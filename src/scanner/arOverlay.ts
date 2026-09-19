import { Choice, Point, SheetGeometry } from '../omr/types';
import { applyHomography, computeHomography } from './homography';
import { CornerPoints, ScanResult } from './types';
import { ExamScore } from './grading';

export interface ARBubbleOverlay {
  id: string;
  type: 'correct' | 'incorrect' | 'target';
  question: number;
  choice: Choice;
  xPct: number;
  yPct: number;
  radiusPct: number;
}

export function computeARBubbleOverlays(
  corners: CornerPoints,
  canvasWidth: number,
  canvasHeight: number,
  geometry: SheetGeometry,
  scanResult: ScanResult,
  examScore: ExamScore | null
): {
  overlays: ARBubbleOverlay[];
  activeGeometry: SheetGeometry;
} {
  // Check if detected image corners match a half-sheet
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

  const tlMarker = activeGeometry.markers.find((m) => m.id === 'TL')!;
  const trMarker = activeGeometry.markers.find((m) => m.id === 'TR')!;
  const brMarker = activeGeometry.markers.find((m) => m.id === 'BR')!;
  const blMarker = activeGeometry.markers.find((m) => m.id === 'BL')!;

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

  const H = computeHomography(canonicalMarkers, imageCorners);

  // Estimate bubble visual radius in percentage of screen
  const sampleQ = activeGeometry.questions[0];
  let radiusPct = 1.6;
  if (sampleQ?.bubbles?.A) {
    const center = sampleQ.bubbles.A.center;
    const rMm = sampleQ.bubbles.A.radius || 2.3;
    const pCenter = applyHomography(H, center);
    const pEdge = applyHomography(H, { x: center.x + rMm, y: center.y });
    const distPx = Math.hypot(pEdge.x - pCenter.x, pEdge.y - pCenter.y);
    radiusPct = Math.min(3.5, Math.max(1.0, (distPx / (canvasWidth || 1)) * 100));
  }

  const overlays: ARBubbleOverlay[] = [];

  for (const q of activeGeometry.questions) {
    const qNum = q.question;
    const detected = scanResult.answers[qNum];
    const scoreItem = examScore?.results?.[qNum];
    const detectedChoice = detected?.detectedChoice;
    const isCorrect = scoreItem?.isCorrect ?? false;
    const correctChoice = scoreItem?.correctChoice;

    if (detectedChoice && detectedChoice !== 'BLANK' && detectedChoice !== 'MULTIPLE') {
      const bubble = q.bubbles[detectedChoice as Choice];
      if (bubble) {
        const ptPx = applyHomography(H, bubble.center);
        const xPct = Number(((ptPx.x / (canvasWidth || 1)) * 100).toFixed(2));
        const yPct = Number(((ptPx.y / (canvasHeight || 1)) * 100).toFixed(2));

        overlays.push({
          id: `q${qNum}-${detectedChoice}-${isCorrect ? 'c' : 'i'}`,
          type: isCorrect ? 'correct' : 'incorrect',
          question: qNum,
          choice: detectedChoice as Choice,
          xPct,
          yPct,
          radiusPct: Number(radiusPct.toFixed(2)),
        });
      }
    }

    // If incorrect or blank, and a valid correct choice is known, show a target marker on the correct answer
    if (!isCorrect && correctChoice) {
      const targetBubble = q.bubbles[correctChoice];
      if (targetBubble) {
        const ptPx = applyHomography(H, targetBubble.center);
        const xPct = Number(((ptPx.x / (canvasWidth || 1)) * 100).toFixed(2));
        const yPct = Number(((ptPx.y / (canvasHeight || 1)) * 100).toFixed(2));

        overlays.push({
          id: `q${qNum}-${correctChoice}-target`,
          type: 'target',
          question: qNum,
          choice: correctChoice as Choice,
          xPct,
          yPct,
          radiusPct: Number(radiusPct.toFixed(2)),
        });
      }
    }
  }

  return { overlays, activeGeometry };
}
