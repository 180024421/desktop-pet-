(function () {
  const petApi = window.petApi;
  const root = document.getElementById("root");
  const scaleWrap = document.getElementById("pet-scale");
  const img = document.getElementById("pet-img");
  const dragHandle = document.getElementById("drag-handle");
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
  let clickThroughActive = false;
  let ambientTimer = null;
  let ambientIndex = 0;
  let actionLockUntil = 0;
  let actionToken = 0;
  let singleClickTimer = null;
  let features = null;
  const AMBIENT_STATES = ["walk", "happy", "eat"];
  const imageCache = new Map();

  const STATE_BUBBLE = {
    idle: "idle",
    click: "click",
    walk: "wander",
    drag: "pet",
    sleep: "sleep",
    happy: "happy",
    sad: "sad",
    eat: "feed",
    angry: "angry",
    special: "special",
  };

  const DEFAULT_PHRASES = {
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
    angry: ["嗷呜！", "别惹我", "恶猫咆哮！", "哼！"],
    special: ["隐藏彩蛋~", "被你发现啦 ✨", "超级喜欢你！", "秘密模式 ON"],
    schedule: ["记得喝水哦", "伸个懒腰吧", "我在这里陪着你"],
  };

  function applyScale() {
    if (scaleWrap) scaleWrap.style.transform = `scale(${scale})`;
  }

  function isAnimatedGif(item) {
    return item?.path?.toLowerCase().endsWith(".gif");
  }

  function phrasesFor(category) {
    const custom = config?.customPhrases?.[category];
    const pluginExtra = config?._pluginPhrases?.[category];
    const merged = [...(custom || []), ...(pluginExtra || [])];
    if (merged.length) return merged;
    return DEFAULT_PHRASES[category] || DEFAULT_PHRASES.idle;
  }

  function mergePhrasePool(category, lines) {
    if (!config) return;
    config._pluginPhrases = config._pluginPhrases || {};
    config._pluginPhrases[category] = lines;
  }

  function bubbleCategoryForState(state) {
    return STATE_BUBBLE[state] || "idle";
  }

  function isActionLocked() {
    return Date.now() < actionLockUntil;
  }

  function applyClickThroughUi() {
    const on = Boolean(config?.clickThrough);
    clickThroughActive = on;
    root?.classList.toggle("click-through", on);
    dragHandle?.classList.toggle("hidden", !on);
  }

  async function preloadAllFrames() {
    if (!config?.frames) return;
    const seen = new Set();
    const tasks = [];
    for (const list of Object.values(config.frames)) {
      for (const item of list || []) {
        if (!item?.path || seen.has(item.path)) continue;
        seen.add(item.path);
        tasks.push(resolveImageUrl(item));
      }
    }
    await Promise.all(tasks);
  }

  async function getWorkArea() {
    if (!petApi?.getWorkArea) return null;
    return petApi.getWorkArea({ x: window.screenX, y: window.screenY });
  }

  function clampMove(x, y, area) {
    const w = window.outerWidth;
    const h = window.outerHeight;
    return {
      x: Math.max(area.x, Math.min(area.x + area.width - w, Math.round(x))),
      y: Math.max(area.y, Math.min(area.y + area.height - h, Math.round(y))),
    };
  }

  async function snapToScreenEdges() {
    const area = await getWorkArea();
    if (!area) return;
    const margin = config?.edgeMargin ?? 12;
    const snap = config?.snapDistance ?? 48;
    let x = window.screenX;
    let y = window.screenY;
    const w = window.outerWidth;
    const h = window.outerHeight;
    if (x - area.x < snap) x = area.x + margin;
    else if (area.x + area.width - (x + w) < snap) x = area.x + area.width - w - margin;
    if (y - area.y < snap) y = area.y + margin;
    else if (area.y + area.height - (y + h) < snap) y = area.y + area.height - h - margin;
    if (x !== window.screenX || y !== window.screenY) window.moveTo(x, y);
  }

  function isFlipbook() {
    return (config?.animationMode ?? "flipbook") === "flipbook";
  }

  function framesFor(state) {
    if (!config) return [];
    if (isFlipbook() && state !== "sleep") {
      let idle = config.frames.idle;
      if (idle?.length >= 2) {
        const start = config.flipbookLoopStart ?? 0;
        const end = config.flipbookLoopEnd ?? -1;
        const e = end < 0 ? idle.length - 1 : Math.min(end, idle.length - 1);
        if (e >= start) idle = idle.slice(start, e + 1);
      }
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
    if (list.length === 1 && isAnimatedGif(list[0])) return;
    const interval = config?.frameIntervalMs ?? 180;
    if (frameTimer) clearInterval(frameTimer);
    frameTimer = setInterval(() => {
      frameIndex = (frameIndex + 1) % list.length;
      showFrameInstant(state, frameIndex);
    }, interval);
  }

  async function resolveImageUrl(item) {
    if (!item?.path) return "";
    if (item.url) {
      imageCache.set(item.path, item.url);
      return item.url;
    }
    if (imageCache.has(item.path)) return imageCache.get(item.path);
    if (petApi?.getImageUrl) {
      const url = await petApi.getImageUrl(item.path);
      if (url) {
        item.url = url;
        imageCache.set(item.path, url);
      }
      return url || "";
    }
    return "";
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
    img.onload = null;
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
    img.classList.remove(
      "effect-breathe",
      "effect-bounce",
      "effect-wiggle",
      "effect-glow",
      "effect-sparkle"
    );
    if (!config || sleeping || currentState !== "idle") return;
    const totalFrames = framesFor("idle").length;
    if (totalFrames > 1) return;
    let effect = config.cssEffect;
    const tiers = config.unlockedTiers || [];
    const aff = affection;
    if (aff >= 80 && tiers.includes(80)) effect = "sparkle";
    else if (aff >= 50 && tiers.includes(50)) effect = "glow";
    else if (aff >= 20 && tiers.includes(20) && effect === "none") effect = "bounce";
    if (effect && effect !== "none") img.classList.add(`effect-${effect}`);
  }

  function cycleDuration(state) {
    const list = framesFor(state);
    const interval = config?.frameIntervalMs ?? 180;
    if (list.length <= 1) return interval * 2;
    return list.length * interval + 80;
  }

  async function maybeSyncWallpaper(state) {
    if (!config?.syncWallpaperWithState || !petApi?.setWallpaper) return;
    const list = framesFor(state);
    const mid = list[Math.floor(list.length / 2)] || list[0];
    if (mid?.path) await petApi.setWallpaper(mid.path);
  }

  function playState(state, durationMs = null, revert = true, options = {}) {
    const { force = false, bubbleCategory = null, showBubbleNow = null } = options;
    const loopStates = ["idle", "sleep"];
    const shouldRevert = revert && !loopStates.includes(state);

    if (!force && isActionLocked() && shouldRevert) return;
    if (!force && isDragging && state !== "drag") return;

    clearTimers();
    const token = ++actionToken;
    currentState = state;
    frameIndex = 0;
    const duration = durationMs ?? (shouldRevert ? cycleDuration(state) : 0);

    if (shouldRevert && duration > 0) {
      actionLockUntil = Date.now() + duration;
    } else if (force || loopStates.includes(state)) {
      actionLockUntil = 0;
    }

    void (async () => {
      await preloadFrames(state);
      if (token !== actionToken) return;
      showFrameInstant(state, 0);
      applyCssEffect();
      startFrameLoop(state);
      void maybeSyncWallpaper(state);

      const syncBubble = config?.syncBubbleWithState !== false;
      const category =
        showBubbleNow === false
          ? null
          : bubbleCategory ?? (syncBubble ? bubbleCategoryForState(state) : null);
      if (category) showBubble(category);

      if (shouldRevert && duration > 0) {
        stateTimer = setTimeout(() => {
          if (token !== actionToken) return;
          actionLockUntil = 0;
          playState("idle", 0, false, { force: true, showBubbleNow: false });
        }, duration);
      }
    })();
  }

  function showBubble(category) {
    if (!config?.speechEnabled) return;
    const pool = phrasesFor(category);
    showTextBubble(pool[Math.floor(Math.random() * pool.length)]);
  }

  function showTextBubble(text) {
    if (!config?.speechEnabled || !text) return;
    bubble.textContent = text;
    bubble.classList.remove("hidden");
    if (bubbleTimer) clearTimeout(bubbleTimer);
    bubbleTimer = setTimeout(() => bubble.classList.add("hidden"), 2800);
  }

  function bumpAffection(delta) {
    affection = Math.max(0, Math.min(100, affection + delta));
    affectionBar.style.width = `${affection}%`;
    affectionWrap.classList.remove("hidden");
    setTimeout(() => affectionWrap.classList.add("hidden"), 2000);
    petApi?.saveAffection?.(affection);
    features?.onAffectionChanged?.();
  }

  function noteInteract(kind) {
    features?.onInteract?.(kind || "click");
  }

  function resetIdleSleep() {
    lastInteract = Date.now();
    if (idleTimer) clearTimeout(idleTimer);
    if (!config) return;
    idleTimer = setTimeout(() => {
      if (Date.now() - lastInteract >= config.idleSleepSeconds * 1000 - 200) {
        sleeping = true;
        playState("sleep", 0, false, { force: true });
      }
    }, config.idleSleepSeconds * 1000);
  }

  function flashAnim(cls) {
    img.classList.remove(cls);
    void img.offsetWidth;
    img.classList.add(cls);
    setTimeout(() => img.classList.remove(cls), 500);
  }

  function beginDrag(e) {
    if (e.button !== 0) return;
    isDragging = true;
    img.classList.add("dragging");
    dragOffset = { x: e.screenX - window.screenX, y: e.screenY - window.screenY };
    if (clickThroughActive) petApi?.setClickThrough?.(false);
    playState("drag", 99999, false, { force: true, showBubbleNow: false });
    resetIdleSleep();
  }

  function moveDrag(e) {
    if (!isDragging) return;
    void (async () => {
      const area = await getWorkArea();
      if (!area) {
        window.moveTo(e.screenX - dragOffset.x, e.screenY - dragOffset.y);
        return;
      }
      const pos = clampMove(e.screenX - dragOffset.x, e.screenY - dragOffset.y, area);
      window.moveTo(pos.x, pos.y);
    })();
  }

  function endDrag() {
    if (!isDragging) return;
    isDragging = false;
    img.classList.remove("dragging");
    if (clickThroughActive) petApi?.setClickThrough?.(true);
    void snapToScreenEdges();
    petApi?.savePosition?.({ x: window.screenX, y: window.screenY });
    playState("idle", 0, false, { force: true, bubbleCategory: "click" });
    bumpAffection(1);
    noteInteract("drag");
    resetIdleSleep();
  }

  function setupDrag() {
    img.addEventListener("mousedown", beginDrag);
    dragHandle?.addEventListener("mousedown", beginDrag);
    window.addEventListener("mousemove", moveDrag);
    window.addEventListener("mouseup", endDrag);
  }

  function setupClicks() {
    img.addEventListener("click", (e) => {
      if (isDragging) return;
      if (singleClickTimer) clearTimeout(singleClickTimer);
      singleClickTimer = setTimeout(() => {
        singleClickTimer = null;
        playState("click", cycleDuration("click"), config?.clickOnceRevert !== false, {
          force: true,
          bubbleCategory: "click",
        });
        flashAnim("shake");
        bumpAffection(2);
        noteInteract("click");
        sleeping = false;
        resetIdleSleep();
      }, 280);
      e.stopPropagation();
    });

    img.addEventListener("dblclick", (e) => {
      if (isDragging) return;
      if (singleClickTimer) {
        clearTimeout(singleClickTimer);
        singleClickTimer = null;
      }
      playState("happy", cycleDuration("happy"), true, {
        force: true,
        bubbleCategory: "happy",
      });
      flashAnim("jump");
      bumpAffection(5);
      noteInteract("play");
      e.stopPropagation();
    });

    img.addEventListener("contextmenu", (e) => {
      e.preventDefault();
      petApi?.showContextMenu?.();
    });

    img.addEventListener(
      "wheel",
      (e) => {
        e.preventDefault();
        scale = Math.max(0.5, Math.min(2.2, scale + (e.deltaY > 0 ? -0.08 : 0.08)));
        applyScale();
        petApi.saveScale(scale);
        resetIdleSleep();
      },
      { passive: false }
    );
  }

  function canAutoSwitchState() {
    return !isDragging && !sleeping && !isActionLocked() && currentState === "idle";
  }

  function startAmbientShowcase() {
    if (ambientTimer) clearInterval(ambientTimer);
    if (config?.ambientShowcase === false) return;
    const interval = config?.ambientIntervalMs ?? 35000;
    ambientTimer = setInterval(() => {
      if (!canAutoSwitchState()) return;
      const state = AMBIENT_STATES[ambientIndex % AMBIENT_STATES.length];
      ambientIndex += 1;
      if (!framesFor(state).length) return;
      playState(state, cycleDuration(state), true);
    }, interval);
  }

  function startWander() {
    if (wanderTimer) clearInterval(wanderTimer);
    const interval = config?.wanderIntervalMs ?? 8000;
    wanderTimer = setInterval(() => {
      if (!config?.wander || !canAutoSwitchState() || config.followMouse) return;
      if (Math.random() > 0.4) return;
      playState("walk", cycleDuration("walk"), true);
      void (async () => {
        const area = await getWorkArea();
        if (!area) return;
        const dist = config?.wanderDistance ?? 120;
        const dx = (Math.random() - 0.5) * dist;
        const dy = (Math.random() - 0.5) * (dist * 0.66);
        const pos = clampMove(window.screenX + dx, window.screenY + dy, area);
        window.moveTo(pos.x, pos.y);
      })();
    }, interval);
  }

  function handleAction(type) {
    sleeping = false;
    resetIdleSleep();
    if (type === "feed") {
      playState("eat", cycleDuration("eat"), true, { force: true, bubbleCategory: "feed" });
      bumpAffection(8);
      noteInteract("feed");
      playState("happy", cycleDuration("happy"), true, { force: true, bubbleCategory: "play" });
      bumpAffection(6);
      noteInteract("play");
    } else if (type === "sleep") {
      sleeping = true;
      playState("sleep", 0, false, { force: true });
    } else if (type === "wake") {
      sleeping = false;
      playState("idle", 0, false, { force: true, bubbleCategory: "wake" });
      flashAnim("jump");
    } else if (type === "pet") {
      playState("happy", cycleDuration("happy"), true, { force: true, bubbleCategory: "pet" });
      bumpAffection(4);
      noteInteract("pet");
    }
  }

  function applyConfig(next) {
    config = next;
    scale = next.scale || 1;
    affection = typeof next.affection === "number" ? next.affection : 50;
    affectionBar.style.width = `${affection}%`;
    applyScale();
    img.alt = next.petName || "pet";
    applyClickThroughUi();
    sleeping = false;
    actionLockUntil = 0;
    imageCache.clear();
    if (root) {
      root.classList.toggle(`bubble-style-${next.bubbleStyle || "round"}`, true);
      root.setAttribute("aria-label", next.petName || "桌面宠物");
    }
    void (async () => {
      await preloadAllFrames();
      playState("idle", 0, false, { force: true, showBubbleNow: false });
      resetIdleSleep();
      startWander();
      startAmbientShowcase();
      features?.onConfigApplied?.();
    })();
  }

  function initFeaturesBridge() {
    if (!window.initPetFeatures) return;
    features = window.initPetFeatures({
      getConfig: () => config,
      getAffection: () => affection,
      showBubble,
      showTextBubble,
      playState,
      bumpAffection,
      applyCssEffect,
      cycleDuration,
      framesFor,
      mergePhrasePool,
      petApi,
      root,
      bubble,
      img,
    });
  }

  async function boot() {
    if (!petApi) {
      console.error("[pet] petApi missing");
      return;
    }
    setupDrag();
    setupClicks();
    initFeaturesBridge();
    if (hint) setTimeout(() => hint.classList.add("hidden"), 5000);

    petApi.onSettings((data) => {
      if (!config) return;
      config = { ...config, ...data };
      applyClickThroughUi();
      startWander();
    });

    petApi.onCursorNear(({ near }) => {
      if (!config?.followMouse || isDragging || sleeping || isActionLocked()) return;
      if (near && currentState === "idle") {
        playState("walk", cycleDuration("walk"), true);
      } else if (!near && currentState === "walk" && !isActionLocked()) {
        playState("idle", 0, false, { force: true, showBubbleNow: false });
      }
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
