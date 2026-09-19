export type TemplateId = 'MCQ10' | 'MCQ20' | 'MCQ40' | 'MCQ50';

export type Choice = 'A' | 'B' | 'C' | 'D';

export type MarkerId = 'TL' | 'TR' | 'BL' | 'BR';

export interface TemplateConfig {
  id: TemplateId;
  version: number;
  title: string;
  questions: number;
  choices: 4;
  columns: number;
  rowsPerColumn: number;
  paper: 'A4';
}

export interface Point {
  x: number;
  y: number;
}

export interface BoundingBox {
  x: number;
  y: number;
  width: number;
  height: number;
}

export interface RegistrationMarkerGeometry {
  id: MarkerId;
  center: Point;
  width: number;
  height: number;
  bounds: BoundingBox;
}

export interface BubbleGeometry {
  choice: Choice;
  center: Point;
  radius: number;
  detectionRadius: number;
  labelOffset: Point;
}

export interface QuestionGeometry {
  question: number;
  column: number;
  row: number;
  numberPosition: Point;
  bounds: BoundingBox;
  bubbles: Record<Choice, BubbleGeometry>;
}

export interface QRGeometry {
  payload: string;
  bounds: BoundingBox;
  moduleCount: number;
  modules: boolean[][];
}

export interface StudentFieldLine {
  label: string;
  labelPosition: Point;
  line: {
    x1: number;
    y1: number;
    x2: number;
    y2: number;
  };
}

export interface HeaderGeometry {
  bounds: BoundingBox;
  title: string;
  templateId: string;
  versionText: string;
  studentFields: {
    name: StudentFieldLine;
    date: StudentFieldLine;
    className: StudentFieldLine;
    testId: StudentFieldLine;
  };
}

export interface PageGeometry {
  paper: 'A4';
  width: number; // 210 mm
  height: number; // 297 mm
  unit: 'mm';
  safeMargins: {
    top: number;
    bottom: number;
    left: number;
    right: number;
  };
}

export interface SheetGeometry {
  protocol: 'OMR';
  version: number;
  template: TemplateId;
  page: PageGeometry;
  markers: RegistrationMarkerGeometry[];
  qr: QRGeometry;
  header: HeaderGeometry;
  grid: {
    columns: number;
    rowsPerColumn: number;
    rowHeight: number;
    colWidth: number;
    gutter: number;
  };
  questions: QuestionGeometry[];
  halfSheetGeometry?: SheetGeometry;
}
