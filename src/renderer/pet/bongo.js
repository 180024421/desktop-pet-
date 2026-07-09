/** Bongo Cat 式打字联动 */
(function () {
  function createBongoController(api) {
  let lastKeys = 0;
  let typingTimer = null;
  let pollTimer = null;

  function stopTyping() {
    if (typingTimer) clearTimeout(typingTimer);
    typingTimer = setTimeout(() => {
      api.playState?.("idle", 0, false, { force: true, showBubbleNow: false });
    }, 1500);
  }

  function onTypingBurst() {
    const cfg = api.getConfig?.();
    if (!cfg?.bongoMode) return;
    api.playState?.("typing", 99999, false, { force: true, showBubbleNow: false });
    stopTyping();
  }

  async function pollOfficeKeys() {
    const cfg = api.getConfig?.();
    if (!cfg?.bongoMode) return;
    try {
      const stats = await api.petApi?.officeBridgeStats?.();
      if (!stats) return;
      const keys = stats.keystrokesToday ?? 0;
      if (keys > lastKeys) onTypingBurst();
      lastKeys = keys;
    } catch {
      /* ignore */
    }
  }

  function onActivity({ level, busy }) {
    const cfg = api.getConfig?.();
    if (!cfg?.bongoMode) return;
    if (busy && level > 40) onTypingBurst();
  }

  function start() {
    stop();
    pollTimer = setInterval(() => void pollOfficeKeys(), 2000);
    if (api.petApi?.onActivity) {
      api._bongoActivity = (data) => onActivity(data);
    }
  }

  function stop() {
    if (pollTimer) clearInterval(pollTimer);
    if (typingTimer) clearTimeout(typingTimer);
    pollTimer = null;
    typingTimer = null;
  }

  function restart() {
    if (api.getConfig?.()?.bongoMode) start();
    else stop();
  }

  return { start, stop, restart, onTypingBurst, onActivity };
  }

  window.createBongoController = createBongoController;
})();
