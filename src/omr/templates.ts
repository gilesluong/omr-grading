import { TemplateConfig, TemplateId } from './types';

export const TEMPLATES: Record<TemplateId, TemplateConfig> = {
  MCQ10: {
    id: 'MCQ10',
    version: 1,
    title: 'MCQ 10 Answer Sheet',
    questions: 10,
    choices: 4,
    columns: 1,
    rowsPerColumn: 10,
    paper: 'A4',
  },
  MCQ20: {
    id: 'MCQ20',
    version: 1,
    title: 'MCQ 20 Answer Sheet',
    questions: 20,
    choices: 4,
    columns: 2,
    rowsPerColumn: 10,
    paper: 'A4',
  },
  MCQ40: {
    id: 'MCQ40',
    version: 1,
    title: 'MCQ 40 Answer Sheet',
    questions: 40,
    choices: 4,
    columns: 2,
    rowsPerColumn: 20,
    paper: 'A4',
  },
  MCQ50: {
    id: 'MCQ50',
    version: 1,
    title: 'MCQ 50 Answer Sheet',
    questions: 50,
    choices: 4,
    columns: 2,
    rowsPerColumn: 25,
    paper: 'A4',
  },
};

export const DEFAULT_TEMPLATE_ID: TemplateId = 'MCQ20';
