import { describe, it, expect } from 'vitest';
import { TEMPLATES } from '../src/omr/templates';
import { TemplateId } from '../src/omr/types';
import { generateGeometry } from '../src/omr/geometry';
import { validateGeometry, validateDeterminism } from '../src/omr/validation';

describe('OMR Paper Protocol Geometry Engine', () => {
  const templateIds: TemplateId[] = ['MCQ10', 'MCQ20', 'MCQ40', 'MCQ50'];

  it.each(templateIds)('%s passes complete protocol validation', (id) => {
    const config = TEMPLATES[id];
    const geometry = generateGeometry(config);
    const result = validateGeometry(geometry);

    expect(result.errors).toEqual([]);
    expect(result.valid).toBe(true);
  });

  it('generates identical registration markers across all four templates', () => {
    const geometries = templateIds.map((id) => generateGeometry(TEMPLATES[id]));
    const firstMarkers = geometries[0].markers;

    expect(firstMarkers.length).toBe(4);

    geometries.forEach((g) => {
      expect(g.markers.length).toBe(4);
      expect(g.markers).toEqual(firstMarkers);
      // Dimensions must be 8x8mm
      g.markers.forEach((m) => {
        expect(m.width).toBe(8);
        expect(m.height).toBe(8);
      });
      // Center points must be at 16mm from corner edges
      const tl = g.markers.find((m) => m.id === 'TL')!;
      const tr = g.markers.find((m) => m.id === 'TR')!;
      const bl = g.markers.find((m) => m.id === 'BL')!;
      const br = g.markers.find((m) => m.id === 'BR')!;

      expect(tl.center).toEqual({ x: 16, y: 16 });
      expect(tr.center).toEqual({ x: 194, y: 16 });
      expect(bl.center).toEqual({ x: 16, y: 281 });
      expect(br.center).toEqual({ x: 194, y: 281 });
    });
  });

  it.each(templateIds)('%s generates bit-exact deterministic coordinates', (id) => {
    const config = TEMPLATES[id];
    expect(validateDeterminism(config)).toBe(true);
  });

  it.each(templateIds)('%s has strictly sequential question numbering', (id) => {
    const config = TEMPLATES[id];
    const geometry = generateGeometry(config);

    expect(geometry.questions.length).toBe(config.questions);
    geometry.questions.forEach((q, idx) => {
      expect(q.question).toBe(idx + 1);
    });
  });

  it.each(templateIds)('%s has exactly four options (A, B, C, D) per question', (id) => {
    const config = TEMPLATES[id];
    const geometry = generateGeometry(config);

    geometry.questions.forEach((q) => {
      const choices = Object.keys(q.bubbles);
      expect(choices.sort()).toEqual(['A', 'B', 'C', 'D']);

      // Each bubble has consistent radius and detection radius
      Object.values(q.bubbles).forEach((b) => {
        expect(b.radius).toBe(2.3);
        expect(b.detectionRadius).toBe(1.8);
      });
    });
  });

  it.each(templateIds)('%s has no bubbles extending outside safe page margins', (id) => {
    const config = TEMPLATES[id];
    const geometry = generateGeometry(config);
    const { safeMargins } = geometry.page;

    geometry.questions.forEach((q) => {
      Object.values(q.bubbles).forEach((b) => {
        expect(b.center.x - b.radius).toBeGreaterThanOrEqual(safeMargins.left);
        expect(b.center.x + b.radius).toBeLessThanOrEqual(safeMargins.right);
        expect(b.center.y - b.radius).toBeGreaterThanOrEqual(safeMargins.top);
        expect(b.center.y + b.radius).toBeLessThanOrEqual(safeMargins.bottom);
      });
    });
  });

  it.each(templateIds)('%s ensures no bubbles or detection regions overlap', (id) => {
    const config = TEMPLATES[id];
    const geometry = generateGeometry(config);

    const allBubbles = geometry.questions.flatMap((q) => Object.values(q.bubbles));

    for (let i = 0; i < allBubbles.length; i++) {
      for (let j = i + 1; j < allBubbles.length; j++) {
        const b1 = allBubbles[i];
        const b2 = allBubbles[j];
        const dist = Math.hypot(b1.center.x - b2.center.x, b1.center.y - b2.center.y);
        // Bubble circles must not intersect
        expect(dist).toBeGreaterThanOrEqual(b1.radius + b2.radius);
        // Detection ROIs must maintain safe clearance (> 1mm)
        expect(dist - (b1.detectionRadius + b2.detectionRadius)).toBeGreaterThanOrEqual(1.0);
      }
    }
  });

  it.each(templateIds)('%s generates valid micro QR payload with webapp link', (id) => {
    const config = TEMPLATES[id];
    const geometry = generateGeometry(config);

    expect(geometry.qr.payload).toBe('https://gilesluong.github.io/omr-grading');
    expect(geometry.qr.moduleCount).toBeGreaterThan(0);
    expect(geometry.qr.modules.length).toBe(geometry.qr.moduleCount);
    expect(geometry.qr.modules[0].length).toBe(geometry.qr.moduleCount);
  });

  it.each(['MCQ10', 'MCQ20'] as const)(
    '%s generates half-sheet geometry for 2-up double printing',
    (id) => {
      const config = TEMPLATES[id];
      const geometry = generateGeometry(config);

      expect(geometry.halfSheetGeometry).toBeDefined();
      const half = geometry.halfSheetGeometry!;
      expect(half.page.height).toBe(148.5);
      expect(half.markers.length).toBe(4);
      expect(half.questions.length).toBe(config.questions);

      const tl = half.markers.find((m) => m.id === 'TL')!;
      const tr = half.markers.find((m) => m.id === 'TR')!;
      const bl = half.markers.find((m) => m.id === 'BL')!;
      const br = half.markers.find((m) => m.id === 'BR')!;

      expect(tl.center).toEqual({ x: 16, y: 10 });
      expect(tr.center).toEqual({ x: 194, y: 10 });
      expect(bl.center).toEqual({ x: 16, y: 138.5 });
      expect(br.center).toEqual({ x: 194, y: 138.5 });
    }
  );

  it.each(['MCQ40', 'MCQ50'] as const)(
    '%s does not generate half-sheet geometry because it exceeds half A4 page',
    (id) => {
      const config = TEMPLATES[id];
      const geometry = generateGeometry(config);
      expect(geometry.halfSheetGeometry).toBeUndefined();
    }
  );

  it('maintains visible space between bubble circle edge and choice letter', () => {
    const geometry = generateGeometry(TEMPLATES['MCQ20']);
    const bubble = geometry.questions[0].bubbles.A;
    const clearance = bubble.labelOffset.x - bubble.radius;
    expect(clearance).toBeGreaterThanOrEqual(1.8);
  });
});
