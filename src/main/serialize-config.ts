import { PetConfig } from "./types";
import { fileUrlForRenderer } from "./protocol";
import { serializeSpriteSheet } from "./sprite-sheet";

export function serializePetConfig(config: PetConfig) {
  const mapFrames = (paths: string[]) =>
    paths.map((p) => ({ path: p, url: fileUrlForRenderer(p) }));
  const sheet = serializeSpriteSheet(config.spriteSheet);
  return {
    ...config,
    spriteSheet: sheet,
    frames: {
      idle: mapFrames(config.frames.idle),
      click: mapFrames(config.frames.click),
      walk: mapFrames(config.frames.walk),
      drag: mapFrames(config.frames.drag),
      sleep: mapFrames(config.frames.sleep),
      happy: mapFrames(config.frames.happy),
      sad: mapFrames(config.frames.sad),
      eat: mapFrames(config.frames.eat),
      angry: mapFrames(config.frames.angry),
      special: mapFrames(config.frames.special || []),
    },
  };
}
