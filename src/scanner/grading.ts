import { Choice, TemplateId } from '../omr/types';
import { ScanResult } from './types';

export type AnswerKey = Record<number, Choice>;

export interface QuestionGrading {
  question: number;
  studentChoice: Choice | 'BLANK' | 'MULTIPLE';
  correctChoice: Choice;
  isCorrect: boolean;
}

export interface ScoringRules {
  correctPoints?: number; // default: 1
  incorrectPenalty?: number; // default: 0 (e.g. 0.25, 0.33, 0.5)
  blankPenalty?: number; // default: 0
}

export interface ExamScore {
  totalQuestions: number;
  correctCount: number;
  incorrectCount: number;
  blankCount: number;
  multipleCount: number;
  rawScore?: number;
  maxScore?: number;
  percentage: number;
  letterGrade: string;
  results: Record<number, QuestionGrading>;
}

export interface ParsedAnswerKeyResult {
  key: AnswerKey;
  parsedCount: number;
  errors: string[];
}

const ANSWER_KEYS_STORAGE_KEY = 'omr_answer_keys_v1';
const SCORING_RULES_STORAGE_KEY = 'omr_scoring_rules_v1';

export const DEFAULT_SCORING_RULES: ScoringRules = {
  correctPoints: 1,
  incorrectPenalty: 0,
  blankPenalty: 0,
};

export function loadScoringRules(): ScoringRules {
  try {
    const raw = localStorage.getItem(SCORING_RULES_STORAGE_KEY);
    if (!raw) return DEFAULT_SCORING_RULES;
    return { ...DEFAULT_SCORING_RULES, ...JSON.parse(raw) };
  } catch {
    return DEFAULT_SCORING_RULES;
  }
}

export function saveScoringRules(rules: ScoringRules): ScoringRules {
  try {
    localStorage.setItem(SCORING_RULES_STORAGE_KEY, JSON.stringify(rules));
    return rules;
  } catch {
    return rules;
  }
}

const DEFAULT_CHOICES: Choice[] = ['A', 'B', 'C', 'D'];

/**
 * Generates a default cyclical answer key (A, B, C, D, A, B...) for a question count.
 */
export function generateDefaultKey(questionCount: number): AnswerKey {
  const key: AnswerKey = {};
  for (let q = 1; q <= questionCount; q++) {
    key[q] = DEFAULT_CHOICES[(q - 1) % 4];
  }
  return key;
}

/**
 * Loads answer keys for all templates from localStorage (with built-in defaults).
 */
export function loadAnswerKeys(): Record<TemplateId, AnswerKey> {
  const defaults: Record<TemplateId, AnswerKey> = {
    MCQ10: generateDefaultKey(10),
    MCQ20: generateDefaultKey(20),
    MCQ40: generateDefaultKey(40),
    MCQ50: generateDefaultKey(50),
  };

  try {
    const raw = localStorage.getItem(ANSWER_KEYS_STORAGE_KEY);
    if (!raw) return defaults;
    const parsed = JSON.parse(raw);
    return { ...defaults, ...parsed };
  } catch (err) {
    console.error('Failed to load answer keys from localStorage:', err);
    return defaults;
  }
}

/**
 * Saves answer key for a specific template.
 */
export function saveAnswerKey(
  templateId: TemplateId,
  key: AnswerKey
): Record<TemplateId, AnswerKey> {
  try {
    const allKeys = loadAnswerKeys();
    allKeys[templateId] = key;
    localStorage.setItem(ANSWER_KEYS_STORAGE_KEY, JSON.stringify(allKeys));
    return allKeys;
  } catch (err) {
    console.error('Failed to save answer key:', err);
    return loadAnswerKeys();
  }
}

/**
 * Parses an answer key from user input.
 * Supports:
 * - Continuous string: "ABCDABCD..."
 * - Spaced/comma separated: "A, B, C, D" or "A B C D"
 * - Numbered lines/pairs: "1: A\n2: B" or "1. A, 2. B"
 * - JSON: '{"1": "A", "2": "B"}' or '["A", "B", "C"]'
 * - CSV: "1,A\n2,B"
 */
export function parseAnswerKeyInput(
  rawText: string,
  expectedQuestions: number
): ParsedAnswerKeyResult {
  const trimmed = rawText.trim();
  const key: AnswerKey = {};

  if (!trimmed) {
    return { key: {}, parsedCount: 0, errors: ['Input is empty'] };
  }

  // 1. Try JSON parsing
  if (trimmed.startsWith('{') || trimmed.startsWith('[')) {
    try {
      const parsed = JSON.parse(trimmed);
      if (Array.isArray(parsed)) {
        parsed.forEach((val, idx) => {
          const char = String(val).trim().toUpperCase();
          if (['A', 'B', 'C', 'D'].includes(char) && idx < expectedQuestions) {
            key[idx + 1] = char as Choice;
          }
        });
      } else if (typeof parsed === 'object' && parsed !== null) {
        Object.entries(parsed).forEach(([qStr, val]) => {
          const qNum = parseInt(qStr, 10);
          const char = String(val).trim().toUpperCase();
          if (
            !isNaN(qNum) &&
            qNum >= 1 &&
            qNum <= expectedQuestions &&
            ['A', 'B', 'C', 'D'].includes(char)
          ) {
            key[qNum] = char as Choice;
          }
        });
      }
      const count = Object.keys(key).length;
      if (count > 0) {
        return { key, parsedCount: count, errors: [] };
      }
    } catch {
      // Fall through to regex/text parsing
    }
  }

  // 2. Try Numbered pairs / CSV lines: "1: A", "1. A", "1, A", "Q1: A", "Q01=A"
  const pairRegex = /(?:Q\s*)?(\d+)\s*[:.,=\t-]\s*([A-Da-d])/g;
  let match: RegExpExecArray | null;
  let pairFound = false;

  while ((match = pairRegex.exec(trimmed)) !== null) {
    pairFound = true;
    const qNum = parseInt(match[1], 10);
    const choice = match[2].toUpperCase() as Choice;
    if (qNum >= 1 && qNum <= expectedQuestions) {
      key[qNum] = choice;
    }
  }

  if (pairFound && Object.keys(key).length > 0) {
    return { key, parsedCount: Object.keys(key).length, errors: [] };
  }

  // 3. Try letter sequence / tokens: only if stripped of delimiters it consists purely of A, B, C, D
  // e.g. "ABCDABCD", "A B C D", "A, B, C, D", "A\nB\nC\nD"
  const stripped = trimmed.replace(/[\s,;_\-|/.]/g, '');
  if (stripped.length > 0 && /^[A-Da-d]+$/.test(stripped)) {
    const chars = stripped.toUpperCase().split('');
    chars.slice(0, expectedQuestions).forEach((char, idx) => {
      key[idx + 1] = char as Choice;
    });
    return { key, parsedCount: Object.keys(key).length, errors: [] };
  }

  return {
    key: {},
    parsedCount: 0,
    errors: ['Could not parse any valid choices (A, B, C, D) from input'],
  };
}

/**
 * Calculates letter grade based on percentage.
 */
export function getLetterGrade(percentage: number): string {
  if (percentage >= 90) return 'A';
  if (percentage >= 80) return 'B';
  if (percentage >= 70) return 'C';
  if (percentage >= 60) return 'D';
  return 'F';
}

/**
 * Grades a ScanResult against an AnswerKey.
 */
export function gradeExam(
  scan: ScanResult,
  answerKey: AnswerKey,
  rules?: ScoringRules
): ExamScore {
  const correctPoints = rules?.correctPoints ?? 1;
  const incorrectPenalty = rules?.incorrectPenalty ?? 0;
  const blankPenalty = rules?.blankPenalty ?? 0;

  let correctCount = 0;
  let incorrectCount = 0;
  let blankCount = 0;
  let multipleCount = 0;

  const results: Record<number, QuestionGrading> = {};

  for (let q = 1; q <= scan.totalQuestions; q++) {
    const studentChoice = scan.answers[q]?.detectedChoice || 'BLANK';
    const correctChoice = answerKey[q] || 'A';
    const isCorrect = studentChoice === correctChoice;

    if (isCorrect) {
      correctCount++;
    } else if (studentChoice === 'BLANK') {
      blankCount++;
    } else if (studentChoice === 'MULTIPLE') {
      multipleCount++;
    } else {
      incorrectCount++;
    }

    results[q] = {
      question: q,
      studentChoice,
      correctChoice,
      isCorrect,
    };
  }

  const maxScore = scan.totalQuestions * correctPoints;
  const rawScore = Number(
    (
      correctCount * correctPoints -
      (incorrectCount + multipleCount) * incorrectPenalty -
      blankCount * blankPenalty
    ).toFixed(2)
  );

  const percentage = maxScore > 0
    ? Number(Math.max(0, (rawScore / maxScore) * 100).toFixed(1))
    : 0;
  const letterGrade = getLetterGrade(percentage);

  return {
    totalQuestions: scan.totalQuestions,
    correctCount,
    incorrectCount,
    blankCount,
    multipleCount,
    rawScore,
    maxScore,
    percentage,
    letterGrade,
    results,
  };
}

/**
 * Formats a graded scan result for Slack or an AI Agent.
 */
export function formatGradedSlackMessage(
  scan: ScanResult,
  score: ExamScore,
  studentName?: string,
  testId?: string,
  className?: string
): string {
  const dateStr = new Date(scan.timestamp).toLocaleString();
  const metaParts: string[] = [];
  if (testId) metaParts.push(`*Test ID*: ${testId}`);
  if (className) metaParts.push(`*Class*: ${className}`);
  if (studentName) metaParts.push(`*Student*: ${studentName}`);
  metaParts.push(`*Template*: ${scan.templateId}`);

  const lines: string[] = [];

  lines.push(
    `📋 *OMR Exam Grade: ${score.correctCount}/${score.totalQuestions} (${score.percentage}% - Grade ${score.letterGrade})*`
  );
  lines.push(metaParts.join(' | '));
  lines.push(`• *Date*: ${dateStr}`);
  lines.push(
    `• *Summary*: ${score.correctCount} Correct • ${score.incorrectCount} Incorrect • ${score.blankCount} Blank`
  );

  // Mistakes analysis
  const mistakes = Object.values(score.results).filter((r) => !r.isCorrect);
  if (mistakes.length > 0) {
    lines.push('');
    lines.push('*Review Mistakes*:');
    mistakes.forEach((m) => {
      const qNum = String(m.question).padStart(2, '0');
      const stud = m.studentChoice === 'BLANK' ? 'Blank' : m.studentChoice;
      lines.push(
        `• Q${qNum}: Student answered *${stud}* (Correct: *${m.correctChoice}*)`
      );
    });
  }

  lines.push('');
  lines.push('*Complete Answer Sheet*:');
  const items: string[] = [];
  Object.values(score.results).forEach((r) => {
    const qNum = String(r.question).padStart(2, '0');
    const mark = r.isCorrect ? '✓' : '✗';
    items.push(`Q${qNum}:${r.studentChoice}${mark}`);
  });
  lines.push(items.join(' '));

  return lines.join('\n');
}
