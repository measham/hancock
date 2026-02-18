# Calibration instructions

Calibration maps latitude/longitude from your dataset to the **pixel coordinates** of the background map image so finds plot in the correct positions.

## Prerequisites

- **Map artwork**: `map-portrait-4k.png` at **3050×3840** pixels. This is the single source of truth; do not scale or crop it for calibration.
- A list of **control point** locations you can identify on the map (towns, landmarks) with known lat/lon.

## Steps

1. **Open the calibration tool**
   - Serve the project locally (e.g. `npm run calibrate` or `npx serve -p 3334`) and open `calibrate.html` in a browser.
   - Or open `calibrate.html` directly (some browsers may block loading the image if using `file://`).

2. **Load the map**
   - The page loads `map-portrait-4k.png` from the same directory. Ensure the image is present and exactly 3050×3840.

3. **Add control points**
   - **Click** on the map at a known location (e.g. Newcastle upon Tyne). The tool computes the **image-space** pixel coordinates (x, y) in the 3050×3840 space and fills the X/Y fields (read-only).
   - Enter a **name** (e.g. "Newcastle upon Tyne") and the **latitude** and **longitude** for that location.
   - Click **Add control point**. The point is added to the list and a marker appears on the map.
   - Repeat for at least **3** points; **8–12** spread across the map (north, south, east, west, interior) give a more stable fit.

4. **Suggested control points** (if visible on your artwork)
   - Berwick-upon-Tweed, Alnwick, Morpeth, Newcastle upon Tyne, Sunderland, Durham, Hartlepool, Middlesbrough, Hexham, plus any other labelled towns or landmarks.

5. **Export**
   - Click **Export controls.json**. This downloads a JSON array of `{ name, lat, lon, x, y }`. Save it as `controls.json` in the project root (same folder as `convert-finds-to-pixels.mjs`).

## Notes

- Coordinates are always in the **full 3050×3840** image space, even if the image is zoomed or scaled in the browser.
- You can remove individual points or clear all and re-export.
- After exporting, run the conversion script (see CONVERSION.md) and check the logged **average** and **max** control-point error. Aim for average &lt; 10 px and max &lt; 20 px; if not, add or adjust control points and re-export.
