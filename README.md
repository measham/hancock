# Hancock — Explore

Portrait 4K projection visual: fixed background map with ~9,000 archaeological finds plotted from lat/lon, animated point reveal, and timed overlay panels. Canvas **3050×3840**.

## Quick start

1. **Map artwork**: Add `map-portrait-4k.png` (3050×3840) to the project root. This is the background used by both the calibration tool and the playback app.
2. **Calibrate** (if you need to recalibrate): Open `calibrate.html`, add 8–12 control points, export `controls.json`. See [docs/CALIBRATION.md](docs/CALIBRATION.md).
3. **Convert**: `npm run convert` (uses `finds.json` and `controls.json`, writes `points_pixels.json`). To use another finds file: `node convert-finds-to-pixels.mjs path/to/finds.json`. See [docs/CONVERSION.md](docs/CONVERSION.md).
4. **Playback**: `npm run playback` then open http://localhost:3333. See [docs/PLAYBACK.md](docs/PLAYBACK.md).

## Deliverables

| Item | Description |
|------|-------------|
| **Playback app** | `index.html` + `app.js` — PixiJS stage 3050×3840, background layer, WebGL points layer, overlay layer, GSAP timeline. |
| **Calibration tool** | `calibrate.html` — Load map, click for pixel coords, add name/lat/lon, export `controls.json`. |
| **Conversion script** | `convert-finds-to-pixels.mjs` — Node; reads finds + controls, outputs `points_pixels.json` with affine fit and jitter. |
| **Docs** | `docs/CALIBRATION.md`, `docs/CONVERSION.md`, `docs/PLAYBACK.md` (and this README). |

## Tech stack

- **PixiJS** — Rendering (portrait 4K canvas, sprites for points, overlays).
- **GSAP** — Timeline (point reveal, overlay in/out).
- **d3-geo** — Mercator projection in the conversion script.
- **Node** — Conversion script (ESM).

## Debug keys

- **D** — Toggle debug (safe frame, crosshair, FPS).
- **C** — Toggle control points on map.
- **R** / **Space** — Restart sequence.
- **O** — Toggle overlay panel.

## Data

- **Finds**: JSON array with at least `fourFigureLat`, `fourFigureLon`; optional `id`, `findIdentifier`, `objecttype`, `broadperiod`, `precision`, `imageUrl`, etc. Example dataset: `north_east_finds_optimized.json` (use as `finds.json` or pass path to the script).
- **Controls**: From calibration: `[{ name, lat, lon, x, y }, ...]`.
- **Output**: `points_pixels.json` — one object per find with `x`, `y` in pixels plus metadata for overlays.
