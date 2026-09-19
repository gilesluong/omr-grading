import { describe, expect, it } from "vitest";
import { previewCrop } from "../src/scanner/preview";

describe("Full-screen camera crop", () => {
  it("crops landscape video to the portrait viewfinder without distortion", () => {
    const crop = previewCrop(1920, 1080, 390, 650);
    expect(crop).toEqual({ x: 636, y: 0, width: 648, height: 1080 });
    expect(crop.width / crop.height).toBeCloseTo(390 / 650);
  });
  it("crops portrait video vertically for a wide preview", () => {
    const crop = previewCrop(1080, 1920, 900, 600);
    expect(crop).toEqual({ x: 0, y: 600, width: 1080, height: 720 });
  });
  it("keeps the entire image when aspect ratios match", () => {
    expect(previewCrop(1080, 1920, 360, 640)).toEqual({
      x: 0,
      y: 0,
      width: 1080,
      height: 1920,
    });
  });
});
