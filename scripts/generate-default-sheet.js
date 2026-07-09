/** 生成内置精灵图 PNG（像素猫条） */
const fs = require("fs");
const path = require("path");

async function main() {
  let sharp;
  try {
    sharp = require("sharp");
  } catch {
    console.warn("sharp 不可用，跳过 sprite-sheet.png 生成");
    return;
  }

  const outDir = path.join(__dirname, "..", "bundled", "sprite-cat", "images");
  fs.mkdirSync(outDir, { recursive: true });
  const out = path.join(outDir, "sprite-sheet.png");
  const fw = 48;
  const fh = 44;
  const frames = 10;
  const w = fw * frames;
  const h = fh;

  const pixels = Buffer.alloc(w * h * 4, 0);
  const colors = [
    [251, 146, 60, 255],
    [234, 88, 12, 255],
    [255, 247, 237, 255],
    [31, 41, 55, 255],
  ];

  for (let f = 0; f < frames; f++) {
    for (let y = 8; y < 36; y++) {
      for (let x = 8 + f * fw; x < 40 + f * fw; x++) {
        const i = (y * w + x) * 4;
        const c = colors[(x + y + f) % colors.length];
        pixels[i] = c[0];
        pixels[i + 1] = c[1];
        pixels[i + 2] = c[2];
        pixels[i + 3] = c[3];
      }
    }
  }

  await sharp(pixels, { raw: { width: w, height: h, channels: 4 } }).png().toFile(out);
  console.log("Wrote", out);
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
