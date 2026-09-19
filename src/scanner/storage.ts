import { ScanResult } from './types';

const STORAGE_KEY = 'omr_scan_history_v1';

/**
 * Loads all stored scan results from localStorage.
 */
export function loadScanHistory(): ScanResult[] {
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (!raw) return [];
    return JSON.parse(raw) as ScanResult[];
  } catch (err) {
    console.error('Failed to load scan history from localStorage:', err);
    return [];
  }
}

/**
 * Saves a new scan result to localStorage (prepends to list).
 */
export function saveScanResult(result: ScanResult): ScanResult[] {
  try {
    const current = loadScanHistory();
    const updated = [result, ...current.filter((item) => item.id !== result.id)];
    localStorage.setItem(STORAGE_KEY, JSON.stringify(updated));
    return updated;
  } catch (err) {
    console.error('Failed to save scan result to localStorage:', err);
    return [];
  }
}

/**
 * Deletes a single scan result from localStorage.
 */
export function deleteScanResult(id: string): ScanResult[] {
  try {
    const current = loadScanHistory();
    const updated = current.filter((item) => item.id !== id);
    localStorage.setItem(STORAGE_KEY, JSON.stringify(updated));
    return updated;
  } catch (err) {
    console.error('Failed to delete scan result from localStorage:', err);
    return [];
  }
}

/**
 * Clears all scan history.
 */
export function clearScanHistory(): void {
  try {
    localStorage.removeItem(STORAGE_KEY);
  } catch (err) {
    console.error('Failed to clear scan history:', err);
  }
}

/**
 * Formats a ScanResult for easy copying to a Slack Bot or AI Agent.
 */
export function formatForSlack(result: ScanResult): string {
  const dateStr = new Date(result.timestamp).toLocaleString();
  const lines: string[] = [];

  lines.push(`📋 *OMR Scan Result* (${result.templateId})`);
  lines.push(`• *Scanned*: ${dateStr}`);
  lines.push(
    `• *Summary*: ${result.summary.answered}/${result.totalQuestions} Answered | ${result.summary.blank} Blank | ${result.summary.multiple} Multiple`
  );
  lines.push('');
  lines.push('*Answers*:');

  const qNumbers = Object.keys(result.answers)
    .map(Number)
    .sort((a, b) => a - b);

  qNumbers.forEach((qNum) => {
    const ans = result.answers[qNum];
    const paddedQ = String(qNum).padStart(2, '0');
    let displayChoice = ans.detectedChoice;
    if (displayChoice === 'BLANK') displayChoice = '— (Blank)' as any;
    if (displayChoice === 'MULTIPLE') displayChoice = '⚠ (Multiple)' as any;
    lines.push(`Q${paddedQ}: ${displayChoice}`);
  });

  return lines.join('\n');
}

/**
 * Formats a ScanResult as structured JSON for direct database insertion or API submission.
 */
export function formatForJson(result: ScanResult): string {
  const answerMap: Record<string, string> = {};
  Object.entries(result.answers).forEach(([q, res]) => {
    answerMap[q] = res.detectedChoice;
  });

  const exportObj = {
    scanId: result.id,
    template: result.templateId,
    timestamp: result.timestamp,
    totalQuestions: result.totalQuestions,
    summary: result.summary,
    answers: answerMap,
  };

  return JSON.stringify(exportObj, null, 2);
}
