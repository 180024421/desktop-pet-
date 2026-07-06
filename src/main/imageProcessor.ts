import { spawnSync } from "child_process";
import fs from "fs";
import path from "path";
import { ChromakeyOptions, ImageImportOptions } from "./types";

let sharpModule: typeof import("sharp") | null = null;

function getSharp(): typeof import("sharp") | null {
  if (sharpModule !== null) return sharpModule;
  try {
    // eslint-disable-next-line @typescript-eslint/no-require-imports
    sharpModule = require("sharp");
    return sharpModule;
  } catch {
    sharpModule = null;
    return null;
  }
}

function parseHexColor(hex: string): { r: number; g: number; b: number } {
  const raw = hex.replace("#", "");
  if (raw.length === 3) {
    return {
      r: parseInt(raw[0] + raw[0], 16),
      g: parseInt(raw[1] + raw[1], 16),
      b: parseInt(raw[2] + raw[2], 16),
    };
  }
  return {
    r: parseInt(raw.slice(0, 2), 16),
    g: parseInt(raw.slice(2, 4), 16),
    b: parseInt(raw.slice(4, 6), 16),
  };
}

async function applyChromakey(
  inputPath: string,
  outputPath: string,
  options: ChromakeyOptions
): Promise<void> {
  const sharp = getSharp();
  if (!sharp) {
    fs.copyFileSync(inputPath, outputPath);
    return;
  }
  const { r, g, b } = parseHexColor(options.color);
  const tol = Math.max(0, Math.min(120, options.tolerance));
  const img = sharp(inputPath).ensureAlpha();
  const { data, info } = await img.raw().toBuffer({ resolveWithObject: true });
  for (let i = 0; i < data.length; i += 4) {
    const dr = data[i] - r;
    const dg = data[i + 1] - g;
    const db = data[i + 2] - b;
    const dist = Math.sqrt(dr * dr + dg * dg + db * db);
    if (dist <= tol) {
      data[i + 3] = 0;
    }
  }
  await sharp(data, { raw: { width: info.width, height: info.height, channels: 4 } })
    .png()
    .toFile(outputPath);
}

async function trimTransparent(inputPath: string, outputPath: string): Promise<void> {
  const sharp = getSharp();
  if (!sharp) {
    fs.copyFileSync(inputPath, outputPath);
    return;
  }
  await sharp(inputPath).trim().png().toFile(outputPath);
}

export async function processImageFile(
  sourcePath: string,
  destPath: string,
  options: ImageImportOptions
): Promise<string> {
  let working = sourcePath;
  const tempFiles: string[] = [];

  try {
    if (
      options.chromakey &&
      [".png", ".jpg", ".jpeg", ".webp"].includes(path.extname(sourcePath).toLowerCase())
    ) {
      const chromaOut = `${destPath}.chroma.png`;
      tempFiles.push(chromaOut);
      await applyChromakey(sourcePath, chromaOut, options.chromakey);
      working = chromaOut;
    }

    if (options.trimTransparent) {
      const trimOut = `${destPath}.trim.png`;
      tempFiles.push(trimOut);
      await trimTransparent(working, trimOut);
      working = trimOut;
    }

    if (path.resolve(working) !== path.resolve(destPath)) {
      fs.copyFileSync(working, destPath);
    }
    return destPath;
  } finally {
    for (const f of tempFiles) {
      if (fs.existsSync(f)) fs.unlinkSync(f);
    }
  }
}

export async function extractGifFrames(
  gifPath: string,
  outDir: string,
  maxFrames = 60
): Promise<string[]> {
  const sharp = getSharp();
  if (!sharp) throw new Error("需要 sharp 模块才能拆解 GIF，请运行 npm install");
  fs.mkdirSync(outDir, { recursive: true });
  const meta = await sharp(gifPath, { animated: true }).metadata();
  const pages = Math.min(meta.pages ?? 1, maxFrames);
  const outputs: string[] = [];
  for (let i = 0; i < pages; i += 1) {
    const out = path.join(outDir, `gif-${Date.now()}-${i}.png`);
    await sharp(gifPath, { animated: true, page: i }).png().toFile(out);
    outputs.push(out);
  }
  return outputs;
}

export function extractVideoFrames(
  videoPath: string,
  outDir: string,
  fps = 8,
  maxFrames = 60
): string[] {
  fs.mkdirSync(outDir, { recursive: true });
  const pattern = path.join(outDir, "vid-%04d.png");
  const result = spawnSync(
    "ffmpeg",
    ["-y", "-i", videoPath, "-vf", `fps=${fps}`, "-frames:v", String(maxFrames), pattern],
    { encoding: "utf-8" }
  );
  if (result.status !== 0) {
    const spawnErr = result.error as NodeJS.ErrnoException | undefined;
    throw new Error(
      spawnErr?.code === "ENOENT"
        ? "未找到 ffmpeg，请先安装并加入 PATH"
        : `ffmpeg 失败: ${result.stderr?.slice(0, 200) || spawnErr?.message}`
    );
  }
  return fs
    .readdirSync(outDir)
    .filter((n) => n.startsWith("vid-") && n.endsWith(".png"))
    .sort()
    .map((n) => path.join(outDir, n));
}

export function isGifFile(filePath: string): boolean {
  return path.extname(filePath).toLowerCase() === ".gif";
}

export function isVideoFile(filePath: string): boolean {
  return [".mp4", ".webm", ".mov", ".mkv"].includes(path.extname(filePath).toLowerCase());
}
