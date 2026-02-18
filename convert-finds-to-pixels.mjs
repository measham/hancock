#!/usr/bin/env node
/**
 * convert-finds-to-pixels.mjs
 * Input: finds.json (or path), controls.json
 * Output: points_pixels.json
 * Uses d3-geo Mercator and affine least-squares fit from projected coords to image pixels.
 */

import { geoMercator } from "d3-geo";
import { readFileSync, writeFileSync } from "fs";
import { fileURLToPath } from "url";
import { dirname, join } from "path";

const __dirname = dirname(fileURLToPath(import.meta.url));
const root = join(__dirname);

const FINDS_PATH = process.argv[2] || join(root, "finds.json");
const CONTROLS_PATH = join(root, "controls.json");
const OUT_PATH = join(root, "points_pixels.json");

// Jitter (px) by precision: spec says precision 10 -> ±2, 8 -> ±6, <=6 -> ±10
function jitterRadius(precision) {
  if (precision == null || precision === undefined) return 2;
  if (precision >= 10) return 2;
  if (precision >= 8) return 6;
  return 10;
}

function randomInRange(lo, hi) {
  return lo + Math.random() * (hi - lo);
}

// Projection: scale 1, translate 0 (we only need a consistent plane)
const projection = geoMercator().scale(1).translate([0, 0]);

function project(lon, lat) {
  const p = projection([lon, lat]);
  return p ? { X: p[0], Y: p[1] } : null;
}

/**
 * Solve affine transform: [x; y] = [a b c; d e f] * [X; Y; 1]
 * So x = a*X + b*Y + c, y = d*X + e*Y + f
 * Least squares: we have N control points (X_i, Y_i) -> (x_i, y_i).
 * Stack: for each i: x_i = a*X_i + b*Y_i + c, same for y.
 * [x_1]   [X_1 Y_1 1] [a]
 * [x_2] = [X_2 Y_2 1] [b]
 * [...]   [...]       [c]
 * So we solve two systems: one for (a,b,c), one for (d,e,f).
 */
function solveAffine(controlPoints) {
  const n = controlPoints.length;
  const X = controlPoints.map((p) => p.X);
  const Y = controlPoints.map((p) => p.Y);
  const x = controlPoints.map((p) => p.px);
  const y = controlPoints.map((p) => p.py);

  // Build matrix A (n x 3): rows [X_i, Y_i, 1]
  const A = controlPoints.map((p) => [p.X, p.Y, 1]);
  // Solve A * [a,b,c]' = x and A * [d,e,f]' = y using normal equations A'A w = A'v
  const matMul = (A, B) => {
    const rows = A.length;
    const inner = B[0]?.length ?? B.length;
    const cols = Array.isArray(B[0]) ? B[0].length : 1;
    const out = Array(rows)
      .fill(0)
      .map(() => (cols === 1 ? 0 : Array(cols).fill(0)));
    for (let i = 0; i < rows; i++)
      for (let k = 0; k < inner; k++) {
        const a = A[i][k];
        if (cols === 1) {
          out[i] += a * B[k];
        } else {
          for (let j = 0; j < cols; j++) out[i][j] += a * B[k][j];
        }
      }
    return out;
  };
  const transpose = (M) => {
    const rows = M.length;
    const cols = M[0]?.length ?? 1;
    if (cols === 1) return M.map((r) => [r]);
    const T = Array(cols)
      .fill(0)
      .map(() => Array(rows));
    for (let i = 0; i < rows; i++) for (let j = 0; j < cols; j++) T[j][i] = M[i][j];
    return T;
  };
  const At = transpose(A);
  const AtA = At.map((row) =>
    A[0].map((_, j) => row.reduce((s, a, i) => s + a * A[i][j], 0))
  );
  const Atx = At.map((row) => row.reduce((s, a, i) => s + a * x[i], 0));
  const Aty = At.map((row) => row.reduce((s, a, i) => s + a * y[i], 0));

  // Solve AtA * [a,b,c] = Atx (3x3)
  function solve3(A3, b) {
    const [[a00, a01, a02], [a10, a11, a12], [a20, a21, a22]] = A3;
    const det =
      a00 * (a11 * a22 - a12 * a21) -
      a01 * (a10 * a22 - a12 * a20) +
      a02 * (a10 * a21 - a11 * a20);
    if (Math.abs(det) < 1e-15) throw new Error("Singular matrix in affine solve");
    const inv = [
      [
        a11 * a22 - a12 * a21,
        a02 * a21 - a01 * a22,
        a01 * a12 - a02 * a11,
      ],
      [
        a12 * a20 - a10 * a22,
        a00 * a22 - a02 * a20,
        a02 * a10 - a00 * a12,
      ],
      [
        a10 * a21 - a11 * a20,
        a01 * a20 - a00 * a21,
        a00 * a11 - a01 * a10,
      ],
    ].map((row) => row.map((v) => v / det));
    return [
      inv[0][0] * b[0] + inv[0][1] * b[1] + inv[0][2] * b[2],
      inv[1][0] * b[0] + inv[1][1] * b[1] + inv[1][2] * b[2],
      inv[2][0] * b[0] + inv[2][1] * b[1] + inv[2][2] * b[2],
    ];
  }
  const [a, b, c] = solve3(AtA, Atx);
  const [d, e, f] = solve3(AtA, Aty);
  return { a, b, c, d, e, f };
}

function transform(affine, X, Y) {
  const x = affine.a * X + affine.b * Y + affine.c;
  const y = affine.d * X + affine.e * Y + affine.f;
  return { x, y };
}

function main() {
  let finds, controls;
  try {
    finds = JSON.parse(readFileSync(FINDS_PATH, "utf8"));
  } catch (err) {
    console.error("Failed to read finds:", FINDS_PATH, err.message);
    process.exit(1);
  }
  try {
    controls = JSON.parse(readFileSync(CONTROLS_PATH, "utf8"));
  } catch (err) {
    console.error("Failed to read controls:", CONTROLS_PATH, err.message);
    process.exit(1);
  }

  if (!Array.isArray(finds) || !Array.isArray(controls) || controls.length < 3) {
    console.error("Need finds (array) and at least 3 control points.");
    process.exit(1);
  }

  const controlPoints = controls.map((c) => {
    const proj = project(c.lon, c.lat);
    if (!proj) throw new Error("Control point out of projection: " + c.name);
    return {
      name: c.name,
      X: proj.X,
      Y: proj.Y,
      px: c.x,
      py: c.y,
    };
  });

  const affine = solveAffine(controlPoints);
  console.log("Affine parameters:", affine);

  // Quality: reproject control points and report errors
  const errors = controlPoints.map((p) => {
    const t = transform(affine, p.X, p.Y);
    const err = Math.hypot(t.x - p.px, t.y - p.py);
    return { name: p.name, error: err };
  });
  const avgErr =
    errors.reduce((s, e) => s + e.error, 0) / errors.length;
  const maxErr = Math.max(...errors.map((e) => e.error));
  console.log("\n--- Calibration quality ---");
  errors.forEach((e) => console.log(`  ${e.name}: ${e.error.toFixed(2)} px`));
  console.log(`  Average error: ${avgErr.toFixed(2)} px`);
  console.log(`  Max error: ${maxErr.toFixed(2)} px\n`);

  const out = [];
  const defaultPrecision = 10;
  for (const find of finds) {
    const lat = find.fourFigureLat;
    const lon = find.fourFigureLon;
    if (lat == null || lon == null) continue;
    const proj = project(lon, lat);
    if (!proj) continue;
    let { x, y } = transform(affine, proj.X, proj.Y);
    const precision = find.precision != null ? find.precision : defaultPrecision;
    const r = jitterRadius(precision);
    x += randomInRange(-r, r);
    y += randomInRange(-r, r);

    out.push({
      id: find.id,
      findIdentifier: find.findIdentifier != null ? find.findIdentifier : `finds-${find.id}`,
      objecttype: find.objecttype ?? "",
      broadperiod: find.broadperiod ?? "",
      precision: precision,
      imageUrl: find.imageUrl ?? "",
      fromdate: find.fromdate,
      todate: find.todate,
      datefound1: find.datefound1,
      x: Math.round(x * 100) / 100,
      y: Math.round(y * 100) / 100,
    });
  }

  writeFileSync(OUT_PATH, JSON.stringify(out, null, 0), "utf8");
  console.log("Wrote", out.length, "points to", OUT_PATH);
}

main();
