import { ExamScore } from './grading';
import { ScanResult } from './types';

export interface BatchItem {
  id: string;
  timestamp: string;
  studentId?: string;
  studentName?: string;
  testId?: string;
  className?: string;
  score: number;
  maxScore: number;
  percentage: number;
  letterGrade: string;
  answers: Array<string>;
  flaggedQuestions: number[]; // Questions that were blank, multiple, or low margin
  confidence: number; // Mean confidence 0.0 to 1.0
  scanResult: ScanResult;
  examScore: ExamScore;
  rectifiedImageUrl?: string;
}

export interface BatchExportResult {
  studentId?: string;
  score: number;
  maxScore: number;
  answers: Array<string>;
  flaggedQuestions: number[];
  confidence: number;
}

export interface BatchExportPayload {
  schemaVersion: 1;
  createdAt: string; // ISO 8601
  test?: string;
  class?: string;
  count: number;
  results: BatchExportResult[];
}

/**
 * Evaluates whether a question requires teacher attention:
 * - Student left it blank while defined in answer key
 * - Multiple bubbles marked
 * - Detection margin < 0.08 (faint or ambiguous second mark)
 */
export function detectFlaggedQuestions(
  scan: ScanResult,
  score: ExamScore
): number[] {
  const flagged: number[] = [];

  for (const qStr of Object.keys(score.results)) {
    const q = Number(qStr);
    const ans = scan.answers[q];
    if (!ans) continue;

    if (ans.detectedChoice === 'BLANK' || ans.detectedChoice === 'MULTIPLE') {
      flagged.push(q);
    } else if (ans.margin !== undefined && ans.margin < 0.08) {
      flagged.push(q);
    }
  }

  return flagged;
}

/**
 * Calculates mean confidence for an exam sheet (0.0 to 1.0).
 */
export function calculateBatchItemConfidence(
  scan: ScanResult,
  score: ExamScore
): number {
  const qNums = Object.keys(score.results).map(Number);
  if (qNums.length === 0) return 1.0;

  let totalConf = 0;
  let count = 0;

  for (const q of qNums) {
    const ans = scan.answers[q];
    if (ans) {
      const conf = ans.confidence !== undefined ? ans.confidence / 100 : 0.95;
      totalConf += conf;
      count++;
    }
  }

  return count > 0 ? Number((totalConf / count).toFixed(2)) : 1.0;
}

/**
 * Constructs a standardized Schema v1 JSON export payload from batch items.
 */
export function formatBatchExport(
  items: BatchItem[],
  testName?: string,
  className?: string
): BatchExportPayload {
  const commonTest = testName || items.find((i) => i.testId)?.testId;
  const commonClass = className || items.find((i) => i.className)?.className;

  return {
    schemaVersion: 1,
    createdAt: new Date().toISOString(),
    ...(commonTest ? { test: commonTest } : {}),
    ...(commonClass ? { class: commonClass } : {}),
    count: items.length,
    results: items.map((item) => ({
      ...(item.studentId || item.studentName ? { studentId: item.studentId || item.studentName } : {}),
      score: item.score,
      maxScore: item.maxScore,
      answers: item.answers,
      flaggedQuestions: item.flaggedQuestions,
      confidence: item.confidence,
    })),
  };
}

/**
 * Initiates download of a JSON string as a local file.
 */
export function downloadJsonFile(jsonStr: string, fileName: string): void {
  if (typeof document === 'undefined') return;
  const blob = new Blob([jsonStr], { type: 'application/json' });
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = fileName;
  document.body.appendChild(a);
  a.click();
  document.body.removeChild(a);
  setTimeout(() => URL.revokeObjectURL(url), 2000);
}

/**
 * Dispatches batch payload via the Web Share API (native share sheet)
 * for integration with iOS/macOS Shortcuts, with graceful fallback to file download.
 */
export async function shareBatchResults(
  payload: BatchExportPayload
): Promise<{ method: 'share' | 'download' | 'canceled'; success: boolean }> {
  const jsonStr = JSON.stringify(payload, null, 2);
  const safeName = (payload.test || 'omr-batch').replace(/[^a-zA-Z0-9_-]/g, '_');
  const dateStr = new Date().toISOString().slice(0, 10);
  const fileName = `${safeName}-${dateStr}.json`;

  if (typeof navigator !== 'undefined' && typeof navigator.share === 'function') {
    try {
      let sharedFile = false;
      if (typeof File !== 'undefined' && typeof navigator.canShare === 'function') {
        const file = new File([jsonStr], fileName, { type: 'application/json' });
        if (navigator.canShare({ files: [file] })) {
          await navigator.share({
            title: `OMR Results (${payload.count} papers)`,
            files: [file],
          });
          sharedFile = true;
        }
      }

      if (!sharedFile) {
        await navigator.share({
          title: `OMR Results (${payload.count} papers)`,
          text: jsonStr,
        });
      }

      return { method: 'share', success: true };
    } catch (err: any) {
      if (err.name === 'AbortError') {
        return { method: 'share', success: false };
      }
      console.warn('Web Share failed, falling back to download:', err);
    }
  }

  // Fallback: Download file
  downloadJsonFile(jsonStr, fileName);
  return { method: 'download', success: true };
}
