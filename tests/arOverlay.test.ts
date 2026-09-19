import { describe, expect, it } from 'vitest';
import { generateGeometry } from '../src/omr/geometry';
import { TEMPLATES } from '../src/omr/templates';
import { computeARBubbleOverlays } from '../src/scanner/arOverlay';
import { CornerPoints, ScanResult } from '../src/scanner/types';
import { gradeExam } from '../src/scanner/grading';

describe('AR Bubble Overlay Engine', () => {
  it('computes green correct dots and red incorrect dots with screen coordinates', () => {
    const geometry = generateGeometry(TEMPLATES['MCQ10']);
    const canvasWidth = 800;
    const canvasHeight = 1000;

    // Simulate corners centered with 10% padding
    const corners: CornerPoints = {
      tl: { x: 80, y: 80 },
      tr: { x: 720, y: 80 },
      br: { x: 720, y: 920 },
      bl: { x: 80, y: 920 },
    };

    // Simulated scan result: Q1 is A, Q2 is B, Q3 is BLANK
    const scanResult: ScanResult = {
      id: 'test-scan-1',
      timestamp: new Date().toISOString(),
      templateId: 'MCQ10',
      totalQuestions: 10,
      answers: {
        1: { question: 1, detectedChoice: 'A', choices: {} as any },
        2: { question: 2, detectedChoice: 'B', choices: {} as any },
        3: { question: 3, detectedChoice: 'BLANK', choices: {} as any },
      },
      summary: { answered: 2, blank: 8, multiple: 0 },
    };

    // Master answer key: Q1 is A (correct), Q2 is C (student picked B => incorrect), Q3 is D (skipped)
    const masterKey = {
      1: 'A' as const,
      2: 'C' as const,
      3: 'D' as const,
    };
    const score = gradeExam(scanResult, masterKey);

    const { overlays } = computeARBubbleOverlays(
      corners,
      canvasWidth,
      canvasHeight,
      geometry,
      scanResult,
      score
    );

    // Q1 should have a 'correct' overlay for A
    const q1Overlay = overlays.find((o) => o.question === 1 && o.choice === 'A');
    expect(q1Overlay).toBeDefined();
    expect(q1Overlay?.type).toBe('correct');
    expect(q1Overlay?.xPct).toBeGreaterThan(0);
    expect(q1Overlay?.xPct).toBeLessThan(100);
    expect(q1Overlay?.yPct).toBeGreaterThan(0);
    expect(q1Overlay?.yPct).toBeLessThan(100);

    // Q2 should have an 'incorrect' overlay for student's choice B
    const q2Wrong = overlays.find((o) => o.question === 2 && o.choice === 'B');
    expect(q2Wrong).toBeDefined();
    expect(q2Wrong?.type).toBe('incorrect');

    // Q2 should also have a 'target' overlay for correct choice C
    const q2Target = overlays.find((o) => o.question === 2 && o.choice === 'C');
    expect(q2Target).toBeDefined();
    expect(q2Target?.type).toBe('target');

    // Q3 should have a 'target' overlay for correct choice D (skipped)
    const q3Target = overlays.find((o) => o.question === 3 && o.choice === 'D');
    expect(q3Target).toBeDefined();
    expect(q3Target?.type).toBe('target');
  });

  it('handles half-sheet geometry correctly when aspect ratio is half-sheet', () => {
    const geometry = generateGeometry(TEMPLATES['MCQ20']);
    const canvasWidth = 840;
    const canvasHeight = 594; // Half-sheet landscape aspect

    const corners: CornerPoints = {
      tl: { x: 64, y: 40 },
      tr: { x: 776, y: 40 },
      br: { x: 776, y: 554 },
      bl: { x: 64, y: 554 },
    };

    const scanResult: ScanResult = {
      id: 'test-scan-half',
      timestamp: new Date().toISOString(),
      templateId: 'MCQ20',
      totalQuestions: 20,
      answers: {
        1: { question: 1, detectedChoice: 'A', choices: {} as any },
      },
      summary: { answered: 1, blank: 19, multiple: 0 },
    };

    const score = gradeExam(scanResult, { 1: 'A' });
    const { overlays, activeGeometry } = computeARBubbleOverlays(
      corners,
      canvasWidth,
      canvasHeight,
      geometry,
      scanResult,
      score
    );

    expect(activeGeometry.page.height).toBe(148.5);
    const q1Overlay = overlays.find((o) => o.question === 1 && o.choice === 'A');
    expect(q1Overlay).toBeDefined();
    expect(q1Overlay?.type).toBe('correct');
  });
});
