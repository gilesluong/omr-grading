import React from 'react';
import { RegistrationMarkerGeometry } from '../omr/types';

interface RegistrationMarkerProps {
  marker: RegistrationMarkerGeometry;
}

export const RegistrationMarker: React.FC<RegistrationMarkerProps> = ({ marker }) => {
  return (
    <rect
      data-marker-id={marker.id}
      x={marker.bounds.x}
      y={marker.bounds.y}
      width={marker.bounds.width}
      height={marker.bounds.height}
      fill="#000000"
      shapeRendering="crispEdges"
    />
  );
};
