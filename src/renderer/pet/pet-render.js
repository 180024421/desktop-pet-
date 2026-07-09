/** 统一渲染桥接：像素 / 精灵图 / 传统 flipbook */

(function () {
  let canvas = null;
  let pixelRenderer = null;
  let sheetRenderer = null;
  let shimeji = null;
  let bongo = null;
  let pixelTimer = null;
  let currentState = "idle";
  let api = null;

  function mode(config) {
    return config?.renderMode || "flipbook";
  }

  function isAlt(config) {
    const m = mode(config);
    return m === "pixel" || m === "spritesheet";
  }

  function ensureCanvas(scaleWrap, imgEl) {
    if (canvas) return canvas;
    canvas = document.getElementById("pet-canvas");
    if (!canvas && scaleWrap) {
      canvas = document.createElement("canvas");
      canvas.id = "pet-canvas";
      canvas.className = "pet-canvas hidden";
      canvas.draggable = false;
      scaleWrap.insertBefore(canvas, imgEl || null);
    }
    return canvas;
  }

  function showCanvas(show) {
    if (canvas) canvas.classList.toggle("hidden", !show);
  }

  function initBridge(ctx) {
    try {
      api = ctx;
      const { scaleWrap, img, petApi, getConfig, playState, savePosition } = ctx;
      ensureCanvas(scaleWrap, img);
      if (!canvas) throw new Error("pet-canvas missing");
      pixelRenderer = new PixelPetRenderer(canvas, "cat");
      sheetRenderer = new SpriteSheetRenderer(canvas);

      shimeji = createShimejiController({
        getConfig,
        getWorkArea: (p) => petApi.getWorkArea(p),
        playState,
        savePosition,
        setFacing: (d) => pixelRenderer?.setFacing(d),
      });

      bongo = createBongoController({
        getConfig,
        playState,
        petApi,
      });

      if (petApi.onActivity) {
        petApi.onActivity((data) => {
          bongo?.onActivity?.(data);
          ctx.onActivity?.(data);
        });
      }
    } catch (err) {
      console.error("[PetRender] initBridge failed", err);
    }
  }

  function applyConfig(config, imgEl) {
    if (!config || !pixelRenderer || !sheetRenderer) return;
    const alt = isAlt(config);
    showCanvas(alt);
    if (imgEl) {
      imgEl.classList.toggle("hidden", alt);
      if (alt) imgEl.removeAttribute("src");
    }

    if (mode(config) === "pixel") {
      pixelRenderer.setSkin(config.pixelSkin || "cat");
      pixelRenderer.drawFrame("idle", 0);
    } else if (mode(config) === "spritesheet" && config.spriteSheet) {
      sheetRenderer.setConfig({
        ...config.spriteSheet,
        imageUrl: config.spriteSheet.imageUrl || config.spriteSheet.url,
      });
      sheetRenderer.draw("idle", 0);
    }

    if (config.shimejiMode && !config.wander) shimeji?.restart();
    else shimeji?.stop();

    bongo?.restart();
  }

  function drawState(state) {
    currentState = state;
    const cfg = api?.getConfig?.();
    if (!cfg || !isAlt(cfg)) return false;

    if (pixelTimer) clearInterval(pixelTimer);

    const drawOnce = () => {
      if (mode(cfg) === "pixel") {
        const mapped = state === "typing" ? "typing" : pixelRenderer.pack.sprites[state] ? state : "idle";
        pixelRenderer.drawFrame(mapped, pixelRenderer.frame);
      } else if (mode(cfg) === "spritesheet") {
        const mapped = cfg.spriteSheet?.states?.[state] ? state : "idle";
        sheetRenderer.draw(mapped, sheetRenderer.frameIndex);
      }
    };

    drawOnce();
    const interval = cfg.frameIntervalMs ?? 180;
    pixelTimer = setInterval(() => {
      if (mode(cfg) === "pixel") {
        const mapped = state === "typing" ? "typing" : pixelRenderer.pack.sprites[state] ? state : "idle";
        pixelRenderer.tick(mapped);
      } else {
        const mapped = cfg.spriteSheet?.states?.[state] ? state : "idle";
        sheetRenderer.tick(mapped);
      }
    }, interval);
    return true;
  }

  function clearTimers() {
    if (pixelTimer) clearInterval(pixelTimer);
    pixelTimer = null;
  }

  function framesForState(config, state) {
    if (mode(config) === "pixel") return [{ path: "pixel", url: "" }];
    if (mode(config) === "spritesheet") {
      const rects = config.spriteSheet?.states?.[state] || config.spriteSheet?.states?.idle;
      return rects?.length ? rects : [];
    }
    return null;
  }

  function restartMovement(config) {
    if (config?.shimejiMode && !config.wander) shimeji?.restart();
    else shimeji?.stop();
  }

  window.PetRender = {
    initBridge,
    applyConfig,
    drawState,
    clearTimers,
    isAlt,
    framesForState,
    restartMovement,
    getShimeji: () => shimeji,
    getBongo: () => bongo,
  };
})();
