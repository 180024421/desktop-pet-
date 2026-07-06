(function () {
  let ctx = null;
  let positionTimer = null;
  let reminderTimer = null;
  let lmTimer = null;
  let lastPos = { x: 0, y: 0, t: Date.now() };
  let throwSamples = [];

  const HOLIDAY_LINES = {
    "01-01": "新年快乐！",
    "02-14": "情人节快乐~",
    "10-01": "国庆快乐！",
    "12-25": "圣诞快乐~",
  };

  function cfg() {
    return ctx?.getConfig?.() || null;
  }

  function playSound(kind) {
    const c = cfg();
    if (!c?.soundEnabled) return;
    const vol = Math.max(0, Math.min(1, c.soundVolume ?? 0.35));
    const Ctx = window.AudioContext || window.webkitAudioContext;
    if (!Ctx) return;
    const ac = new Ctx();
    const osc = ac.createOscillator();
    const gain = ac.createGain();
    const freq = { click: 520, feed: 380, unlock: 660, bump: 440, throw: 300 }[kind] || 500;
    osc.frequency.value = freq;
    gain.gain.value = vol * 0.15;
    osc.connect(gain);
    gain.connect(ac.destination);
    osc.start();
    osc.stop(ac.currentTime + 0.08);
  }

  function applyBubbleStyle() {
    const c = cfg();
    const bubble = ctx?.bubble;
    if (!bubble) return;
    bubble.classList.remove("bubble-round", "bubble-pixel", "bubble-comic");
    bubble.classList.add(`bubble-${c?.bubbleStyle || "round"}`);
  }

  function trackThrow(e) {
    const c = cfg();
    if (!c?.throwInteractionEnabled) return;
    const now = Date.now();
    throwSamples.push({ dx: e.screenX - lastPos.x, dy: e.screenY - lastPos.y, dt: now - lastPos.t });
    if (throwSamples.length > 6) throwSamples.shift();
    lastPos = { x: e.screenX, y: e.screenY, t: now };
  }

  function detectThrowEnd() {
    const c = cfg();
    if (!c?.throwInteractionEnabled || throwSamples.length < 3) return;
    const last = throwSamples[throwSamples.length - 1];
    const speed = Math.hypot(last.dx, last.dy) / Math.max(last.dt, 1);
    if (speed > 1.2) {
      playSound("throw");
      const state = speed > 2.5 ? "angry" : "happy";
      ctx?.playState?.(state, ctx.cycleDuration(state), true, {
        force: true,
        bubbleCategory: state === "angry" ? "angry" : "happy",
      });
    }
    throwSamples = [];
  }

  function checkRandomEvent() {
    const c = cfg();
    if (!c?.randomEventsEnabled || Math.random() > 0.08) return;
    const mmdd = new Date().toISOString().slice(5, 10);
    if (HOLIDAY_LINES[mmdd]) {
      ctx?.showTextBubble?.(HOLIDAY_LINES[mmdd]);
      ctx?.playState?.("special", ctx.cycleDuration("special"), true, { force: true });
      return;
    }
    if (Math.random() < 0.3) {
      ctx?.showBubble?.("schedule");
      return;
    }
    const states = ["happy", "sad", "walk"];
    const st = states[Math.floor(Math.random() * states.length)];
    if (ctx?.framesFor?.(st)?.length) {
      ctx?.playState?.(st, ctx.cycleDuration(st), true);
    }
  }

  function startReminders() {
    if (reminderTimer) clearInterval(reminderTimer);
    const c = cfg();
    if (!c?.remindersEnabled) return;
    const ms = Math.max(5, c.reminderIntervalMin || 45) * 60 * 1000;
    reminderTimer = setInterval(() => {
      const msgs = c.reminderMessages?.length
        ? c.reminderMessages
        : ["记得喝水~", "起来活动一下"];
      ctx?.showTextBubble?.(msgs[Math.floor(Math.random() * msgs.length)]);
      playSound("click");
    }, ms);
  }

  function startLmStudio() {
    if (lmTimer) clearInterval(lmTimer);
    const c = cfg();
    if (!c?.lmStudioEnabled || !ctx?.petApi?.lmStudioPhrase) return;
    const ms = Math.max(10, c.lmStudioIntervalMin || 60) * 60 * 1000;
    lmTimer = setInterval(async () => {
      try {
        const res = await ctx.petApi.lmStudioPhrase();
        if (res?.phrase) ctx.showTextBubble?.(res.phrase);
      } catch {
        /* ignore */
      }
    }, ms);
  }

  function reportPosition() {
    const c = cfg();
    if (!c) return;
    ctx?.petApi?.reportPosition?.({
      profileId: c.profileId,
      petName: c.petName,
      x: window.screenX,
      y: window.screenY,
      isPrimary: !c.isSecondary,
    });
  }

  function onPositions(list) {
    const c = cfg();
    if (!c?.petInteractEnabled || c.isSecondary) return;
    const me = { x: window.screenX, y: window.screenY };
    for (const p of list || []) {
      if (p.profileId === c.profileId) continue;
      const d = Math.hypot(p.x - me.x, p.y - me.y);
      if (d < 140 && Math.random() < 0.25) {
        ctx?.showTextBubble?.(`和 ${p.petName} 碰一碰~`);
        ctx?.playState?.("happy", ctx.cycleDuration("happy"), true, { force: true });
        playSound("bump");
        break;
      }
    }
  }

  function onScene({ hide, shrink }) {
    const root = ctx?.root;
    if (!root) return;
    root.classList.toggle("scene-hidden", Boolean(hide));
    root.classList.toggle("scene-shrink", Boolean(shrink) && !hide);
  }

  function onOfficeHint({ hint }) {
    if (hint === "sleep") {
      ctx?.playState?.("sleep", 0, false, { force: true });
      ctx?.showTextBubble?.("主人摸鱼中…我也睡会儿");
    } else if (hint === "complain") {
      ctx?.showBubble?.("sad");
      ctx?.playState?.("sad", ctx.cycleDuration("sad"), true, { force: true });
    } else if (hint === "cheer") {
      ctx?.showBubble?.("happy");
    }
  }

  async function mergePluginPhrases(category) {
    if (!cfg()?.pluginsEnabled || !ctx?.petApi?.pluginPhrases) return;
    try {
      const extra = await ctx.petApi.pluginPhrases(category);
      if (extra?.length && ctx.mergePhrasePool) ctx.mergePhrasePool(category, extra);
    } catch {
      /* ignore */
    }
  }

  function restart() {
    applyBubbleStyle();
    startReminders();
    startLmStudio();
    void mergePluginPhrases("idle");
    reportPosition();
  }

  window.initPetExtras = function initPetExtras(core) {
    ctx = core;

    if (positionTimer) clearInterval(positionTimer);
    positionTimer = setInterval(reportPosition, 3000);
    reportPosition();

    core.petApi?.onPositions?.(onPositions);
    core.petApi?.onScene?.(onScene);
    core.petApi?.onOfficeHint?.(onOfficeHint);

    const img = core.img;
    if (img) {
      img.addEventListener("mousemove", trackThrow);
      img.addEventListener("mouseup", detectThrowEnd);
    }

    setInterval(checkRandomEvent, 5 * 60 * 1000);
    restart();

    return {
      onConfigApplied: () => restart(),
      onInteract: (kind) => {
        playSound(kind || "click");
        void (async () => {
          if (!cfg()?.pluginsEnabled) return;
          const line = await core.petApi?.pluginOnInteract?.();
          if (line) core.showTextBubble?.(line);
        })();
      },
      playSound,
    };
  };
})();
