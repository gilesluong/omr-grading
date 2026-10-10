import { Choice, Point, SheetGeometry } from "../omr/types";
import { applyHomography, computeHomography, Matrix3x3 } from "./homography";
import {
  BubbleDetectionResult,
  CornerPoints,
  QuestionDetectionResult,
  ScanResult,
} from "./types";

const CHOICES: Choice[] = ["A", "B", "C", "D"];

/**
 * Gets luminance of pixel at (x, y) in ImageData.
 */
function getPixelLuminance(imageData: ImageData, x: number, y: number): number {
  const px = Math.round(x);
  const py = Math.round(y);

  if (px < 0 || px >= imageData.width || py < 0 || py >= imageData.height) {
    return 255;
  }

  const index = (py * imageData.width + px) * 4;
  const r = imageData.data[index];
  const g = imageData.data[index + 1];
  const b = imageData.data[index + 2];

  // Standard luminance conversion
  return 0.299 * r + 0.587 * g + 0.114 * b;
}

/**
 * Least-squares plane fit z = a + b*x + c*y through the background-ring samples,
 * evaluated at the origin (the bubble centre). Returns the intercept, or 0 when
 * the fit is degenerate. This estimates what bare paper would read like at the
 * bubble's own position, so a lighting gradient across the sampled patch is not
 * mistaken for ink.
 */
function fitPlaneAtCenter(points: Array<{ x: number; y: number; v: number }>): number {
  if (points.length < 3) return 0;
  let s1 = 0, sx = 0, sy = 0, sxx = 0, sxy = 0, syy = 0, sz = 0, sxz = 0, syz = 0;
  for (const p of points) {
    s1 += 1;
    sx += p.x;
    sy += p.y;
    sxx += p.x * p.x;
    sxy += p.x * p.y;
    syy += p.y * p.y;
    sz += p.v;
    sxz += p.x * p.v;
    syz += p.y * p.v;
  }
  // Normal equations for [a, b, c]; solve by Gaussian elimination with pivoting.
  const M = [
    [s1, sx, sy, sz],
    [sx, sxx, sxy, sxz],
    [sy, sxy, syy, syz],
  ];
  for (let i = 0; i < 3; i++) {
    let pivot = i;
    for (let k = i + 1; k < 3; k++) if (Math.abs(M[k][i]) > Math.abs(M[pivot][i])) pivot = k;
    [M[i], M[pivot]] = [M[pivot], M[i]];
    if (Math.abs(M[i][i]) < 1e-9) return 0;
    for (let k = i + 1; k < 3; k++) {
      const factor = M[k][i] / M[i][i];
      for (let j = i; j < 4; j++) M[k][j] -= factor * M[i][j];
    }
  }
  const c = M[2][3] / M[2][2];
  const b = (M[1][3] - M[1][2] * c) / M[1][1];
  const a = (M[0][3] - M[0][1] * b - M[0][2] * c) / M[0][0];
  return Number.isFinite(a) && a > 0 ? a : 0;
}

/**
 * Samples a circular region and estimates fill ratio compared to local paper background.
 */
function sampleBubbleFill(
  imageData: ImageData,
  center: Point,
  radiusMm: number,
  H: Matrix3x3,
): { fillRatio: number; isMarked: boolean } {
  const inside: number[] = [];
  const ring: Array<{ x: number; y: number; v: number }> = [];
  // Sample in paper coordinates, then project every point. A single pixel radius
  // cannot describe ellipses or the change in scale down a tilted page.
  for (let y = -3.2; y <= 3.2; y += 0.32) {
    for (let x = -3.2; x <= 3.2; x += 0.32) {
      const distance = Math.hypot(x, y);
      const inner = distance <= radiusMm * 0.85;
      const outer = distance >= 2.8 && distance <= 3.2;
      if (!inner && !outer) continue;
      const point = applyHomography(H, { x: center.x + x, y: center.y + y });
      if (
        point.x < 0 ||
        point.y < 0 ||
        point.x >= imageData.width ||
        point.y >= imageData.height
      ) {
        throw new Error(
          "Part of the answer grid is outside the photo. Include the entire sheet.",
        );
      }
      const value = getPixelLuminance(imageData, point.x, point.y);
      if (inner) inside.push(value);
      else ring.push({ x, y, v: value });
    }
  }

  // Reference paper brightness AT THE BUBBLE CENTRE.
  //
  // The ring sits ~2.8-3.2mm out, so simply comparing the interior to a ring
  // quantile bakes the lighting gradient into the result: whenever brightness
  // falls off across those ~6mm (shadow, vignette, uneven classroom light) the
  // interior looks darker than the ring even with no ink at all, which invented
  // an answer on a completely blank sheet. Fitting a plane to the ring and
  // evaluating it at the centre removes that bias while staying noise-robust
  // (a mean would too, but it cannot follow the gradient).
  const paper = fitPlaneAtCenter(ring) || 1;

  const insideMean = inside.reduce((sum, v) => sum + v, 0) / (inside.length || 1);
  const darkness =
    inside.filter((value) => value < paper * 0.72).length / (inside.length || 1);
  const fillRatio = Math.min(
    1,
    Math.max(darkness, Math.max(0, (paper - insideMean) / paper) * 1.2),
  );
  return {
    fillRatio: Number(fillRatio.toFixed(3)),
    isMarked: fillRatio >= 0.25,
  };
}

/**
 * Executes OMR detection on a captured image frame using canonical SheetGeometry.
 */
export function processOMRSheet(
  imageData: ImageData,
  geometry: SheetGeometry,
  corners: CornerPoints,
): ScanResult {
  // Check if detected image corners match a half-sheet (double-printed on A4)
  const dxTop = corners.tr.x - corners.tl.x;
  const dyTop = corners.tr.y - corners.tl.y;
  const topWidth = Math.hypot(dxTop, dyTop);

  const dxLeft = corners.bl.x - corners.tl.x;
  const dyLeft = corners.bl.y - corners.tl.y;
  const leftHeight = Math.hypot(dxLeft, dyLeft);

  const detectedAspect = leftHeight / (topWidth || 1);
  const activeGeometry =
    geometry.halfSheetGeometry && detectedAspect < 0.85
      ? geometry.halfSheetGeometry
      : geometry;

  // 1. Map canonical registration markers to image corner points
  const tlMarker = activeGeometry.markers.find((m) => m.id === "TL")!;
  const trMarker = activeGeometry.markers.find((m) => m.id === "TR")!;
  const brMarker = activeGeometry.markers.find((m) => m.id === "BR")!;
  const blMarker = activeGeometry.markers.find((m) => m.id === "BL")!;

  const canonicalMarkers: [Point, Point, Point, Point] = [
    tlMarker.center,
    trMarker.center,
    brMarker.center,
    blMarker.center,
  ];

  const imageCorners: [Point, Point, Point, Point] = [
    corners.tl,
    corners.tr,
    corners.br,
    corners.bl,
  ];

  // 2. Solve homography matrix
  const H: Matrix3x3 = computeHomography(canonicalMarkers, imageCorners);

  // 4. Evaluate each question
  const answers: Record<number, QuestionDetectionResult> = {};
  let answeredCount = 0;
  let blankCount = 0;
  let multipleCount = 0;

  activeGeometry.questions.forEach((q) => {
    const choicesRecord: Partial<Record<Choice, BubbleDetectionResult>> = {};
    const rawChoices: Array<{ choice: Choice; fillRatio: number }> = [];

    CHOICES.forEach((choice) => {
      const bubbleGeom = q.bubbles[choice];
      const { fillRatio } = sampleBubbleFill(
        imageData,
        bubbleGeom.center,
        bubbleGeom.detectionRadius,
        H,
      );

      rawChoices.push({ choice, fillRatio });
    });

    // OMRChecker-inspired Relative Question-Strip Separation:
    // Evaluate distribution of darkness across choices in this specific question strip
    const sorted = [...rawChoices].sort((a, b) => b.fillRatio - a.fillRatio);
    const top = sorted[0];
    const runnerUp = sorted[1];
    const margin = Number((top.fillRatio - runnerUp.fillRatio).toFixed(3));

    let detectedChoice: Choice | "BLANK" | "MULTIPLE";
    const markedChoices: Choice[] = [];

    // Decision Logic:
    // 1. Conflict / Multiple Marks: two or more bubbles are filled with low separation
    if (
      runnerUp.fillRatio >= 0.28 ||
      (top.fillRatio >= 0.2 && runnerUp.fillRatio >= 0.18 && margin < 0.08)
    ) {
      detectedChoice = "MULTIPLE";
      multipleCount++;
      sorted
        .filter((c) => c.fillRatio >= 0.18)
        .forEach((c) => markedChoices.push(c.choice));
    }
    // 2. Clear Intentional Mark (handles faint 2B pencil, pen marks, and imperfect erasures):
    else if (
      (top.fillRatio >= 0.09 && margin >= 0.06) ||
      (top.fillRatio >= 0.14 && margin >= 0.04) ||
      (top.fillRatio >= 0.22 && margin >= 0.03)
    ) {
      detectedChoice = top.choice;
      markedChoices.push(top.choice);
      answeredCount++;
    }
    // 3. Unmarked / Blank
    else {
      detectedChoice = "BLANK";
      blankCount++;
    }

    // Populate choicesRecord with isMarked status
    rawChoices.forEach(({ choice, fillRatio }) => {
      choicesRecord[choice] = {
        choice,
        fillRatio,
        isMarked: markedChoices.includes(choice),
      };
    });

    // Confidence metric (0-100%): based on separation margin and fill darkness
    const confidence =
      detectedChoice === "BLANK"
        ? 100
        : detectedChoice === "MULTIPLE"
          ? 50
          : Math.min(
              100,
              Math.round((top.fillRatio * 0.4 + margin * 0.6) * 120),
            );

    answers[q.question] = {
      question: q.question,
      detectedChoice,
      choices: choicesRecord as Record<Choice, BubbleDetectionResult>,
      confidence,
      margin,
    };
  });

  return {
    id: `scan_${Date.now()}_${Math.random().toString(36).substring(2, 7)}`,
    timestamp: new Date().toISOString(),
    templateId: geometry.template,
    totalQuestions: geometry.questions.length,
    answers,
    summary: {
      answered: answeredCount,
      blank: blankCount,
      multiple: multipleCount,
    },
  };
}
