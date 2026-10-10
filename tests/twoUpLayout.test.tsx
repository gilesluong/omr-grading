import { describe, expect, it } from "vitest";
import { renderToStaticMarkup } from "react-dom/server";
import sharp from "sharp";
import { Sheet } from "../src/components/Sheet";
import { generateGeometry } from "../src/omr/geometry";
import { TEMPLATES } from "../src/omr/templates";
import { Choice, TemplateId } from "../src/omr/types";
import { detectRegistrationMarkers } from "../src/scanner/markerDetector";
import { processOMRSheet } from "../src/scanner/omrDetector";

/**
 * An uncut 2-up page holds TWO half-sheets, so it has eight registration
 * markers. Grading it as one sheet read the wrong bubble grid and silently
 * scored 0% / F, so the detector must flag it and the scanner must refuse it
 * instead of emitting a grade.
 */

const fallback = {
  tl: { x: 0, y: 0 },
  tr: { x: 1, y: 0 },
  br: { x: 1, y: 1 },
  bl: { x: 0, y: 1 },
};

async function render(id: TemplateId, width: number, isDouble: boolean) {
  const geometry = generateGeometry(TEMPLATES[id]);
  const marks: Record<number, Choice> = {};
  geometry.questions.forEach((q) => {
    marks[q.question] = (["A", "B", "C", "D"] as Choice[])[(q.question - 1) % 4];
  });
  const markup = renderToStaticMarkup(
    <Sheet geometry={geometry} isDouble={isDouble} interactiveMarks={marks} />,
  );
  const svg = markup.slice(markup.indexOf("<svg"), markup.lastIndexOf("</svg>") + 6);
  const { data, info } = await sharp(Buffer.from(svg))
    .resize(width)
    .ensureAlpha()
    .raw()
    .toBuffer({ resolveWithObject: true });
  return {
    geometry,
    marks,
    image: {
      data: new Uint8ClampedArray(data),
      width: info.width,
      height: info.height,
    } as ImageData,
  };
}

describe("Uncut 2-up (double) pages", () => {
  it("flags an uncut 2-up page as two sheets", async () => {
    for (const id of ["MCQ10", "MCQ20"] as TemplateId[]) {
      for (const width of [840, 700]) {
        const { image } = await render(id, width, true);
        const d = detectRegistrationMarkers(image, fallback);
        expect({ id, width, twoUp: d.twoUp }).toMatchObject({ twoUp: true });
      }
    }
  }, 60000);

  it("does not flag a single sheet, marked or blank", async () => {
    for (const width of [840, 700]) {
      const { image } = await render("MCQ20", width, false);
      expect(detectRegistrationMarkers(image, fallback).twoUp).toBe(false);
    }
    const geometry = generateGeometry(TEMPLATES["MCQ20"]);
    const markup = renderToStaticMarkup(
      <Sheet geometry={geometry} interactiveMarks={{}} />,
    );
    const svg = markup.slice(markup.indexOf("<svg"), markup.lastIndexOf("</svg>") + 6);
    const { data, info } = await sharp(Buffer.from(svg))
      .resize(840)
      .ensureAlpha()
      .raw()
      .toBuffer({ resolveWithObject: true });
    const blank = {
      data: new Uint8ClampedArray(data),
      width: info.width,
      height: info.height,
    } as ImageData;
    expect(detectRegistrationMarkers(blank, fallback).twoUp).toBe(false);
  }, 60000);

  it("is exactly the trap that used to produce a silent zero", async () => {
    // Documents why the flag exists: grading the same page (no flag honoured)
    // scores nothing even though the sheet is filled correctly.
    const { geometry, marks, image } = await render("MCQ20", 840, true);
    const det = detectRegistrationMarkers(image, fallback);
    expect(det.twoUp).toBe(true);
    const r = processOMRSheet(image, geometry, det.corners);
    const mismatch = geometry.questions.filter(
      (q) => r.answers[q.question].detectedChoice !== marks[q.question],
    ).length;
    expect(mismatch).toBeGreaterThan(0);
  }, 60000);
});
