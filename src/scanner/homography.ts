import { Point } from '../omr/types';

export type Matrix3x3 = [
  [number, number, number],
  [number, number, number],
  [number, number, number]
];

/**
 * Solves an 8x8 linear system Ax = B using Gaussian elimination with partial pivoting.
 */
function solve8x8(A: number[][], B: number[]): number[] {
  const n = 8;
  // Augmented matrix
  const M: number[][] = A.map((row, i) => [...row, B[i]]);

  for (let i = 0; i < n; i++) {
    // Partial pivoting: find max element in column i
    let maxRow = i;
    for (let k = i + 1; k < n; k++) {
      if (Math.abs(M[k][i]) > Math.abs(M[maxRow][i])) {
        maxRow = k;
      }
    }
    // Swap rows
    const temp = M[i];
    M[i] = M[maxRow];
    M[maxRow] = temp;

    if (Math.abs(M[i][i]) < 1e-12) {
      throw new Error('Singular matrix in homography calculation');
    }

    // Eliminate below
    for (let k = i + 1; k < n; k++) {
      const factor = M[k][i] / M[i][i];
      for (let j = i; j <= n; j++) {
        M[k][j] -= factor * M[i][j];
      }
    }
  }

  // Back substitution
  const x = new Array(n).fill(0);
  for (let i = n - 1; i >= 0; i--) {
    let sum = M[i][n];
    for (let j = i + 1; j < n; j++) {
      sum -= M[i][j] * x[j];
    }
    x[i] = sum / M[i][i];
  }

  return x;
}

/**
 * Computes the 3x3 Projective Homography matrix that maps src points to dst points:
 * dst ~ H * src
 *
 * @param src 4 corner points in source space (e.g. canonical mm) [TL, TR, BR, BL]
 * @param dst 4 corner points in destination space (e.g. camera pixels) [TL, TR, BR, BL]
 */
export function computeHomography(
  src: [Point, Point, Point, Point],
  dst: [Point, Point, Point, Point]
): Matrix3x3 {
  const A: number[][] = [];
  const B: number[] = [];

  for (let i = 0; i < 4; i++) {
    const { x, y } = src[i];
    const { x: u, y: v } = dst[i];

    // Row 1: x equation
    A.push([x, y, 1, 0, 0, 0, -u * x, -u * y]);
    B.push(u);

    // Row 2: y equation
    A.push([0, 0, 0, x, y, 1, -v * x, -v * y]);
    B.push(v);
  }

  const h = solve8x8(A, B);

  return [
    [h[0], h[1], h[2]],
    [h[3], h[4], h[5]],
    [h[6], h[7], 1.0],
  ];
}

/**
 * Transforms a point (x, y) using the 3x3 homography matrix H.
 */
export function applyHomography(H: Matrix3x3, pt: Point): Point {
  const { x, y } = pt;
  const w = H[2][0] * x + H[2][1] * y + H[2][2];

  if (Math.abs(w) < 1e-12) {
    return { x: 0, y: 0 };
  }

  return {
    x: (H[0][0] * x + H[0][1] * y + H[0][2]) / w,
    y: (H[1][0] * x + H[1][1] * y + H[1][2]) / w,
  };
}
