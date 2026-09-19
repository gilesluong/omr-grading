import React from 'react';
import { QRGeometry } from '../omr/types';

interface TemplateQRProps {
  qr: QRGeometry;
}

export const TemplateQR: React.FC<TemplateQRProps> = ({ qr }) => {
  const { bounds, moduleCount, modules } = qr;
  const moduleSize = bounds.width / moduleCount;

  return (
    <g data-role="template-qr">
      {/* Crisp white background */}
      <rect
        x={bounds.x}
        y={bounds.y}
        width={bounds.width}
        height={bounds.height}
        fill="#FFFFFF"
      />

      {/* Vector QR code modules */}
      {modules.map((row, rIdx) =>
        row.map((isDark, cIdx) => {
          if (!isDark) return null;
          return (
            <rect
              key={`qr-${rIdx}-${cIdx}`}
              x={bounds.x + cIdx * moduleSize}
              y={bounds.y + rIdx * moduleSize}
              width={moduleSize}
              height={moduleSize}
              fill="#000000"
              shapeRendering="crispEdges"
            />
          );
        })
      )}

    </g>
  );
};
