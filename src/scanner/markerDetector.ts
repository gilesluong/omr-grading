import { Point } from "../omr/types";
import { applyHomography, computeHomography } from "./homography";
import { CornerPoints } from "./types";

export interface MarkerDetectionResult {
  detected: boolean;
  corners: CornerPoints;
  confidence: number;
}

interface Candidate extends Point {
  area: number;
}

/** Find solid connected components, then validate all four as one sheet.
 * Never infer a missing marker: an affine guess is unsafe under perspective.
 */
export function detectRegistrationMarkers(
  imageData: ImageData,
  fallbackCorners: CornerPoints,
): MarkerDetectionResult {
  const scale = Math.min(1, 1000 / Math.max(imageData.width, imageData.height));
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
    // Solid fiducials, not text, hollow bubbles, QR finder rings, or desk edges.
    if (
      minX <= 2 ||
      minY <= 2 ||
      maxX >= width - 3 ||
      maxY >= height - 3 ||
      w < 5 ||
      h < 5 ||
      w / h < 0.5 ||
      w / h > 2 ||
      tail / (w * h) < 0.65 ||
      tail > width * height * 0.015
    )
      continue;
    candidates.push({ x: sumX / tail, y: sumY / tail, area: tail });
  }
  const points = candidates.sort((a, b) => b.area - a.area).slice(0, 28);
  let best: CornerPoints | null = null,
    bestScore = -Infinity;
  const distance = (a: Point, b: Point) => Math.hypot(a.x - b.x, a.y - b.y);
  for (let a = 0; a < points.length; a++)
    for (let b = a + 1; b < points.length; b++)
      for (let c = b + 1; c < points.length; c++)
        for (let d = c + 1; d < points.length; d++) {
          const group = [points[a], points[b], points[c], points[d]];
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
              Math.min(width, height) * 0.2 ||
            top / bottom < 0.68 ||
            top / bottom > 1.47 ||
            left / right < 0.68 ||
            left / right > 1.47
          )
            continue;
          const aspect = (top + bottom) / (left + right);
          const isStandard = aspect >= 0.38 && aspect <= 1.18;
          const isHalf = aspect >= 1.25 && aspect <= 1.45;
          if (!isStandard && !isHalf) continue;
          let area = 0,
            convex = true;
          for (let i = 0; i < 4; i++) {
            const p = group[i],
              q = group[(i + 1) % 4],
              r = group[(i + 2) % 4];
            area += p.x * q.y - p.y * q.x;
            if ((q.x - p.x) * (r.y - q.y) - (q.y - p.y) * (r.x - q.x) <= 0)
              convex = false;
          }
          area /= 2;
          if (!convex || area < width * height * 0.08) continue;
          const isHalfSheet = isHalf;
          // 8 mm fiducials around a 178 x 265 mm rectangle (or 178 x 128.5 mm for half-sheet).
          const nominalArea = isHalfSheet ? 178 * 128.5 : 178 * 265;
          const expectedArea = (area * 64) / nominalArea;
          if (
            group.some(
              (p) => p.area / expectedArea < 0.3 || p.area / expectedArea > 3,
            )
          )
            continue;
          const canonical: [Point, Point, Point, Point] = isHalfSheet
            ? [
                { x: 16, y: 10 },
                { x: 194, y: 10 },
                { x: 194, y: 138.5 },
                { x: 16, y: 138.5 },
              ]
            : [
                { x: 16, y: 16 },
                { x: 194, y: 16 },
                { x: 194, y: 281 },
                { x: 16, y: 281 },
              ];
          const H = computeHomography(canonical, [tl, tr, br, bl]);
          const ratios = group.map((p, i) => {
            const center = canonical[i];
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
            return p.area / (Math.abs(projectedArea) / 2);
          });
          if (ratios.some((r) => !Number.isFinite(r) || r < 0.8 || r > 1.2))
            continue;
          const solidSquares = canonical.every((center) => {
            let dark = 0;
            for (const dx of [-3.2, -1.6, 0, 1.6, 3.2])
              for (const dy of [-3.2, -1.6, 0, 1.6, 3.2]) {
                const p = applyHomography(H, {
                  x: center.x + dx,
                  y: center.y + dy,
                });
                const x = Math.round(p.x),
                  y = Math.round(p.y);
                if (
                  x >= 0 &&
                  y >= 0 &&
                  x < width &&
                  y < height &&
                  darkPixels[y * width + x]
                )
                  dark++;
              }
            return dark >= 23;
          });
          if (!solidSquares) continue;
          const quietZone = canonical.every((center) => {
            let darkBorder = 0;
            for (const [dx, dy] of [
              [-5.5, 0],
              [5.5, 0],
              [0, -5.5],
              [0, 5.5],
              [-5.5, -5.5],
              [5.5, -5.5],
              [-5.5, 5.5],
              [5.5, 5.5],
            ]) {
              const p = applyHomography(H, {
                x: center.x + dx,
                y: center.y + dy,
              });
              const x = Math.round(p.x),
                y = Math.round(p.y);
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
          if (!quietZone) continue;
          const score =
            Math.log(area) -
            ratios.reduce((n, r) => n + Math.abs(Math.log(r)), 0);
          if (score > bestScore) {
            bestScore = score;
            best = { tl, tr, br, bl };
          }
        }
  if (!best) return fail;
  const corners = {} as CornerPoints;
  for (const key of ["tl", "tr", "br", "bl"] as const)
    corners[key] = { x: best[key].x / scale, y: best[key].y / scale };
  return { detected: true, corners, confidence: 1 };
}
