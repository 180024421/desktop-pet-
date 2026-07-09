import fs from "fs";
import path from "path";
import { spawnSync } from "child_process";
import { SpriteSheetConfig } from "./types";
import { fileUrlForRenderer } from "./protocol";
import { getImagesDir } from "./profiles";
export interface SpriteSheetJson {
  frameWidth: number;
  frameHeight: number;
  states: SpriteSheetConfig["states"];
}

export function parseSpriteSheetJson(jsonPath: string): SpriteSheetJson {
  const raw = JSON.parse(fs.readFileSync(jsonPath, "utf8")) as SpriteSheetJson;
  return {
    frameWidth: raw.frameWidth || 32,
    frameHeight: raw.frameHeight || 32,
    states: raw.states || {},
  };
}

export function buildSpriteSheetConfig(
  imagePath: string,
  json: SpriteSheetJson
): SpriteSheetConfig {
  return {
    imagePath,
    frameWidth: json.frameWidth,
    frameHeight: json.frameHeight,
    states: json.states,
  };
}

export function serializeSpriteSheet(config: SpriteSheetConfig | null) {
  if (!config?.imagePath) return null;
  return {
    ...config,
    imageUrl: fileUrlForRenderer(config.imagePath),
    url: fileUrlForRenderer(config.imagePath),
  };
}

export function runRembg(inputPath: string, outputPath: string): boolean {
  fs.mkdirSync(path.dirname(outputPath), { recursive: true });
  const py2 = spawnSync("python", ["-m", "rembg", "i", inputPath, outputPath], {
    timeout: 120000,
    windowsHide: true,
  });
  if (py2.status === 0 && fs.existsSync(outputPath)) return true;

  const py = spawnSync(
    "python",
    [
      "-c",
      "from rembg import remove; import sys; open(sys.argv[2],'wb').write(remove(open(sys.argv[1],'rb').read()))",
      inputPath,
      outputPath,
    ],
    { encoding: "utf8", timeout: 120000, windowsHide: true }
  );
  return py.status === 0 && fs.existsSync(outputPath);
}

export function importSpriteSheetFiles(
  imagePath: string,
  jsonPath: string,
  profileId?: string
): SpriteSheetConfig {
  const imagesDir = getImagesDir(profileId);
  const baseName = `sheet-${Date.now().toString(36)}.png`;
  const destAbs = path.join(imagesDir, baseName);
  fs.copyFileSync(imagePath, destAbs);
  const json = parseSpriteSheetJson(jsonPath);
  const rel = path.join("images", baseName).replace(/\\/g, "/");
  return buildSpriteSheetConfig(rel, json);
}