(function () {
  const petApi = window.petApi;
  const img = document.getElementById("pet-img");
  const bubble = document.getElementById("bubble");
  const affectionWrap = document.getElementById("affection");
  const affectionBar = document.getElementById("affection-bar");
  const hint = document.getElementById("hint");

  let config = null;
  let currentState = "idle";
  let frameIndex = 0;
  let frameTimer = null;
  let stateTimer = null;
  let wanderTimer = null;
  let idleTimer = null;
  let bubbleTimer = null;
  let affection = 50;
  let isDragging = false;
  let dragOffset = { x: 0, y: 0 };
  let scale = 1;
  let sleeping = false;
  let lastInteract = Date.now();
  const imageCache = new Map();

  const PHRASES = {
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

  function isFlipbook() {
    return (config?.animationMode ?? "flipbook") === "flipbook";
  }

  function framesFor(state) {
    if (!config) return [];
    if (isFlipbook() && state !== "sleep") {
      const idle = config.frames.idle;
      if (idle?.length) return idle;
    }
    const list = config.frames[state];
    if (list?.length) return list;
    if (config.frames.idle?.length) return config.frames.idle;
    for (const key of Object.keys(config.frames)) {
      if (config.frames[key]?.length) return config.frames[key];
    }
    return [];
  }

  async function preloadFrames(state) {
    const list = framesFor(state);
    await Promise.all(list.map((item) => resolveImageUrl(item)));
  }

  function showFrameInstant(state, index) {
    const list = framesFor(state);
    if (!list.length || !img) return;
    const item = list[index % list.length];
    const url = item.url || imageCache.get(item.path);
    if (url) {
      img.src = url;
      return;
    }
    void setImage(state, index);
  }

  function startFrameLoop(state) {
    const list = framesFor(state);
    if (list.length <= 1) return;
    const interval = config?.frameIntervalMs ?? 180;
    if (frameTimer) clearInterval(frameTimer);
    frameTimer = setInterval(() => {
      frameIndex = (frameIndex + 1) % list.length;
      showFrameInstant(state, frameIndex);
    }, interval);
  }

  async function resolveImageUrl(item) {
    if (!item?.path) return "";
    if (item.url) return item.url;
    if (imageCache.has(item.path)) return imageCache.get(item.path);
    const url = await petApi.getImageUrl(item.path);
    if (url) {
      item.url = url;
      imageCache.set(item.path, url);
    }
    return url || "";
  }

  async function setImage(state, index = 0) {
    const list = framesFor(state);
    if (!list.length || !img) return;
    const item = list[index % list.length];
    const url = await resolveImageUrl(item);
    if (!url) {
      console.error("[pet] image url empty:", item.path);
      return;
    }
    img.onload = () => console.log("[pet] image loaded", item.path);
    img.onerror = () => console.error("[pet] image failed", item.path);
    img.src = url;
  }

  function clearTimers() {
    if (frameTimer) clearInterval(frameTimer);
    if (stateTimer) clearTimeout(stateTimer);
    frameTimer = null;
    stateTimer = null;
  }

  function applyCssEffect() {
    img.classList.remove("effect-breathe", "effect-bounce", "effect-wiggle");
    if (!config || sleeping || currentState !== "idle") return;
    const totalFrames = framesFor("idle").length;
    if (totalFrames > 1) return;
    const effect = config.cssEffect;
    if (effect && effect !== "none") img.classList.add(`effect-${effect}`);
  }

  function playState(state, durationMs = 1200, revert = true) {
    clearTimers();
    currentState = state;
    frameIndex = 0;

    void (async () => {
      await preloadFrames(state);
      showFrameInstant(state, 0);
      applyCssEffect();
      startFrameLoop(state);

      if (revert && state !== "sleep") {
        stateTimer = setTimeout(() => {
          if (state === "sleep") return;
          playState("idle", 0, false);
        }, durationMs);
      }
    })();
  }

  function showBubble(category) {
    if (!config?.speechEnabled) return;
    const pool = PHRASES[category] || PHRASES.idle;
    bubble.textContent = pool[Math.floor(Math.random() * pool.length)];
    bubble.classList.remove("hidden");
    if (bubbleTimer) clearTimeout(bubbleTimer);
    bubbleTimer = setTimeout(() => bubble.classList.add("hidden"), 2800);
  }

  function bumpAffection(delta) {
    affection = Math.max(0, Math.min(100, affection + delta));
    affectionBar.style.width = `${affection}%`;
    affectionWrap.classList.remove("hidden");
    setTimeout(() => affectionWrap.classList.add("hidden"), 2000);
  }

  function resetIdleSleep() {
    lastInteract = Date.now();
    if (idleTimer) clearTimeout(idleTimer);
    if (!config) return;
    idleTimer = setTimeout(() => {
      if (Date.now() - lastInteract >= config.idleSleepSeconds * 1000 - 200) {
        sleeping = true;
        playState("sleep", 0, false);
        showBubble("sleep");
      }
    }, config.idleSleepSeconds * 1000);
  }

  function flashAnim(cls) {
    img.classList.remove(cls);
    void img.offsetWidth;
    img.classList.add(cls);
    setTimeout(() => img.classList.remove(cls), 500);
  }

  function setupDrag() {
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
      window.moveTo(e.screenX - dragOffset.x, e.screenY - dragOffset.y);
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

  function setupClicks() {
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
    img.addEventListener("wheel", (e) => {
      e.preventDefault();
      scale = Math.max(0.5, Math.min(2.2, scale + (e.deltaY > 0 ? -0.08 : 0.08)));
      img.style.transform = `scale(${scale})`;
      petApi.saveScale(scale);
      resetIdleSleep();
    }, { passive: false });
  }

  function startWander() {
    if (wanderTimer) clearInterval(wanderTimer);
    wanderTimer = setInterval(() => {
      if (!config?.wander || isDragging || sleeping || config.followMouse) return;
      if (Math.random() > 0.35) return;
      playState("walk", 1800);
      showBubble("wander");
      window.moveTo(window.screenX + (Math.random() - 0.5) * 120, window.screenY + (Math.random() - 0.5) * 80);
    }, 4500);
  }

  function handleAction(type) {
    sleeping = false;
    resetIdleSleep();
    if (type === "feed") {
      playState("eat", 2000);
      showBubble("feed");
      bumpAffection(8);
      flashAnim("jump");
    } else if (type === "play") {
      playState("happy", 2000);
      showBubble("play");
      bumpAffection(6);
    } else if (type === "sleep") {
      sleeping = true;
      playState("sleep", 0, false);
      showBubble("sleep");
    } else if (type === "wake") {
      sleeping = false;
      playState("idle", 0, false);
      showBubble("wake");
      flashAnim("jump");
    } else if (type === "pet") {
      playState("happy", 1200);
      showBubble("pet");
      bumpAffection(4);
    }
  }

  function applyConfig(next) {
    config = next;
    scale = next.scale || 1;
    img.style.transform = `scale(${scale})`;
    img.alt = next.petName || "pet";
    sleeping = false;
    playState("idle", 0, false);
    resetIdleSleep();
    startWander();
  }

  async function boot() {
    if (!petApi) {
      console.error("[pet] petApi missing");
      return;
    }
    setupDrag();
    setupClicks();
    petApi.onSettings((data) => {
      if (!config) return;
      config = { ...config, ...data };
      startWander();
    });
    petApi.onAction((data) => handleAction(data.type));
    petApi.onInit((data) => applyConfig(data));
    try {
      const data = await petApi.getConfig();
      applyConfig(data);
    } catch (err) {
      console.error("[pet] load config failed", err);
    }
  }

  if (document.readyState === "loading") {
    document.addEventListener("DOMContentLoaded", boot);
  } else {
    boot();
  }
})();
