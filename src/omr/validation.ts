import { SheetGeometry, TemplateConfig } from './types';
import { generateGeometry } from './geometry';

export interface ValidationResult {
  valid: boolean;
  errors: string[];
}

/**
 * Checks if two bounding boxes intersect with each other.
 */
function boxesIntersect(
  b1: { x: number; y: number; width: number; height: number },
  b2: { x: number; y: number; width: number; height: number }
): boolean {
  return !(
    b1.x + b1.width <= b2.x ||
    b2.x + b2.width <= b1.x ||
    b1.y + b1.height <= b2.y ||
    b2.y + b2.height <= b1.y
  );
}

/**
 * Validates an OMR SheetGeometry according to protocol specifications.
 */
export function validateGeometry(geometry: SheetGeometry): ValidationResult {
  const errors: string[] = [];

  // 1. Exactly four registration markers
  if (geometry.markers.length !== 4) {
    errors.push(`Expected exactly 4 registration markers, found ${geometry.markers.length}`);
  }

  const expectedMarkerIds = new Set(['TL', 'TR', 'BL', 'BR']);
  geometry.markers.forEach((marker) => {
    if (!expectedMarkerIds.has(marker.id)) {
      errors.push(`Unexpected marker ID: ${marker.id}`);
    }
  });

  // 2. Marker dimensions & placement
  geometry.markers.forEach((marker) => {
    if (marker.width !== 8 || marker.height !== 8) {
      errors.push(`Marker ${marker.id} dimensions must be 8x8mm, found ${marker.width}x${marker.height}mm`);
    }
    // Must be inside page
    if (
      marker.bounds.x < 0 ||
      marker.bounds.x + marker.bounds.width > geometry.page.width ||
      marker.bounds.y < 0 ||
      marker.bounds.y + marker.bounds.height > geometry.page.height
    ) {
      errors.push(`Marker ${marker.id} extends outside page bounds`);
    }
  });

  // 3. Question count & sequential numbering
  const questions = geometry.questions;
  const expectedCount = parseInt(geometry.template.replace('MCQ', ''), 10);

  if (questions.length !== expectedCount) {
    errors.push(`Expected ${expectedCount} questions, found ${questions.length}`);
  }

  questions.forEach((q, idx) => {
    const expectedNum = idx + 1;
    if (q.question !== expectedNum) {
      errors.push(`Question numbering gap: expected ${expectedNum}, got ${q.question}`);
    }

    // Exactly four bubbles per question
    const choices = Object.keys(q.bubbles) as Array<'A' | 'B' | 'C' | 'D'>;
    if (choices.length !== 4) {
      errors.push(`Question ${q.question} does not have 4 bubbles (has ${choices.length})`);
    }

    const expectedChoices = ['A', 'B', 'C', 'D'];
    expectedChoices.forEach((c) => {
      if (!q.bubbles[c as 'A' | 'B' | 'C' | 'D']) {
        errors.push(`Question ${q.question} missing bubble ${c}`);
      }
    });
  });

  // 4. Safe page bounds and bubble overlap checks
  const allBubbles: Array<{ qNum: number; choice: string; x: number; y: number; r: number; detR: number }> = [];

  questions.forEach((q) => {
    Object.values(q.bubbles).forEach((b) => {
      allBubbles.push({
        qNum: q.question,
        choice: b.choice,
        x: b.center.x,
        y: b.center.y,
        r: b.radius,
        detR: b.detectionRadius,
      });

      // Safe bounds check
      const leftEdge = b.center.x - b.radius;
      const rightEdge = b.center.x + b.radius + b.labelOffset.x;
      const topEdge = b.center.y - b.radius;
      const bottomEdge = b.center.y + b.radius;

      if (
        leftEdge < geometry.page.safeMargins.left ||
        rightEdge > geometry.page.safeMargins.right ||
        topEdge < geometry.page.safeMargins.top ||
        bottomEdge > geometry.page.safeMargins.bottom
      ) {
        errors.push(
          `Bubble Q${q.question}-${b.choice} extends outside safe margins: center=(${b.center.x}, ${b.center.y})`
        );
      }
    });
  });

  // Check pairwise bubble non-overlap and minimum detection clearance
  for (let i = 0; i < allBubbles.length; i++) {
    for (let j = i + 1; j < allBubbles.length; j++) {
      const b1 = allBubbles[i];
      const b2 = allBubbles[j];
      const dx = b1.x - b2.x;
      const dy = b1.y - b2.y;
      const dist = Math.sqrt(dx * dx + dy * dy);
      const minDistance = b1.r + b2.r;

      if (dist < minDistance) {
        errors.push(
          `Bubbles overlap: Q${b1.qNum}-${b1.choice} and Q${b2.qNum}-${b2.choice} (dist=${dist.toFixed(2)}mm, min=${minDistance}mm)`
        );
      }

      // Ensure detection regions have safe separation
      const detectionClearance = dist - (b1.detR + b2.detR);
      if (detectionClearance < 1.0) {
        errors.push(
          `Detection regions too close: Q${b1.qNum}-${b1.choice} and Q${b2.qNum}-${b2.choice} (clearance=${detectionClearance.toFixed(2)}mm)`
        );
      }
    }
  }

  // 5. Registration markers do not overlap with content
  geometry.markers.forEach((marker) => {
    // Check overlap with QR code
    if (boxesIntersect(marker.bounds, geometry.qr.bounds)) {
      errors.push(`Marker ${marker.id} overlaps with QR code`);
    }

    // Check overlap with question bounds
    questions.forEach((q) => {
      if (boxesIntersect(marker.bounds, q.bounds)) {
        errors.push(`Marker ${marker.id} overlaps with Question ${q.question} bounds`);
      }
    });
  });

  // 6. QR Code within bounds
  if (
    geometry.qr.bounds.x < 0 ||
    geometry.qr.bounds.x + geometry.qr.bounds.width > geometry.page.width ||
    geometry.qr.bounds.y < 0 ||
    geometry.qr.bounds.y + geometry.qr.bounds.height > geometry.page.height
  ) {
    errors.push('QR code extends outside page bounds');
  }

  return {
    valid: errors.length === 0,
    errors,
  };
}

/**
 * Validates that running geometry generation multiple times is bit-exact deterministic.
 */
export function validateDeterminism(config: TemplateConfig): boolean {
  const g1 = generateGeometry(config);
  const g2 = generateGeometry(config);

  return JSON.stringify(g1) === JSON.stringify(g2);
}
