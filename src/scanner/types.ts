import { Choice, Point, TemplateId } from '../omr/types';

export interface CornerPoints {
  tl: Point;
  tr: Point;
  br: Point;
  bl: Point;
}

export interface BubbleDetectionResult {
  choice: Choice;
  fillRatio: number; // 0.0 to 1.0
  isMarked: boolean;
}

export interface QuestionDetectionResult {
  question: number;
  detectedChoice: Choice | 'BLANK' | 'MULTIPLE';
  choices: Record<Choice, BubbleDetectionResult>;
  confidence?: number; // 0 to 100 (%)
  margin?: number; // Difference between highest and runner-up fill ratio
}

export interface ScanResult {
  id: string;
  timestamp: string; // ISO 8601
  templateId: TemplateId;
  totalQuestions: number;
  answers: Record<number, QuestionDetectionResult>;
  summary: {
    answered: number;
    blank: number;
    multiple: number;
  };
  studentName?: string;
  testId?: string;
  className?: string;
}
