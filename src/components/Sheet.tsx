import { Choice, SheetGeometry } from '../omr/types';
import { RegistrationMarker } from './RegistrationMarker';
import { Bubble } from './Bubble';
import { TemplateQR } from './TemplateQR';
import { DebugOverlay } from './DebugOverlay';

interface SheetProps {
  geometry: SheetGeometry;
  debug?: boolean;
  interactiveMarks?: Record<number, Choice>;
  onToggleBubble?: (question: number, choice: Choice) => void;
  isDouble?: boolean;
}

const renderSheetElements = (
  geom: SheetGeometry,
  keyPrefix: string,
  marks: Record<number, Choice>,
  onToggle?: (question: number, choice: Choice) => void,
) => {
  const { markers, qr, header, questions, page } = geom;
  return (
    <>
      {/* 1. Four Registration Markers */}
      <g data-role="registration-markers">
        {markers.map((marker) => (
          <RegistrationMarker
            key={`${keyPrefix}-marker-${marker.id}`}
            marker={marker}
          />
        ))}
      </g>

      {/* 2. Header Area */}
      <g data-role="sheet-header">
        <g data-role="student-info">
          {/* Student Name */}
          <text
            x={header.studentFields.name.labelPosition.x}
            y={header.studentFields.name.labelPosition.y}
            dominantBaseline="central"
            fill="#000000"
            fontSize="2.2"
            fontWeight="bold"
            fontFamily="system-ui, -apple-system, sans-serif"
          >
            {header.studentFields.name.label}:
          </text>
          <line
            x1={header.studentFields.name.line.x1}
            y1={header.studentFields.name.line.y1 + 1.2}
            x2={header.studentFields.name.line.x2}
            y2={header.studentFields.name.line.y2 + 1.2}
            stroke="#000000"
            strokeWidth="0.3"
          />

          {/* Class Field */}
          <text
            x={header.studentFields.className.labelPosition.x}
            y={header.studentFields.className.labelPosition.y}
            dominantBaseline="central"
            fill="#000000"
            fontSize="2.2"
            fontWeight="bold"
            fontFamily="system-ui, -apple-system, sans-serif"
          >
            {header.studentFields.className.label}:
          </text>
          <line
            x1={header.studentFields.className.line.x1}
            y1={header.studentFields.className.line.y1 + 1.2}
            x2={header.studentFields.className.line.x2}
            y2={header.studentFields.className.line.y2 + 1.2}
            stroke="#000000"
            strokeWidth="0.3"
          />

          {/* Date Field */}
          <text
            x={header.studentFields.date.labelPosition.x}
            y={header.studentFields.date.labelPosition.y}
            dominantBaseline="central"
            fill="#000000"
            fontSize="2.2"
            fontWeight="bold"
            fontFamily="system-ui, -apple-system, sans-serif"
          >
            {header.studentFields.date.label}:
          </text>
          <line
            x1={header.studentFields.date.line.x1}
            y1={header.studentFields.date.line.y1 + 1.2}
            x2={header.studentFields.date.line.x2}
            y2={header.studentFields.date.line.y2 + 1.2}
            stroke="#000000"
            strokeWidth="0.3"
          />

          {/* Test ID Field */}
          <text
            x={header.studentFields.testId.labelPosition.x}
            y={header.studentFields.testId.labelPosition.y}
            dominantBaseline="central"
            fill="#000000"
            fontSize="2.2"
            fontWeight="bold"
            fontFamily="system-ui, -apple-system, sans-serif"
          >
            {header.studentFields.testId.label}:
          </text>
          <line
            x1={header.studentFields.testId.line.x1}
            y1={header.studentFields.testId.line.y1 + 1.2}
            x2={header.studentFields.testId.line.x2}
            y2={header.studentFields.testId.line.y2 + 1.2}
            stroke="#000000"
            strokeWidth="0.3"
          />
        </g>

        {/* Divider rule separating header from question grid, stopping before QR code */}
        <line
          x1={page.safeMargins.left}
          y1={header.studentFields.date.labelPosition.y + 5.0}
          x2={qr.bounds.x - 4.0}
          y2={header.studentFields.date.labelPosition.y + 5.0}
          stroke="#000000"
          strokeWidth="0.35"
        />
      </g>

      {/* 3. Machine-readable QR Code */}
      <TemplateQR qr={qr} />

      {/* 4. Question Rows */}
      <g data-role="question-grid">
        {questions.map((q) => (
          <g
            key={`${keyPrefix}-question-${q.question}`}
            data-question-number={q.question}
          >
            {/* Question Number */}
            <text
              x={q.numberPosition.x}
              y={q.numberPosition.y}
              textAnchor="end"
              dominantBaseline="central"
              fill="#000000"
              fontSize="2.8"
              fontWeight="700"
              fontFamily="system-ui, -apple-system, sans-serif"
            >
              {String(q.question).padStart(2, "0")}
            </text>

            {/* Bubbles A, B, C, D */}
            <Bubble
              bubble={q.bubbles.A}
              questionNumber={q.question}
              isMarked={marks[q.question] === "A"}
              onClick={onToggle ? () => onToggle(q.question, "A") : undefined}
            />
            <Bubble
              bubble={q.bubbles.B}
              questionNumber={q.question}
              isMarked={marks[q.question] === "B"}
              onClick={onToggle ? () => onToggle(q.question, "B") : undefined}
            />
            <Bubble
              bubble={q.bubbles.C}
              questionNumber={q.question}
              isMarked={marks[q.question] === "C"}
              onClick={onToggle ? () => onToggle(q.question, "C") : undefined}
            />
            <Bubble
              bubble={q.bubbles.D}
              questionNumber={q.question}
              isMarked={marks[q.question] === "D"}
              onClick={onToggle ? () => onToggle(q.question, "D") : undefined}
            />
          </g>
        ))}
      </g>
    </>
  );
};

export const Sheet: React.FC<SheetProps> = ({
  geometry,
  debug = false,
  interactiveMarks = {},
  onToggleBubble,
  isDouble = false,
}) => {
  // Double-sheet 2-up layout for 10MCQ & 20MCQ on A4
  if (isDouble && geometry.halfSheetGeometry) {
    const half = geometry.halfSheetGeometry;
    return (
      <div className="omr-sheet-wrapper">
        <svg
          xmlns="http://www.w3.org/2000/svg"
          viewBox="0 0 210 297"
          width="210mm"
          height="297mm"
          className="omr-sheet-svg"
        >
          {/* Crisp white background */}
          <rect width="210" height="297" fill="#FFFFFF" />

          {/* Top Half-Sheet */}
          <g data-role="sheet-half-top">
            {renderSheetElements(half, "top", interactiveMarks, onToggleBubble)}
          </g>

          {/* Middle Cutting Line */}
          <g data-role="cut-line">
            <line
              x1="8"
              y1="148.5"
              x2="202"
              y2="148.5"
              stroke="#94a3b8"
              strokeWidth="0.35"
              strokeDasharray="3 2"
            />
            <text
              x="105"
              y="148.5"
              textAnchor="middle"
              dominantBaseline="central"
              fill="#64748b"
              fontSize="2.4"
              fontWeight="600"
              fontFamily="system-ui, -apple-system, sans-serif"
            >
              ✂ - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - ✂
            </text>
          </g>

          {/* Bottom Half-Sheet */}
          <g data-role="sheet-half-bottom" transform="translate(0, 148.5)">
            {renderSheetElements(
              half,
              "bottom",
              interactiveMarks,
              onToggleBubble,
            )}
          </g>

          {/* Optional Debug Overlay */}
          {debug && <DebugOverlay geometry={geometry} />}
        </svg>
      </div>
    );
  }

  // Standard Single Sheet Layout
  const { page } = geometry;
  return (
    <div className="omr-sheet-wrapper">
      <svg
        xmlns="http://www.w3.org/2000/svg"
        viewBox={`0 0 ${page.width} ${page.height}`}
        width={`${page.width}mm`}
        height={`${page.height}mm`}
        className="omr-sheet-svg"
      >
        {/* Crisp white background */}
        <rect width={page.width} height={page.height} fill="#FFFFFF" />

        {renderSheetElements(
          geometry,
          "single",
          interactiveMarks,
          onToggleBubble,
        )}

        {/* Optional Debug Overlay */}
        {debug && <DebugOverlay geometry={geometry} />}
      </svg>
    </div>
  );
};
