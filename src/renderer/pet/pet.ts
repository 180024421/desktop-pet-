type PetState =
  | "idle"
  | "click"
  | "walk"
  | "drag"
  | "sleep"
  | "happy"
  | "sad"
  | "eat"
  | "angry";

interface FrameItem {
  path: string;
  url: string;
}

interface PetConfigView {
  petName: string;
  scale: number;
  followMouse: boolean;
  wander: boolean;
  speechEnabled: boolean;
  idleSleepSeconds: number;
  frameIntervalMs: number;
  cssEffect: "breathe" | "bounce" | "wiggle" | "none";
  frames: Record<PetState, FrameItem[]>;
}

declare const petApi: {
  onInit: (cb: (config: PetConfigView) => void) => void;
  onSettings: (cb: (data: Partial<PetConfigView>) => void) => void;
  onAction: (cb: (data: { type: string }) => void) => void;
  onCursorNear: (cb: (data: { near: boolean }) => void) => void;
  savePosition: (pos: { x: number; y: number }) => void;
  saveScale: (scale: number) => void;
  getWorkArea: () => Promise<{ x: number; y: number; width: number; height: number }>;
};

const img = document.getElementById("pet-img") as HTMLImageElement;
const bubble = document.getElementById("bubble") as HTMLDivElement;
const affectionWrap = document.getElementById("affection") as HTMLDivElement;
const affectionBar = document.getElementById("affection-bar") as HTMLDivElement;
const hint = document.getElementById("hint") as HTMLDivElement;

let config: PetConfigView | null = null;
let currentState: PetState = "idle";
let frameIndex = 0;
let frameTimer: ReturnType<typeof setInterval> | null = null;
let stateTimer: ReturnType<typeof setTimeout> | null = null;
let wanderTimer: ReturnType<typeof setInterval> | null = null;
let followTimer: ReturnType<typeof setInterval> | null = null;
let idleTimer: ReturnType<typeof setTimeout> | null = null;
let bubbleTimer: ReturnType<typeof setTimeout> | null = null;
let affection = 50;
let isDragging = false;
let dragOffset = { x: 0, y: 0 };
let windowPos = { x: 0, y: 0 };
let scale = 1;
let sleeping = false;
let lastInteract = Date.now();

const PHRASES: Record<string, string[]> = {
  click: ["嘿嘿~", "别戳啦！", "摸头杀 ✨", "你在干嘛呀", "好痒！"],
  happy: ["开心！", "今天也要加油鸭", "最喜欢你啦", "耶耶耶~"],
  feed: ["好吃好吃！", "谢谢投喂~", "还想再吃一口", "饱饱的 ♡"],
  play: ["再来再来！", "玩累了...", "好开心呀", "接球！"],
  sleep: ["Zzz...", "晚安...", "做个好梦", "呼呼..."],
  wake: ["早呀！", "睡饱了~", "精神满满！", "起床啦"],
  pet: ["舒服~", "蹭蹭", "主人最好了", "呼噜呼噜"],
  wander: ["溜达溜达~", "这边看看", "那边有什么", "散步时间"],
  sad: ["委屈...", "不要嘛", "哼！"],
  idle: ["我在这里哦", "今天天气不错", "陪我玩嘛", "无聊中..."],
};

function framesFor(state: PetState): FrameItem[] {
  if (!config) return [];
  const list = config.frames[state];
  if (list?.length) return list;
  if (config.frames.idle.length) return config.frames.idle;
  for (const key of Object.keys(config.frames) as PetState[]) {
    if (config.frames[key].length) return config.frames[key];
  }
  return [];
}

function setImage(state: PetState, index = 0): void {
  const list = framesFor(state);
  if (!list.length) return;
  const item = list[index % list.length];
  img.src = item.url;
}

function clearTimers(): void {
  if (frameTimer) clearInterval(frameTimer);
  if (stateTimer) clearTimeout(stateTimer);
  frameTimer = null;
  stateTimer = null;
}

function applyCssEffect(): void {
  img.classList.remove("effect-breathe", "effect-bounce", "effect-wiggle");
  if (!config || sleeping || currentState !== "idle") return;
  const totalFrames = framesFor("idle").length;
  if (totalFrames > 1) return;
  const effect = config.cssEffect;
  if (effect && effect !== "none") img.classList.add(`effect-${effect}`);
}

function playState(state: PetState, durationMs = 1200, revert = true): void {
  clearTimers();
  currentState = state;
  frameIndex = 0;
  const list = framesFor(state);
  setImage(state, 0);
  applyCssEffect();

  if (list.length > 1) {
    const interval = config?.frameIntervalMs ?? 350;
    frameTimer = setInterval(() => {
      frameIndex = (frameIndex + 1) % list.length;
      setImage(state, frameIndex);
    }, interval);
  }

  if (revert) {
    stateTimer = setTimeout(() => {
      if (state === "sleep") return;
      playState("idle", 0, false);
    }, durationMs);
  }
}

function showBubble(category: string): void {
  if (!config?.speechEnabled) return;
  const pool = PHRASES[category] ?? PHRASES.idle;
  bubble.textContent = pool[Math.floor(Math.random() * pool.length)];
  bubble.classList.remove("hidden");
  if (bubbleTimer) clearTimeout(bubbleTimer);
  bubbleTimer = setTimeout(() => bubble.classList.add("hidden"), 2800);
}

function bumpAffection(delta: number): void {
  affection = Math.max(0, Math.min(100, affection + delta));
  affectionBar.style.width = `${affection}%`;
  affectionWrap.classList.remove("hidden");
  setTimeout(() => affectionWrap.classList.add("hidden"), 2000);
}

function resetIdleSleep(): void {
  lastInteract = Date.now();
  if (idleTimer) clearTimeout(idleTimer);
  if (!config) return;
  const ms = (config.idleSleepSeconds || 120) * 1000;
  idleTimer = setTimeout(() => {
    if (Date.now() - lastInteract >= ms - 200) {
      sleeping = true;
      playState("sleep", 0, false);
      showBubble("sleep");
    }
  }, ms);
}

function flashAnim(cls: string): void {
  img.classList.remove(cls);
  void img.offsetWidth;
  img.classList.add(cls);
  setTimeout(() => img.classList.remove(cls), 500);
}

async function getWindowPos(): Promise<void> {
  const area = await petApi.getWorkArea();
  windowPos = { x: area.x, y: area.y };
}

function moveWindowTo(x: number, y: number): void {
  const w = window.outerWidth;
  const h = window.outerHeight;
  const area = { width: screen.availWidth, height: screen.availHeight };
  const nx = Math.max(0, Math.min(area.width - w, x));
  const ny = Math.max(0, Math.min(area.height - h, y));
  window.moveTo(nx, ny);
  petApi.savePosition({ x: nx, y: ny });
}

function setupDrag(): void {
  img.addEventListener("mousedown", (e) => {
    if (e.button !== 0) return;
    isDragging = true;
    img.classList.add("dragging");
    dragOffset = { x: e.screenX - window.screenX, y: e.screenY - window.screenY };
    playState("drag", 99999, false);
    resetIdleSleep();
  });

  window.addEventListener("mousemove", (e) => {
    if (!isDragging) return;
    moveWindowTo(e.screenX - dragOffset.x, e.screenY - dragOffset.y);
  });

  window.addEventListener("mouseup", () => {
    if (!isDragging) return;
    isDragging = false;
    img.classList.remove("dragging");
    playState("idle", 0, false);
    showBubble("click");
    bumpAffection(1);
    resetIdleSleep();
  });
}

function setupClicks(): void {
  let lastClick = 0;
  img.addEventListener("click", (e) => {
    if (isDragging) return;
    const now = Date.now();
    if (now - lastClick < 280) {
      playState("happy", 1500);
      showBubble("happy");
      flashAnim("jump");
      bumpAffection(5);
    } else {
      playState("click", 900);
      showBubble("click");
      flashAnim("shake");
      bumpAffection(2);
    }
    lastClick = now;
    sleeping = false;
    resetIdleSleep();
    e.stopPropagation();
  });

  img.addEventListener("mouseenter", () => {
    if (!sleeping) img.style.transform = `scale(${scale * 1.05})`;
    hint.classList.remove("hidden");
  });
  img.addEventListener("mouseleave", () => {
    img.style.transform = `scale(${scale})`;
    hint.classList.add("hidden");
  });

  img.addEventListener("wheel", (e) => {
    e.preventDefault();
    const delta = e.deltaY > 0 ? -0.08 : 0.08;
    scale = Math.max(0.5, Math.min(2.2, scale + delta));
    img.style.transform = `scale(${scale})`;
    petApi.saveScale(scale);
    resetIdleSleep();
  }, { passive: false });
}

function startWander(): void {
  if (wanderTimer) clearInterval(wanderTimer);
  wanderTimer = setInterval(() => {
    if (!config?.wander || isDragging || sleeping || config.followMouse) return;
    if (Math.random() > 0.35) return;
    playState("walk", 1800);
    showBubble("wander");
    const dx = (Math.random() - 0.5) * 120;
    const dy = (Math.random() - 0.5) * 80;
    moveWindowTo(window.screenX + dx, window.screenY + dy);
  }, 4500);
}

function startFollowMouse(): void {
  if (followTimer) clearInterval(followTimer);
  followTimer = null;
}

petApi.onCursorNear(({ near }) => {
  if (!config?.followMouse || isDragging || sleeping) return;
  if (near && currentState === "idle") playState("walk", 800);
});

function handleAction(type: string): void {
  sleeping = false;
  resetIdleSleep();
  switch (type) {
    case "feed":
      playState("eat", 2000);
      showBubble("feed");
      bumpAffection(8);
      flashAnim("jump");
      break;
    case "play":
      playState("happy", 2000);
      showBubble("play");
      bumpAffection(6);
      flashAnim("bounce" as never);
      break;
    case "sleep":
      sleeping = true;
      playState("sleep", 0, false);
      showBubble("sleep");
      break;
    case "wake":
      sleeping = false;
      playState("idle", 0, false);
      showBubble("wake");
      flashAnim("jump");
      break;
    case "pet":
      playState("happy", 1200);
      showBubble("pet");
      bumpAffection(4);
      break;
    default:
      break;
  }
}

function applyConfig(next: PetConfigView): void {
  config = next;
  scale = next.scale || 1;
  img.style.transform = `scale(${scale})`;
  img.alt = next.petName;
  sleeping = false;
  playState("idle", 0, false);
  resetIdleSleep();
  startWander();
  startFollowMouse();
}

petApi.onInit((data) => applyConfig(data));
petApi.onSettings((data) => {
  if (!config) return;
  config = { ...config, ...data };
  startWander();
  startFollowMouse();
});
petApi.onAction((data) => handleAction(data.type));

setupDrag();
setupClicks();
getWindowPos();

setTimeout(() => hint.classList.add("hidden"), 4000);

export {};
