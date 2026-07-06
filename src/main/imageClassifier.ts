import path from "path";
import { PetState, StateFrames } from "./types";

const RULES: Array<{ state: PetState; keywords: string[] }> = [
  { state: "idle", keywords: ["idle", "stand", "normal", "default", "待机", "默认", "站立", "常态"] },
  { state: "click", keywords: ["click", "tap", "poke", "点击", "戳", "点"] },
  { state: "walk", keywords: ["walk", "move", "run", "走", "跑", "移动", "行走"] },
  { state: "drag", keywords: ["drag", "hold", "grab", "拖", "抓", "拎"] },
  { state: "sleep", keywords: ["sleep", "rest", "nap", "睡", "休息", "困"] },
  { state: "happy", keywords: ["happy", "joy", "smile", "开心", "高兴", "笑"] },
  { state: "sad", keywords: ["sad", "cry", "难过", "哭", "伤心"] },
  { state: "eat", keywords: ["eat", "feed", "food", "吃", "喂", "食"] },
  { state: "angry", keywords: ["angry", "mad", "生气", "怒"] },
  { state: "special", keywords: ["special", "secret", "rare", "隐藏", "稀有", "解锁"] },
];

export interface ClassifiedUpload {
  filePath: string;
  fileName: string;
  suggestedState: PetState;
  confidence: "high" | "low";
}

function scoreName(fileName: string, keywords: string[]): number {
  const base = path.parse(fileName).name.toLowerCase();
  let score = 0;
  for (const kw of keywords) {
    if (base.includes(kw.toLowerCase())) score += kw.length;
  }
  return score;
}

export function classifyFileName(fileName: string): { state: PetState; confidence: "high" | "low" } {
  let best: PetState = "idle";
  let bestScore = 0;
  for (const rule of RULES) {
    const s = scoreName(fileName, rule.keywords);
    if (s > bestScore) {
      bestScore = s;
      best = rule.state;
    }
  }
  return { state: best, confidence: bestScore > 0 ? "high" : "low" };
}

export function classifyUploads(filePaths: string[]): ClassifiedUpload[] {
  return filePaths.map((filePath) => {
    const fileName = path.basename(filePath);
    const { state, confidence } = classifyFileName(fileName);
    return { filePath, fileName, suggestedState: state, confidence };
  });
}

export function buildFlipbookFrames(paths: string[]): StateFrames {
  return {
    idle: [...paths],
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
}

export function mergeExistingToFlipbook(frames: StateFrames): string[] {
  const order: PetState[] = [
    "idle",
    "walk",
    "click",
    "happy",
    "drag",
    "eat",
    "sleep",
    "sad",
    "angry",
  ];
  const seen = new Set<string>();
  const merged: string[] = [];
  for (const state of order) {
    for (const p of frames[state]) {
      if (!seen.has(p)) {
        seen.add(p);
        merged.push(p);
      }
    }
  }
  return merged;
}

export function buildFramesFromAssignments(
  assignments: Array<{ destPath: string; state: PetState }>
): StateFrames {
  const frames: StateFrames = {
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
  for (const item of assignments) {
    frames[item.state].push(item.destPath);
  }
  if (!frames.idle.length) {
    const first = assignments[0]?.destPath;
    if (first) frames.idle.push(first);
  }
  return frames;
}

export function describeAutoResult(frames: StateFrames): string {
  const idleCount = frames.idle.length;
  const otherCount = Object.entries(frames)
    .filter(([state]) => state !== "idle")
    .reduce((n, [, list]) => n + list.length, 0);
  if (idleCount >= 2 && otherCount === 0) {
    return `连续帧×${idleCount}`;
  }
  const parts: string[] = [];
  const labels: Record<PetState, string> = {
    idle: "待机",
    click: "点击",
    walk: "行走",
    drag: "拖拽",
    sleep: "睡觉",
    happy: "开心",
    sad: "难过",
    eat: "进食",
    angry: "生气",
    special: "特殊",
  };
  for (const [state, label] of Object.entries(labels) as [PetState, string][]) {
    const n = frames[state].length;
    if (n) parts.push(`${label}×${n}`);
  }
  return parts.length ? parts.join(" · ") : "未识别到图片";
}

export const STATE_LABELS: Record<PetState, string> = {
  idle: "待机",
  click: "点击",
  walk: "行走",
  drag: "拖拽",
  sleep: "睡觉",
  happy: "开心",
  sad: "难过",
  eat: "进食",
  angry: "生气",
  special: "特殊",
};

export const ALL_STATES: PetState[] = [
  "idle",
  "click",
  "walk",
  "drag",
  "sleep",
  "happy",
  "sad",
  "eat",
  "angry",
  "special",
];
