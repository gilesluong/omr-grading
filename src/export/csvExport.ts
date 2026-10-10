import { ScanResult } from '../scanner/types';
import { AnswerKey, gradeExam, loadScoringRules } from '../scanner/grading';
import { TemplateId } from '../omr/types';

/**
 * Escapes a cell value for standard CSV.
 *
 * Also neutralises spreadsheet formula injection: Excel/Sheets evaluate a cell
 * whose text starts with = + - @ or a control character even when it is quoted,
 * so a student name of "=1+1" or "=cmd|'/c calc'!A0" would otherwise execute in
 * the teacher's gradebook.
 */
function escapeCsvCell(val: any): string {
  if (val === null || val === undefined) return '';
  let str = String(val);
  if (/^[=+\-@\t\r]/.test(str)) {
    str = `'${str}`;
  }
  if (str.includes(',') || str.includes('"') || str.includes('\n') || str.includes('\r')) {
    return `"${str.replace(/"/g, '""')}"`;
  }
  return str;
}

/**
 * Generates a CSV gradebook from scan history.
 */
export function generateGradebookCsv(
  history: ScanResult[],
  answerKeys: Record<TemplateId, AnswerKey>
): string {
  if (history.length === 0) {
    return 'Scan ID,Timestamp,Template,Student,Total,Correct,Incorrect,Blank,Percentage,Grade\n';
  }

  // Find maximum questions count across all scans for header columns
  const maxQuestions = Math.max(...history.map((s) => s.totalQuestions));

  // Build CSV Header
  const headers = [
    'Scan ID',
    'Timestamp',
    'Test ID',
    'Class',
    'Student Name',
    'Template',
    'Total Questions',
    'Correct',
    'Incorrect',
    'Blank',
    'Score %',
    'Letter Grade',
  ];

  for (let q = 1; q <= maxQuestions; q++) {
    headers.push(`Q${String(q).padStart(2, '0')}`);
  }

  const rows: string[] = [headers.map(escapeCsvCell).join(',')];

  // Export official answer key rows for all templates present in history
  const usedTemplates = Array.from(new Set(history.map((s) => s.templateId)));
  usedTemplates.forEach((templateId) => {
    const key = answerKeys[templateId] || {};
    const sampleScan = history.find((s) => s.templateId === templateId);
    const totalQ = sampleScan?.totalQuestions || Object.keys(key).length || maxQuestions;

    const keyRow = [
      'ANSWER_KEY',
      '—',
      sampleScan?.testId || 'ANSWER_KEY',
      sampleScan?.className || 'ALL',
      `OFFICIAL ANSWER KEY (${templateId})`,
      templateId,
      totalQ,
      totalQ,
      0,
      0,
      '100%',
      'A+',
    ];

    for (let q = 1; q <= maxQuestions; q++) {
      if (q <= totalQ) {
        keyRow.push(key[q] || '—');
      } else {
        keyRow.push('');
      }
    }

    rows.push(keyRow.map(escapeCsvCell).join(','));
  });

  // Export each student scan submission with inline context
  history.forEach((scan) => {
    const key = answerKeys[scan.templateId] || {};
    // Same scoring rules as the scanner/batch view, otherwise the exported
    // grade disagrees with what the teacher saw while scanning.
    const score = gradeExam(scan, key, loadScoringRules());

    const row = [
      scan.id,
      new Date(scan.timestamp).toLocaleString(),
      scan.testId || '—',
      scan.className || '—',
      scan.studentName || '—',
      scan.templateId,
      scan.totalQuestions,
      score.correctCount,
      score.incorrectCount,
      score.blankCount,
      `${score.percentage}%`,
      score.letterGrade,
    ];

    for (let q = 1; q <= maxQuestions; q++) {
      if (q <= scan.totalQuestions) {
        const ans = scan.answers[q];
        const choice = ans?.detectedChoice || 'BLANK';
        const expected = key[q];
        if (expected) {
          if (choice === expected) {
            row.push(`${choice} ✓`);
          } else if (choice === 'BLANK') {
            row.push(`BLANK (Key: ${expected})`);
          } else if (choice === 'MULTIPLE') {
            row.push(`MULTIPLE (Key: ${expected})`);
          } else {
            row.push(`${choice} ✗ (Key: ${expected})`);
          }
        } else {
          row.push(choice === 'BLANK' ? '—' : choice);
        }
      } else {
        row.push('');
      }
    }

    rows.push(row.map(escapeCsvCell).join(','));
  });

  return rows.join('\n');
}

/**
 * Triggers a browser file download of the gradebook CSV.
 */
export function downloadGradebookCsv(
  history: ScanResult[],
  answerKeys: Record<TemplateId, AnswerKey>
): void {
  const csvContent = generateGradebookCsv(history, answerKeys);
  const blob = new Blob([csvContent], { type: 'text/csv;charset=utf-8;' });
  const url = URL.createObjectURL(blob);

  const link = document.createElement('a');
  link.href = url;
  link.download = `omr-gradebook-${new Date().toISOString().slice(0, 10)}.csv`;
  document.body.appendChild(link);
  link.click();
  document.body.removeChild(link);
  URL.revokeObjectURL(url);
}
