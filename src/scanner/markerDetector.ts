import { Point } from "../omr/types";
import { applyHomography, computeHomography } from "./homography";
import { CornerPoints } from "./types";

export interface MarkerDetectionResult {
  detected: boolean;
  corners: CornerPoints;
  confidence: number;
  /**
   * True when the page carries MORE than one sheet's worth of registration
   * markers (an uncut 2-up / "double" A4 page holding two half-sheets). Such a
   * page cannot be graded as a single sheet, and grading it anyway silently
   * produced a 0% / F result, so callers must refuse it with a clear message.
   */
  twoUp?: boolean;
}

interface Candidate extends Point {
  area: number;
  w: number;
  h: number;
}

// Canonical marker-centre geometry (mm) for the two supported sheet formats.
const STANDARD_CANONICAL: [Point, Point, Point, Point] = [
  { x: 16, y: 16 },
  { x: 194, y: 16 },
  { x: 194, y: 281 },
  { x: 16, y: 281 },
];
const HALF_CANONICAL: [Point, Point, Point, Point] = [
  { x: 16, y: 10 },
  { x: 194, y: 10 },
  { x: 194, y: 138.5 },
  { x: 16, y: 138.5 },
];

// The projected marker quad must fall in one of these aspect bands (the ratio
// of the marker-centre quad's height to its width). Full A4 markers sit at
// 178/265 = 0.672; a cut half sheet sits at 178/128.5 = 1.385. The split at
// 1.18 matches the scanner's own half/full-sheet convention. The bands are
// wide enough for tilt, any sensor aspect ratio and printer scaling, but still
// exclude quads of ordinary printed content (e.g. four filled bubbles at 1.67).
const STANDARD_ASPECT_RANGE: [number, number] = [0.42, 1.18];
const HALF_ASPECT_RANGE: [number, number] = [1.18, 1.6];
const STANDARD_ASPECT = 178 / 265;
const HALF_ASPECT = 178 / 128.5;
const inRange = (a: number, [lo, hi]: [number, number]) => a >= lo && a <= hi;

/** How much larger than the smallest marker an *outside* solid component may be
 *  before we conclude the candidate quad is really a cluster of content marks.
 *  1.05 = only marginally larger; raise to loosen the safety check. */
const INTRUDER_RATIO = 1.05;

/** Find solid connected components, then validate all four as one sheet.
 * Never infer a missing marker: an affine guess is unsafe under perspective.
 *
 * @param maxDim Internal working resolution (long edge). Larger = better small
 *   marker fidelity, more CPU. The detection envelope no longer depends on it.
 */
export function detectRegistrationMarkers(
  imageData: ImageData,
  fallbackCorners: CornerPoints,
  maxDim: number = 1000,
): MarkerDetectionResult {
  const scale = Math.min(1, maxDim / Math.max(imageData.width, imageData.height));
  const width = Math.floor(imageData.width * scale);
  const height = Math.floor(imageData.height * scale);
  const fail = { detected: false, corners: fallbackCorners, confidence: 0 };
  if (width < 40 || height < 40) return fail;
  const lum = new Float32Array(width * height);
  const stride = width + 1;
  const integral = new Float64Array(stride * (height + 1));
  for (let y = 0; y < height; y++) {
    let sum = 0;
    for (let x = 0; x < width; x++) {
      const i =
        (Math.floor(y / scale) * imageData.width + Math.floor(x / scale)) * 4;
      const value =
        0.299 * imageData.data[i] +
        0.587 * imageData.data[i + 1] +
        0.114 * imageData.data[i + 2];
      lum[y * width + x] = value;
      sum += value;
      integral[(y + 1) * stride + x + 1] = integral[y * stride + x + 1] + sum;
    }
  }
  const mask = new Uint8Array(width * height);
  const radius = Math.max(12, Math.round(Math.min(width, height) * 0.06));
  for (let y = 0; y < height; y++)
    for (let x = 0; x < width; x++) {
      const x0 = Math.max(0, x - radius),
        x1 = Math.min(width, x + radius + 1);
      const y0 = Math.max(0, y - radius),
        y1 = Math.min(height, y + radius + 1);
      const mean =
        (integral[y1 * stride + x1] -
          integral[y0 * stride + x1] -
          integral[y1 * stride + x0] +
          integral[y0 * stride + x0]) /
        ((x1 - x0) * (y1 - y0));
      mask[y * width + x] =
        lum[y * width + x] < Math.min(180, mean * 0.72) ? 1 : 0;
    }
  const darkPixels = mask.slice();
  const queue = new Int32Array(width * height);
  const candidates: Candidate[] = [];
  for (let seed = 0; seed < mask.length; seed++) {
    if (!mask[seed]) continue;
    let head = 0,
      tail = 1,
      minX = width,
      minY = height,
      maxX = 0,
      maxY = 0,
      sumX = 0,
      sumY = 0;
    queue[0] = seed;
    mask[seed] = 0;
    while (head < tail) {
      const i = queue[head++],
        x = i % width,
        y = Math.floor(i / width);
      minX = Math.min(minX, x);
      maxX = Math.max(maxX, x);
      minY = Math.min(minY, y);
      maxY = Math.max(maxY, y);
      sumX += x;
      sumY += y;
      for (const next of [
        x > 0 ? i - 1 : -1,
        x < width - 1 ? i + 1 : -1,
        y > 0 ? i - width : -1,
        y < height - 1 ? i + width : -1,
      ]) {
        if (next >= 0 && mask[next]) {
          mask[next] = 0;
          queue[tail++] = next;
        }
      }
    }
    const w = maxX - minX + 1,
      h = maxY - minY + 1;
    // Solid fiducials: robust against wide-angle scaling, lighting, and minor perspective distortion.
    if (
      minX <= 1 ||
      minY <= 1 ||
      maxX >= width - 2 ||
      maxY >= height - 2 ||
      w < 3 ||
      h < 3 ||
      w / h < 0.35 ||
      w / h > 2.9 ||
      tail / (w * h) < 0.42 ||
      tail < 6 ||
      tail > width * height * 0.035
    )
      continue;
    candidates.push({ x: sumX / tail, y: sumY / tail, area: tail, w, h });
  }
  // Keep a generous pool: a busy printed sheet (QR + filled bubbles + labels)
  // can produce many components, but the markers are almost always the largest.
  const points = candidates.sort((a, b) => b.area - a.area).slice(0, 48);
  let best: CornerPoints | null = null,
    bestScore = -Infinity;
  let bestGroup: Candidate[] | null = null;
  const distance = (a: Point, b: Point) => Math.hypot(a.x - b.x, a.y - b.y);

  let group: Candidate[] = [];

  /** Validate one 4-marker group against a canonical geometry. Returns a score
   *  (higher = better) when the group is a plausible sheet, else null. */
  const validateGroup = (
    canonical: [Point, Point, Point, Point],
  ): number | null => {
    const H = computeHomography(canonical, [group[0], group[1], group[2], group[3]]);

    // Each projected marker must be ~8mm square, so its size must match the
    // square the homography projects at that location. The comparison uses the
    // component's ink AREA (not its bounding box, which does not shrink for a
    // round blob) derived as an equivalent side length, with an absolute pixel
    // tolerance so far/distant sheets still validate: thresholding erodes a
    // marker by ~1px per edge, which is negligible at 30px and huge at 5px.
    const sizes = canonical.map((center, i) => {
      const vertices = [
        [-4, -4],
        [4, -4],
        [4, 4],
        [-4, 4],
      ].map(([dx, dy]) =>
        applyHomography(H, { x: center.x + dx, y: center.y + dy }),
      );
      let projectedArea = 0;
      for (let j = 0; j < 4; j++) {
        const a = vertices[j],
          b = vertices[(j + 1) % 4];
        projectedArea += a.x * b.y - a.y * b.x;
      }
      const expectedSide = Math.sqrt(Math.abs(projectedArea) / 2);
      const actualSide = Math.sqrt(group[i].area);
      return { expectedSide, actualSide };
    });
    if (
      sizes.some(
        (r) =>
          !Number.isFinite(r.expectedSide) ||
          r.expectedSide <= 0 ||
          Math.abs(r.actualSide - r.expectedSide) >
            Math.max(2, r.expectedSide * 0.18),
      )
    )
      return null;

    // Solid, filled fiducials: the connected component must fill most of its
    // own bounding box (a printed ring or speckle does not). This is measured
    // on the component itself, so it is scale invariant.
    if (group.some((p) => p.area / (p.w * p.h) < 0.62)) return null;

    // Quiet zone: the ring just outside each marker must be paper, not ink.
    // Offsets are a fixed fraction of the marker's own size (~5.5mm for a
    // correct marker), never a fixed pixel/mm offset that collapses or
    // overshoots when the sheet is small, blurred or distant.
    const calm = group.every((p) => {
      let darkBorder = 0;
      for (const [ux, uy] of [
        [-1, 0],
        [1, 0],
        [0, -1],
        [0, 1],
        [-1, -1],
        [1, -1],
        [-1, 1],
        [1, 1],
      ]) {
        const x = Math.round(p.x + ux * p.w * 0.68);
        const y = Math.round(p.y + uy * p.h * 0.68);
        if (
          x >= 0 &&
          y >= 0 &&
          x < width &&
          y < height &&
          darkPixels[y * width + x]
        )
          darkBorder++;
      }
      return darkBorder <= 2;
    });
    if (!calm) return null;

    // The four registration markers are the largest solid ink on a sheet. If a
    // larger (or comparable) solid component exists OUTSIDE the candidate quad,
    // this "quad" is really a cluster of ordinary content marks (e.g. four
    // filled answer bubbles) sitting inside a real sheet — not a sheet itself.
    const quad = [group[0], group[1], group[2], group[3]];
    const minMarkerArea = Math.min(...group.map((p) => p.area));
    const intruder = candidates.find(
      (p) =>
        !group.includes(p) &&
        p.area / (p.w * p.h) >= 0.6 &&
        p.area > minMarkerArea * INTRUDER_RATIO &&
        !pointInQuad(quad, p),
    );
    if (intruder) return null;

    const area = quadArea(group);
    // Prefer the canonical geometry whose marker-density ratio is most uniform.
    return (
      Math.log(Math.max(area, 1)) -
      sizes.reduce(
        (n: number, r: { actualSide: number; expectedSide: number }) =>
          n + Math.abs(Math.log(r.actualSide / r.expectedSide)),
        0,
      )
    );
  };

  // Strategy 1: Search all 4-candidate groups
  for (let a = 0; a < points.length; a++)
    for (let b = a + 1; b < points.length; b++)
      for (let c = b + 1; c < points.length; c++)
        for (let d = c + 1; d < points.length; d++) {
          group = [points[a], points[b], points[c], points[d]];
          const cx = group.reduce((n, p) => n + p.x, 0) / 4,
            cy = group.reduce((n, p) => n + p.y, 0) / 4;
          group.sort(
            (p, q) =>
              Math.atan2(p.y - cy, p.x - cx) - Math.atan2(q.y - cy, q.x - cx),
          );
          const [tl, tr, br, bl] = group;
          if (!(tl.x < tr.x && bl.x < br.x && tl.y < bl.y && tr.y < br.y))
            continue;
          const top = distance(tl, tr),
            bottom = distance(bl, br),
            left = distance(tl, bl),
            right = distance(tr, br);
          if (
            Math.min(top, bottom, left, right) <
              Math.min(width, height) * 0.06 ||
            top / bottom < 0.68 ||
            top / bottom > 1.47 ||
            left / right < 0.68 ||
            left / right > 1.47
          )
            continue;
          const aspect = (top + bottom) / (left + right);
          const tryHalf = inRange(aspect, HALF_ASPECT_RANGE);
          const tryStandard = inRange(aspect, STANDARD_ASPECT_RANGE);
          if (!tryHalf && !tryStandard) continue;
          let convex = true;
          for (let i = 0; i < 4; i++) {
            const p = group[i],
              q = group[(i + 1) % 4],
              r = group[(i + 2) % 4];
            if ((q.x - p.x) * (r.y - q.y) - (q.y - p.y) * (r.x - q.x) <= 0)
              convex = false;
          }
          if (!convex) continue;
          if (quadArea(group) < width * height * 0.01) continue;

          // Try the canonical geometry whose aspect is closest first; if the
          // marker-density check rejects it, try the other one.
          const dHalf = tryHalf ? Math.abs(Math.log(aspect / HALF_ASPECT)) : Infinity;
          const dStd = tryStandard ? Math.abs(Math.log(aspect / STANDARD_ASPECT)) : Infinity;
          const order =
            dHalf < dStd
              ? ([
                  [HALF_CANONICAL, true],
                  [STANDARD_CANONICAL, false],
                ] as const)
              : ([
                  [STANDARD_CANONICAL, false],
                  [HALF_CANONICAL, true],
                ] as const);
          let score: number | null = null;
          for (const [canonical] of order) {
            score = validateGroup(canonical);
            if (score !== null) break;
          }
          if (score === null) continue;
          if (score > bestScore) {
            bestScore = score;
            best = { tl, tr, br, bl };
            bestGroup = [tl, tr, br, bl];
          }
        }

  if (!best) return fail;
  const corners = {} as CornerPoints;
  for (const key of ["tl", "tr", "br", "bl"] as const)
    corners[key] = { x: best[key].x / scale, y: best[key].y / scale };

  // How many marker-sized solid marks sit INSIDE the detected page? A single
  // sheet has exactly four (its registration markers). An uncut 2-up page holds
  // two half-sheets, so it has eight, and grading it as one sheet read the
  // wrong grid and scored 0%. Marks from a neighbouring cut sheet lie OUTSIDE
  // the page quad, so they do not count here.
  let twoUp = false;
  if (bestGroup) {
    const minArea = Math.min(...bestGroup.map((p) => p.area));
    const quad: Point[] = bestGroup;
    const markerSized = candidates.filter(
      (p) =>
        p.area / (p.w * p.h) >= 0.6 &&
        p.area >= minArea * 0.6 &&
        p.area <= minArea * 1.7 &&
        pointInQuad(quad, p),
    ).length;
    twoUp = markerSized >= 7;
  }

  return { detected: true, corners, confidence: 1, twoUp };
}

/** Signed-area magnitude of a candidate quadrilateral. */
function quadArea(g: Point[]): number {
  let area = 0;
  for (let i = 0; i < 4; i++) {
    const p = g[i],
      q = g[(i + 1) % 4];
    area += p.x * q.y - p.y * q.x;
  }
  return Math.abs(area) / 2;
}

/** Convex-quad containment by consistent cross-product sign. */
function pointInQuad(quad: Point[], pt: Point): boolean {
  let sign = 0;
  for (let i = 0; i < 4; i++) {
    const a = quad[i],
      b = quad[(i + 1) % 4];
    const cross = (b.x - a.x) * (pt.y - a.y) - (b.y - a.y) * (pt.x - a.x);
    if (Math.abs(cross) < 1e-9) continue;
    const s = Math.sign(cross);
    if (sign === 0) sign = s;
    else if (s !== sign) return false;
  }
  return true;
}
