(function () {
  "use strict";

  const STAGE_WIDTH = 2160;
  const STAGE_HEIGHT = 3840;
  const POINTS_FADE_START = 0.2;
  const POINTS_FADE_END = 2.0;
  const OVERLAY_IN_TIME = 2.5;
  const OVERLAY_OUT_TIME = 6.0;

  // Map tiles: grid size and grayscale (highlighted) tiles
  const TILE_SIZE = 100;
  const TILE_COLS = Math.ceil(STAGE_WIDTH / TILE_SIZE);
  const TILE_ROWS = Math.ceil(STAGE_HEIGHT / TILE_SIZE);
  const NUM_GRAYSCALE_TILES = 5;
  const GRAYSCALE_TILE_INTERVAL_MS = 5000;

  let app;
  let backgroundLayer;
  let mapTilesLayer;
  let pointsLayer;
  let tileOverlayLayer;
  let overlayLayer;
  let debugLayer;
  let controlPointsLayer;
  let pointsData = [];
  let controlPointsData = [];
  let revealProgress = 0;
  let tl;
  let debugVisible = false;
  let controlPointsVisible = false;
  let overlayVisible = false;
  let overlayPanel = null;
  let pointSprites = null;
  let pinTexture = null;
  let lastFrameTime = 0;
  let frameCount = 0;
  let fpsEl;
  let mapTextureSource = null;
  let invertedTilesContainer = null;
  let grayscaleTileIntervalId = null;

  function createPointTexture(radius, glow) {
    const size = Math.max(32, (radius + (glow || 0)) * 2);
    const canvas = document.createElement("canvas");
    canvas.width = size;
    canvas.height = size;
    const ctx = canvas.getContext("2d");
    const cx = size / 2;
    const cy = size / 2;
    if (glow) {
      const g = ctx.createRadialGradient(cx, cy, 0, cx, cy, radius + glow);
      g.addColorStop(0, "rgba(255,220,120,0.9)");
      g.addColorStop(0.5, "rgba(255,180,80,0.4)");
      g.addColorStop(1, "rgba(255,140,40,0)");
      ctx.fillStyle = g;
      ctx.beginPath();
      ctx.arc(cx, cy, radius + glow, 0, Math.PI * 2);
      ctx.fill();
    }
    ctx.fillStyle = "rgba(255,220,140,0.95)";
    ctx.beginPath();
    ctx.arc(cx, cy, radius, 0, Math.PI * 2);
    ctx.fill();
    return PIXI.Texture.from(canvas);
  }

  function initPixi() {
    app = new PIXI.Application();
    return app.init({
      width: STAGE_WIDTH,
      height: STAGE_HEIGHT,
      resolution: 1,
      autoDensity: true,
      antialias: true,
      background: "#0a0a0a",
      canvas: document.createElement("canvas"),
    }).then(() => {
      document.getElementById("app").appendChild(app.canvas);
      app.canvas.style.width = "100%";
      app.canvas.style.height = "100%";
      app.canvas.style.display = "block";
      backgroundLayer = new PIXI.Container();
      mapTilesLayer = new PIXI.Container();
      pointsLayer = new PIXI.Container();
      tileOverlayLayer = new PIXI.Container();
      overlayLayer = new PIXI.Container();
      debugLayer = new PIXI.Container();
      controlPointsLayer = new PIXI.Container();
      app.stage.addChild(backgroundLayer);
      app.stage.addChild(mapTilesLayer);
      app.stage.addChild(pointsLayer);
      app.stage.addChild(tileOverlayLayer);
      app.stage.addChild(overlayLayer);
      app.stage.addChild(controlPointsLayer);
      app.stage.addChild(debugLayer);
      debugLayer.eventMode = "none";
      debugLayer.visible = false;
      controlPointsLayer.visible = false;
      return Promise.all([
        PIXI.Assets.load("map-portrait-4k.png").catch(() => {
          const canvas = document.createElement("canvas");
          canvas.width = STAGE_WIDTH;
          canvas.height = STAGE_HEIGHT;
          const ctx = canvas.getContext("2d");
          ctx.fillStyle = "#1a2a1a";
          ctx.fillRect(0, 0, STAGE_WIDTH, STAGE_HEIGHT);
          ctx.strokeStyle = "rgba(255,255,255,0.06)";
          ctx.lineWidth = 1;
          for (let i = 0; i < STAGE_WIDTH; i += 120) {
            ctx.beginPath();
            ctx.moveTo(i, 0);
            ctx.lineTo(i, STAGE_HEIGHT);
            ctx.stroke();
          }
          for (let j = 0; j < STAGE_HEIGHT; j += 120) {
            ctx.beginPath();
            ctx.moveTo(0, j);
            ctx.lineTo(STAGE_WIDTH, j);
            ctx.stroke();
          }
          return PIXI.Texture.from(canvas);
        }),
        fetch("points_pixels.json").then((r) => r.json()),
        fetch("controls.json").then((r) => r.json()).catch(() => []),
      ]);
    }).then(([bgTexture, points, controls]) => {
      pointsData = points;
      controlPointsData = controls;
      const bg = new PIXI.Sprite(bgTexture);
      bg.width = STAGE_WIDTH;
      bg.height = STAGE_HEIGHT;
      bg.anchor.set(0, 0);
      backgroundLayer.addChild(bg);

      buildMapTiles(bgTexture);
      buildTileOverlay();

      pinTexture = createPointTexture(4, 6);
      const pointsContainer = new PIXI.Container();
      pointSprites = pointsContainer;
      pointsLayer.addChild(pointsContainer);

      const shuffle = (arr) => {
        const a = arr.slice();
        for (let i = a.length - 1; i > 0; i--) {
          const j = Math.floor(Math.random() * (i + 1));
          [a[i], a[j]] = [a[j], a[i]];
        }
        return a;
      };
      const indices = shuffle(pointsData.map((_, i) => i));
      const spriteSize = 1;
      pointsData.forEach((p, i) => {
        const sprite = new PIXI.Sprite(pinTexture);
        sprite.anchor.set(0.5, 0.5);
        sprite.x = p.x;
        sprite.y = p.y;
        sprite.scale.set(spriteSize);
        sprite.alpha = 0;
        sprite.eventMode = "none";
        pointsContainer.addChild(sprite);
        p._sprite = sprite;
        p._staggerIndex = indices.indexOf(i);
      });

      drawControlPointsSprites();

      buildOverlay();
      buildDebugOverlay();
      startTimeline();
      app.ticker.add(tick);
    });
  }

  function drawControlPointsSprites() {
    controlPointsLayer.removeChildren();
    controlPointsData.forEach((c) => {
      const g = new PIXI.Graphics();
      g.circle(c.x, c.y, 12);
      g.fill({ color: 0xff0000, alpha: 0.2 });
      g.stroke({ width: 2, color: 0xff0000 });
      controlPointsLayer.addChild(g);
    });
  }

  function pickRandomGrayscaleTiles() {
    const tiles = [];
    const indices = [];
    for (let col = 0; col < TILE_COLS; col++) {
      for (let row = 0; row < TILE_ROWS; row++) indices.push([col, row]);
    }
    for (let i = 0; i < NUM_GRAYSCALE_TILES && indices.length > 0; i++) {
      const idx = Math.floor(Math.random() * indices.length);
      tiles.push(indices[idx]);
      indices.splice(idx, 1);
    }
    return tiles;
  }

  function updateGrayscaleTiles(tileList) {
    if (!invertedTilesContainer || !mapTextureSource) return;
    invertedTilesContainer.removeChildren();
    const colorFilter = new PIXI.ColorMatrixFilter();
    colorFilter.desaturate();
    colorFilter.brightness(0.5, true); // darken for more dramatic grayscale

    tileList.forEach(([col, row]) => {
      const tileX = Math.floor(col * TILE_SIZE);
      const tileY = Math.floor(row * TILE_SIZE);
      const w = Math.min(TILE_SIZE, STAGE_WIDTH - tileX);
      const h = Math.min(TILE_SIZE, STAGE_HEIGHT - tileY);
      if (w <= 0 || h <= 0) return;

      const frame = new PIXI.Rectangle(tileX, tileY, w, h);
      const tileTexture = new PIXI.Texture({ source: mapTextureSource, frame });
      const sprite = new PIXI.Sprite(tileTexture);
      sprite.x = tileX;
      sprite.y = tileY;
      sprite.width = w;
      sprite.height = h;
      sprite.roundPixels = true; // avoid sub-pixel shift vs background
      sprite.filters = [colorFilter];
      invertedTilesContainer.addChild(sprite);

      const border = new PIXI.Graphics();
      border.rect(tileX, tileY, w, h);
      border.stroke({ width: 2, color: 0xcc2222 });
      invertedTilesContainer.addChild(border);
    });
  }

  function buildMapTiles(bgTexture) {
    const source = bgTexture.source ?? bgTexture;
    mapTextureSource = source;

    // Full map: outline every tile (subtle grid like reference)
    const gridGraphics = new PIXI.Graphics();
    for (let col = 0; col < TILE_COLS; col++) {
      for (let row = 0; row < TILE_ROWS; row++) {
        const x = col * TILE_SIZE;
        const y = row * TILE_SIZE;
        const w = Math.min(TILE_SIZE, STAGE_WIDTH - x);
        const h = Math.min(TILE_SIZE, STAGE_HEIGHT - y);
        gridGraphics.rect(x, y, w, h);
      }
    }
    gridGraphics.stroke({ width: 0.5, color: 0x555555 });
    mapTilesLayer.addChild(gridGraphics);

    // Crosshairs at every grid intersection (small plus markers)
    const crosshairArm = 5;
    const crosshairColor = 0x5a6a6a;
    const crosshairGraphics = new PIXI.Graphics();
    for (let col = 0; col <= TILE_COLS; col++) {
      for (let row = 0; row <= TILE_ROWS; row++) {
        const cx = col * TILE_SIZE;
        const cy = row * TILE_SIZE;
        if (cx > STAGE_WIDTH || cy > STAGE_HEIGHT) continue;
        crosshairGraphics.moveTo(cx - crosshairArm, cy);
        crosshairGraphics.lineTo(cx + crosshairArm, cy);
        crosshairGraphics.moveTo(cx, cy - crosshairArm);
        crosshairGraphics.lineTo(cx, cy + crosshairArm);
      }
    }
    crosshairGraphics.stroke({ width: 1.5, color: crosshairColor }); // crosshairs slightly thicker than tile outlines
    mapTilesLayer.addChild(crosshairGraphics);

    invertedTilesContainer = new PIXI.Container();
    mapTilesLayer.addChild(invertedTilesContainer);
    updateGrayscaleTiles(pickRandomGrayscaleTiles());

    grayscaleTileIntervalId = setInterval(() => {
      updateGrayscaleTiles(pickRandomGrayscaleTiles());
    }, GRAYSCALE_TILE_INTERVAL_MS);
  }

  function drawDashedLine(g, x0, y0, x1, y1, dashLength, gapLength) {
    const dx = x1 - x0;
    const dy = y1 - y0;
    const len = Math.hypot(dx, dy);
    if (len < 1e-6) return;
    const ux = dx / len;
    const uy = dy / len;
    let d = 0;
    while (d < len) {
      const d1 = Math.min(d + dashLength, len);
      g.moveTo(x0 + ux * d, y0 + uy * d);
      g.lineTo(x0 + ux * d1, y0 + uy * d1);
      d = d1 + gapLength;
    }
  }

  function buildTileOverlay() {
    tileOverlayLayer.removeChildren();
    const featured = pointsData
      .filter((p) => p.objecttype && String(p.objecttype).length > 2)
      .slice(0, 5);
    const lineColor = 0xcc4422;
    const dashLen = 12;
    const gapLen = 8;

    featured.forEach((p, i) => {
      const fromX = p.x;
      const fromY = p.y;
      const toX = p.x + 140;
      const toY = p.y - 35;

      const g = new PIXI.Graphics();
      g.moveTo(fromX, fromY);
      drawDashedLine(g, fromX, fromY, toX, toY, dashLen, gapLen);
      g.stroke({ width: 2, color: lineColor });
      tileOverlayLayer.addChild(g);

      const label = new PIXI.Text({
        text: String(p.objecttype).slice(0, 32),
        style: {
          fontFamily: "system-ui, sans-serif",
          fontSize: 22,
          fill: 0xcc5522,
        },
      });
      label.x = toX + 4;
      label.y = toY - 10;
      tileOverlayLayer.addChild(label);
    });
  }

  function buildOverlay() {
    overlayLayer.removeChildren();
    const scrim = new PIXI.Graphics();
    scrim.rect(0, 0, STAGE_WIDTH, STAGE_HEIGHT);
    scrim.fill({ color: 0x000000, alpha: 0.5 });
    overlayLayer.addChild(scrim);

    const cardW = 700;
    const cardH = 420;
    const cardX = (STAGE_WIDTH - cardW) / 2;
    const cardY = STAGE_HEIGHT - cardH - 120;
    const card = new PIXI.Graphics();
    card.roundRect(cardX, cardY, cardW, cardH, 16);
    card.fill({ color: 0x1a1a1a, alpha: 0.95 });
    card.stroke({ width: 1, color: 0x444444 });
    overlayLayer.addChild(card);

    const title = new PIXI.Text({
      text: "Latest finds",
      style: { fontFamily: "system-ui, sans-serif", fontSize: 36, fill: 0xe0e0e0 },
    });
    title.x = cardX + 24;
    title.y = cardY + 20;
    overlayLayer.addChild(title);

    const sample = pointsData.filter((p) => p.objecttype && p.broadperiod).slice(-3).reverse();
    let yy = cardY + 80;
    sample.forEach((p, i) => {
      const line = new PIXI.Text({
        text: `${p.objecttype} — ${p.broadperiod}`,
        style: { fontFamily: "system-ui, sans-serif", fontSize: 24, fill: 0xc0c0c0 },
      });
      line.x = cardX + 24;
      line.y = yy;
      overlayLayer.addChild(line);
      yy += 36;
    });

    overlayPanel = overlayLayer;
    overlayLayer.visible = false;
    overlayLayer.alpha = 0;
  }

  function buildDebugOverlay() {
    debugLayer.removeChildren();
    const g = new PIXI.Graphics();
    const m = 40;
    g.rect(m, m, STAGE_WIDTH - 2 * m, STAGE_HEIGHT - 2 * m);
    g.stroke({ width: 2, color: 0x00ff00 });
    g.moveTo(STAGE_WIDTH / 2 - 30, STAGE_HEIGHT / 2);
    g.lineTo(STAGE_WIDTH / 2 + 30, STAGE_HEIGHT / 2);
    g.moveTo(STAGE_WIDTH / 2, STAGE_HEIGHT / 2 - 30);
    g.lineTo(STAGE_WIDTH / 2, STAGE_HEIGHT / 2 + 30);
    g.stroke({ width: 2, color: 0x00ff00 });
    debugLayer.addChild(g);
    fpsEl = document.getElementById("fps");
  }

  function startTimeline() {
    if (tl) tl.kill();
    revealProgress = 0;
    const totalStagger = pointsData.length;
    pointsData.forEach((p) => {
      if (p._sprite) p._sprite.alpha = 0;
    });
    overlayLayer.visible = false;
    overlayLayer.alpha = 0;

    tl = gsap.timeline({ paused: false });
    tl.to({ v: 0 }, {
      v: 1,
      duration: POINTS_FADE_END - POINTS_FADE_START,
      ease: "none",
      onUpdate: function () {
        revealProgress = this.targets()[0].v;
      },
    }, POINTS_FADE_START);
    tl.to(overlayLayer, { alpha: 1, duration: 0.5 }, OVERLAY_IN_TIME);
    tl.set(overlayLayer, { visible: true }, OVERLAY_IN_TIME);
    tl.to(overlayLayer, { alpha: 0, duration: 0.6 }, OVERLAY_OUT_TIME);
    tl.call(() => { overlayLayer.visible = false; }, [], OVERLAY_OUT_TIME + 0.3);
  }

  function tick() {
    frameCount++;
    const now = performance.now();
    if (now - lastFrameTime >= 1000) {
      if (fpsEl) fpsEl.textContent = debugVisible ? "FPS: " + frameCount : "";
      frameCount = 0;
      lastFrameTime = now;
    }
    if (pointSprites && pointsData.length) {
      const totalStagger = pointsData.length;
      const duration = POINTS_FADE_END - POINTS_FADE_START;
      pointsData.forEach((p) => {
        const t = p._staggerIndex / totalStagger;
        const threshold = t * 0.9;
        p._sprite.alpha = revealProgress >= threshold ? Math.min(1, (revealProgress - threshold) * (1 / 0.1)) : 0;
      });
    }
  }

  function toggleDebug() {
    debugVisible = !debugVisible;
    debugLayer.visible = debugVisible;
  }

  function toggleControlPoints() {
    controlPointsVisible = !controlPointsVisible;
    controlPointsLayer.visible = controlPointsVisible;
  }

  function toggleOverlay() {
    overlayVisible = !overlayVisible;
    overlayLayer.visible = overlayVisible;
    overlayLayer.alpha = overlayVisible ? 1 : 0;
  }

  function restart() {
    startTimeline();
  }

  document.addEventListener("keydown", (e) => {
    if (e.key === "d" || e.key === "D") {
      toggleDebug();
      e.preventDefault();
    } else if (e.key === "c" || e.key === "C") {
      toggleControlPoints();
      e.preventDefault();
    } else if (e.key === "r" || e.key === "R" || e.key === " ") {
      restart();
      e.preventDefault();
    } else if (e.key === "o" || e.key === "O") {
      toggleOverlay();
      e.preventDefault();
    }
  });

  initPixi().catch((err) => {
    console.error(err);
    document.body.innerHTML = "<pre style='color:#e00; padding:20px'>" + err.message + "</pre>";
  });
})();
