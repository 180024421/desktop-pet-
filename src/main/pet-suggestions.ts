import { FRAME_CHECKLIST, PetConfig, PetState, StateFrames } from "./types";
import { classifyFileName } from "./imageClassifier";

export interface FrameGap {
  state: PetState;
  label: string;
  missing: boolean;
}

export function analyzeFrameGaps(frames: StateFrames): FrameGap[] {
  return FRAME_CHECKLIST.map(({ state, label }) => ({
    state,
    label,
    missing: !frames[state]?.length,
  }));
}

export function suggestFilename(fileName: string): {
  state: PetState;
  confidence: string;
  tip: string;
} {
  const { state, confidence } = classifyFileName(fileName);
  const tips: Record<string, string> = {
    idle: "适合作为待机默认帧",
    click: "点击宠物时播放",
    walk: "漫游/跟随时使用",
    sleep: "长时间无互动时睡觉",
    happy: "双击或陪玩时开心",
    eat: "喂食动作",
    special: "好感 80+ 解锁隐藏动作",
  };
  return {
    state,
    confidence: confidence === "high" ? "高" : "低",
    tip: tips[state] || "可手动调整分类",
  };
}

export function generatePhraseSuggestions(petName: string): Partial<Record<string, string[]>> {
  const n = petName || "小宠物";
  return {
    idle: [`${n}在这里哦~`, "陪我玩嘛", "无聊中…"],
    click: ["别戳啦！", "嘿嘿~", "摸头杀 ✨"],
    happy: ["最喜欢你啦！", "开心开心~"],
    feed: ["谢谢投喂！", "好吃好吃~"],
    sleep: ["Zzz…", "晚安主人~"],
    special: [`${n}的超稀有表情！`, "解锁隐藏台词~"],
  };
}

export function configSummary(config: PetConfig): string {
  const gaps = analyzeFrameGaps(config.frames).filter((g) => g.missing);
  if (!gaps.length) return "素材齐全，可以导出贴纸包啦";
  return `还缺：${gaps.map((g) => g.label).join("、")}`;
}
