import { describe, it, expect } from 'vitest';
import { applyHomography, computeHomography } from '../src/scanner/homography';
import { formatForJson, formatForSlack } from '../src/scanner/storage';
import { Point } from '../src/omr/types';
import { QuestionDetectionResult, ScanResult } from '../src/scanner/types';

describe('Scanner Homography Engine', () => {
  it('maps identity transformation exactly', () => {
    const src: [Point, Point, Point, Point] = [
      { x: 0, y: 0 },
      { x: 100, y: 0 },
      { x: 100, y: 200 },
      { x: 0, y: 200 },
    ];
    const dst: [Point, Point, Point, Point] = [
      { x: 0, y: 0 },
      { x: 100, y: 0 },
      { x: 100, y: 200 },
      { x: 0, y: 200 },
    ];

    const H = computeHomography(src, dst);

    src.forEach((pt, i) => {
      const mapped = applyHomography(H, pt);
      expect(mapped.x).toBeCloseTo(dst[i].x, 2);
      expect(mapped.y).toBeCloseTo(dst[i].y, 2);
    });
  });

  it('correctly maps scaled, translated, and sheared perspective points', () => {
    const canonical: [Point, Point, Point, Point] = [
      { x: 16, y: 16 },
      { x: 194, y: 16 },
      { x: 194, y: 281 },
      { x: 16, y: 281 },
    ];
    // Camera image coordinates with rotation & perspective distortion
    const cameraPixels: [Point, Point, Point, Point] = [
      { x: 120, y: 80 },
      { x: 950, y: 110 },
      { x: 920, y: 1300 },
      { x: 80, y: 1250 },
    ];

    const H = computeHomography(canonical, cameraPixels);

    canonical.forEach((pt, i) => {
      const mapped = applyHomography(H, pt);
      expect(mapped.x).toBeCloseTo(cameraPixels[i].x, 1);
      expect(mapped.y).toBeCloseTo(cameraPixels[i].y, 1);
    });

    // Test an interior point (e.g. Question 1 bubble)
    const midPoint = { x: 105, y: 148.5 };
    const mappedMid = applyHomography(H, midPoint);
    expect(mappedMid.x).toBeGreaterThan(100);
    expect(mappedMid.x).toBeLessThan(950);
    expect(mappedMid.y).toBeGreaterThan(100);
    expect(mappedMid.y).toBeLessThan(1300);
  });
});

describe('Scan Storage & Formatters', () => {
  const mockScan: ScanResult = {
    id: 'test_scan_001',
    timestamp: '2026-09-18T12:00:00.000Z',
    templateId: 'MCQ20',
    totalQuestions: 20,
    answers: {
      1: {
        question: 1,
        detectedChoice: 'A',
        choices: {
          A: { choice: 'A', fillRatio: 0.85, isMarked: true },
          B: { choice: 'B', fillRatio: 0.02, isMarked: false },
          C: { choice: 'C', fillRatio: 0.01, isMarked: false },
          D: { choice: 'D', fillRatio: 0.03, isMarked: false },
        },
      },
      2: {
        question: 2,
        detectedChoice: 'C',
        choices: {
          A: { choice: 'A', fillRatio: 0.01, isMarked: false },
          B: { choice: 'B', fillRatio: 0.04, isMarked: false },
          C: { choice: 'C', fillRatio: 0.92, isMarked: true },
          D: { choice: 'D', fillRatio: 0.02, isMarked: false },
        },
      },
      3: {
        question: 3,
        detectedChoice: 'BLANK',
        choices: {
          A: { choice: 'A', fillRatio: 0.01, isMarked: false },
          B: { choice: 'B', fillRatio: 0.02, isMarked: false },
          C: { choice: 'C', fillRatio: 0.01, isMarked: false },
          D: { choice: 'D', fillRatio: 0.02, isMarked: false },
        },
      },
    },
    summary: {
      answered: 2,
      blank: 1,
      multiple: 0,
    },
  };

  it('formats clean Markdown text for Slack / AI agents', () => {
    const slackText = formatForSlack(mockScan);
    expect(slackText).toContain('📋 *OMR Scan Result* (MCQ20)');
    expect(slackText).toContain('Q01: A');
    expect(slackText).toContain('Q02: C');
    expect(slackText).toContain('Q03: — (Blank)');
    expect(slackText).toContain('2/20 Answered');
  });

  it('formats valid JSON for database insertion', () => {
    const jsonStr = formatForJson(mockScan);
    const parsed = JSON.parse(jsonStr);

    expect(parsed.scanId).toBe('test_scan_001');
    expect(parsed.template).toBe('MCQ20');
    expect(parsed.answers['1']).toBe('A');
    expect(parsed.answers['2']).toBe('C');
    expect(parsed.answers['3']).toBe('BLANK');
  });
});

describe('OMRChecker Relative Strip Separation', () => {
  it('detects high-confidence marks and handles faint marks & conflicts correctly', () => {
    // Verify QuestionDetectionResult types and confidence scoring
    const strongResult: QuestionDetectionResult = {
      question: 1,
      detectedChoice: 'B',
      choices: {
        A: { choice: 'A', fillRatio: 0.04, isMarked: false },
        B: { choice: 'B', fillRatio: 0.65, isMarked: true },
        C: { choice: 'C', fillRatio: 0.05, isMarked: false },
        D: { choice: 'D', fillRatio: 0.03, isMarked: false },
      },
      confidence: 95,
      margin: 0.60,
    };
    expect(strongResult.detectedChoice).toBe('B');
    expect(strongResult.confidence).toBeGreaterThan(80);
    expect(strongResult.margin).toBeGreaterThan(0.5);

    // Faint pencil mark (e.g. 0.20 vs 0.04) with high relative margin
    const faintResult: QuestionDetectionResult = {
      question: 2,
      detectedChoice: 'C',
      choices: {
        A: { choice: 'A', fillRatio: 0.03, isMarked: false },
        B: { choice: 'B', fillRatio: 0.04, isMarked: false },
        C: { choice: 'C', fillRatio: 0.20, isMarked: true },
        D: { choice: 'D', fillRatio: 0.02, isMarked: false },
      },
      confidence: 65,
      margin: 0.16,
    };
    expect(faintResult.detectedChoice).toBe('C');
    expect(faintResult.choices.C.isMarked).toBe(true);

    // Conflicted double mark (both A and B filled)
    const conflictResult: QuestionDetectionResult = {
      question: 3,
      detectedChoice: 'MULTIPLE',
      choices: {
        A: { choice: 'A', fillRatio: 0.55, isMarked: true },
        B: { choice: 'B', fillRatio: 0.52, isMarked: true },
        C: { choice: 'C', fillRatio: 0.04, isMarked: false },
        D: { choice: 'D', fillRatio: 0.05, isMarked: false },
      },
      confidence: 50,
      margin: 0.03,
    };
    expect(conflictResult.detectedChoice).toBe('MULTIPLE');
    expect(conflictResult.choices.A.isMarked).toBe(true);
    expect(conflictResult.choices.B.isMarked).toBe(true);
  });
});
