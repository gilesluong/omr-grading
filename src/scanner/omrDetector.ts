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

  // Standard Rec. 601 luminance
  return 0.299 * r + 0.587 * g + 0.114 * b;
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
  const background: number[] = [];
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
      (inner ? inside : background).push(value);
    }
  }
  // The old background ring crossed the printed circle. Use paper outside it
  // and a bright quantile so nearby choice labels do not darken the reference.
  background.sort((a, b) => a - b);
  const paper = background[Math.floor(background.length * 0.75)] || 1;
  const average = inside.reduce((sum, value) => sum + value, 0) / inside.length;
  const darkness =
    inside.filter((value) => value < paper * 0.72).length / inside.length;
  const fillRatio = Math.min(
    1,
    Math.max(darkness, Math.max(0, (paper - average) / paper) * 1.2),
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
      top.fillRatio >= 0.16 &&
      (margin >= 0.08 || (top.fillRatio >= 0.22 && margin >= 0.05))
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
