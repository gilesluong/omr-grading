import { describe, expect, it } from "vitest";
import { renderToStaticMarkup } from "react-dom/server";
import sharp from "sharp";
import { Sheet } from "../src/components/Sheet";
import { generateGeometry } from "../src/omr/geometry";
import { TEMPLATES } from "../src/omr/templates";
import { applyHomography, computeHomography } from "../src/scanner/homography";
import { Choice, Point, TemplateId } from "../src/omr/types";
import { detectRegistrationMarkers } from "../src/scanner/markerDetector";
import { gradeExam } from "../src/scanner/grading";
import { processOMRSheet } from "../src/scanner/omrDetector";

const fallback = {
  tl: { x: 0, y: 0 },
  tr: { x: 1, y: 0 },
  br: { x: 1, y: 1 },
  bl: { x: 0, y: 1 },
};
async function sheetImage(
  id: TemplateId,
  width: number,
  marked: boolean | Record<number, Choice> = true,
) {
  const geometry = generateGeometry(TEMPLATES[id]);
  const marks: Record<number, Choice> = {};
  if (typeof marked === "object") Object.assign(marks, marked);
  else if (marked)
    geometry.questions.forEach((q) => {
      marks[q.question] = (["A", "B", "C", "D"] as Choice[])[
        (q.question - 1) % 4
      ];
    });
  const markup = renderToStaticMarkup(
    <Sheet geometry={geometry} interactiveMarks={marks} />,
  );
  const svg = markup.slice(
    markup.indexOf("<svg"),
    markup.lastIndexOf("</svg>") + 6,
  );
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

describe("Real printable sheet recognition", () => {
  for (const id of Object.keys(TEMPLATES) as TemplateId[]) {
    for (const width of [420, 840])
      it(`reads ${id} at ${width}px including printed labels and QR`, async () => {
        const { geometry, marks, image } = await sheetImage(id, width);
        const detection = detectRegistrationMarkers(image, fallback);
        expect(detection.detected).toBe(true);
        const result = processOMRSheet(image, geometry, detection.corners);
        for (const q of geometry.questions)
          expect(
            result.answers[q.question].detectedChoice,
            `Q${q.question}`,
          ).toBe(marks[q.question]);
      });
  }
  it("does not classify printed outlines as answers", async () => {
    const { geometry, image } = await sheetImage("MCQ50", 840, false);
    const detection = detectRegistrationMarkers(image, fallback);
    expect(detection.detected).toBe(true);
    expect(
      processOMRSheet(image, geometry, detection.corners).summary.blank,
    ).toBe(50);
  });
  it("rejects a sheet missing a registration marker", async () => {
    const { image } = await sheetImage("MCQ20", 840);
    for (let y = 0; y < 100; y++)
      for (let x = 0; x < 100; x++) {
        const i = (y * image.width + x) * 4;
        image.data[i] = image.data[i + 1] = image.data[i + 2] = 255;
      }
    const res = detectRegistrationMarkers(image, fallback);
    expect(res.detected).toBe(false);
  });

  it("renders double sheet with 2 halves and cutting line for 10MCQ and 20MCQ", () => {
    const geometry20 = generateGeometry(TEMPLATES["MCQ20"]);
    const markup20 = renderToStaticMarkup(
      <Sheet geometry={geometry20} isDouble={true} />,
    );
    expect(markup20).toContain('data-role="sheet-half-top"');
    expect(markup20).toContain('data-role="cut-line"');
    expect(markup20).toContain('data-role="sheet-half-bottom"');
    expect(markup20).not.toContain("MCQ 20 ANSWER SHEET");
    expect(markup20).not.toContain("Protocol: OMR");
    expect(markup20).toContain("SCAN TO GRADE");
  });

  it("reads a cut half-sheet correctly with auto-detected half-sheet geometry", async () => {
    const geometry = generateGeometry(TEMPLATES["MCQ20"]);
    const half = geometry.halfSheetGeometry!;
    const marks: Record<number, Choice> = {};
    for (let q = 1; q <= 20; q++) {
      marks[q] = (["A", "B", "C", "D"] as Choice[])[(q - 1) % 4];
    }
    // Render the half sheet directly at 840px width
    const markupHalf = renderToStaticMarkup(
      <Sheet geometry={half} isDouble={false} interactiveMarks={marks} />,
    );
    const svg = markupHalf.slice(
      markupHalf.indexOf("<svg"),
      markupHalf.lastIndexOf("</svg>") + 6,
    );
    const { data, info } = await sharp(Buffer.from(svg))
      .resize(840)
      .ensureAlpha()
      .raw()
      .toBuffer({ resolveWithObject: true });
    const image: ImageData = {
      data: new Uint8ClampedArray(data),
      width: info.width,
      height: info.height,
    } as ImageData;

    const detection = detectRegistrationMarkers(image, fallback);
    expect(detection.detected).toBe(true);
    // processOMRSheet receives full geometry (with halfSheetGeometry attached) and auto-detects half-sheet
    const result = processOMRSheet(image, geometry, detection.corners);
    for (let q = 1; q <= 20; q++) {
      expect(result.answers[q].detectedChoice, `Q${q}`).toBe(marks[q]);
    }
  });
});

async function photographedSheet(
  destination: [Point, Point, Point, Point],
  marks: Record<number, Choice>,
  shadow = false,
) {
  const { image: source, geometry } = await sheetImage("MCQ20", 630, marks);
  const width = 1200,
    height = 1000;
  const inverse = computeHomography(destination, [
    { x: 0, y: 0 },
    { x: source.width, y: 0 },
    { x: source.width, y: source.height },
    { x: 0, y: source.height },
  ]);
  const data = new Uint8ClampedArray(width * height * 4);
  for (let y = 0; y < height; y++)
    for (let x = 0; x < width; x++) {
      const p = applyHomography(inverse, { x, y }),
        sx = Math.round(p.x),
        sy = Math.round(p.y);
      const i = (y * width + x) * 4;
      const value =
        sx >= 0 && sy >= 0 && sx < source.width && sy < source.height
          ? source.data[(sy * source.width + sx) * 4]
          : 45;
      const lighting = shadow ? 0.45 + (0.55 * x) / width : 1;
      data[i] = data[i + 1] = data[i + 2] = Math.round(value * lighting);
      data[i + 3] = 255;
    }
  return { geometry, image: { width, height, data } as ImageData };
}

describe("Photographed sheets", () => {
  const scenarios: Array<[string, [Point, Point, Point, Point], boolean]> = [
    [
      "small sheet on a dark desk",
      [
        { x: 340, y: 130 },
        { x: 760, y: 130 },
        { x: 760, y: 724 },
        { x: 340, y: 724 },
      ],
      false,
    ],
    [
      "off-centre sheet",
      [
        { x: 70, y: 80 },
        { x: 510, y: 80 },
        { x: 510, y: 702 },
        { x: 70, y: 702 },
      ],
      false,
    ],
    [
      "perspective and shadow",
      [
        { x: 220, y: 100 },
        { x: 900, y: 170 },
        { x: 790, y: 940 },
        { x: 310, y: 790 },
      ],
      true,
    ],
  ];
  for (const [name, corners, shadow] of scenarios)
    it(`reads five A answers: ${name}`, async () => {
      const { geometry, image } = await photographedSheet(
        corners,
        { 1: "A", 2: "A", 3: "A", 4: "A", 5: "A" },
        shadow,
      );
      const detection = detectRegistrationMarkers(image, fallback);
      expect(detection.detected).toBe(true);
      const result = processOMRSheet(image, geometry, detection.corners);
      for (let q = 1; q <= 20; q++)
        expect(result.answers[q].detectedChoice, `Q${q}`).toBe(
          q <= 5 ? "A" : "BLANK",
        );
      const allA = Object.fromEntries(
        Array.from({ length: 20 }, (_, i) => [i + 1, "A"]),
      ) as Record<number, Choice>;
      expect(gradeExam(result, allA).correctCount).toBe(5);
    });
  it("rejects a uniform image", () => {
    const image = {
      width: 400,
      height: 600,
      data: new Uint8ClampedArray(400 * 600 * 4).fill(255),
    } as ImageData;
    expect(detectRegistrationMarkers(image, fallback).detected).toBe(false);
  });
});

describe("Camera image quality and conflicting marks", () => {
  it("reads slightly blurred photos with the same five-A score", async () => {
    const { geometry, image } = await photographedSheet(
      [
        { x: 200, y: 60 },
        { x: 800, y: 90 },
        { x: 780, y: 920 },
        { x: 180, y: 900 },
      ],
      { 1: "A", 2: "A", 3: "A", 4: "A", 5: "A" },
    );
    const blurred = await sharp(Buffer.from(image.data), {
      raw: { width: image.width, height: image.height, channels: 4 },
    })
      .blur(0.8)
      .raw()
      .toBuffer();
    image.data.set(blurred);
    const detection = detectRegistrationMarkers(image, fallback);
    expect(detection.detected).toBe(true);
    expect(processOMRSheet(image, geometry, detection.corners).summary).toEqual(
      { answered: 5, blank: 15, multiple: 0 },
    );
  });
  it("flags two marks with unequal darkness instead of choosing the darker answer", async () => {
    const { geometry, image } = await sheetImage("MCQ20", 840, { 1: "A" });
    const bubble = geometry.questions[0].bubbles.B;
    for (let y = 0; y < image.height; y++)
      for (let x = 0; x < image.width; x++) {
        if (
          Math.hypot(x / 4 - bubble.center.x, y / 4 - bubble.center.y) < 1.8
        ) {
          const i = (y * image.width + x) * 4;
          image.data[i] = image.data[i + 1] = image.data[i + 2] = 135;
        }
      }
    const detection = detectRegistrationMarkers(image, fallback);
    expect(detection.detected).toBe(true);
    expect(
      processOMRSheet(image, geometry, detection.corners).answers[1]
        .detectedChoice,
    ).toBe("MULTIPLE");
  });
});
