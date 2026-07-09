(function () {
  const log = (msg) => {
    console.log(msg);
    if (window.appLog) window.appLog(msg);
  };

  const STATES = [
    { value: "idle", label: "待机" },
    { value: "click", label: "点击" },
    { value: "walk", label: "行走" },
    { value: "drag", label: "拖拽" },
    { value: "sleep", label: "睡觉" },
    { value: "happy", label: "开心" },
    { value: "sad", label: "难过" },
    { value: "eat", label: "进食" },
    { value: "angry", label: "生气" },
    { value: "special", label: "隐藏/特殊" },
  ];

  const RULES = [
    { state: "idle", keywords: ["idle", "stand", "normal", "default", "待机", "默认", "站立", "常态"] },
    { state: "click", keywords: ["click", "tap", "poke", "点击", "戳", "点"] },
    { state: "walk", keywords: ["walk", "move", "run", "走", "跑", "移动", "行走"] },
    { state: "drag", keywords: ["drag", "hold", "grab", "拖", "抓", "拎"] },
    { state: "sleep", keywords: ["sleep", "rest", "nap", "睡", "休息", "困"] },
    { state: "happy", keywords: ["happy", "joy", "smile", "开心", "高兴", "笑"] },
    { state: "sad", keywords: ["sad", "cry", "难过", "哭", "伤心"] },
    { state: "eat", keywords: ["eat", "feed", "food", "吃", "喂", "食"] },
    { state: "angry", keywords: ["angry", "mad", "生气", "怒"] },
    { state: "special", keywords: ["special", "secret", "hidden", "隐藏", "彩蛋", "稀有"] },
  ];

  const PHRASE_KEYS = [
    { id: "phrases-click", key: "click" },
    { id: "phrases-happy", key: "happy" },
    { id: "phrases-feed", key: "feed" },
    { id: "phrases-play", key: "play" },
    { id: "phrases-idle", key: "idle" },
    { id: "phrases-sleep", key: "sleep" },
    { id: "phrases-wander", key: "wander" },
    { id: "phrases-pet", key: "pet" },
    { id: "phrases-angry", key: "angry" },
    { id: "phrases-special", key: "special" },
    { id: "phrases-schedule", key: "schedule" },
  ];

  function boot() {
    try {
      const configApi = window.configApi;
      const getPathForFile = window.getPathForFile;
      const uploads = [];
      let previewTimer = null;
      let previewIndex = 0;
      let dragFromIndex = null;

      const el = {
        pick: document.getElementById("btn-pick"),
        pickMedia: document.getElementById("btn-pick-media"),
        launch: document.getElementById("btn-launch"),
        save: document.getElementById("btn-save"),
        clear: document.getElementById("btn-clear"),
        list: document.getElementById("upload-list"),
        status: document.getElementById("status"),
        summary: document.getElementById("auto-summary"),
        petName: document.getElementById("pet-name"),
        cssEffect: document.getElementById("css-effect"),
        animationMode: document.getElementById("animation-mode"),
        frameInterval: document.getElementById("frame-interval"),
        idleSleep: document.getElementById("idle-sleep"),
        wanderInterval: document.getElementById("wander-interval"),
        wanderDistance: document.getElementById("wander-distance"),
        followSpeed: document.getElementById("follow-speed"),
        snapDistance: document.getElementById("snap-distance"),
        speech: document.getElementById("toggle-speech"),
        wander: document.getElementById("toggle-wander"),
        follow: document.getElementById("toggle-follow"),
        top: document.getElementById("toggle-top"),
        autoStart: document.getElementById("toggle-autostart"),
        clickThrough: document.getElementById("toggle-clickthrough"),
        syncBubble: document.getElementById("toggle-sync-bubble"),
        syncWallpaper: document.getElementById("toggle-sync-wallpaper"),
        ambient: document.getElementById("toggle-ambient"),
        trim: document.getElementById("toggle-trim"),
        chromakeyColor: document.getElementById("chromakey-color"),
        chromakeyTolerance: document.getElementById("chromakey-tolerance"),
        profileSelect: document.getElementById("profile-select"),
        profileNew: document.getElementById("btn-profile-new"),
        profileExport: document.getElementById("btn-profile-export"),
        profileImport: document.getElementById("btn-profile-import"),
        previewImg: document.getElementById("preview-img"),
        previewToggle: document.getElementById("btn-preview-toggle"),
        fileInput: document.getElementById("file-input"),
        displayMode: document.getElementById("display-mode"),
        pomodoroMinutes: document.getElementById("pomodoro-minutes"),
        weatherCity: document.getElementById("weather-city"),
        schedule: document.getElementById("toggle-schedule"),
        activity: document.getElementById("toggle-activity"),
        weather: document.getElementById("toggle-weather"),
        officeBridge: document.getElementById("toggle-office-bridge"),
        renderMode: document.getElementById("render-mode"),
        pixelSkin: document.getElementById("pixel-skin"),
        shimeji: document.getElementById("toggle-shimeji"),
        bongo: document.getElementById("toggle-bongo"),
        rembg: document.getElementById("toggle-rembg"),
        pickSpriteSheet: document.getElementById("btn-pick-sprite-sheet"),
        spriteSheetStatus: document.getElementById("sprite-sheet-status"),
        frameGaps: document.getElementById("frame-gaps"),
        configSummary: document.getElementById("config-summary"),
        previewChroma: document.getElementById("preview-chroma"),
      };

      function parseHexColor(hex) {
        const m = String(hex || "").trim().match(/^#?([0-9a-f]{6})$/i);
        if (!m) return null;
        const n = parseInt(m[1], 16);
        return { r: (n >> 16) & 255, g: (n >> 8) & 255, b: n & 255 };
      }

      function applyChromakeyPreview() {
        const color = el.chromakeyColor?.value?.trim();
        const canvas = el.previewChroma;
        const imgNode = el.previewImg;
        if (!canvas || !imgNode || !imgNode.src || !color) {
          if (canvas) canvas.classList.add("hidden");
          if (imgNode) imgNode.classList.remove("hidden");
          return;
        }
        const key = parseHexColor(color);
        if (!key) return;
        const tol = Number(el.chromakeyTolerance?.value) || 32;
        const ctx = canvas.getContext("2d");
        const w = imgNode.naturalWidth || 200;
        const h = imgNode.naturalHeight || 200;
        canvas.width = w;
        canvas.height = h;
        ctx.drawImage(imgNode, 0, 0, w, h);
        const data = ctx.getImageData(0, 0, w, h);
        for (let i = 0; i < data.data.length; i += 4) {
          const dr = Math.abs(data.data[i] - key.r);
          const dg = Math.abs(data.data[i + 1] - key.g);
          const db = Math.abs(data.data[i + 2] - key.b);
          if (dr + dg + db < tol * 2) data.data[i + 3] = 0;
        }
        ctx.putImageData(data, 0, 0);
        canvas.classList.remove("hidden");
        imgNode.classList.add("hidden");
      }

      async function refreshFrameGaps(cfg) {
        if (!configApi.frameGaps) return;
        try {
          const gaps = await configApi.frameGaps();
          const missing = (gaps || []).filter((g) => g.missing);
          if (el.frameGaps) {
            el.frameGaps.textContent = missing.length
              ? `帧缺口：${missing.map((g) => g.label).join("、")}`
              : "帧素材齐全 ✓";
          }
          if (el.configSummary && configApi.configSummary) {
            el.configSummary.textContent = await configApi.configSummary();
          }
        } catch {
          /* ignore */
        }
      }

      function setStatus(text) {
        if (el.status) el.status.textContent = text;
        log(`[status] ${text}`);
      }

      if (!el.fileInput) {
        setStatus("错误：文件选择器未找到，请重启应用");
        return;
      }

      function classifyFileName(fileName) {
        const base = fileName.replace(/\.[^.]+$/, "").toLowerCase();
        let best = "idle";
        let bestScore = 0;
        for (const rule of RULES) {
          let score = 0;
          for (const kw of rule.keywords) {
            if (base.includes(kw.toLowerCase())) score += kw.length;
          }
          if (score > bestScore) {
            bestScore = score;
            best = rule.state;
          }
        }
        return { state: best, confidence: bestScore > 0 ? "high" : "low" };
      }

      function isFlipbookMode() {
        return (el.animationMode?.value || "flipbook") === "flipbook";
      }

      function parsePhrases(text) {
        return String(text || "")
          .split("\n")
          .map((s) => s.trim())
          .filter(Boolean);
      }

      function fillPhrases(customPhrases) {
        for (const { id, key } of PHRASE_KEYS) {
          const node = document.getElementById(id);
          if (node) node.value = (customPhrases?.[key] || []).join("\n");
        }
      }

      function readPhrases() {
        const out = {};
        for (const { id, key } of PHRASE_KEYS) {
          const lines = parsePhrases(document.getElementById(id)?.value);
          if (lines.length) out[key] = lines;
        }
        return out;
      }

      function readImportOptions() {
        const color = el.chromakeyColor?.value?.trim();
        return {
          trimTransparent: Boolean(el.trim?.checked),
          useRembg: Boolean(el.rembg?.checked),
          chromakey: color
            ? { color, tolerance: Number(el.chromakeyTolerance?.value) || 32 }
            : null,
        };
      }

      function updateRenderModeUi() {
        const mode = el.renderMode?.value || "flipbook";
        const pixelOn = mode === "pixel";
        const sheetOn = mode === "spritesheet";
        if (el.pixelSkin?.closest("label")) {
          el.pixelSkin.closest("label").style.display = pixelOn ? "" : "none";
        }
        if (el.pickSpriteSheet) el.pickSpriteSheet.style.display = sheetOn ? "" : "none";
        if (el.spriteSheetStatus) el.spriteSheetStatus.style.display = sheetOn ? "" : "none";
      }

      function stopPreview() {
        if (previewTimer) clearInterval(previewTimer);
        previewTimer = null;
        if (el.previewToggle) el.previewToggle.textContent = "播放预览";
      }

      function startPreview() {
        if (!uploads.length) return setStatus("请先添加图片再预览");
        stopPreview();
        previewIndex = 0;
        const interval = Number(el.frameInterval?.value) || 180;
        el.previewToggle.textContent = "停止预览";
        const tick = () => {
          const row = uploads[previewIndex % uploads.length];
          if (el.previewImg && row?.previewUrl) {
            el.previewImg.src = row.previewUrl;
            el.previewImg.onload = () => applyChromakeyPreview();
          }
          previewIndex += 1;
        };
        tick();
        previewTimer = setInterval(tick, interval);
      }

      function renderList() {
        stopPreview();
        if (!uploads.length) {
          el.list.className = "upload-list empty";
          el.list.innerHTML = '<div class="empty-tip">还没有图片，点击上方「选择图片」开始</div>';
          el.summary.textContent = "";
          return;
        }

        el.list.className = "upload-list";
        el.list.innerHTML = "";
        const flipbook = isFlipbookMode();

        if (flipbook) {
          el.summary.textContent = `· 连续帧 × ${uploads.length}（可拖拽排序）`;
        } else {
          const counts = {};
          for (const row of uploads) counts[row.state] = (counts[row.state] || 0) + 1;
          el.summary.textContent =
            "· " +
            Object.entries(counts)
              .map(([k, n]) => `${STATES.find((s) => s.value === k)?.label ?? k}×${n}`)
              .join(" · ");
        }

        uploads.forEach((row, index) => {
          const card = document.createElement("div");
          card.className = "upload-item";
          card.draggable = flipbook;
          card.dataset.index = String(index);

          const badgeClass = flipbook ? "high" : row.confidence === "high" ? "high" : "low";
          const badgeText = flipbook
            ? `第 ${index + 1} 帧`
            : row.confidence === "high"
              ? "自动识别"
              : "待确认";

          const stateSelect = flipbook
            ? `<div class="frame-order">
                 <span>第 ${index + 1} 帧</span>
                 <button type="button" class="btn ghost tiny" data-move="up" data-index="${index}" ${index === 0 ? "disabled" : ""}>↑</button>
                 <button type="button" class="btn ghost tiny" data-move="down" data-index="${index}" ${index === uploads.length - 1 ? "disabled" : ""}>↓</button>
               </div>`
            : `<select data-index="${index}">${STATES.map(
                (s) =>
                  `<option value="${s.value}" ${s.value === row.state ? "selected" : ""}>${s.label}</option>`
              ).join("")}</select>`;

          card.innerHTML = `
            <div class="upload-thumb">
              <img src="${row.previewUrl}" alt="${row.fileName}" />
              <button type="button" class="btn-delete" data-delete="${index}" title="删除">×</button>
            </div>
            <div class="upload-meta">
              <span class="badge ${badgeClass}">${badgeText}</span>
              <div class="name" title="${row.fileName}">${row.fileName}</div>
              ${stateSelect}
            </div>
          `;
          el.list.appendChild(card);
        });

        el.list.querySelectorAll("[data-delete]").forEach((btn) => {
          btn.addEventListener("click", (e) => {
            const idx = Number(e.currentTarget.dataset.delete);
            uploads.splice(idx, 1);
            renderList();
            setStatus("已删除一帧");
          });
        });

        if (!flipbook) {
          el.list.querySelectorAll("select").forEach((select) => {
            select.addEventListener("change", (e) => {
              const idx = Number(e.target.dataset.index);
              uploads[idx].state = e.target.value;
              renderList();
            });
          });
        } else {
          el.list.querySelectorAll("[data-move]").forEach((btn) => {
            btn.addEventListener("click", (e) => {
              const target = e.currentTarget;
              const idx = Number(target.dataset.index);
              const next = target.dataset.move === "up" ? idx - 1 : idx + 1;
              if (next < 0 || next >= uploads.length) return;
              [uploads[idx], uploads[next]] = [uploads[next], uploads[idx]];
              renderList();
            });
          });

          el.list.querySelectorAll(".upload-item").forEach((card) => {
            card.addEventListener("dragstart", (e) => {
              dragFromIndex = Number(card.dataset.index);
              card.classList.add("dragging");
              e.dataTransfer.effectAllowed = "move";
            });
            card.addEventListener("dragend", () => {
              card.classList.remove("dragging");
              dragFromIndex = null;
            });
            card.addEventListener("dragover", (e) => {
              e.preventDefault();
              e.dataTransfer.dropEffect = "move";
            });
            card.addEventListener("drop", (e) => {
              e.preventDefault();
              const toIndex = Number(card.dataset.index);
              if (dragFromIndex === null || dragFromIndex === toIndex) return;
              const [item] = uploads.splice(dragFromIndex, 1);
              uploads.splice(toIndex, 0, item);
              renderList();
            });
          });
        }
        window.__configUploads = uploads;
        window.renderTimeline?.(uploads);
      }

      function readForm() {
        const base = {
          petName: el.petName.value.trim() || "小宠物",
          renderMode: el.renderMode?.value || "flipbook",
          pixelSkin: el.pixelSkin?.value || "cat",
          shimejiMode: el.shimeji?.checked !== false,
          bongoMode: el.bongo?.checked !== false,
          cssEffect: el.cssEffect.value,
          animationMode: el.animationMode?.value || "flipbook",
          frameIntervalMs: Number(el.frameInterval.value) || 180,
          idleSleepSeconds: Number(el.idleSleep.value) || 120,
          wanderIntervalMs: Number(el.wanderInterval?.value) || 4500,
          wanderDistance: Number(el.wanderDistance?.value) || 120,
          followSpeed: Number(el.followSpeed?.value) || 12,
          snapDistance: Number(el.snapDistance?.value) || 48,
          speechEnabled: el.speech.checked,
          wander: el.wander.checked,
          followMouse: el.follow.checked,
          alwaysOnTop: el.top.checked,
          autoStart: el.autoStart?.checked ?? false,
          clickThrough: el.clickThrough?.checked ?? false,
          syncBubbleWithState: el.syncBubble?.checked ?? true,
          syncWallpaperWithState: el.syncWallpaper?.checked ?? false,
          ambientShowcase: el.ambient?.checked ?? true,
          customPhrases: readPhrases(),
          importOptions: readImportOptions(),
          displayMode: el.displayMode?.value || "full",
          pomodoroMinutes: Number(el.pomodoroMinutes?.value) || 25,
          weatherCity: el.weatherCity?.value?.trim() || "Beijing",
          weatherEnabled: Boolean(el.weather?.checked),
          scheduleBubbles: el.schedule?.checked !== false,
          activityLink: el.activity?.checked !== false,
          officeBridgeEnabled: Boolean(el.officeBridge?.checked),
        };
        return window.configAdvancedRead ? window.configAdvancedRead(base) : base;
      }

      function fillForm(config) {
        el.petName.value = String(config.petName ?? "小宠物");
        el.cssEffect.value = String(config.cssEffect ?? "breathe");
        if (el.animationMode) el.animationMode.value = String(config.animationMode ?? "flipbook");
        el.frameInterval.value = String(config.frameIntervalMs ?? 180);
        el.idleSleep.value = String(config.idleSleepSeconds ?? 120);
        if (el.wanderInterval) el.wanderInterval.value = String(config.wanderIntervalMs ?? 4500);
        if (el.wanderDistance) el.wanderDistance.value = String(config.wanderDistance ?? 120);
        if (el.followSpeed) el.followSpeed.value = String(config.followSpeed ?? 12);
        if (el.snapDistance) el.snapDistance.value = String(config.snapDistance ?? 48);
        el.speech.checked = Boolean(config.speechEnabled ?? true);
        el.wander.checked = Boolean(config.wander ?? true);
        el.follow.checked = Boolean(config.followMouse ?? false);
        el.top.checked = Boolean(config.alwaysOnTop ?? true);
        if (el.autoStart) el.autoStart.checked = Boolean(config.autoStart ?? false);
        if (el.clickThrough) el.clickThrough.checked = Boolean(config.clickThrough ?? false);
        if (el.syncBubble) el.syncBubble.checked = config.syncBubbleWithState !== false;
        if (el.syncWallpaper) el.syncWallpaper.checked = Boolean(config.syncWallpaperWithState ?? false);
        if (el.ambient) el.ambient.checked = config.ambientShowcase !== false;
        if (el.trim) el.trim.checked = Boolean(config.importOptions?.trimTransparent);
        if (el.chromakeyColor) {
          el.chromakeyColor.value = config.importOptions?.chromakey?.color || "";
        }
        if (el.chromakeyTolerance) {
          el.chromakeyTolerance.value = String(config.importOptions?.chromakey?.tolerance ?? 32);
        }
        if (el.rembg) el.rembg.checked = Boolean(config.importOptions?.useRembg);
        if (el.renderMode) el.renderMode.value = String(config.renderMode ?? "flipbook");
        if (el.pixelSkin) el.pixelSkin.value = String(config.pixelSkin ?? "cat");
        if (el.shimeji) el.shimeji.checked = config.shimejiMode !== false;
        if (el.bongo) el.bongo.checked = config.bongoMode !== false;
        if (el.spriteSheetStatus) {
          const sheet = config.spriteSheet;
          el.spriteSheetStatus.textContent = sheet?.imagePath
            ? `已配置精灵图：${sheet.imagePath.split(/[/\\]/).pop()}`
            : "未导入精灵图";
        }
        updateRenderModeUi();
        if (el.displayMode) el.displayMode.value = String(config.displayMode ?? "full");
        if (el.pomodoroMinutes) el.pomodoroMinutes.value = String(config.pomodoroMinutes ?? 25);
        if (el.weatherCity) el.weatherCity.value = String(config.weatherCity ?? "Beijing");
        if (el.schedule) el.schedule.checked = config.scheduleBubbles !== false;
        if (el.activity) el.activity.checked = config.activityLink !== false;
        if (el.weather) el.weather.checked = Boolean(config.weatherEnabled);
        if (el.officeBridge) el.officeBridge.checked = Boolean(config.officeBridgeEnabled);
        window.configAdvancedFill?.(config);
        fillPhrases(config.customPhrases);
        void refreshFrameGaps(config);
      }

      async function loadProfilesSelect(activeId) {
        if (!configApi.listProfiles) return;
        const data = await configApi.listProfiles();
        if (!el.profileSelect) return;
        el.profileSelect.innerHTML = "";
        for (const p of data.profiles || []) {
          const opt = document.createElement("option");
          opt.value = p.id;
          opt.textContent = p.name;
          if (p.id === (activeId || data.activeId)) opt.selected = true;
          el.profileSelect.appendChild(opt);
        }
      }

      async function loadConfigIntoForm(cfg) {
        fillForm(cfg);
        uploads.length = 0;
        const frames = cfg.frames;
        if (!frames) {
          renderList();
          return;
        }
        const flipbook = (cfg.animationMode ?? "flipbook") === "flipbook";
        const frameOrder = ["idle", "walk", "click", "happy", "drag", "eat", "sleep", "sad", "angry", "special"];
        const seen = new Set();
        const entries = [];

        if (flipbook && cfg.frames?.idle?.length >= 2) {
          for (const item of cfg.frames.idle) {
            if (!seen.has(item.path)) {
              seen.add(item.path);
              entries.push({ item, state: "idle" });
            }
          }
        } else if (flipbook) {
          for (const state of frameOrder) {
            for (const item of cfg.frames?.[state] || []) {
              if (!seen.has(item.path)) {
                seen.add(item.path);
                entries.push({ item, state: "idle" });
              }
            }
          }
        } else {
          for (const [state, list] of Object.entries(cfg.frames || {})) {
            for (const item of list || []) entries.push({ item, state });
          }
        }

        for (const { item, state } of entries) {
          let previewUrl = item.url || "";
          if (!previewUrl && configApi.getImageUrl) {
            try {
              previewUrl = await configApi.getImageUrl(item.path);
            } catch (err) {
              console.error(err);
            }
          }
          uploads.push({
            filePath: item.path,
            fileName: item.path.split(/[/\\]/).pop() || "image",
            suggestedState: state,
            confidence: "high",
            previewUrl,
            state,
          });
        }
        renderList();
        if (uploads.length) setStatus("已加载当前档案，可继续编辑");
      }

      async function addFilesFromInput(fileList) {
        const files = Array.from(fileList || []);
        if (!files.length) return setStatus("未选择任何文件");
        let added = 0;
        for (const file of files) {
          let filePath = "";
          try {
            if (typeof getPathForFile === "function") filePath = getPathForFile(file);
          } catch (err) {
            log(`getPathForFile error: ${err}`);
          }
          if (!filePath) {
            setStatus(`无法读取路径：${file.name}`);
            continue;
          }
          const { state, confidence } = classifyFileName(file.name);
          uploads.push({
            filePath,
            fileName: file.name,
            suggestedState: state,
            confidence,
            previewUrl: URL.createObjectURL(file),
            state,
          });
          added += 1;
        }
        renderList();
        setStatus(added ? `已添加 ${added} 张图片` : "没有成功添加图片");
      }

      el.fileInput.addEventListener("change", async () => {
        try {
          await addFilesFromInput(el.fileInput.files);
          el.fileInput.value = "";
        } catch (err) {
          setStatus(`选择图片失败：${err?.message || err}`);
        }
      });

      el.pick?.addEventListener("click", () => setStatus("请在弹出的窗口中选择图片…"));
      el.animationMode?.addEventListener("change", () => renderList());
      el.frameInterval?.addEventListener("change", () => stopPreview());
      el.chromakeyColor?.addEventListener("input", () => applyChromakeyPreview());
      el.chromakeyTolerance?.addEventListener("input", () => applyChromakeyPreview());

      document.getElementById("btn-export-stickers")?.addEventListener("click", async () => {
        try {
          const res = await configApi.exportStickers();
          setStatus(res.ok ? `贴纸包：${res.path}` : "导出失败");
          if (res.ok) await configApi.openExports?.();
        } catch (err) {
          setStatus(`导出失败：${err?.message || err}`);
        }
      });

      document.getElementById("btn-diary")?.addEventListener("click", async () => {
        try {
          const res = await configApi.diary();
          setStatus(res.ok ? `日记已生成：${res.path}` : "生成失败");
          if (res.ok) await configApi.openDiary?.();
        } catch (err) {
          setStatus(`日记失败：${err?.message || err}`);
        }
      });

      document.getElementById("btn-share-create")?.addEventListener("click", async () => {
        try {
          const res = await configApi.shareCreate();
          prompt("分享码（发给好友导入）", res.code);
          setStatus(`分享包：${res.zipPath}`);
        } catch (err) {
          setStatus(`创建分享码失败：${err?.message || err}`);
        }
      });

      document.getElementById("btn-share-import")?.addEventListener("click", async () => {
        const code = prompt("粘贴分享码");
        if (!code) return;
        try {
          const res = await configApi.shareImport(code.trim());
          if (res.ok) {
            await loadProfilesSelect(res.profileId);
            await loadConfigIntoForm(await configApi.getConfig());
            setStatus(`已导入分享包，档案 ID：${res.profileId || ""}`);
          } else setStatus(res.error || "导入失败");
        } catch (err) {
          setStatus(`导入失败：${err?.message || err}`);
        }
      });

      document.getElementById("btn-backup-export")?.addEventListener("click", async () => {
        const res = await configApi.backupExport();
        setStatus(res.ok ? `设置已备份：${res.path}` : "备份失败");
      });

      document.getElementById("btn-backup-import")?.addEventListener("click", async () => {
        const res = await configApi.backupImport();
        if (res.ok && res.config) {
          await loadConfigIntoForm(res.config);
          setStatus("设置已恢复");
        }
      });

      document.getElementById("btn-phrase-suggest")?.addEventListener("click", async () => {
        const name = el.petName?.value?.trim() || "小宠物";
        const sug = await configApi.phraseSuggestions(name);
        for (const [key, lines] of Object.entries(sug || {})) {
          const node = document.getElementById(`phrases-${key}`);
          if (node && lines?.length) node.value = lines.join("\n");
        }
        setStatus("已填入台词建议，可继续编辑");
      });

      el.renderMode?.addEventListener("change", () => updateRenderModeUi());

      el.pickSpriteSheet?.addEventListener("click", async () => {
        if (!configApi.pickSpriteSheet) return setStatus("请重启应用后重试");
        try {
          const picked = await configApi.pickSpriteSheet();
          if (picked.canceled) return;
          if (!picked.ok) return setStatus(picked.reason || "导入失败");
          const cur = await configApi.getConfig();
          const form = readForm();
          form.renderMode = "spritesheet";
          form.spriteSheet = picked.spriteSheet;
          const res = await configApi.save({
            config: form,
            importOptions: readImportOptions(),
          });
          if (res.ok) {
            setStatus("精灵图已导入并保存");
            if (el.spriteSheetStatus) {
              el.spriteSheetStatus.textContent = `已配置精灵图：${picked.spriteSheet.imagePath.split(/[/\\]/).pop()}`;
            }
            if (res.config) await loadConfigIntoForm(res.config);
          }
        } catch (err) {
          setStatus(`精灵图导入失败：${err?.message || err}`);
        }
      });

      updateRenderModeUi();

      el.previewToggle?.addEventListener("click", () => {
        if (previewTimer) stopPreview();
        else startPreview();
      });

      el.pickMedia?.addEventListener("click", async () => {
        if (!configApi.pickMedia) return setStatus("请重启应用后重试");
        try {
          const picked = await configApi.pickMedia();
          if (picked.canceled || !picked.paths?.[0]) return;
          setStatus("正在拆帧，请稍候…");
          const res = await configApi.extractFrames({ sourcePath: picked.paths[0], fps: 8, maxFrames: 60 });
          if (!res.ok) return setStatus(res.error || "拆帧失败");
          let added = 0;
          for (const framePath of res.frames || []) {
            uploads.push({
              filePath: framePath,
              fileName: framePath.split(/[/\\]/).pop() || "frame.png",
              suggestedState: "idle",
              confidence: "high",
              previewUrl: await configApi.getImageUrl(framePath),
              state: "idle",
            });
            added += 1;
          }
          renderList();
          setStatus(`已从媒体导入 ${added} 帧`);
        } catch (err) {
          setStatus(`拆帧失败：${err?.message || err}`);
        }
      });

      el.save?.addEventListener("click", async () => {
        if (!configApi) return setStatus("页面桥接失败，请重启应用");
        const form = readForm();
        const mode = form.renderMode || "flipbook";
        if (!uploads.length && mode === "flipbook") {
          return setStatus("连续帧模式请先选择至少一张图片，或切换到像素/精灵图模式");
        }
        if (mode === "spritesheet" && !form.spriteSheet?.imagePath) {
          const cur = await configApi.getConfig();
          if (!cur?.spriteSheet?.imagePath) {
            return setStatus("精灵图模式请先导入 PNG + JSON");
          }
          form.spriteSheet = cur.spriteSheet;
        }
        try {
          const flipbook = isFlipbookMode() && mode === "flipbook";
          const payload = {
            config: form,
            importOptions: readImportOptions(),
          };
          if (uploads.length) {
            payload.assignments = uploads.map((u, index) => ({
              sourcePath: u.filePath,
              state: flipbook ? "idle" : u.state,
              order: index,
            }));
          }
          const res = await configApi.save(payload);
          if (res.ok) {
            setStatus(`已生成宠物：${res.summary}`);
            if (res.config) await loadConfigIntoForm(res.config);
            await configApi.syncMultiPet?.();
          }
        } catch (err) {
          setStatus(`保存失败：${err?.message || err}`);
        }
      });

      el.launch?.addEventListener("click", async () => {
        try {
          const res = await configApi.launchPet();
          setStatus(res.ok ? "宠物已启动，看看桌面吧~" : res.reason || "启动失败");
        } catch (err) {
          setStatus(`启动失败：${err?.message || err}`);
        }
      });

      el.clear?.addEventListener("click", async () => {
        if (!confirm("确定清空所有已保存的宠物图片？")) return;
        try {
          await configApi.clearImages();
          uploads.length = 0;
          renderList();
          setStatus("已清空");
        } catch (err) {
          setStatus(`清空失败：${err?.message || err}`);
        }
      });

      el.profileNew?.addEventListener("click", async () => {
        const name = prompt("新宠物档案名称", "新宠物");
        if (!name) return;
        const res = await configApi.createProfile(name);
        if (res.ok) {
          await loadProfilesSelect(res.profile.id);
          await loadConfigIntoForm(await configApi.getConfig());
          setStatus(`已创建档案：${res.profile.name}`);
        }
      });

      el.profileSelect?.addEventListener("change", async () => {
        const id = el.profileSelect.value;
        const res = await configApi.switchProfile(id);
        if (res.ok && res.config) {
          await loadProfilesSelect(id);
          await loadConfigIntoForm(res.config);
          setStatus("已切换档案");
        }
      });

      el.profileExport?.addEventListener("click", async () => {
        const res = await configApi.exportProfile(el.profileSelect?.value);
        setStatus(res.ok ? `已导出：${res.path}` : "导出已取消");
      });

      el.profileImport?.addEventListener("click", async () => {
        const res = await configApi.importProfile();
        if (res.ok) {
          await loadProfilesSelect(res.profile.id);
          await loadConfigIntoForm(res.config);
          setStatus(`已导入：${res.profile.name}`);
        }
      });

      window.__configUploads = uploads;
      window.__configRenderList = renderList;
      window.applyChromakeyPreview = applyChromakeyPreview;

      el.previewImg?.addEventListener("click", (ev) => {
        if (!el.chromakeyColor) return;
        const canvas = document.createElement("canvas");
        const img = el.previewImg;
        canvas.width = img.naturalWidth;
        canvas.height = img.naturalHeight;
        const ctx = canvas.getContext("2d");
        ctx.drawImage(img, 0, 0);
        const x = Math.floor((ev.offsetX / img.clientWidth) * img.naturalWidth);
        const y = Math.floor((ev.offsetY / img.clientHeight) * img.naturalHeight);
        const p = ctx.getImageData(x, y, 1, 1).data;
        const hex = `#${[p[0], p[1], p[2]].map((v) => v.toString(16).padStart(2, "0")).join("")}`;
        el.chromakeyColor.value = hex;
        applyChromakeyPreview();
        setStatus(`已取色 ${hex}`);
      });

      if (!configApi) {
        setStatus("页面桥接失败：configApi 未加载，请完全关闭后重启");
        return;
      }

      configApi.onProfileChanged?.((cfg) => {
        void loadConfigIntoForm(cfg);
      });

      setStatus("就绪，点击「选择图片」上传素材");
      Promise.all([configApi.getConfig(), loadProfilesSelect()])
        .then(([cfg]) => loadConfigIntoForm(cfg))
        .catch((err) => setStatus(`加载配置失败：${err?.message || err}`));

      log("config page boot ok");
    } catch (err) {
      console.error(err);
      const status = document.getElementById("status");
      if (status) status.textContent = `脚本错误：${err?.message || err}`;
    }
  }

  window.addEventListener("error", (e) => {
    const status = document.getElementById("status");
    const msg = `脚本错误：${e.message}`;
    if (status) status.textContent = msg;
    if (window.appLog) window.appLog(msg);
  });

  if (document.readyState === "loading") {
    document.addEventListener("DOMContentLoaded", boot);
  } else {
    boot();
  }
})();
