import { describe, it, expect } from 'vitest';
import {
  generateDefaultKey,
  getLetterGrade,
  gradeExam,
  formatGradedSlackMessage,
  parseAnswerKeyInput,
} from '../src/scanner/grading';
import { generateGradebookCsv } from '../src/export/csvExport';
import { ScanResult } from '../src/scanner/types';
import { detectRegistrationMarkers } from '../src/scanner/markerDetector';
import { CornerPoints } from '../src/scanner/types';

describe('Grading Engine', () => {
  it('generates cyclical default answer keys', () => {
    const key = generateDefaultKey(10);
    expect(Object.keys(key).length).toBe(10);
    expect(key[1]).toBe('A');
    expect(key[2]).toBe('B');
    expect(key[3]).toBe('C');
    expect(key[4]).toBe('D');
    expect(key[5]).toBe('A');
  });

  it('accurately calculates percentage and letter grades', () => {
    expect(getLetterGrade(100)).toBe('A');
    expect(getLetterGrade(90)).toBe('A');
    expect(getLetterGrade(85)).toBe('B');
    expect(getLetterGrade(75)).toBe('C');
    expect(getLetterGrade(62)).toBe('D');
    expect(getLetterGrade(45)).toBe('F');
  });

  it('correctly grades an exam with mixed correct and incorrect answers', () => {
    const mockScan: ScanResult = {
      id: 'scan_grade_01',
      timestamp: '2026-09-18T12:00:00.000Z',
      templateId: 'MCQ10',
      totalQuestions: 10,
      answers: {
        1: { question: 1, detectedChoice: 'A', choices: {} as any }, // Correct
        2: { question: 2, detectedChoice: 'B', choices: {} as any }, // Correct
        3: { question: 3, detectedChoice: 'A', choices: {} as any }, // Incorrect (Key is C)
        4: { question: 4, detectedChoice: 'D', choices: {} as any }, // Correct
        5: { question: 5, detectedChoice: 'BLANK', choices: {} as any }, // Blank (Key is A)
        6: { question: 6, detectedChoice: 'B', choices: {} as any }, // Correct
        7: { question: 7, detectedChoice: 'C', choices: {} as any }, // Correct
        8: { question: 8, detectedChoice: 'D', choices: {} as any }, // Correct
        9: { question: 9, detectedChoice: 'A', choices: {} as any }, // Correct
        10: { question: 10, detectedChoice: 'B', choices: {} as any }, // Correct
      },
      summary: { answered: 9, blank: 1, multiple: 0 },
    };

    const key = generateDefaultKey(10);
    const score = gradeExam(mockScan, key);

    // 8 out of 10 correct = 80.0% = Grade B
    expect(score.correctCount).toBe(8);
    expect(score.incorrectCount).toBe(1);
    expect(score.blankCount).toBe(1);
    expect(score.percentage).toBe(80.0);
    expect(score.letterGrade).toBe('B');

    expect(score.results[1].isCorrect).toBe(true);
    expect(score.results[3].isCorrect).toBe(false);
    expect(score.results[3].correctChoice).toBe('C');
    expect(score.results[5].studentChoice).toBe('BLANK');
  });

  it('correctly applies negative marking penalty when configured', () => {
    const mockScan: ScanResult = {
      id: 'scan_grade_penalty',
      timestamp: '2026-09-18T12:00:00.000Z',
      templateId: 'MCQ10',
      totalQuestions: 10,
      answers: {
        1: { question: 1, detectedChoice: 'A', choices: {} as any }, // Correct
        2: { question: 2, detectedChoice: 'B', choices: {} as any }, // Correct
        3: { question: 3, detectedChoice: 'A', choices: {} as any }, // Wrong (Key C)
        4: { question: 4, detectedChoice: 'BLANK', choices: {} as any }, // Blank (Key D)
        5: { question: 5, detectedChoice: 'A', choices: {} as any }, // Correct
        6: { question: 6, detectedChoice: 'B', choices: {} as any }, // Correct
        7: { question: 7, detectedChoice: 'C', choices: {} as any }, // Correct
        8: { question: 8, detectedChoice: 'D', choices: {} as any }, // Correct
        9: { question: 9, detectedChoice: 'A', choices: {} as any }, // Correct
        10: { question: 10, detectedChoice: 'B', choices: {} as any }, // Correct
      },
      summary: { answered: 9, blank: 1, multiple: 0 },
    };

    const key = generateDefaultKey(10);
    // 8 correct, 1 wrong, 1 blank
    // With -0.25 penalty: Raw score = 8 - 0.25 = 7.75. Percentage = 77.5% -> Grade C
    const scoreWithPenalty = gradeExam(mockScan, key, {
      correctPoints: 1,
      incorrectPenalty: 0.25,
      blankPenalty: 0,
    });

    expect(scoreWithPenalty.correctCount).toBe(8);
    expect(scoreWithPenalty.incorrectCount).toBe(1);
    expect(scoreWithPenalty.rawScore).toBe(7.75);
    expect(scoreWithPenalty.maxScore).toBe(10);
    expect(scoreWithPenalty.percentage).toBe(77.5);
    expect(scoreWithPenalty.letterGrade).toBe('C');
  });

  it('formats Slack message with grade percentage and mistakes', () => {
    const mockScan: ScanResult = {
      id: 'scan_slack_01',
      timestamp: '2026-09-18T12:00:00.000Z',
      templateId: 'MCQ10',
      totalQuestions: 10,
      answers: {
        1: { question: 1, detectedChoice: 'A', choices: {} as any },
        2: { question: 2, detectedChoice: 'C', choices: {} as any }, // Incorrect (Key B)
      },
      summary: { answered: 2, blank: 8, multiple: 0 },
    };
    const key = generateDefaultKey(10);
    const score = gradeExam(mockScan, key);
    const slackText = formatGradedSlackMessage(mockScan, score, 'Alice');

    expect(slackText).toContain('Alice');
    expect(slackText).toContain('Exam Grade:');
    expect(slackText).toContain('Review Mistakes');
  });

  it('generates valid RFC 4180 CSV gradebook', () => {
    const mockScan: ScanResult = {
      id: 'scan_csv_01',
      timestamp: '2026-09-18T12:00:00.000Z',
      templateId: 'MCQ10',
      totalQuestions: 10,
      answers: {
        1: { question: 1, detectedChoice: 'A', choices: {} as any },
      },
      summary: { answered: 1, blank: 9, multiple: 0 },
    };
    const keys = {
      MCQ10: generateDefaultKey(10),
      MCQ20: generateDefaultKey(20),
      MCQ40: generateDefaultKey(40),
      MCQ50: generateDefaultKey(50),
    };

    const csv = generateGradebookCsv([mockScan], keys);
    expect(csv).toContain('Scan ID,Timestamp,Test ID,Class,Student Name,Template,Total Questions,Correct');
    expect(csv).toContain('ANSWER_KEY');
    expect(csv).toContain('OFFICIAL ANSWER KEY (MCQ10)');
    expect(csv).toContain('scan_csv_01');
    expect(csv).toContain('MCQ10');
    expect(csv).toContain('A ✓');
    expect(csv).toContain('BLANK (Key: B)');
  });

  it('detects registration markers with synthetic image data', () => {
    const width = 400;
    const height = 400;
    const data = new Uint8ClampedArray(width * height * 4).fill(250); // White paper background

    // Helper to draw a dark square
    const drawDarkSquare = (x1: number, y1: number, size: number) => {
      for (let y = y1; y < y1 + size; y++) {
        for (let x = x1; x < x1 + size; x++) {
          const idx = (y * width + x) * 4;
          data[idx] = 20;
          data[idx + 1] = 20;
          data[idx + 2] = 20;
          data[idx + 3] = 255;
        }
      }
    };

    // Draw 4 corner fiducials
    drawDarkSquare(34, 34, 12); // TL
    drawDarkSquare(354, 34, 12); // TR
    drawDarkSquare(34, 354, 12); // BL
    drawDarkSquare(354, 354, 12); // BR

    const imgData: ImageData = {
      width,
      height,
      data,
      colorSpace: 'srgb',
    };

    const defaultCorners: CornerPoints = {
      tl: { x: 40, y: 40 },
      tr: { x: 360, y: 40 },
      br: { x: 360, y: 360 },
      bl: { x: 40, y: 360 },
    };

    const result = detectRegistrationMarkers(imgData, defaultCorners);
    expect(result.detected).toBe(true);
    expect(result.confidence).toBe(1.0);
    expect(result.corners.tl.x).toBeCloseTo(40, -1);
    expect(result.corners.tl.y).toBeCloseTo(40, -1);
  });

  describe('Answer Key Parser', () => {
    it('parses continuous letter strings', () => {
      const res = parseAnswerKeyInput('ABCDABCDAB', 10);
      expect(res.parsedCount).toBe(10);
      expect(res.key[1]).toBe('A');
      expect(res.key[2]).toBe('B');
      expect(res.key[3]).toBe('C');
      expect(res.key[4]).toBe('D');
      expect(res.key[10]).toBe('B');
    });

    it('parses numbered pairs and lines', () => {
      const text = `
        1: A
        2: B
        3. C
        Q4 = D
        5 - A
      `;
      const res = parseAnswerKeyInput(text, 10);
      expect(res.parsedCount).toBe(5);
      expect(res.key[1]).toBe('A');
      expect(res.key[2]).toBe('B');
      expect(res.key[3]).toBe('C');
      expect(res.key[4]).toBe('D');
      expect(res.key[5]).toBe('A');
    });

    it('parses JSON objects and arrays', () => {
      const jsonStr = JSON.stringify({ '1': 'B', '2': 'C', '3': 'D' });
      const res = parseAnswerKeyInput(jsonStr, 10);
      expect(res.parsedCount).toBe(3);
      expect(res.key[1]).toBe('B');
      expect(res.key[2]).toBe('C');
      expect(res.key[3]).toBe('D');

      const arrayStr = JSON.stringify(['A', 'C', 'B', 'D']);
      const resArray = parseAnswerKeyInput(arrayStr, 10);
      expect(resArray.parsedCount).toBe(4);
      expect(resArray.key[1]).toBe('A');
      expect(resArray.key[2]).toBe('C');
      expect(resArray.key[3]).toBe('B');
      expect(resArray.key[4]).toBe('D');
    });

    it('handles empty and invalid input gracefully', () => {
      const emptyRes = parseAnswerKeyInput('', 10);
      expect(emptyRes.parsedCount).toBe(0);
      expect(emptyRes.errors.length).toBeGreaterThan(0);

      const invalidRes = parseAnswerKeyInput('hello world xyz', 10);
      expect(invalidRes.parsedCount).toBe(0);
    });
  });

  describe('Exam Metadata & Gradebook Serialization', () => {
    it('includes Test ID, Class, and Student Name in Slack reports', () => {
      const mockScan: ScanResult = {
        id: 'scan_meta_01',
        timestamp: '2026-09-18T12:00:00.000Z',
        templateId: 'MCQ10',
        totalQuestions: 10,
        studentName: 'Alice Smith',
        testId: 'ENG-101',
        className: 'Grade 10A',
        answers: {
          1: { question: 1, detectedChoice: 'A', choices: {} as any },
        },
        summary: { answered: 1, blank: 9, multiple: 0 },
      };

      const key = generateDefaultKey(10);
      const score = gradeExam(mockScan, key);
      const slack = formatGradedSlackMessage(
        mockScan,
        score,
        mockScan.studentName,
        mockScan.testId,
        mockScan.className
      );

      expect(slack).toContain('ENG-101');
      expect(slack).toContain('Grade 10A');
      expect(slack).toContain('Alice Smith');
    });

    it('includes Test ID, Class, and Student in CSV output', () => {
      const mockScan: ScanResult = {
        id: 'scan_meta_02',
        timestamp: '2026-09-18T12:00:00.000Z',
        templateId: 'MCQ10',
        totalQuestions: 10,
        studentName: 'Bob Jones',
        testId: 'TEST-002',
        className: 'IELTS-2',
        answers: {
          1: { question: 1, detectedChoice: 'A', choices: {} as any },
        },
        summary: { answered: 1, blank: 9, multiple: 0 },
      };

      const keys = {
        MCQ10: generateDefaultKey(10),
        MCQ20: generateDefaultKey(20),
        MCQ40: generateDefaultKey(40),
        MCQ50: generateDefaultKey(50),
      };

      const csv = generateGradebookCsv([mockScan], keys);
      expect(csv).toContain('TEST-002');
      expect(csv).toContain('IELTS-2');
      expect(csv).toContain('Bob Jones');
    });
  });
});
