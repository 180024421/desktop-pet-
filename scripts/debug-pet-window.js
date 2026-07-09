/**
 * 启动宠物页并 dump DOM / 图片加载状态到 stdout
 */
const { app, BrowserWindow, protocol, net } = require("electron");
const path = require("path");
const fs = require("fs");
const { pathToFileURL } = require("url");

const root = path.join(__dirname, "..");
const profileDir = path.join(process.env.APPDATA, "desktop-pet", "profiles", "default");
const cfg = JSON.parse(
  fs.readFileSync(path.join(profileDir, "pet-config.json"), "utf-8")
);

function fileUrlForRenderer(absPath) {
  const normalized = path.resolve(absPath);
  if (!fs.existsSync(normalized)) return "";
  const posix = normalized.replace(/\\/g, "/");
  return `pet://local/${encodeURI(posix)}`;
}

function serializeConfig() {
  const base = profileDir;
  const mapFrames = (paths) =>
    paths.map((p) => {
      const abs = path.isAbsolute(p) ? p : path.join(base, p.replace(/\//g, path.sep));
      return { path: abs, url: fileUrlForRenderer(abs) };
    });
  return {
    ...cfg,
    renderMode: "flipbook",
    frames: {
      idle: mapFrames(cfg.frames.idle),
      click: mapFrames(cfg.frames.click || []),
      walk: mapFrames(cfg.frames.walk || []),
      drag: mapFrames(cfg.frames.drag || []),
      sleep: mapFrames(cfg.frames.sleep || []),
      happy: mapFrames(cfg.frames.happy || []),
      sad: mapFrames(cfg.frames.sad || []),
      eat: mapFrames(cfg.frames.eat || []),
      angry: mapFrames(cfg.frames.angry || []),
      special: mapFrames(cfg.frames.special || []),
    },
  };
}

protocol.registerSchemesAsPrivileged([
  {
    scheme: "pet",
    privileges: { standard: true, secure: true, supportFetchAPI: true, stream: true, bypassCSP: true },
  },
]);

app.whenReady().then(async () => {
  protocol.handle("pet", (request) => {
    try {
      const url = new URL(request.url);
      if (url.hostname !== "local") return new Response("Not Found", { status: 404 });
      let filePath = decodeURIComponent(url.pathname.replace(/^\//, ""));
      if (!filePath || !fs.existsSync(filePath)) {
        console.error("[protocol] missing:", filePath);
        return new Response("Not Found", { status: 404 });
      }
      return net.fetch(pathToFileURL(filePath).href);
    } catch (err) {
      console.error("[protocol]", err);
      return new Response("Error", { status: 500 });
    }
  });

  const win = new BrowserWindow({
    width: 400,
    height: 400,
    show: false,
    webPreferences: {
      preload: path.join(root, "dist/preload/pet.js"),
      contextIsolation: true,
      nodeIntegration: false,
    },
  });

  win.webContents.on("console-message", (_e, level, message) => {
    console.log(`[renderer:${level}]`, message);
  });

  await win.loadFile(path.join(root, "dist/renderer/pet/index.html"));

  const serialized = serializeConfig();
  win.webContents.send("pet:init", serialized);

  await new Promise((r) => setTimeout(r, 5000));

  const loadResult = await win.webContents.executeJavaScript(`(() => new Promise((resolve) => {
    const img = document.getElementById('pet-img');
    if (!img?.src) return resolve({ status: 'no-src' });
    if (img.complete && img.naturalWidth > 0) return resolve({ status: 'ok', w: img.naturalWidth, h: img.naturalHeight, src: img.src });
    img.onload = () => resolve({ status: 'ok', w: img.naturalWidth, h: img.naturalHeight, src: img.src });
    img.onerror = () => resolve({ status: 'error', src: img.src });
    setTimeout(() => resolve({ status: 'timeout', src: img.src, complete: img.complete, w: img.naturalWidth }), 4000);
  }))()`);

  console.log("=== img load ===");
  console.log(JSON.stringify(loadResult, null, 2));

  const dump = await win.webContents.executeJavaScript(`(() => {
    const img = document.getElementById('pet-img');
    const canvas = document.getElementById('pet-canvas');
    return {
      imgHidden: img?.classList.contains('hidden'),
      imgSrc: img?.src || '',
      imgComplete: img?.complete,
      imgNatural: { w: img?.naturalWidth, h: img?.naturalHeight },
      canvasHidden: canvas?.classList.contains('hidden'),
      rootOpacity: getComputedStyle(document.getElementById('root')).opacity,
    };
  })()`);

  console.log("=== DOM dump ===");
  console.log(JSON.stringify(dump, null, 2));

  try {
    const image = await win.capturePage();
    const out = path.join(root, "debug-pet-capture.png");
    fs.writeFileSync(out, image.toPNG());
    console.log("screenshot:", out);
  } catch (e) {
    console.error("capture failed", e);
  }

  app.quit();
});

setTimeout(() => app.quit(), 15000);
