/** The same centered crop drives the cover preview, live reticle, and capture. */
export function previewCrop(
  sourceWidth: number,
  sourceHeight: number,
  viewWidth: number,
  viewHeight: number,
) {
  const scale = Math.max(viewWidth / sourceWidth, viewHeight / sourceHeight);
  const width = viewWidth / scale;
  const height = viewHeight / scale;
  return {
    x: (sourceWidth - width) / 2,
    y: (sourceHeight - height) / 2,
    width,
    height,
  };
}
