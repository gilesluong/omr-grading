import { describe, it, expect } from 'vitest';
import {
  formatBatchExport,
  detectFlaggedQuestions,
  calculateBatchItemConfidence,
  BatchItem,
} from '../src/scanner/batch';
import { ScanResult } from '../src/scanner/types';
import { ExamScore } from '../src/scanner/grading';

describe('Batch Processing & Schema v1 Export', () => {
  const mockScan: ScanResult = {
    id: 'scan_01',
    timestamp: '2026-10-05T12:00:00.000Z',
    templateId: 'MCQ20',
    totalQuestions: 4,
    studentName: 'Student 101',
    testId: 'Unit-04',
    className: 'Class-A',
    answers: {
      1: { question: 1, detectedChoice: 'A', choices: {} as any, confidence: 98, margin: 0.25 },
      2: { question: 2, detectedChoice: 'BLANK', choices: {} as any, confidence: 50, margin: 0.02 },
      3: { question: 3, detectedChoice: 'MULTIPLE', choices: {} as any, confidence: 40, margin: 0.01 },
      4: { question: 4, detectedChoice: 'B', choices: {} as any, confidence: 75, margin: 0.05 }, // Low margin (< 0.08)
    },
    summary: { answered: 2, blank: 1, multiple: 1 },
  };

  const mockScore: ExamScore = {
    totalQuestions: 4,
    correctCount: 1,
    incorrectCount: 1,
    blankCount: 1,
    multipleCount: 1,
    rawScore: 1,
    maxScore: 4,
    percentage: 25,
    letterGrade: 'F',
    results: {
      1: { question: 1, studentChoice: 'A', correctChoice: 'A', isCorrect: true },
      2: { question: 2, studentChoice: 'BLANK', correctChoice: 'B', isCorrect: false },
      3: { question: 3, studentChoice: 'MULTIPLE', correctChoice: 'C', isCorrect: false },
      4: { question: 4, studentChoice: 'B', correctChoice: 'D', isCorrect: false },
    },
  };

  it('detects blank, multiple, and low-margin questions as flagged', () => {
    const flagged = detectFlaggedQuestions(mockScan, mockScore);
    expect(flagged).toContain(2); // BLANK
    expect(flagged).toContain(3); // MULTIPLE
    expect(flagged).toContain(4); // Margin 0.05 < 0.08
    expect(flagged).not.toContain(1); // Normal clear choice
  });

  it('calculates average item confidence', () => {
    const conf = calculateBatchItemConfidence(mockScan, mockScore);
    expect(conf).toBeGreaterThan(0);
    expect(conf).toBeLessThanOrEqual(1.0);
  });

  it('generates standardized Schema v1 JSON export payload', () => {
    const flagged = detectFlaggedQuestions(mockScan, mockScore);
    const item: BatchItem = {
      id: mockScan.id,
      timestamp: mockScan.timestamp,
      studentId: 'ST-001',
      studentName: 'Alice',
      testId: 'Unit-04',
      className: 'Class-A',
      score: 18,
      maxScore: 20,
      percentage: 90,
      letterGrade: 'A',
      answers: ['A', 'C', 'B', 'D'],
      flaggedQuestions: flagged,
      confidence: 0.95,
      scanResult: mockScan,
      examScore: mockScore,
    };

    const payload = formatBatchExport([item], 'Unit-04', 'Class-A');

    expect(payload.schemaVersion).toBe(1);
    expect(payload.count).toBe(1);
    expect(payload.test).toBe('Unit-04');
    expect(payload.class).toBe('Class-A');
    expect(payload.results.length).toBe(1);

    const r0 = payload.results[0];
    expect(r0.studentId).toBe('ST-001');
    expect(r0.score).toBe(18);
    expect(r0.maxScore).toBe(20);
    expect(r0.answers).toEqual(['A', 'C', 'B', 'D']);
    expect(r0.flaggedQuestions).toEqual(flagged);
    expect(r0.confidence).toBe(0.95);
  });

  it('handles empty batch export gracefully', () => {
    const payload = formatBatchExport([]);
    expect(payload.schemaVersion).toBe(1);
    expect(payload.count).toBe(0);
    expect(payload.results).toEqual([]);
  });
});
