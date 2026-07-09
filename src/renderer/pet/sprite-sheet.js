/** Sprite Sheet 渲染器 */
(function () {
  class SpriteSheetRenderer {
  constructor(canvas) {
    this.canvas = canvas;
    this.ctx = canvas.getContext("2d", { alpha: true });
    this.ctx.imageSmoothingEnabled = false;
    this.image = new Image();
    this.imageLoaded = false;
    this.config = null;
    this.frameIndex = 0;
    this.image.onload = () => {
      this.imageLoaded = true;
    };
  }

  setConfig(config) {
    this.config = config;
    if (config?.imageUrl) {
      this.imageLoaded = false;
      this.image.src = config.imageUrl;
    }
  }

  rectsFor(state) {
    const list = this.config?.states?.[state];
    if (list?.length) return list;
    return this.config?.states?.idle || [];
  }

  draw(state, index = 0) {
    if (!this.imageLoaded || !this.config) return null;
    const rects = this.rectsFor(state);
    if (!rects.length) return null;
    const r = rects[index % rects.length];
    const w = r.w || this.config.frameWidth;
    const h = r.h || this.config.frameHeight;
    this.canvas.width = w;
    this.canvas.height = h;
    this.ctx.clearRect(0, 0, w, h);
    this.ctx.drawImage(this.image, r.x, r.y, w, h, 0, 0, w, h);
    return { w, h };
  }

  tick(state) {
    const rects = this.rectsFor(state);
    if (!rects.length) return null;
    this.frameIndex = (this.frameIndex + 1) % rects.length;
    return this.draw(state, this.frameIndex);
  }
  }

  window.SpriteSheetRenderer = SpriteSheetRenderer;
})();
