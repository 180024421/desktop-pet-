import fs from "fs";
import path from "path";
import sharp from "sharp";
import { GIFEncoder, quantize, applyPalette } from "gifenc";
import { PetConfig } from "./types";
import { primaryIdleFrames } from "./types";
import { exportsDir } from "./export-stickers";

export interface RgbaFrame {
  width: number;
  height: number;
  rgba: number[];
}

export function encodeTransparentGif(frames: RgbaFrame[], delayMs: number): Buffer {
  if (!frames.length) throw new Error("无帧数据");
  const enc = GIFEncoder();
  for (const frame of frames) {
    const rgba = new Uint8Array(frame.rgba);
    const palette = quantize(rgba, 256);
    const index = applyPalette(rgba, palette);
    let transparentIndex = 0;
    for (let i = 0; i < rgba.length; i += 4) {
      if (rgba[i + 3] < 16) {
        transparentIndex = index[i / 4];
        break;
      }
    }
    enc.writeFrame(index, frame.width, frame.height, {
      palette,
      delay: delayMs,
      transparent: true,
      transparentIndex,
      repeat: 0,
    });
  }
  enc.finish();
  return Buffer.from(enc.bytes());
}

async function loadRgba(filePath: string, size = 240): Promise<RgbaFrame | null> {
  if (!fs.existsSync(filePath)) return null;
  const { data, info } = await sharp(filePath)
    .resize(size, size, { fit: "inside", background: { r: 0, g: 0, b: 0, alpha: 0 } })
    .ensureAlpha()
    .raw()
    .toBuffer({ resolveWithObject: true });
  return { width: info.width, height: info.height, rgba: Array.from(data) };
}

function loopSlice(paths: string[], start: number, end: number): string[] {
  if (!paths.length) return [];
  const s = Math.max(0, start);
  const e = end < 0 ? paths.length - 1 : Math.min(end, paths.length - 1);
  if (e < s) return paths;
  return paths.slice(s, e + 1);
}

export async function exportPetGif(config: PetConfig, destPath?: string): Promise<string> {
  const dir = exportsDir();
  fs.mkdirSync(dir, { recursive: true });
  const out = destPath || path.join(dir, `${config.petName || "pet"}-anim.gif`);

  let paths = primaryIdleFrames(config.frames);
  if (config.animationMode === "flipbook" && paths.length > 1) {
    paths = loopSlice(paths, config.flipbookLoopStart ?? 0, config.flipbookLoopEnd ?? -1);
  }
  if (paths.length <= 1) {
    for (const list of Object.values(config.frames)) {
      if (list.length > 1) {
        paths = list;
        break;
      }
    }
  }

  const frames: RgbaFrame[] = [];
  for (const p of paths) {
    const f = await loadRgba(p);
    if (f) frames.push(f);
  }
  if (!frames.length) throw new Error("没有可导出的帧");

  const buf = encodeTransparentGif(frames, config.frameIntervalMs || 180);
  fs.writeFileSync(out, buf);
  return out;
}

export async function exportPetWebp(config: PetConfig, destPath?: string): Promise<string> {
  const dir = exportsDir();
  fs.mkdirSync(dir, { recursive: true });
  const out = destPath || path.join(dir, `${config.petName || "pet"}-anim.webp`);

  let paths = primaryIdleFrames(config.frames);
  if (config.animationMode === "flipbook") {
    paths = loopSlice(paths, config.flipbookLoopStart ?? 0, config.flipbookLoopEnd ?? -1);
  }
  const existing = paths.filter((p) => fs.existsSync(p));
  if (!existing.length) throw new Error("没有可导出的帧");

  const delay = Math.max(40, config.frameIntervalMs || 180);
  if (existing.length === 1) {
    await sharp(existing[0]).resize(240, 240, { fit: "inside" }).webp().toFile(out);
    return out;
  }

  const resized = await Promise.all(
    existing.map((p) => sharp(p).resize(240, 240, { fit: "inside", background: { r: 0, g: 0, b: 0, alpha: 0 } }).png().toBuffer())
  );
  await sharp(resized[0], { animated: true })
    .webp({ loop: 0, delay: resized.map(() => delay) })
    .toFile(out)
    .catch(async () => {
      const mid = existing[Math.floor(existing.length / 2)];
      await sharp(mid).resize(240, 240, { fit: "inside" }).webp().toFile(out);
    });
  return out;
}
