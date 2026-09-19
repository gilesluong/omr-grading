import React from 'react';
import { BubbleGeometry } from '../omr/types';

interface BubbleProps {
  bubble: BubbleGeometry;
  questionNumber: number;
  isMarked?: boolean;
  onClick?: () => void;
}

export const Bubble: React.FC<BubbleProps> = ({
  bubble,
  questionNumber,
  isMarked = false,
  onClick,
}) => {
  const labelX = bubble.center.x + bubble.labelOffset.x;
  const labelY = bubble.center.y + bubble.labelOffset.y;

  return (
    <g
      data-q={questionNumber}
      data-choice={bubble.choice}
      onClick={onClick}
      style={{ cursor: onClick ? 'pointer' : 'default' }}
    >
      {/* Target Bubble circle: pure black 0.35mm outline; dark pencil fill if marked, pure white if unmarked */}
      <circle
        cx={bubble.center.x}
        cy={bubble.center.y}
        r={bubble.radius}
        fill={isMarked ? '#1e293b' : '#FFFFFF'}
        stroke="#000000"
        strokeWidth="0.35"
      />
      {/* Adjacent choice letter (A/B/C/D) */}
      <text
        x={labelX}
        y={labelY}
        textAnchor="middle"
        dominantBaseline="central"
        fill="#000000"
        fontSize="2.7"
        fontWeight="600"
        fontFamily="system-ui, -apple-system, sans-serif"
      >
        {bubble.choice}
      </text>
    </g>
  );
};
