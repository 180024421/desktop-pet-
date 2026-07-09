/** 桌面宠物像素精灵 — 猫/狗/史莱姆 */
(function () {
  const PIXEL_PALETTE = {
    ".": null,
    O: "#fb923c",
    o: "#ea580c",
    W: "#fff7ed",
    w: "#fed7aa",
    K: "#1f2937",
    k: "#374151",
    E: "#ffffff",
    e: "#fef3c7",
    P: "#f472b6",
    p: "#ec4899",
    G: "#86efac",
    g: "#4ade80",
    B: "#60a5fa",
    b: "#3b82f6",
    R: "#ef4444",
    r: "#dc2626",
    Y: "#fbbf24",
    y: "#f59e0b",
    N: "#64748b",
    n: "#475569",
    z: "#94a3b8",
    L: "#a78bfa",
    l: "#8b5cf6",
  };

  const DOG_PALETTE = { ...PIXEL_PALETTE, O: "#a16207", o: "#854d0e", W: "#fef9c3", w: "#fde68a" };
  const BLOB_PALETTE = { ...PIXEL_PALETTE, O: "#a78bfa", o: "#8b5cf6", W: "#ede9fe", w: "#ddd6fe" };

  function catSprites() {
    return {
      idle: [
        [
          "....OOOO....",
          "...OooWWo...",
          "..OoWeWeOo..",
          "..OoWWWWoO..",
          "...OooWWo...",
          "....OOOO....",
          "..OOOOOOOO..",
          ".OOOOOOOOOO.",
          ".OOOOOOOOOO.",
          "..KK....KK..",
          "..kk....kk..",
        ],
        [
          "....OOOO....",
          "...OooWWo...",
          "..OoWeWeOo..",
          "..OoWWWWoO..",
          "...OooWWo...",
          "....OOOO....",
          "..OOOOOOOO..",
          ".OOOOOOOOOO.",
          ".OOOOOOOOOO.",
          "..KK....KK..",
          "..kk....kk..",
          "..kk....kk..",
        ],
      ],
      walk: [
        [
          "....OOOO....",
          "...OooWWo...",
          "..OoWeWeOo..",
          "..OoWWWWoO..",
          "...OooWWo...",
          "....OOOO....",
          "..OOOOOOOO..",
          ".OOOOOOOOOO.",
          ".OOOOOOOOOO.",
          "..KK......KK",
          "..kk......kk",
        ],
        [
          "....OOOO....",
          "...OooWWo...",
          "..OoWeWeOo..",
          "..OoWWWWoO..",
          "...OooWWo...",
          "....OOOO....",
          "..OOOOOOOO..",
          ".OOOOOOOOOO.",
          ".OOOOOOOOOO.",
          "KK......KK..",
          "kk......kk..",
        ],
      ],
      sleep: [
        [
          "....OOOO....",
          "...OooWWo...",
          "..OoWWWWoO..",
          "..OoWWWWoO..",
          "...OooWWo...",
          "....zzzz....",
          "..OOOOOOOO..",
          ".OOOOOOOOOO.",
          ".OOOOOOOOOO.",
          "..KKKKKKKK..",
          "..kkkkkkkk..",
        ],
      ],
      happy: [
        [
          "....OOOO....",
          "...OooWWo...",
          "..OoWeWeOo..",
          "..OoWWWWoO..",
          "...OooWWo...",
          "....OOOO....",
          "..OOOOOOOO..",
          ".OOOOOOOOOO.",
          ".OOOOOOOOOO.",
          "..KK....KK..",
          "..kk....kk..",
          "....PPPP....",
        ],
      ],
      eat: [
        [
          "....OOOO....",
          "...OooWWo...",
          "..OoWeWeOo..",
          "..OoWWWWoO..",
          "...OooWWo...",
          "....Yyyy....",
          "..OOOOOOOO..",
          ".OOOOOOOOOO.",
          ".OOOOOOOOOO.",
          "..KK....KK..",
          "..kk....kk..",
        ],
      ],
      click: [
        [
          "....OOOO....",
          "...OooWWo...",
          "..OoWeWeOo..",
          "..OoWWWWoO..",
          "...OooWWo...",
          "....OOOO....",
          "..OOOOOOOO..",
          ".OOOOOOOOOO.",
          ".OOOOOOOOOO.",
          "..KK....KK..",
          "..kk....kk..",
          "...PP..PP...",
        ],
      ],
      typing: [
        [
          "....OOOO....",
          "...OooWWo...",
          "..OoWeWeOo..",
          "..OoWWWWoO..",
          "...OooWWo...",
          "....OOOO....",
          "..OOOOOOOO..",
          ".OOOOOOOOOO.",
          ".OOOOOOOOOO.",
          "..KK....KK..",
          "..kk....kk..",
          "..KK....KK..",
        ],
        [
          "....OOOO....",
          "...OooWWo...",
          "..OoWeWeOo..",
          "..OoWWWWoO..",
          "...OooWWo...",
          "....OOOO....",
          "..OOOOOOOO..",
          ".OOOOOOOOOO.",
          ".OOOOOOOOOO.",
          "KK......KK..",
          "kk......kk..",
          "..KK....KK..",
        ],
      ],
      drag: [
        [
          "....OOOO....",
          "...OooWWo...",
          "..OoWeWeOo..",
          "..OoWWWWoO..",
          "...OooWWo...",
          "....OOOO....",
          "..OOOOOOOO..",
          ".OOOOOOOOOO.",
          ".OOOOOOOOOO.",
          "..KK....KK..",
          "..kk....kk..",
        ],
      ],
      sad: [
        [
          "....OOOO....",
          "...OooWWo...",
          "..OoWeWeOo..",
          "..OoWWWWoO..",
          "...OooWWo...",
          "....OOOO....",
          "..OOOOOOOO..",
          ".OOOOOOOOOO.",
          ".OOOOOOOOOO.",
          "..KK....KK..",
          "..kk....kk..",
          "...BB..BB...",
        ],
      ],
      angry: [
        [
          "....OOOO....",
          "...OooWWo...",
          "..OoWeWeOo..",
          "..OoWWWWoO..",
          "...OooWWo...",
          "....RRRR....",
          "..OOOOOOOO..",
          ".OOOOOOOOOO.",
          ".OOOOOOOOOO.",
          "..KK....KK..",
          "..kk....kk..",
        ],
      ],
      special: [
        [
          "....LLLL....",
          "...LllWWl...",
          "..LlLeWeLl..",
          "..LlLWWWWl..",
          "...LllWWl...",
          "....LLLL....",
          "..LLLLLLLL..",
          ".LLLLLLLLLL.",
          ".LLLLLLLLLL.",
          "..KK....KK..",
          "..kk....kk..",
          "....YYYY....",
        ],
      ],
    };
  }

  function dogSprites() {
    return JSON.parse(JSON.stringify(catSprites()));
  }

  function blobSprites() {
    const base = catSprites();
    return {
      idle: [
        [
          "....LLLL....",
          "...Llllll...",
          "..Llllllll..",
          "..Llllllll..",
          "..Llllllll..",
          "...Llllll...",
          "....LLLL....",
        ],
        [
          "....LLLL....",
          "...Llllll...",
          "..Llllllll..",
          "..Llllllll..",
          "..Llllllll..",
          "...Llllll...",
          "....LLLL....",
          "....LLLL....",
        ],
      ],
      walk: base.walk,
      sleep: base.sleep,
      happy: base.happy,
      eat: base.eat,
      click: base.click,
      typing: base.typing,
      drag: base.drag,
      sad: base.sad,
      angry: base.angry,
      special: base.special,
    };
  }

  function getPixelPack(skin) {
    const sprites = skin === "dog" ? dogSprites() : skin === "blob" ? blobSprites() : catSprites();
    const palette = skin === "dog" ? DOG_PALETTE : skin === "blob" ? BLOB_PALETTE : PIXEL_PALETTE;
    return { sprites, palette, skin: skin || "cat" };
  }

  class PixelPetRenderer {
    constructor(canvas, skin = "cat") {
      this.canvas = canvas;
      this.ctx = canvas.getContext("2d", { alpha: true });
      this.ctx.imageSmoothingEnabled = false;
      this.pixelSize = 6;
      this.pack = getPixelPack(skin);
      this.frame = 0;
      this.facing = 1;
    }

    setSkin(skin) {
      this.pack = getPixelPack(skin);
    }

    setFacing(dir) {
      this.facing = dir >= 0 ? 1 : -1;
    }

    drawFrame(state, animFrame) {
      const sprites = this.pack.sprites[state] || this.pack.sprites.idle;
      const frame = sprites[animFrame % sprites.length];
      const palette = this.pack.palette;
      const ps = this.pixelSize;
      const w = frame[0].length * ps;
      const h = frame.length * ps;
      this.canvas.width = w;
      this.canvas.height = h;
      this.ctx.clearRect(0, 0, w, h);
      this.ctx.save();
      if (this.facing < 0) {
        this.ctx.translate(w, 0);
        this.ctx.scale(-1, 1);
      }
      for (let y = 0; y < frame.length; y++) {
        const row = frame[y];
        for (let x = 0; x < row.length; x++) {
          const col = palette[row[x]];
          if (col) {
            this.ctx.fillStyle = col;
            this.ctx.fillRect(x * ps, y * ps, ps, ps);
          }
        }
      }
      this.ctx.restore();
      return { w, h };
    }

    tick(state) {
      const sprites = this.pack.sprites[state] || this.pack.sprites.idle;
      this.frame = (this.frame + 1) % sprites.length;
      return this.drawFrame(state, this.frame);
    }
  }

  window.PixelPetRenderer = PixelPetRenderer;
  window.getPixelPack = getPixelPack;
})();
