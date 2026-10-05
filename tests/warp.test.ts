import { describe, it, expect } from 'vitest';
import { warpPerspective } from '../src/scanner/warp';
import { CornerPoints } from '../src/scanner/types';

describe('Perspective Rectification Warp', () => {
  it('rectifies a simple orthogonal region correctly', () => {
    const width = 100;
    const height = 140;
    const data = new Uint8ClampedArray(width * height * 4).fill(200);

    // Put distinctive pixel pattern
    const idx = (10 * width + 10) * 4;
    data[idx] = 255;
    data[idx + 1] = 0;
    data[idx + 2] = 0;
    data[idx + 3] = 255;

    const imgData: ImageData = {
      width,
      height,
      data,
      colorSpace: 'srgb',
    };

    const corners: CornerPoints = {
      tl: { x: 5, y: 5 },
      tr: { x: 95, y: 5 },
      br: { x: 95, y: 135 },
      bl: { x: 5, y: 135 },
    };

    const warped = warpPerspective(imgData, corners, 50, 70);
    expect(warped.width).toBe(50);
    expect(warped.height).toBe(70);
    expect(warped.data.length).toBe(50 * 70 * 4);
    // Ensure pixels were transferred and not all zeros
    expect(warped.data[0]).toBeGreaterThan(0);
  });
});
