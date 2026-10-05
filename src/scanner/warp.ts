import { Point } from '../omr/types';
import { CornerPoints } from './types';
import { applyHomography, computeHomography } from './homography';

/**
 * Perspective-corrects (rectifies) the quadrilateral defined by `corners` in `sourceData`
 * into an orthogonal A4-proportioned image.
 *
 * @param sourceData Captured frame ImageData (e.g. from high-res video canvas)
 * @param corners 4 detected corner points in sourceData pixel coordinates
 * @param outWidth Target width of rectified output (default 360px for fast mobile rendering)
 * @param outHeight Target height of rectified output (default 509px, A4 ~1:1.414 ratio)
 */
export function warpPerspective(
  sourceData: ImageData,
  corners: CornerPoints,
  outWidth: number = 360,
  outHeight: number = 509
): ImageData {
  const dstCorners: [Point, Point, Point, Point] = [
    { x: 0, y: 0 },
    { x: outWidth, y: 0 },
    { x: outWidth, y: outHeight },
    { x: 0, y: outHeight },
  ];

  const srcCorners: [Point, Point, Point, Point] = [
    corners.tl,
    corners.tr,
    corners.br,
    corners.bl,
  ];

  // Homography mapping from destination (rectified output) coordinates to source camera pixels
  const H = computeHomography(dstCorners, srcCorners);

function createSafeImageData(width: number, height: number): ImageData {
  if (typeof ImageData !== 'undefined') {
    return new ImageData(width, height);
  }
  return {
    width,
    height,
    data: new Uint8ClampedArray(width * height * 4),
    colorSpace: 'srgb',
  } as ImageData;
}

  const outImg = createSafeImageData(outWidth, outHeight);
  const src = sourceData.data;
  const dst = outImg.data;
  const sw = sourceData.width;
  const sh = sourceData.height;

  for (let y = 0; y < outHeight; y++) {
    const rowOffset = y * outWidth;
    for (let x = 0; x < outWidth; x++) {
      const srcPt = applyHomography(H, { x, y });
      const sx = Math.round(srcPt.x);
      const sy = Math.round(srcPt.y);

      const dstIdx = (rowOffset + x) << 2;
      if (sx >= 0 && sx < sw && sy >= 0 && sy < sh) {
        const srcIdx = (sy * sw + sx) << 2;
        dst[dstIdx] = src[srcIdx];
        dst[dstIdx + 1] = src[srcIdx + 1];
        dst[dstIdx + 2] = src[srcIdx + 2];
        dst[dstIdx + 3] = 255;
      } else {
        // Outside bounds: light neutral background
        dst[dstIdx] = 245;
        dst[dstIdx + 1] = 245;
        dst[dstIdx + 2] = 245;
        dst[dstIdx + 3] = 255;
      }
    }
  }

  return outImg;
}

/**
 * Converts an ImageData object into a data URL for static thumbnail rendering.
 */
export function imageDataToDataUrl(imageData: ImageData): string {
  if (typeof document === 'undefined') return '';
  const canvas = document.createElement('canvas');
  canvas.width = imageData.width;
  canvas.height = imageData.height;
  const ctx = canvas.getContext('2d');
  if (!ctx) return '';
  ctx.putImageData(imageData, 0, 0);
  return canvas.toDataURL('image/jpeg', 0.85);
}
