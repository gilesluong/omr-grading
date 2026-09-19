import { SheetGeometry } from '../omr/types';

/**
 * Cleanly serializes the SheetGeometry for export as a JSON contract.
 */
export function formatGeometryJson(geometry: SheetGeometry): string {
  // We can omit raw 2D modules from the high-level contract JSON or include them.
  // Including them allows offline verification of the QR layout.
  return JSON.stringify(geometry, null, 2);
}

/**
 * Triggers a browser download of the geometry JSON file.
 */
export function downloadGeometryJson(geometry: SheetGeometry): void {
  const jsonContent = formatGeometryJson(geometry);
  const blob = new Blob([jsonContent], { type: 'application/json' });
  const url = URL.createObjectURL(blob);

  const a = document.createElement('a');
  a.href = url;
  a.download = `omr-${geometry.template.toLowerCase()}-geometry.json`;
  document.body.appendChild(a);
  a.click();
  document.body.removeChild(a);
  URL.revokeObjectURL(url);
}
