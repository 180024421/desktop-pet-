export type PetState =
  | "idle"
  | "click"
  | "walk"
  | "drag"
  | "sleep"
  | "happy"
  | "sad"
  | "eat"
  | "angry";

export interface StateFrames {
  idle: string[];
  click: string[];
  walk: string[];
  drag: string[];
  sleep: string[];
  happy: string[];
  sad: string[];
  eat: string[];
  angry: string[];
}

export interface PetConfig {
  version: 1;
  petName: string;
  scale: number;
  alwaysOnTop: boolean;
  clickThrough: boolean;
  followMouse: boolean;
  wander: boolean;
  speechEnabled: boolean;
  autoStart: boolean;
  idleSleepSeconds: number;
  frameIntervalMs: number;
  position: { x: number; y: number } | null;
  frames: StateFrames;
  /** 单图时启用的 CSS 动效 */
  cssEffect: "breathe" | "bounce" | "wiggle" | "none";
  /** flipbook=多图连续帧循环；states=按动作分类 */
  animationMode: "flipbook" | "states";
}

export const DEFAULT_FRAMES: StateFrames = {
  idle: [],
  click: [],
  walk: [],
  drag: [],
  sleep: [],
  happy: [],
  sad: [],
  eat: [],
  angry: [],
};

export const DEFAULT_CONFIG: PetConfig = {
  version: 1,
  petName: "小宠物",
  scale: 1,
  alwaysOnTop: true,
  clickThrough: false,
  followMouse: false,
  wander: true,
  speechEnabled: true,
  autoStart: false,
  idleSleepSeconds: 120,
  frameIntervalMs: 180,
  position: null,
  frames: { ...DEFAULT_FRAMES },
  cssEffect: "breathe",
  animationMode: "flipbook",
};

export function cloneConfig(config: PetConfig): PetConfig {
  return JSON.parse(JSON.stringify(config)) as PetConfig;
}

export function hasAnyFrame(frames: StateFrames): boolean {
  return Object.values(frames).some((list) => list.length > 0);
}

export function primaryIdleFrames(frames: StateFrames): string[] {
  if (frames.idle.length) return frames.idle;
  for (const list of Object.values(frames)) {
    if (list.length) return list;
  }
  return [];
}
