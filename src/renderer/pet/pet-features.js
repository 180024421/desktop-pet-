(function () {
  const TIERS = [20, 50, 80];
  const SCHEDULE_LINES = {
    morning: ["早安呀~", "今天也要元气满满", "起床啦主人"],
    lunch: ["该吃午饭了", "休息一下嘛", "补充能量~"],
    evening: ["下班快乐！", "辛苦一天啦", "傍晚好~"],
    night: ["夜深了，早点休息", "别熬夜哦", "晚安 Zzz"],
  };

  let api = null;
  let extras = null;
  let scheduleTimer = null;
  let weatherTimer = null;
  let officeTimer = null;
  let pomodoroTimer = null;
  let pomodoroLeft = 0;

  function cfg() {
    return api?.getConfig?.() || null;
  }

  function applyDisplayMode() {
    const c = cfg();
    const mode = c?.displayMode || "full";
    const root = api?.root;
    if (!root) return;
    root.classList.remove("mode-full", "mode-pet-only", "mode-widget");
    root.classList.add(`mode-${mode}`);
    const widget = document.getElementById("pomodoro-widget");
    if (widget) widget.classList.toggle("hidden", mode !== "widget");
    if (mode === "widget" && pomodoroLeft <= 0) {
      pomodoroLeft = (c?.pomodoroMinutes || 25) * 60;
      updatePomodoroUi();
    }
  }

  function updatePomodoroUi() {
    const el = document.getElementById("pomodoro-time");
    if (!el) return;
    const m = Math.floor(pomodoroLeft / 60);
    const s = pomodoroLeft % 60;
    el.textContent = `${String(m).padStart(2, "0")}:${String(s).padStart(2, "0")}`;
  }

  function stopPomodoro() {
    if (pomodoroTimer) clearInterval(pomodoroTimer);
    pomodoroTimer = null;
  }

  function startPomodoro() {
    const c = cfg();
    if (pomodoroLeft <= 0) pomodoroLeft = (c?.pomodoroMinutes || 25) * 60;
    stopPomodoro();
    pomodoroTimer = setInterval(() => {
      pomodoroLeft -= 1;
      updatePomodoroUi();
      if (pomodoroLeft <= 0) {
        stopPomodoro();
        extras?.playSound?.("unlock");
        api?.showBubble?.("happy");
        api?.playState?.("happy", api.cycleDuration("happy"), true, {
          force: true,
          bubbleCategory: "happy",
        });
        pomodoroLeft = (cfg()?.pomodoroMinutes || 25) * 60;
        updatePomodoroUi();
      }
    }, 1000);
  }

  function setupPomodoro() {
    const btn = document.getElementById("pomodoro-start");
    if (!btn) return;
    btn.addEventListener("click", () => {
      if (pomodoroTimer) {
        stopPomodoro();
        btn.textContent = "▶";
      } else {
        startPomodoro();
        btn.textContent = "⏸";
      }
    });
  }

  function scheduleBucket() {
    const h = new Date().getHours();
    if (h >= 7 && h < 10) return "morning";
    if (h >= 11 && h < 14) return "lunch";
    if (h >= 17 && h < 20) return "evening";
    if (h >= 21 || h < 6) return "night";
    return null;
  }

  function startScheduleBubbles() {
    if (scheduleTimer) clearInterval(scheduleTimer);
    scheduleTimer = setInterval(() => {
      const c = cfg();
      if (!c?.scheduleBubbles || !c.speechEnabled) return;
      const bucket = scheduleBucket();
      if (!bucket) return;
      const lines = SCHEDULE_LINES[bucket];
      api?.showTextBubble?.(lines[Math.floor(Math.random() * lines.length)]);
    }, 45 * 60 * 1000);
  }

  function onActivity({ level, busy }) {
    const c = cfg();
    if (!c?.activityLink) return;
    if (busy && Math.random() < 0.35) {
      api?.showBubble?.("idle");
      return;
    }
    if (!busy && level < 20 && Math.random() < 0.2) {
      api?.playState?.("sleep", 0, false, { force: true, showBubbleNow: false });
    }
  }

  function startWeather() {
    if (weatherTimer) clearInterval(weatherTimer);
    weatherTimer = setInterval(async () => {
      const c = cfg();
      if (!c?.weatherEnabled || !api?.petApi?.fetchWeather) return;
      try {
        const w = await api.petApi.fetchWeather(c.weatherCity);
        if (w?.phrase) api.showTextBubble?.(w.phrase);
      } catch {
        /* ignore */
      }
    }, 30 * 60 * 1000);
  }

  function startOfficeBridge() {
    if (officeTimer) clearInterval(officeTimer);
    officeTimer = setInterval(async () => {
      const c = cfg();
      if (!c?.officeBridgeEnabled || !api?.petApi?.officeBridge) return;
      try {
        const phrase = await api.petApi.officeBridge();
        if (phrase) api.showTextBubble?.(phrase);
      } catch {
        /* ignore */
      }
    }, 20 * 60 * 1000);
  }

  function checkAffectionTiers() {
    const c = cfg();
    if (!c) return;
    const aff = api.getAffection?.() ?? 0;
    for (const tier of TIERS) {
      if (aff >= tier && !(c.unlockedTiers || []).includes(tier)) {
        api.petApi?.unlockTier?.(tier);
        c.unlockedTiers = [...(c.unlockedTiers || []), tier];
        extras?.playSound?.("unlock");
        if (tier === 80) {
          api.showBubble?.("special");
          if (api.framesFor?.("special")?.length) {
            api.playState?.("special", api.cycleDuration("special"), true, {
              force: true,
              bubbleCategory: "special",
            });
          }
        } else if (tier === 50) api.showBubble?.("happy");
        else api.showBubble?.("pet");
        api.applyCssEffect?.();
      }
    }
  }

  function bumpInteract(kind) {
    api?.petApi?.bumpInteract?.(kind || "interact");
    extras?.onInteract?.(kind || "click");
    checkAffectionTiers();
  }

  function restartAll() {
    stopPomodoro();
    applyDisplayMode();
    startScheduleBubbles();
    startWeather();
    startOfficeBridge();
    extras?.onConfigApplied?.();
  }

  window.initPetFeatures = function initPetFeatures(core) {
    api = core;
    if (window.initPetExtras) extras = window.initPetExtras(core);
    setupPomodoro();
    restartAll();
    core.petApi?.onActivity?.(onActivity);
    return {
      onConfigApplied: () => restartAll(),
      onInteract: (kind) => bumpInteract(kind),
      onAffectionChanged: () => checkAffectionTiers(),
    };
  };
})();
