# Playback instructions and show-day checklist

## Running the playback app

1. **Prepare assets**
   - `map-portrait-4k.png` (3050×3840) in the project root.
   - `points_pixels.json` (from the conversion script).
   - Optional: `controls.json` (for debug control-point overlay).

2. **Serve locally** (required for loading JSON and image)
   ```bash
   npm run playback
   ```
   Then open **http://localhost:3333** in a browser.

3. **Resolution**
   - The canvas is fixed at **3050×3840**. The browser may scale it to fit the window; for true 1:1 pixels, run in fullscreen on a display set to 3050×3840 (portrait), or use an Electron wrapper that locks resolution.
   - Fallback: if the machine cannot output 3050×3840, scale the stage accordingly (e.g. change `STAGE_WIDTH`/`STAGE_HEIGHT` and use a proportionally scaled map).

## Keyboard controls (debug)

| Key | Action |
|-----|--------|
| **D** | Toggle debug overlay (safe frame, center crosshair, FPS when debug on) |
| **C** | Toggle control points (from `controls.json`) on the map |
| **R** or **Space** | Restart the animation timeline |
| **O** | Toggle overlay panel on/off manually |

## Animation sequence

- **t = 0**: Background visible, points at alpha 0.
- **t = 0.2–2.0 s**: Points fade in with a staggered order (randomized for an organic look).
- **t = 2.5 s**: Overlay panel fades in (scrim + card + “Latest finds” content).
- **t = 6.0 s**: Overlay fades out.
- FPS is shown in the top-left when debug mode (D) is on.

## Show day checklist

- [ ] **Display**: Projector (or output) set to **portrait** orientation and correct resolution (3050×3840).
- [ ] **OS**: Disable sleep, screensaver, and (if possible) notifications.
- [ ] **Browser**: Run in fullscreen/kiosk; ensure no zoom (100%) and no browser scaling of the canvas.
- [ ] **Offline**: If the app is served from a local server, ensure all assets (map, JSON, and optionally GSAP/Pixi from local copies) are available without internet.
- [ ] **GPU**: Ensure drivers are up to date and hardware acceleration is enabled for smooth 30–60 fps.
- [ ] **Test**: Press **D** to confirm FPS and safe frame; **R** to restart the sequence; **C** to verify control points if needed.

## Packaging (optional)

- **Electron**: Wrap the app in Electron to lock resolution and fullscreen and avoid browser UI.
- **Local server**: Alternatively, use `npx serve` or similar and open in Chrome (or another browser) in fullscreen; disable dev tools and any scaling.

## Offline playback

- Host the app and assets on the same machine (e.g. `npm run playback`).
- For full offline use, save GSAP and PixiJS locally and point the script tags in `index.html` to those files instead of CDN URLs.
