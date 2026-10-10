import { describe, expect, it } from "vitest";
import { renderToStaticMarkup } from "react-dom/server";
import sharp from "sharp";
import { Sheet } from "../src/components/Sheet";
import { generateGeometry } from "../src/omr/geometry";
import { TEMPLATES } from "../src/omr/templates";
import { applyHomography, computeHomography } from "../src/scanner/homography";
import { Choice, Point } from "../src/omr/types";
import { detectRegistrationMarkers } from "../src/scanner/markerDetector";
import { processOMRSheet } from "../src/scanner/omrDetector";

/**
 * Operating-envelope regression tests.
 *
 * A classroom capture is never a clean fronto-parallel scan: the sheet is held
 * at a distance on a desk, under uneven light, with motion blur and JPEG
 * compression. The detector must keep working across that whole range, because
 * failing here is what a teacher experiences as "sometimes it scans, sometimes
 * it doesn't". These tests render a real sheet, project it into a camera frame
 * and degrade it the way a phone camera does.
 */

const fallback = {
  tl: { x: 0, y: 0 },
  tr: { x: 1, y: 0 },
  br: { x: 1, y: 1 },
  bl: { x: 0, y: 1 },
};
const A4 = 297 / 210; // sheet height / width
const FRAME_W = 1280;
const FRAME_H = 960;

async function renderSheet(width: number, marked: boolean = true) {
  const geometry = generateGeometry(TEMPLATES["MCQ20"]);
  const marks: Record<number, Choice> = {};
  if (marked)
    geometry.questions.forEach((q) => {
      marks[q.question] = (["A", "B", "C", "D"] as Choice[])[(q.question - 1) % 4];
    });
  const markup = renderToStaticMarkup(
    <Sheet geometry={geometry} interactiveMarks={marks} />,
  );
  const svg = markup.slice(markup.indexOf("<svg"), markup.lastIndexOf("</svg>") + 6);
  const { data, info } = await sharp(Buffer.from(svg))
    .resize(width)
    .flatten({ background: "#ffffff" })
    .raw()
    .toBuffer({ resolveWithObject: true });
  return { width: info.width, height: info.height, data, channels: info.channels, geometry, marks };
}

type SheetImg = Awaited<ReturnType<typeof renderSheet>>;

function srcLum(img: SheetImg, sx: number, sy: number) {
  if (sx < 0 || sy < 0 || sx >= img.width || sy >= img.height) return 210; // desk
  const i = (sy * img.width + sx) * img.channels;
  return 0.299 * img.data[i] + 0.587 * img.data[i + 1] + 0.114 * img.data[i + 2];
}

function boxDownscale(lum: Float32Array, w: number, h: number, nw: number, nh: number) {
  const out = new Float32Array(nw * nh);
  for (let y = 0; y < nh; y++)
    for (let x = 0; x < nw; x++) {
      const x0 = Math.floor((x * w) / nw),
        x1 = Math.max(x0 + 1, Math.floor(((x + 1) * w) / nw));
      const y0 = Math.floor((y * h) / nh),
        y1 = Math.max(y0 + 1, Math.floor(((y + 1) * h) / nh));
      let s = 0,
        n = 0;
      for (let yy = y0; yy < y1; yy++)
        for (let xx = x0; xx < x1; xx++) {
          s += lum[yy * w + xx];
          n++;
        }
      out[y * nw + x] = s / n;
    }
  return out;
}

function toImageData(lum: Float32Array, w: number, h: number): ImageData {
  const data = new Uint8ClampedArray(w * h * 4);
  for (let i = 0; i < w * h; i++) {
    const v = Math.max(0, Math.min(255, lum[i]));
    data[i * 4] = data[i * 4 + 1] = data[i * 4 + 2] = v;
    data[i * 4 + 3] = 255;
  }
  return { width: w, height: h, data } as ImageData;
}

/** Place the sheet in the frame at its true A4 aspect ratio. */
function fit(cx: number, cy: number, height: number): [Point, Point, Point, Point] {
  const w = height / A4;
  return [
    { x: cx - w / 2, y: cy - height / 2 },
    { x: cx + w / 2, y: cy - height / 2 },
    { x: cx + w / 2, y: cy + height / 2 },
    { x: cx - w / 2, y: cy + height / 2 },
  ];
}

interface Degrade {
  sheetHeight: number;
  skew?: Partial<Record<"tl" | "tr" | "br" | "bl", [number, number]>>;
  noise?: number;
  boxBlur?: number;
  shadow?: number; // left-to-right lighting falloff, 0 = none
  vignette?: boolean;
  jpeg?: number;
  live?: number; // long edge if this models the viewfinder sampling path
  seed?: number;
}

async function capture(img: SheetImg, d: Degrade): Promise<ImageData> {
  const base = fit(FRAME_W / 2, FRAME_H / 2, d.sheetHeight);
  const corners = base.map((p, i) => {
    const k = (["tl", "tr", "br", "bl"] as const)[i];
    const off = d.skew?.[k] ?? [0, 0];
    return { x: p.x + off[0], y: p.y + off[1] };
  }) as [Point, Point, Point, Point];

  const inv = computeHomography(corners, [
    { x: 0, y: 0 },
    { x: img.width, y: 0 },
    { x: img.width, y: img.height },
    { x: 0, y: img.height },
  ]);
  let lum = new Float32Array(FRAME_W * FRAME_H);
  for (let y = 0; y < FRAME_H; y++)
    for (let x = 0; x < FRAME_W; x++) {
      const p = applyHomography(inv, { x, y });
      let v = srcLum(img, Math.round(p.x), Math.round(p.y));
      if (d.shadow) v *= 1 - d.shadow * (x / FRAME_W);
      if (d.vignette) {
        const lx = x / FRAME_W,
          ly = y / FRAME_H;
        v *= 1 - 0.35 * Math.min(1, Math.hypot(lx - 0.5, ly - 0.5) ** 2 * 4);
      }
      lum[y * FRAME_W + x] = v;
    }
  if (d.boxBlur) {
    const r = d.boxBlur,
      tmp = new Float32Array(FRAME_W * FRAME_H);
    for (let y = 0; y < FRAME_H; y++)
      for (let x = 0; x < FRAME_W; x++) {
        let s = 0,
          n = 0;
        for (let dy = -r; dy <= r; dy++)
          for (let dx = -r; dx <= r; dx++) {
            const xx = x + dx,
              yy = y + dy;
            if (xx < 0 || yy < 0 || xx >= FRAME_W || yy >= FRAME_H) continue;
            s += lum[yy * FRAME_W + xx];
            n++;
          }
        tmp[y * FRAME_W + x] = s / n;
      }
    lum = tmp;
  }
  let s = d.seed ?? 12345;
  const rnd = () => ((s = (s * 1103515245 + 12345) & 0x7fffffff) / 0x7fffffff - 0.5) * 2;
  if (d.noise)
    for (let i = 0; i < lum.length; i++)
      lum[i] += ((rnd() + rnd() + rnd()) / 1.5) * d.noise;

  let out = toImageData(lum, FRAME_W, FRAME_H);
  if (d.jpeg) {
    const buf = await sharp(Buffer.from(out.data), {
      raw: { width: FRAME_W, height: FRAME_H, channels: 4 },
    })
      .jpeg({ quality: d.jpeg })
      .raw()
      .toBuffer();
    out = { width: FRAME_W, height: FRAME_H, data: new Uint8ClampedArray(buf) } as ImageData;
  }
  if (d.live) {
    const k = d.live / FRAME_W;
    const nw = Math.round(FRAME_W * k),
      nh = Math.round(FRAME_H * k);
    const src = new Float32Array(FRAME_W * FRAME_H);
    for (let i = 0; i < FRAME_W * FRAME_H; i++) src[i] = out.data[i * 4];
    out = toImageData(boxDownscale(src, FRAME_W, FRAME_H, nw, nh), nw, nh);
  }
  return out;
}

/** Fraction of trials where the sheet was found AND every answer graded right. */
async function successRate(img: SheetImg, d: Degrade, trials = 4) {
  let found = 0,
    graded = 0;
  for (let t = 0; t < trials; t++) {
    const frame = await capture(img, { ...d, seed: (d.seed ?? 500) + t * 991 });
    try {
      const det = detectRegistrationMarkers(frame, fallback);
      if (!det.detected) continue;
      found++;
      const r = processOMRSheet(frame, img.geometry, det.corners);
      if (
        img.geometry.questions.every(
          (q) => r.answers[q.question].detectedChoice === img.marks[q.question],
        )
      )
        graded++;
    } catch {
      /* counted as a miss */
    }
  }
  return { found, graded, trials };
}

const PERSPECTIVE = { tl: [70, 45] as [number, number], tr: [-55, 18] as [number, number], br: [-70, -40] as [number, number], bl: [55, -60] as [number, number] };

describe("Capture operating envelope", () => {
  it("detects and grades a sheet filling the viewfinder", async () => {
    const img = await renderSheet(700);
    const r = await successRate(img, { sheetHeight: 800 });
    expect(r.found).toBe(r.trials);
    expect(r.graded).toBe(r.trials);
  }, 30000);

  it("detects a sheet held at a distance (down to a quarter of the frame)", async () => {
    const img = await renderSheet(700);
    for (const sheetHeight of [700, 528, 440, 384, 300, 240]) {
      const r = await successRate(img, { sheetHeight });
      expect({ sheetHeight, ...r }).toMatchObject({ found: r.trials });
    }
  }, 30000);

  it("grades accurately at every distance the app will auto-capture", async () => {
    // Auto-capture requires the marker quad to cover MIN_AUTO_CAPTURE_AREA_PCT
    // of the viewfinder, which for an A4 sheet is reached at ~42% frame height.
    // Below that the bubbles are too few pixels to read and the app must not
    // silently emit a grade.
    const img = await renderSheet(700);
    for (const sheetHeight of [800, 700, 528, 440, 400]) {
      const r = await successRate(img, { sheetHeight });
      expect({ sheetHeight, ...r }).toMatchObject({ graded: r.trials });
    }
  }, 30000);

  it("survives uneven light, blur, noise, tilt and JPEG artefacts", async () => {
    const img = await renderSheet(700);
    const cases: Array<[string, Degrade]> = [
      ["strong perspective", { sheetHeight: 760, skew: PERSPECTIVE }],
      ["heavy blur", { sheetHeight: 800, boxBlur: 2 }],
      ["sensor noise", { sheetHeight: 800, noise: 26 }],
      ["hard shadow", { sheetHeight: 800, shadow: 0.6 }],
      ["vignette", { sheetHeight: 800, vignette: true }],
      ["jpeg q25 + noise", { sheetHeight: 800, jpeg: 25, noise: 10 }],
      ["small + tilted + jpeg", { sheetHeight: 400, skew: PERSPECTIVE, jpeg: 45, noise: 12 }],
      ["worst case combined", { sheetHeight: 700, skew: PERSPECTIVE, noise: 12, shadow: 0.45, vignette: true, boxBlur: 1, jpeg: 50 }],
    ];
    for (const [name, d] of cases) {
      const r = await successRate(img, d);
      expect({ name, ...r }).toMatchObject({ found: r.trials });
    }
  }, 30000);

  it("works through the 720px live viewfinder sampling path", async () => {
    const img = await renderSheet(700);
    for (const sheetHeight of [800, 528, 400, 300, 211]) {
      const r = await successRate(img, { sheetHeight, live: 720 });
      expect({ sheetHeight, ...r }).toMatchObject({ found: r.trials });
    }
  }, 30000);

  it("never invents an answer on a completely blank sheet", async () => {
    // A blank sheet graded against a real key must report every question blank.
    // Comparing each bubble interior to a ring quantile used to fold the
    // lighting gradient into the fill ratio, so an uneven capture produced a
    // phantom answer (a teacher saw exactly one wrong answer on a blank sheet).
    const img = await renderSheet(700, false);
    const cases: Degrade[] = [
      { sheetHeight: 800 },
      { sheetHeight: 800, shadow: 0.5 },
      { sheetHeight: 800, noise: 16 },
      { sheetHeight: 800, boxBlur: 2 },
      { sheetHeight: 800, jpeg: 35 },
      { sheetHeight: 430, shadow: 0.4, noise: 10 },
      { sheetHeight: 700, shadow: 0.3, noise: 8, boxBlur: 1, jpeg: 40 },
    ];
    for (const d of cases) {
      for (let t = 0; t < 3; t++) {
        const frame = await capture(img, { ...d, seed: 11 + t * 977 });
        const det = detectRegistrationMarkers(frame, fallback);
        if (!det.detected) continue;
        const r = processOMRSheet(frame, img.geometry, det.corners);
        const phantom = img.geometry.questions
          .filter((q) => r.answers[q.question].detectedChoice !== "BLANK")
          .map((q) => `Q${q.question}=${r.answers[q.question].detectedChoice}`);
        expect({ ...d, seed: t, phantom }).toMatchObject({ phantom: [] });
      }
    }
  }, 30000);

  it("still refuses a sheet with a missing registration marker", async () => {
    const img = await renderSheet(840);
    const image = { width: img.width, height: img.height, data: new Uint8ClampedArray(img.data) } as ImageData;
    // Blank out the top-left marker.
    for (let y = 0; y < 100; y++)
      for (let x = 0; x < 100; x++) {
        const i = (y * image.width + x) * 4;
        image.data[i] = image.data[i + 1] = image.data[i + 2] = 255;
      }
    expect(detectRegistrationMarkers(image, fallback).detected).toBe(false);
  }, 30000);
});
