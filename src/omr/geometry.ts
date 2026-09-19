import QRCode from 'qrcode';
import {
  BubbleGeometry,
  Choice,
  MarkerId,
  QuestionGeometry,
  RegistrationMarkerGeometry,
  SheetGeometry,
  TemplateConfig,
} from './types';

// Constants for physical A4 paper (210mm x 297mm)
export const PAGE_WIDTH_MM = 210;
export const PAGE_HEIGHT_MM = 297;

// Registration markers: 8mm x 8mm solid black squares placed at 16mm from corner edges
// Outer edges are at 12mm (safe from printer margins); inner edges at 20mm
export const MARKER_SIZE_MM = 8;
export const MARKER_OFFSET_MM = 16;

// Safe margins for readable content
export const SAFE_MARGIN_TOP_MM = 20;
export const SAFE_MARGIN_BOTTOM_MM = 275;
export const SAFE_MARGIN_LEFT_MM = 20;
export const SAFE_MARGIN_RIGHT_MM = 190;

// Header layout
export const HEADER_START_Y = 22;
export const HEADER_HEIGHT = 24;

// Question grid parameters
export const GRID_START_Y = 54;
export const ROW_HEIGHT_MM = 8.0;
export const COLUMN_WIDTH_MM = 60.0;
export const TWO_COL_GUTTER_MM = 24.0;

// Micro QR code parameters
export const WEBAPP_URL = 'https://gilesluong.github.io/omr-grading';
export const QR_SIZE_MM = 18.0;
export const QR_POS_X_MM = 168.0;
export const QR_POS_Y_MM = 24.0;

// Bubble parameters
export const BUBBLE_RADIUS_MM = 2.3; // 4.6mm diameter
export const DETECTION_RADIUS_MM = 1.8; // 3.6mm inner ROI diameter
export const BUBBLE_SPACING_MM = 11.5; // distance between bubble centers
export const LABEL_OFFSET_X_MM = 4.3; // distance from bubble center to choice label center

const CHOICES: Choice[] = ['A', 'B', 'C', 'D'];

/**
 * Generate 2D boolean matrix for QR code.
 * Deterministic for given payload.
 */
export function generateQRModules(payload: string): { moduleCount: number; modules: boolean[][] } {
  const qr = QRCode.create(payload, { errorCorrectionLevel: 'M' });
  const size = qr.modules.size;
  const modules: boolean[][] = [];

  for (let r = 0; r < size; r++) {
    const row: boolean[] = [];
    for (let c = 0; c < size; c++) {
      // In qrcode library, get(row, col) returns 1 (dark) or 0 (light)
      row.push(qr.modules.get(r, c) === 1);
    }
    modules.push(row);
  }

  return { moduleCount: size, modules };
}

/**
 * Generates the four corner registration markers.
 * Identical across all templates.
 */
export function generateRegistrationMarkers(): RegistrationMarkerGeometry[] {
  const halfSize = MARKER_SIZE_MM / 2;

  const markerPositions: Array<{ id: MarkerId; x: number; y: number }> = [
    { id: 'TL', x: MARKER_OFFSET_MM, y: MARKER_OFFSET_MM },
    { id: 'TR', x: PAGE_WIDTH_MM - MARKER_OFFSET_MM, y: MARKER_OFFSET_MM },
    { id: 'BL', x: MARKER_OFFSET_MM, y: PAGE_HEIGHT_MM - MARKER_OFFSET_MM },
    { id: 'BR', x: PAGE_WIDTH_MM - MARKER_OFFSET_MM, y: PAGE_HEIGHT_MM - MARKER_OFFSET_MM },
  ];

  return markerPositions.map(({ id, x, y }) => ({
    id,
    center: { x, y },
    width: MARKER_SIZE_MM,
    height: MARKER_SIZE_MM,
    bounds: {
      x: Number((x - halfSize).toFixed(3)),
      y: Number((y - halfSize).toFixed(3)),
      width: MARKER_SIZE_MM,
      height: MARKER_SIZE_MM,
    },
  }));
}

/**
 * Canonical Single Source of Truth for OMR Sheet Geometry.
 * Maps 1:1 to physical millimeters and SVG coordinates.
 */
export function generateGeometry(config: TemplateConfig): SheetGeometry {
  const markers = generateRegistrationMarkers();

  // QR Code encodes webapp link
  const qrPayload = WEBAPP_URL;
  const { moduleCount, modules } = generateQRModules(qrPayload);

  // Column layout calculation
  let columnStartXs: number[] = [];
  if (config.columns === 1) {
    // Center single column on the page
    const startX = (PAGE_WIDTH_MM - COLUMN_WIDTH_MM) / 2;
    columnStartXs = [startX];
  } else {
    // 2 columns symmetrically centered
    const totalGridWidth = 2 * COLUMN_WIDTH_MM + TWO_COL_GUTTER_MM;
    const gridLeft = (PAGE_WIDTH_MM - totalGridWidth) / 2;
    columnStartXs = [gridLeft, gridLeft + COLUMN_WIDTH_MM + TWO_COL_GUTTER_MM];
  }

  // Generate questions and bubble coordinates
  const questions: QuestionGeometry[] = [];

  for (let q = 1; q <= config.questions; q++) {
    // Sequential column-first distribution:
    // Col 0: 1 to rowsPerColumn
    // Col 1: rowsPerColumn + 1 to 2 * rowsPerColumn
    const colIndex = Math.floor((q - 1) / config.rowsPerColumn);
    const rowIndex = (q - 1) % config.rowsPerColumn;

    const colX = columnStartXs[colIndex];
    const rowY = GRID_START_Y + rowIndex * ROW_HEIGHT_MM;

    // Center vertical alignment of row items within the row
    const centerY = Number((rowY + ROW_HEIGHT_MM / 2).toFixed(3));

    // Question number position: right-aligned at colX + 7mm
    const numberPosition = {
      x: Number((colX + 7.0).toFixed(3)),
      y: centerY,
    };

    // First bubble starts at colX + 13.0mm
    const firstBubbleX = colX + 13.0;

    const bubblesRecord: Partial<Record<Choice, BubbleGeometry>> = {};

    CHOICES.forEach((choice, choiceIndex) => {
      const bubbleCenterX = Number((firstBubbleX + choiceIndex * BUBBLE_SPACING_MM).toFixed(3));
      bubblesRecord[choice] = {
        choice,
        center: {
          x: bubbleCenterX,
          y: centerY,
        },
        radius: BUBBLE_RADIUS_MM,
        detectionRadius: DETECTION_RADIUS_MM,
        labelOffset: {
          x: LABEL_OFFSET_X_MM,
          y: 0,
        },
      };
    });

    questions.push({
      question: q,
      column: colIndex,
      row: rowIndex,
      numberPosition,
      bounds: {
        x: Number(colX.toFixed(3)),
        y: Number(rowY.toFixed(3)),
        width: COLUMN_WIDTH_MM,
        height: ROW_HEIGHT_MM,
      },
      bubbles: bubblesRecord as Record<Choice, BubbleGeometry>,
    });
  }

  const sheetGeometry: SheetGeometry = {
    protocol: 'OMR',
    version: config.version,
    template: config.id,
    page: {
      paper: 'A4',
      width: PAGE_WIDTH_MM,
      height: PAGE_HEIGHT_MM,
      unit: 'mm',
      safeMargins: {
        top: SAFE_MARGIN_TOP_MM,
        bottom: SAFE_MARGIN_BOTTOM_MM,
        left: SAFE_MARGIN_LEFT_MM,
        right: SAFE_MARGIN_RIGHT_MM,
      },
    },
    markers,
    qr: {
      payload: qrPayload,
      bounds: {
        x: QR_POS_X_MM,
        y: QR_POS_Y_MM,
        width: QR_SIZE_MM,
        height: QR_SIZE_MM,
      },
      moduleCount,
      modules,
    },
    header: {
      bounds: {
        x: SAFE_MARGIN_LEFT_MM,
        y: HEADER_START_Y,
        width: PAGE_WIDTH_MM - 2 * SAFE_MARGIN_LEFT_MM,
        height: HEADER_HEIGHT,
      },
      title: config.title,
      templateId: config.id,
      versionText: `Protocol: OMR v${config.version} • A4 • ${config.questions} Questions`,
      studentFields: {
        name: {
          label: 'NAME',
          labelPosition: { x: 24, y: 38 },
          line: { x1: 37, y1: 38, x2: 95, y2: 38 },
        },
        className: {
          label: 'CLASS',
          labelPosition: { x: 104, y: 38 },
          line: { x1: 119, y1: 38, x2: 162, y2: 38 },
        },
        date: {
          label: 'DATE',
          labelPosition: { x: 24, y: 44 },
          line: { x1: 37, y1: 44, x2: 95, y2: 44 },
        },
        testId: {
          label: 'TEST ID',
          labelPosition: { x: 104, y: 44 },
          line: { x1: 122, y1: 44, x2: 162, y2: 44 },
        },
      },
    },
    grid: {
      columns: config.columns,
      rowsPerColumn: config.rowsPerColumn,
      rowHeight: ROW_HEIGHT_MM,
      colWidth: COLUMN_WIDTH_MM,
      gutter: config.columns > 1 ? TWO_COL_GUTTER_MM : 0,
    },
    questions,
  };

  if (config.questions <= 20) {
    sheetGeometry.halfSheetGeometry = generateHalfSheetGeometry(config);
  }

  return sheetGeometry;
}

/**
 * Generates canonical geometry for a half-sheet (A5 size: 210mm x 148.5mm).
 * Used when printing 2-up on A4, and when scanning a cut half-sheet.
 */
export function generateHalfSheetGeometry(config: TemplateConfig): SheetGeometry {
  const halfSize = MARKER_SIZE_MM / 2;
  const HALF_HEIGHT = 148.5;
  const TOP_MARGIN = 10.0;
  const BOTTOM_MARGIN = 138.5;

  const markers: RegistrationMarkerGeometry[] = [
    {
      id: 'TL',
      center: { x: MARKER_OFFSET_MM, y: TOP_MARGIN },
      width: MARKER_SIZE_MM,
      height: MARKER_SIZE_MM,
      bounds: {
        x: MARKER_OFFSET_MM - halfSize,
        y: TOP_MARGIN - halfSize,
        width: MARKER_SIZE_MM,
        height: MARKER_SIZE_MM,
      },
    },
    {
      id: 'TR',
      center: { x: PAGE_WIDTH_MM - MARKER_OFFSET_MM, y: TOP_MARGIN },
      width: MARKER_SIZE_MM,
      height: MARKER_SIZE_MM,
      bounds: {
        x: PAGE_WIDTH_MM - MARKER_OFFSET_MM - halfSize,
        y: TOP_MARGIN - halfSize,
        width: MARKER_SIZE_MM,
        height: MARKER_SIZE_MM,
      },
    },
    {
      id: 'BL',
      center: { x: MARKER_OFFSET_MM, y: BOTTOM_MARGIN },
      width: MARKER_SIZE_MM,
      height: MARKER_SIZE_MM,
      bounds: {
        x: MARKER_OFFSET_MM - halfSize,
        y: BOTTOM_MARGIN - halfSize,
        width: MARKER_SIZE_MM,
        height: MARKER_SIZE_MM,
      },
    },
    {
      id: 'BR',
      center: { x: PAGE_WIDTH_MM - MARKER_OFFSET_MM, y: BOTTOM_MARGIN },
      width: MARKER_SIZE_MM,
      height: MARKER_SIZE_MM,
      bounds: {
        x: PAGE_WIDTH_MM - MARKER_OFFSET_MM - halfSize,
        y: BOTTOM_MARGIN - halfSize,
        width: MARKER_SIZE_MM,
        height: MARKER_SIZE_MM,
      },
    },
  ];

  const qrPayload = WEBAPP_URL;
  const { moduleCount, modules } = generateQRModules(qrPayload);

  let columnStartXs: number[] = [];
  if (config.columns === 1) {
    const startX = (PAGE_WIDTH_MM - COLUMN_WIDTH_MM) / 2;
    columnStartXs = [startX];
  } else {
    const totalGridWidth = 2 * COLUMN_WIDTH_MM + TWO_COL_GUTTER_MM;
    const gridLeft = (PAGE_WIDTH_MM - totalGridWidth) / 2;
    columnStartXs = [gridLeft, gridLeft + COLUMN_WIDTH_MM + TWO_COL_GUTTER_MM];
  }

  const GRID_Y = 34.0;
  const questions: QuestionGeometry[] = [];

  for (let q = 1; q <= config.questions; q++) {
    const colIndex = Math.floor((q - 1) / config.rowsPerColumn);
    const rowIndex = (q - 1) % config.rowsPerColumn;
    const colX = columnStartXs[colIndex];
    const rowY = GRID_Y + rowIndex * ROW_HEIGHT_MM;
    const centerY = Number((rowY + ROW_HEIGHT_MM / 2).toFixed(3));

    const numberPosition = {
      x: Number((colX + 7.0).toFixed(3)),
      y: centerY,
    };
    const firstBubbleX = colX + 13.0;
    const bubblesRecord: Partial<Record<Choice, BubbleGeometry>> = {};

    CHOICES.forEach((choice, choiceIndex) => {
      const bubbleCenterX = Number((firstBubbleX + choiceIndex * BUBBLE_SPACING_MM).toFixed(3));
      bubblesRecord[choice] = {
        choice,
        center: { x: bubbleCenterX, y: centerY },
        radius: BUBBLE_RADIUS_MM,
        detectionRadius: DETECTION_RADIUS_MM,
        labelOffset: { x: LABEL_OFFSET_X_MM, y: 0 },
      };
    });

    questions.push({
      question: q,
      column: colIndex,
      row: rowIndex,
      numberPosition,
      bounds: {
        x: Number(colX.toFixed(3)),
        y: Number(rowY.toFixed(3)),
        width: COLUMN_WIDTH_MM,
        height: ROW_HEIGHT_MM,
      },
      bubbles: bubblesRecord as Record<Choice, BubbleGeometry>,
    });
  }

  return {
    protocol: 'OMR',
    version: config.version,
    template: config.id,
    page: {
      paper: 'A4',
      width: PAGE_WIDTH_MM,
      height: HALF_HEIGHT,
      unit: 'mm',
      safeMargins: {
        top: 8,
        bottom: HALF_HEIGHT - 8,
        left: SAFE_MARGIN_LEFT_MM,
        right: SAFE_MARGIN_RIGHT_MM,
      },
    },
    markers,
    qr: {
      payload: qrPayload,
      bounds: {
        x: QR_POS_X_MM,
        y: 10.0,
        width: 16.0,
        height: 16.0,
      },
      moduleCount,
      modules,
    },
    header: {
      bounds: {
        x: SAFE_MARGIN_LEFT_MM,
        y: 10.0,
        width: PAGE_WIDTH_MM - 2 * SAFE_MARGIN_LEFT_MM,
        height: 20.0,
      },
      title: config.title,
      templateId: config.id,
      versionText: `Protocol: OMR v${config.version} • A5 • ${config.questions} Questions`,
      studentFields: {
        name: {
          label: 'NAME',
          labelPosition: { x: 24, y: 16 },
          line: { x1: 37, y1: 16, x2: 95, y2: 16 },
        },
        className: {
          label: 'CLASS',
          labelPosition: { x: 104, y: 16 },
          line: { x1: 119, y1: 16, x2: 162, y2: 16 },
        },
        date: {
          label: 'DATE',
          labelPosition: { x: 24, y: 23 },
          line: { x1: 37, y1: 23, x2: 95, y2: 23 },
        },
        testId: {
          label: 'TEST ID',
          labelPosition: { x: 104, y: 23 },
          line: { x1: 122, y1: 23, x2: 162, y2: 23 },
        },
      },
    },
    grid: {
      columns: config.columns,
      rowsPerColumn: config.rowsPerColumn,
      rowHeight: ROW_HEIGHT_MM,
      colWidth: COLUMN_WIDTH_MM,
      gutter: config.columns > 1 ? TWO_COL_GUTTER_MM : 0,
    },
    questions,
  };
}
