export type PetState =
  | "idle"
  | "click"
  | "walk"
  | "drag"
  | "sleep"
  | "happy"
  | "sad"
  | "eat"
  | "angry"
  | "special";

export type PhraseCategory =
  | "click"
  | "happy"
  | "feed"
  | "play"
  | "sleep"
  | "wake"
  | "pet"
  | "wander"
  | "sad"
  | "idle"
  | "angry"
  | "special"
  | "schedule";

export type DisplayMode = "full" | "pet-only" | "widget";

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
  special: string[];
}

export interface ChromakeyOptions {
  color: string;
  tolerance: number;
}

export interface ImageImportOptions {
  trimTransparent?: boolean;
  chromakey?: ChromakeyOptions | null;
}

export interface DailyStats {
  date: string;
  interactCount: number;
}

export type BubbleStyle = "round" | "pixel" | "comic";

export interface LifetimeStats {
  totalInteracts: number;
  daysActive: number;
  firstRunDate: string;
  actionCounts: Record<string, number>;
}

export interface WeeklyStatEntry {
  date: string;
  interactCount: number;
}

export interface PetConfig {
  version: 1;
  profileId: string;
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
  positionsByDisplay: Record<string, { x: number; y: number }>;
  frames: StateFrames;
  cssEffect: "breathe" | "bounce" | "wiggle" | "none" | "glow" | "sparkle";
  animationMode: "flipbook" | "states";
  affection: number;
  unlockedTiers: number[];
  customPhrases: Partial<Record<PhraseCategory, string[]>>;
  wanderIntervalMs: number;
  wanderDistance: number;
  followSpeed: number;
  snapDistance: number;
  edgeMargin: number;
  importOptions: ImageImportOptions;
  ambientShowcase: boolean;
  ambientIntervalMs: number;
  syncBubbleWithState: boolean;
  syncWallpaperWithState: boolean;
  scheduleBubbles: boolean;
  activityLink: boolean;
  weatherEnabled: boolean;
  weatherCity: string;
  displayMode: DisplayMode;
  pomodoroMinutes: number;
  multiPetProfileIds: string[];
  flipbookLoopStart: number;
  flipbookLoopEnd: number;
  clickOnceRevert: boolean;
  frameCacheMax: number;
  dailyStats: DailyStats;
  officeBridgeEnabled: boolean;
  officeBridgeWriteEnabled: boolean;
  bubbleStyle: BubbleStyle;
  soundEnabled: boolean;
  soundVolume: number;
  randomEventsEnabled: boolean;
  throwInteractionEnabled: boolean;
  petInteractEnabled: boolean;
  sceneAutoHide: boolean;
  sceneAutoShrink: boolean;
  remindersEnabled: boolean;
  reminderIntervalMin: number;
  reminderMessages: string[];
  lmStudioEnabled: boolean;
  lmStudioBaseUrl: string;
  lmStudioIntervalMin: number;
  lifetimeStats: LifetimeStats;
  weeklyStats: WeeklyStatEntry[];
  pluginsEnabled: boolean;
  autoUpdateCheck: boolean;
}

export interface ProfileInfo {
  id: string;
  name: string;
}

export interface ProfilesIndex {
  activeId: string;
  profiles: ProfileInfo[];
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
  special: [],
};

export const DEFAULT_CUSTOM_PHRASES: Partial<Record<PhraseCategory, string[]>> = {};

export const DEFAULT_CONFIG: PetConfig = {
  version: 1,
  profileId: "default",
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
  positionsByDisplay: {},
  frames: { ...DEFAULT_FRAMES },
  cssEffect: "breathe",
  animationMode: "flipbook",
  affection: 50,
  unlockedTiers: [],
  customPhrases: { ...DEFAULT_CUSTOM_PHRASES },
  wanderIntervalMs: 4500,
  wanderDistance: 120,
  followSpeed: 12,
  snapDistance: 48,
  edgeMargin: 12,
  importOptions: { trimTransparent: false, chromakey: null },
  ambientShowcase: true,
  ambientIntervalMs: 35000,
  syncBubbleWithState: true,
  syncWallpaperWithState: false,
  scheduleBubbles: true,
  activityLink: true,
  weatherEnabled: false,
  weatherCity: "Beijing",
  displayMode: "full",
  pomodoroMinutes: 25,
  multiPetProfileIds: [],
  flipbookLoopStart: 0,
  flipbookLoopEnd: -1,
  clickOnceRevert: true,
  frameCacheMax: 120,
  dailyStats: { date: "", interactCount: 0 },
  officeBridgeEnabled: false,
  officeBridgeWriteEnabled: true,
  bubbleStyle: "round",
  soundEnabled: true,
  soundVolume: 0.35,
  randomEventsEnabled: true,
  throwInteractionEnabled: true,
  petInteractEnabled: true,
  sceneAutoHide: false,
  sceneAutoShrink: true,
  remindersEnabled: false,
  reminderIntervalMin: 45,
  reminderMessages: ["记得喝水~", "起来活动一下", "眼睛休息 20 秒"],
  lmStudioEnabled: false,
  lmStudioBaseUrl: "http://127.0.0.1:1234",
  lmStudioIntervalMin: 60,
  lifetimeStats: {
    totalInteracts: 0,
    daysActive: 0,
    firstRunDate: "",
    actionCounts: {},
  },
  weeklyStats: [],
  pluginsEnabled: true,
  autoUpdateCheck: true,
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

export const AFFECTION_TIERS = [
  { level: 20, effect: "bounce" as const, phraseKey: "happy" as const },
  { level: 50, effect: "glow" as const, phraseKey: "pet" as const },
  { level: 80, effect: "sparkle" as const, phraseKey: "special" as const },
];

export const FRAME_CHECKLIST: Array<{ state: PetState; label: string }> = [
  { state: "idle", label: "待机" },
  { state: "click", label: "点击" },
  { state: "walk", label: "行走" },
  { state: "sleep", label: "睡觉" },
  { state: "happy", label: "开心" },
  { state: "eat", label: "进食" },
  { state: "special", label: "隐藏/特殊" },
];
