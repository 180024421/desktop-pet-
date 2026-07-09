/** Shimeji 式沿屏幕边缘爬行 */
(function () {
  function createShimejiController(api) {
  let timer = null;
  let edge = "bottom";
  let dir = 1;
  const stepPx = 3;

  async function workArea() {
    return api.getWorkArea?.({ x: window.screenX, y: window.screenY });
  }

  function pickEdge(area) {
    const x = window.screenX;
    const y = window.screenY;
    const w = window.outerWidth;
    const h = window.outerHeight;
    const dl = x - area.x;
    const dr = area.x + area.width - (x + w);
    const dt = y - area.y;
    const db = area.y + area.height - (y + h);
    const min = Math.min(dl, dr, dt, db);
    if (min === dl) return "left";
    if (min === dr) return "right";
    if (min === dt) return "top";
    return "bottom";
  }

  async function crawlTick() {
    const cfg = api.getConfig?.();
    if (!cfg?.shimejiMode || cfg.followMouse) return;
    const area = await workArea();
    if (!area) return;
    edge = pickEdge(area);
    let x = window.screenX;
    let y = window.screenY;
    const w = window.outerWidth;
    const h = window.outerHeight;
    const margin = cfg.edgeMargin ?? 12;

    if (edge === "bottom") {
      y = area.y + area.height - h - margin;
      x += stepPx * dir;
      if (x <= area.x + margin) dir = 1;
      if (x + w >= area.x + area.width - margin) dir = -1;
      api.setFacing?.(dir);
    } else if (edge === "top") {
      y = area.y + margin;
      x += stepPx * dir;
      if (x <= area.x + margin) dir = 1;
      if (x + w >= area.x + area.width - margin) dir = -1;
      api.setFacing?.(dir);
    } else if (edge === "left") {
      x = area.x + margin;
      y += stepPx * dir;
      if (y <= area.y + margin) dir = 1;
      if (y + h >= area.y + area.height - margin) dir = -1;
    } else {
      x = area.x + area.width - w - margin;
      y += stepPx * dir;
      if (y <= area.y + margin) dir = 1;
      if (y + h >= area.y + area.height - margin) dir = -1;
    }

    api.playState?.("walk", 99999, false, { force: true, showBubbleNow: false });
    window.moveTo(Math.round(x), Math.round(y));
    api.savePosition?.({ x: Math.round(x), y: Math.round(y) });
  }

  function start() {
    stop();
    timer = setInterval(() => void crawlTick(), 120);
  }

  function stop() {
    if (timer) clearInterval(timer);
    timer = null;
  }

  function restart() {
    const cfg = api.getConfig?.();
    if (cfg?.shimejiMode && !cfg.wander) start();
    else stop();
  }

  return { start, stop, restart };
  }

  window.createShimejiController = createShimejiController;
})();
