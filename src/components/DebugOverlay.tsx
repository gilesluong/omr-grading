import React from 'react';
import { SheetGeometry } from '../omr/types';

interface DebugOverlayProps {
  geometry: SheetGeometry;
}

export const DebugOverlay: React.FC<DebugOverlayProps> = ({ geometry }) => {
  const { page, markers, qr, questions } = geometry;

  return (
    <g className="omr-debug-layer" opacity="0.85">
      {/* 1. Safe Margins Box */}
      <rect
        x={page.safeMargins.left}
        y={page.safeMargins.top}
        width={page.safeMargins.right - page.safeMargins.left}
        height={page.safeMargins.bottom - page.safeMargins.top}
        fill="none"
        stroke="#0284c7"
        strokeWidth="0.3"
        strokeDasharray="2 1.5"
      />
      <text
        x={page.safeMargins.left + 2}
        y={page.safeMargins.top + 3}
        fill="#0284c7"
        fontSize="2.0"
        fontFamily="ui-monospace, monospace"
      >
        SAFE MARGIN BOUNDS: [{page.safeMargins.left}, {page.safeMargins.top}] to [
        {page.safeMargins.right}, {page.safeMargins.bottom}] mm
      </text>

      {/* 2. Registration Marker Debug */}
      {markers.map((marker) => {
        const isBottom = marker.id.startsWith('B');
        const isRight = marker.id.endsWith('R');
        const labelY = isBottom ? marker.center.y - 6 : marker.center.y + 7.5;
        const textAnchor = isRight ? 'end' : 'start';

        return (
          <g key={`debug-marker-${marker.id}`}>
            {/* Marker Bounding Box */}
            <rect
              x={marker.bounds.x}
              y={marker.bounds.y}
              width={marker.bounds.width}
              height={marker.bounds.height}
              fill="rgba(225, 29, 72, 0.15)"
              stroke="#e11d48"
              strokeWidth="0.25"
            />
            {/* Center Crosshairs */}
            <line
              x1={marker.center.x - 5}
              y1={marker.center.y}
              x2={marker.center.x + 5}
              y2={marker.center.y}
              stroke="#e11d48"
              strokeWidth="0.25"
            />
            <line
              x1={marker.center.x}
              y1={marker.center.y - 5}
              x2={marker.center.x}
              y2={marker.center.y + 5}
              stroke="#e11d48"
              strokeWidth="0.25"
            />
            {/* Coordinates Badge */}
            <text
              x={marker.center.x + (isRight ? -4 : 4)}
              y={labelY}
              textAnchor={textAnchor}
              fill="#e11d48"
              fontSize="2.1"
              fontWeight="bold"
              fontFamily="ui-monospace, monospace"
            >
              {marker.id} ({marker.center.x}, {marker.center.y})
            </text>
          </g>
        );
      })}

      {/* 3. QR Code ROI Debug */}
      <g>
        <rect
          x={qr.bounds.x}
          y={qr.bounds.y}
          width={qr.bounds.width}
          height={qr.bounds.height}
          fill="none"
          stroke="#2563eb"
          strokeWidth="0.3"
          strokeDasharray="1.5 1"
        />
        <text
          x={qr.bounds.x}
          y={qr.bounds.y - 1.5}
          fill="#2563eb"
          fontSize="1.9"
          fontFamily="ui-monospace, monospace"
        >
          QR ROI [{qr.bounds.x}, {qr.bounds.y}] {qr.bounds.width}x{qr.bounds.height}mm
        </text>
      </g>

      {/* 4. Question Bounding Boxes and Bubble Detection ROIs */}
      {questions.map((q) => (
        <g key={`debug-q-${q.question}`}>
          {/* Question Row Box */}
          <rect
            x={q.bounds.x}
            y={q.bounds.y}
            width={q.bounds.width}
            height={q.bounds.height}
            fill="none"
            stroke="#9333ea"
            strokeWidth="0.15"
            strokeDasharray="0.8 0.8"
          />

          {/* Bubbles Debug: Center Crosshair and Detection Region */}
          {Object.values(q.bubbles).map((b) => (
            <g key={`debug-q-${q.question}-${b.choice}`}>
              {/* Detection ROI Circle */}
              <circle
                cx={b.center.x}
                cy={b.center.y}
                r={b.detectionRadius}
                fill="rgba(5, 150, 105, 0.12)"
                stroke="#059669"
                strokeWidth="0.2"
                strokeDasharray="0.6 0.6"
              />
              {/* Center point (+) */}
              <line
                x1={b.center.x - 0.8}
                y1={b.center.y}
                x2={b.center.x + 0.8}
                y2={b.center.y}
                stroke="#059669"
                strokeWidth="0.25"
              />
              <line
                x1={b.center.x}
                y1={b.center.y - 0.8}
                x2={b.center.x}
                y2={b.center.y + 0.8}
                stroke="#059669"
                strokeWidth="0.25"
              />
            </g>
          ))}
        </g>
      ))}

      {/* Origin (0,0) indicator */}
      <circle cx={0} cy={0} r={2} fill="#ef4444" />
      <text x={3} y={4} fill="#ef4444" fontSize="2.0" fontFamily="ui-monospace, monospace">
        (0,0) A4 Origin
      </text>
    </g>
  );
};
