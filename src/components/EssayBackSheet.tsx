import React from 'react';

export interface EssayBackSheetProps {
  isDouble?: boolean;
}

export const EssayBackSheet: React.FC<EssayBackSheetProps> = ({
  isDouble = false,
}) => {
  // If isDouble (2-up): renders two half-sheet ruled line blocks divided by cut line
  if (isDouble) {
    const topLines = [
      16, 24.5, 33, 41.5, 50, 58.5, 67, 75.5, 84, 92.5, 101, 109.5, 118, 126.5,
      135,
    ];
    const bottomLines = [
      157, 165.5, 174, 182.5, 191, 199.5, 208, 216.5, 225, 233.5, 242, 250.5,
      259, 267.5, 276,
    ];

    return (
      <div className="essay-sheet-wrapper" data-testid="essay-back-double">
        <svg
          xmlns="http://www.w3.org/2000/svg"
          viewBox="0 0 210 297"
          width="210mm"
          height="297mm"
          className="essay-sheet-svg"
        >
          <rect width="210" height="297" fill="#FFFFFF" />

          {/* Top Half Ruled Lines */}
          <g data-role="essay-back-half-top">
            {topLines.map((y, idx) => (
              <line
                key={`top-line-${idx}`}
                x1="16"
                y1={y}
                x2="194"
                y2={y}
                stroke="#cbd5e1"
                strokeWidth="0.35"
              />
            ))}
          </g>

          {/* Scissor Cut Line Guide */}
          <g data-role="scissor-divider">
            <line
              x1="10"
              y1="148.5"
              x2="200"
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
              fontSize="2.2"
              fontWeight="600"
              fontFamily="system-ui, -apple-system, sans-serif"
            >
              ✂ - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - -
              - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - ✂
            </text>
          </g>

          {/* Bottom Half Ruled Lines */}
          <g data-role="essay-back-half-bottom">
            {bottomLines.map((y, idx) => (
              <line
                key={`bot-line-${idx}`}
                x1="16"
                y1={y}
                x2="194"
                y2={y}
                stroke="#cbd5e1"
                strokeWidth="0.35"
              />
            ))}
          </g>
        </svg>
      </div>
    );
  }

  // ================= FULL SINGLE A4 RULED LINES ONLY =================
  const lines = [
    16, 24.5, 33, 41.5, 50, 58.5, 67, 75.5, 84, 92.5, 101, 109.5, 118, 126.5,
    135, 143.5, 152, 160.5, 169, 177.5, 186, 194.5, 203, 211.5, 220, 228.5,
    237, 245.5, 254, 262.5, 271, 279.5,
  ];

  return (
    <div className="essay-sheet-wrapper" data-testid="essay-back-full">
      <svg
        xmlns="http://www.w3.org/2000/svg"
        viewBox="0 0 210 297"
        width="210mm"
        height="297mm"
        className="essay-sheet-svg"
      >
        <rect width="210" height="297" fill="#FFFFFF" />

        {/* Pure Ruled Lines Only */}
        <g data-role="ruled-lines">
          {lines.map((y, idx) => (
            <line
              key={`full-line-${idx}`}
              x1="16"
              y1={y}
              x2="194"
              y2={y}
              stroke="#cbd5e1"
              strokeWidth="0.35"
            />
          ))}
        </g>
      </svg>
    </div>
  );
};
