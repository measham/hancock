# Conversion instructions

The conversion script turns your **finds** (with lat/lon) and **control points** (from calibration) into a single **points_pixels.json** file used by the playback app.

## Inputs

| File | Description |
|------|-------------|
| `finds.json` | JSON array of find objects. Each must have `fourFigureLat`, `fourFigureLon`; optional `id`, `findIdentifier`, `objecttype`, `broadperiod`, `precision`, `imageUrl`, `fromdate`, `todate`, `datefound1`. |
| `controls.json` | From the calibration tool: array of `{ name, lat, lon, x, y }`. |

You can use a different finds file by passing its path as the first argument (see below).

## Run

From the project root:

```bash
npm run convert
```

This uses `finds.json` and `controls.json` in the current directory and writes `points_pixels.json`.

To use another finds file:

```bash
node convert-finds-to-pixels.mjs path/to/your/finds.json
```

Output is always `points_pixels.json` in the current directory.

## What it does

1. **Projection**: Converts (lon, lat) to plane coordinates (X, Y) using **d3-geo** `geoMercator().scale(1).translate([0,0])`.
2. **Affine fit**: Solves a 6-parameter affine transform from (X, Y) to image pixels (x, y) using the control points (least squares).
3. **Convert all finds**: For each find, projects (fourFigureLon, fourFigureLat) to (X, Y), then applies the transform to get (x, y).
4. **Jitter**: Applies a small random offset to reduce overlap when many finds share the same 4-figure grid:
   - precision ≥ 10: ±2 px  
   - precision ≥ 8: ±6 px  
   - precision ≤ 6: ±10 px  
   (Missing precision is treated as 10.)
5. **Output**: Writes `points_pixels.json` with one object per find: `id`, `findIdentifier`, `objecttype`, `broadperiod`, `precision`, `imageUrl`, `fromdate`, `todate`, `datefound1`, and **x**, **y** in pixels.

## Quality reporting

After solving the transform, the script prints:

- **Per-control-point error** (distance in pixels between clicked position and reprojected position)
- **Average error** and **Max error**

Use this to validate calibration. Target: average &lt; 10 px, max &lt; 20 px. If errors are high, add or reposition control points and re-run.
