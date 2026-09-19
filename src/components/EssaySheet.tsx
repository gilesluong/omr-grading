import React from 'react';

export type EssayLayout = 'side-by-side' | 'top-bottom';

export interface EssaySheetProps {
  layout?: EssayLayout;
}

export const EssaySheet: React.FC<EssaySheetProps> = ({
  layout = 'side-by-side',
}) => {
  if (layout === 'top-bottom') {
    // 2 Pages on 1 Paper - Top and Bottom Portrait A4 (210mm x 297mm)
    // Page 1: Top half (0 - 148.5mm), Page 2: Bottom half (148.5 - 297mm)
    const page1Lines = [60, 68, 76, 84, 92, 100, 108, 116, 124, 132, 140];
    const page2Lines = [
      172, 180, 188, 196, 204, 212, 220, 228, 236, 244, 252, 260, 268, 276,
      284,
    ];

    return (
      <div className="essay-sheet-wrapper">
        <svg
          xmlns="http://www.w3.org/2000/svg"
          viewBox="0 0 210 297"
          width="210mm"
          height="297mm"
          className="essay-sheet-svg"
          data-testid="essay-sheet-portrait"
        >
          {/* Crisp white background */}
          <rect width="210" height="297" fill="#FFFFFF" />

          {/* ================= PAGE 1 (TOP HALF) ================= */}
          <g data-role="essay-page-1">
            {/* Header Titles */}
            <text
              x="14"
              y="11"
              fill="#000000"
              fontSize="3.4"
              fontWeight="bold"
              fontFamily="system-ui, -apple-system, sans-serif"
            >
              ESSAY ANSWER SHEET
            </text>
            <text
              x="14"
              y="15.5"
              fill="#64748b"
              fontSize="1.9"
              fontWeight="600"
              fontFamily="system-ui, -apple-system, sans-serif"
            >
              Written Response • Page 1 of 2
            </text>

            {/* Student Info Fields */}
            <g data-role="student-info">
              {/* Row 1: Name and Class */}
              <text
                x="14"
                y="21"
                dominantBaseline="central"
                fill="#000000"
                fontSize="2.1"
                fontWeight="bold"
                fontFamily="system-ui, -apple-system, sans-serif"
              >
                Name:
              </text>
              <line
                x1="33"
                y1="21.8"
                x2="128"
                y2="21.8"
                stroke="#000000"
                strokeWidth="0.3"
                strokeDasharray="1.5 1.5"
              />

              <text
                x="134"
                y="21"
                dominantBaseline="central"
                fill="#000000"
                fontSize="2.1"
                fontWeight="bold"
                fontFamily="system-ui, -apple-system, sans-serif"
              >
                Class:
              </text>
              <line
                x1="144"
                y1="21.8"
                x2="196"
                y2="21.8"
                stroke="#000000"
                strokeWidth="0.3"
                strokeDasharray="1.5 1.5"
              />

              {/* Row 2: ID, Date, Subject */}
              <text
                x="14"
                y="26.5"
                dominantBaseline="central"
                fill="#000000"
                fontSize="2.1"
                fontWeight="bold"
                fontFamily="system-ui, -apple-system, sans-serif"
              >
                ID:
              </text>
              <line
                x1="26"
                y1="27.3"
                x2="65"
                y2="27.3"
                stroke="#000000"
                strokeWidth="0.3"
                strokeDasharray="1.5 1.5"
              />

              <text
                x="71"
                y="26.5"
                dominantBaseline="central"
                fill="#000000"
                fontSize="2.1"
                fontWeight="bold"
                fontFamily="system-ui, -apple-system, sans-serif"
              >
                Date:
              </text>
              <line
                x1="87"
                y1="27.3"
                x2="128"
                y2="27.3"
                stroke="#000000"
                strokeWidth="0.3"
                strokeDasharray="1.5 1.5"
              />

              <text
                x="134"
                y="26.5"
                dominantBaseline="central"
                fill="#000000"
                fontSize="2.1"
                fontWeight="bold"
                fontFamily="system-ui, -apple-system, sans-serif"
              >
                Subject:
              </text>
              <line
                x1="147"
                y1="27.3"
                x2="196"
                y2="27.3"
                stroke="#000000"
                strokeWidth="0.3"
                strokeDasharray="1.5 1.5"
              />
            </g>

            {/* Score & Remarks Box */}
            <g data-role="score-box">
              <rect
                x="14"
                y="31"
                width="182"
                height="14"
                fill="none"
                stroke="#000000"
                strokeWidth="0.35"
              />
              <line
                x1="14"
                y1="35.5"
                x2="196"
                y2="35.5"
                stroke="#000000"
                strokeWidth="0.3"
              />
              <line
                x1="55"
                y1="31"
                x2="55"
                y2="45"
                stroke="#000000"
                strokeWidth="0.3"
              />
              <line
                x1="34.5"
                y1="35.5"
                x2="34.5"
                y2="45"
                stroke="#000000"
                strokeWidth="0.25"
                strokeDasharray="1 1"
              />
              <text
                x="34.5"
                y="33.8"
                textAnchor="middle"
                dominantBaseline="central"
                fontSize="1.9"
                fontWeight="bold"
                fontFamily="system-ui, -apple-system, sans-serif"
              >
                SCORE
              </text>
              <text
                x="24.25"
                y="37.8"
                textAnchor="middle"
                dominantBaseline="central"
                fontSize="1.6"
                fill="#64748b"
                fontFamily="system-ui, -apple-system, sans-serif"
              >
                Số
              </text>
              <text
                x="44.75"
                y="37.8"
                textAnchor="middle"
                dominantBaseline="central"
                fontSize="1.6"
                fill="#64748b"
                fontFamily="system-ui, -apple-system, sans-serif"
              >
                Chữ
              </text>
              <text
                x="125.5"
                y="33.8"
                textAnchor="middle"
                dominantBaseline="central"
                fontSize="1.9"
                fontWeight="bold"
                fontFamily="system-ui, -apple-system, sans-serif"
              >
                TEACHER REMARKS
              </text>
            </g>

            {/* Writing Area Page 1 */}
            <text
              x="14"
              y="52"
              dominantBaseline="central"
              fontSize="2.3"
              fontWeight="bold"
              fontFamily="system-ui, -apple-system, sans-serif"
            >
              RESPONSE:
            </text>
            <line
              x1="28"
              y1="55"
              x2="28"
              y2="142"
              stroke="#94a3b8"
              strokeWidth="0.3"
            />
            <text
              x="21"
              y="58"
              textAnchor="middle"
              dominantBaseline="central"
              fontSize="1.5"
              fill="#94a3b8"
              fontFamily="system-ui, -apple-system, sans-serif"
            >
              Margin
            </text>

            {/* Ruled lines Page 1 */}
            {page1Lines.map((y, idx) => (
              <line
                key={`p1-line-${idx}`}
                x1="14"
                y1={y}
                x2="196"
                y2={y}
                stroke="#cbd5e1"
                strokeWidth="0.3"
              />
            ))}

            <text
              x="105"
              y="145"
              textAnchor="middle"
              dominantBaseline="central"
              fontSize="2.0"
              fontWeight="600"
              fill="#64748b"
              fontFamily="system-ui, -apple-system, sans-serif"
            >
              — Page 1 of 2 —
            </text>
          </g>

          {/* ================= MIDDLE SCISSOR CUT LINE ================= */}
          <g data-role="middle-cut-line">
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
              ✂ - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - -
              - - - - - - - - - - - - - - - - - - - - - - - - - - - ✂
            </text>
          </g>

          {/* ================= PAGE 2 (BOTTOM HALF) ================= */}
          <g data-role="essay-page-2">
            {/* Compact Header */}
            <text
              x="14"
              y="157"
              dominantBaseline="central"
              fill="#000000"
              fontSize="2.1"
              fontWeight="bold"
              fontFamily="system-ui, -apple-system, sans-serif"
            >
              Name:
            </text>
            <line
              x1="33"
              y1="157.8"
              x2="135"
              y2="157.8"
              stroke="#000000"
              strokeWidth="0.3"
              strokeDasharray="1.5 1.5"
            />
            <text
              x="142"
              y="157"
              dominantBaseline="central"
              fill="#000000"
              fontSize="2.1"
              fontWeight="bold"
              fontFamily="system-ui, -apple-system, sans-serif"
            >
              Class:
            </text>
            <line
              x1="152"
              y1="157.8"
              x2="196"
              y2="157.8"
              stroke="#000000"
              strokeWidth="0.3"
              strokeDasharray="1.5 1.5"
            />

            <text
              x="14"
              y="163"
              dominantBaseline="central"
              fill="#64748b"
              fontSize="1.9"
              fontWeight="600"
              fontFamily="system-ui, -apple-system, sans-serif"
            >
              Continuation • Page 2 of 2
            </text>
            <line
              x1="14"
              y1="166"
              x2="196"
              y2="166"
              stroke="#000000"
              strokeWidth="0.3"
            />

            {/* Writing Area Page 2 */}
            <line
              x1="28"
              y1="169"
              x2="28"
              y2="286"
              stroke="#94a3b8"
              strokeWidth="0.3"
            />
            <text
              x="21"
              y="172"
              textAnchor="middle"
              dominantBaseline="central"
              fontSize="1.5"
              fill="#94a3b8"
              fontFamily="system-ui, -apple-system, sans-serif"
            >
              Margin
            </text>

            {/* Ruled lines Page 2 */}
            {page2Lines.map((y, idx) => (
              <line
                key={`p2-line-${idx}`}
                x1="14"
                y1={y}
                x2="196"
                y2={y}
                stroke="#cbd5e1"
                strokeWidth="0.3"
              />
            ))}

            <text
              x="105"
              y="292"
              textAnchor="middle"
              dominantBaseline="central"
              fontSize="2.0"
              fontWeight="600"
              fill="#64748b"
              fontFamily="system-ui, -apple-system, sans-serif"
            >
              — Page 2 of 2 —
            </text>
            <text
              x="196"
              y="292"
              textAnchor="end"
              dominantBaseline="central"
              fontSize="1.9"
              fontWeight="bold"
              fill="#64748b"
              fontFamily="system-ui, -apple-system, sans-serif"
            >
              — End of Exam —
            </text>
          </g>
        </svg>
      </div>
    );
  }

  // DEFAULT: Side-by-side Landscape A4 (297mm x 210mm)
  // Left half = Page 1 (0 to 148.5mm), Right half = Page 2 (148.5 to 297mm)
  // Standard A5 portrait pages side-by-side, perfect for exam booklet or folding
  const page1Lines = [
    68, 76, 84, 92, 100, 108, 116, 124, 132, 140, 148, 156, 164, 172, 180, 188,
    196,
  ];
  const page2Lines = [
    28, 36, 44, 52, 60, 68, 76, 84, 92, 100, 108, 116, 124, 132, 140, 148, 156,
    164, 172, 180, 188, 196,
  ];

  return (
    <div className="essay-sheet-wrapper">
      <svg
        xmlns="http://www.w3.org/2000/svg"
        viewBox="0 0 297 210"
        width="297mm"
        height="210mm"
        className="essay-sheet-svg"
        data-testid="essay-sheet-landscape"
      >
        {/* Crisp white background */}
        <rect width="297" height="210" fill="#FFFFFF" />

        {/* ================= PAGE 1 (LEFT HALF: 0 - 148.5mm) ================= */}
        <g data-role="essay-page-1">
          {/* Header Title */}
          <text
            x="12"
            y="13"
            fill="#000000"
            fontSize="3.6"
            fontWeight="bold"
            fontFamily="system-ui, -apple-system, sans-serif"
          >
            ESSAY ANSWER SHEET
          </text>
          <text
            x="12"
            y="17.5"
            fill="#64748b"
            fontSize="1.9"
            fontWeight="600"
            fontFamily="system-ui, -apple-system, sans-serif"
          >
            Written Response • Page 1 of 2
          </text>

          {/* Student Info Fields */}
          <g data-role="student-info">
            {/* Row 1: Name */}
            <text
              x="12"
              y="23"
              dominantBaseline="central"
              fill="#000000"
              fontSize="2.1"
              fontWeight="bold"
              fontFamily="system-ui, -apple-system, sans-serif"
            >
              Name:
            </text>
            <line
              x1="31"
              y1="23.8"
              x2="136.5"
              y2="23.8"
              stroke="#000000"
              strokeWidth="0.3"
              strokeDasharray="1.5 1.5"
            />

            {/* Row 2: Class & ID */}
            <text
              x="12"
              y="28.5"
              dominantBaseline="central"
              fill="#000000"
              fontSize="2.1"
              fontWeight="bold"
              fontFamily="system-ui, -apple-system, sans-serif"
            >
              Class:
            </text>
            <line
              x1="22"
              y1="29.3"
              x2="68"
              y2="29.3"
              stroke="#000000"
              strokeWidth="0.3"
              strokeDasharray="1.5 1.5"
            />

            <text
              x="74"
              y="28.5"
              dominantBaseline="central"
              fill="#000000"
              fontSize="2.1"
              fontWeight="bold"
              fontFamily="system-ui, -apple-system, sans-serif"
            >
              ID:
            </text>
            <line
              x1="86"
              y1="29.3"
              x2="136.5"
              y2="29.3"
              stroke="#000000"
              strokeWidth="0.3"
              strokeDasharray="1.5 1.5"
            />

            {/* Row 3: Date & Subject */}
            <text
              x="12"
              y="34"
              dominantBaseline="central"
              fill="#000000"
              fontSize="2.1"
              fontWeight="bold"
              fontFamily="system-ui, -apple-system, sans-serif"
            >
              Date:
            </text>
            <line
              x1="28"
              y1="34.8"
              x2="68"
              y2="34.8"
              stroke="#000000"
              strokeWidth="0.3"
              strokeDasharray="1.5 1.5"
            />

            <text
              x="74"
              y="34"
              dominantBaseline="central"
              fill="#000000"
              fontSize="2.1"
              fontWeight="bold"
              fontFamily="system-ui, -apple-system, sans-serif"
            >
              Subject:
            </text>
            <line
              x1="90"
              y1="34.8"
              x2="136.5"
              y2="34.8"
              stroke="#000000"
              strokeWidth="0.3"
              strokeDasharray="1.5 1.5"
            />
          </g>

          {/* Score & Remarks Box */}
          <g data-role="score-box">
            <rect
              x="12"
              y="38.5"
              width="124.5"
              height="14"
              fill="none"
              stroke="#000000"
              strokeWidth="0.35"
            />
            <line
              x1="12"
              y1="43"
              x2="136.5"
              y2="43"
              stroke="#000000"
              strokeWidth="0.3"
            />
            <line
              x1="46"
              y1="38.5"
              x2="46"
              y2="52.5"
              stroke="#000000"
              strokeWidth="0.3"
            />
            <line
              x1="29"
              y1="43"
              x2="29"
              y2="52.5"
              stroke="#000000"
              strokeWidth="0.25"
              strokeDasharray="1 1"
            />
            <text
              x="29"
              y="41"
              textAnchor="middle"
              dominantBaseline="central"
              fontSize="1.9"
              fontWeight="bold"
              fontFamily="system-ui, -apple-system, sans-serif"
            >
              SCORE
            </text>
            <text
              x="20.5"
              y="45.5"
              textAnchor="middle"
              dominantBaseline="central"
              fontSize="1.6"
              fill="#64748b"
              fontFamily="system-ui, -apple-system, sans-serif"
            >
              Số
            </text>
            <text
              x="37.5"
              y="45.5"
              textAnchor="middle"
              dominantBaseline="central"
              fontSize="1.6"
              fill="#64748b"
              fontFamily="system-ui, -apple-system, sans-serif"
            >
              Chữ
            </text>
            <text
              x="91.25"
              y="41"
              textAnchor="middle"
              dominantBaseline="central"
              fontSize="1.9"
              fontWeight="bold"
              fontFamily="system-ui, -apple-system, sans-serif"
            >
              TEACHER REMARKS
            </text>
          </g>

          {/* Writing Area Page 1 */}
          <text
            x="12"
            y="59"
            dominantBaseline="central"
            fontSize="2.3"
            fontWeight="bold"
            fontFamily="system-ui, -apple-system, sans-serif"
          >
            RESPONSE:
          </text>
          <line
            x1="25"
            y1="62"
            x2="25"
            y2="198"
            stroke="#94a3b8"
            strokeWidth="0.3"
          />
          <text
            x="18.5"
            y="65"
            textAnchor="middle"
            dominantBaseline="central"
            fontSize="1.5"
            fill="#94a3b8"
            fontFamily="system-ui, -apple-system, sans-serif"
          >
            Margin
          </text>

          {/* Ruled lines Page 1 */}
          {page1Lines.map((y, idx) => (
            <line
              key={`side-p1-line-${idx}`}
              x1="12"
              y1={y}
              x2="136.5"
              y2={y}
              stroke="#cbd5e1"
              strokeWidth="0.3"
            />
          ))}

          <text
            x="74.25"
            y="204"
            textAnchor="middle"
            dominantBaseline="central"
            fontSize="2.0"
            fontWeight="600"
            fill="#64748b"
            fontFamily="system-ui, -apple-system, sans-serif"
          >
            — Page 1 of 2 —
          </text>
        </g>

        {/* ================= MIDDLE FOLD / CUT GUIDE ================= */}
        <g data-role="center-cut-line">
          <line
            x1="148.5"
            y1="6"
            x2="148.5"
            y2="204"
            stroke="#94a3b8"
            strokeWidth="0.35"
            strokeDasharray="3 2"
          />
          <text
            x="148.5"
            y="11"
            textAnchor="middle"
            dominantBaseline="central"
            fontSize="2.8"
            fill="#64748b"
          >
            ✂
          </text>
          <text
            x="148.5"
            y="105"
            textAnchor="middle"
            dominantBaseline="central"
            fontSize="2.1"
            fontWeight="600"
            fill="#94a3b8"
            fontFamily="system-ui, -apple-system, sans-serif"
            transform="rotate(-90 148.5 105)"
          >
            ✂ - - - FOLD OR CUT LINE - - - ✂
          </text>
          <text
            x="148.5"
            y="200"
            textAnchor="middle"
            dominantBaseline="central"
            fontSize="2.8"
            fill="#64748b"
          >
            ✂
          </text>
        </g>

        {/* ================= PAGE 2 (RIGHT HALF: 148.5 - 297mm) ================= */}
        <g data-role="essay-page-2">
          {/* Compact Header */}
          <text
            x="160.5"
            y="13"
            dominantBaseline="central"
            fill="#000000"
            fontSize="2.1"
            fontWeight="bold"
            fontFamily="system-ui, -apple-system, sans-serif"
          >
            Name:
          </text>
          <line
            x1="179.5"
            y1="13.8"
            x2="238"
            y2="13.8"
            stroke="#000000"
            strokeWidth="0.3"
            strokeDasharray="1.5 1.5"
          />

          <text
            x="245"
            y="13"
            dominantBaseline="central"
            fill="#000000"
            fontSize="2.1"
            fontWeight="bold"
            fontFamily="system-ui, -apple-system, sans-serif"
          >
            Class:
          </text>
          <line
            x1="255"
            y1="13.8"
            x2="285"
            y2="13.8"
            stroke="#000000"
            strokeWidth="0.3"
            strokeDasharray="1.5 1.5"
          />

          <text
            x="160.5"
            y="18.5"
            dominantBaseline="central"
            fill="#64748b"
            fontSize="1.9"
            fontWeight="600"
            fontFamily="system-ui, -apple-system, sans-serif"
          >
            Continuation • Page 2 of 2
          </text>
          <line
            x1="160.5"
            y1="21.5"
            x2="285"
            y2="21.5"
            stroke="#000000"
            strokeWidth="0.3"
          />

          {/* Writing Area Page 2 */}
          <line
            x1="173.5"
            y1="24"
            x2="173.5"
            y2="198"
            stroke="#94a3b8"
            strokeWidth="0.3"
          />
          <text
            x="167"
            y="27"
            textAnchor="middle"
            dominantBaseline="central"
            fontSize="1.5"
            fill="#94a3b8"
            fontFamily="system-ui, -apple-system, sans-serif"
          >
            Margin
          </text>

          {/* Ruled lines Page 2 */}
          {page2Lines.map((y, idx) => (
            <line
              key={`side-p2-line-${idx}`}
              x1="160.5"
              y1={y}
              x2="285"
              y2={y}
              stroke="#cbd5e1"
              strokeWidth="0.3"
            />
          ))}

          <text
            x="222.75"
            y="204"
            textAnchor="middle"
            dominantBaseline="central"
            fontSize="2.0"
            fontWeight="600"
            fill="#64748b"
            fontFamily="system-ui, -apple-system, sans-serif"
          >
            — Page 2 of 2 —
          </text>
          <text
            x="285"
            y="204"
            textAnchor="end"
            dominantBaseline="central"
            fontSize="1.9"
            fontWeight="bold"
            fill="#64748b"
            fontFamily="system-ui, -apple-system, sans-serif"
          >
            — End of Exam —
          </text>
        </g>
      </svg>
    </div>
  );
};

export default EssaySheet;
