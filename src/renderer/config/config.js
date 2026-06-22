(function () {
  const log = (msg) => {
    console.log(msg);
    if (window.appLog) window.appLog(msg);
  };

  function boot() {
    try {
      const configApi = window.configApi;
      const getPathForFile = window.getPathForFile;

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
      ];

      const uploads = [];

      const el = {
        pick: document.getElementById("btn-pick"),
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
        speech: document.getElementById("toggle-speech"),
        wander: document.getElementById("toggle-wander"),
        follow: document.getElementById("toggle-follow"),
        top: document.getElementById("toggle-top"),
        fileInput: document.getElementById("file-input"),
      };

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

      function renderList() {
        if (!uploads.length) {
          el.list.className = "upload-list empty";
          el.list.innerHTML =
            '<div class="empty-tip">还没有图片，点击上方「选择图片」开始</div>';
          el.summary.textContent = "";
          return;
        }

        el.list.className = "upload-list";
        el.list.innerHTML = "";

        const flipbook = isFlipbookMode();
        if (flipbook) {
          el.summary.textContent = `· 连续帧 × ${uploads.length}（按上传顺序循环播放）`;
        } else {
          const counts = {};
          for (const row of uploads) {
            counts[row.state] = (counts[row.state] || 0) + 1;
          }
          el.summary.textContent =
            "· " +
            Object.entries(counts)
              .map(([k, n]) => `${STATES.find((s) => s.value === k)?.label ?? k}×${n}`)
              .join(" · ");
        }

        uploads.forEach((row, index) => {
          const card = document.createElement("div");
          card.className = "upload-item";
          const badgeClass = flipbook ? "high" : row.confidence === "high" ? "high" : "low";
          const badgeText = flipbook
            ? `第 ${index + 1} 帧`
            : row.confidence === "high"
              ? "自动识别"
              : "待确认";
          const stateSelect = flipbook
            ? `<div class="frame-order">顺序 ${index + 1}</div>`
            : `<select data-index="${index}">${STATES.map(
                (s) =>
                  `<option value="${s.value}" ${s.value === row.state ? "selected" : ""}>${s.label}</option>`
              ).join("")}</select>`;
          card.innerHTML = `
            <img src="${row.previewUrl}" alt="${row.fileName}" />
            <div class="upload-meta">
              <span class="badge ${badgeClass}">${badgeText}</span>
              <div class="name" title="${row.fileName}">${row.fileName}</div>
              ${stateSelect}
            </div>
          `;
          el.list.appendChild(card);
        });

        if (!flipbook) {
          el.list.querySelectorAll("select").forEach((select) => {
            select.addEventListener("change", (e) => {
              const target = e.target;
              const idx = Number(target.dataset.index);
              uploads[idx].state = target.value;
              renderList();
            });
          });
        }
      }

      function readForm() {
        return {
          petName: el.petName.value.trim() || "小宠物",
          cssEffect: el.cssEffect.value,
          animationMode: el.animationMode?.value || "flipbook",
          frameIntervalMs: Number(el.frameInterval.value) || 180,
          idleSleepSeconds: Number(el.idleSleep.value) || 120,
          speechEnabled: el.speech.checked,
          wander: el.wander.checked,
          followMouse: el.follow.checked,
          alwaysOnTop: el.top.checked,
        };
      }

      function fillForm(config) {
        el.petName.value = String(config.petName ?? "小宠物");
        el.cssEffect.value = String(config.cssEffect ?? "breathe");
        if (el.animationMode) {
          el.animationMode.value = String(config.animationMode ?? "flipbook");
        }
        el.frameInterval.value = String(config.frameIntervalMs ?? 180);
        el.idleSleep.value = String(config.idleSleepSeconds ?? 120);
        el.speech.checked = Boolean(config.speechEnabled ?? true);
        el.wander.checked = Boolean(config.wander ?? true);
        el.follow.checked = Boolean(config.followMouse ?? false);
        el.top.checked = Boolean(config.alwaysOnTop ?? true);
      }

      async function addFilesFromInput(fileList) {
        const files = Array.from(fileList || []);
        if (!files.length) {
          setStatus("未选择任何文件");
          return;
        }

        let added = 0;
        for (const file of files) {
          let filePath = "";
          try {
            if (typeof getPathForFile === "function") {
              filePath = getPathForFile(file);
            }
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
        log("file-input change event");
        try {
          await addFilesFromInput(el.fileInput.files);
          el.fileInput.value = "";
        } catch (err) {
          setStatus(`选择图片失败：${err?.message || err}`);
        }
      });

      if (el.pick) {
        el.pick.addEventListener("click", () => {
          log("pick label clicked");
          setStatus("请在弹出的窗口中选择图片…");
        });
      }

      el.animationMode?.addEventListener("change", () => renderList());

      el.save?.addEventListener("click", async () => {
        if (!configApi) return setStatus("页面桥接失败，请重启应用");
        if (!uploads.length) return setStatus("请先选择至少一张图片");
        try {
          const flipbook = isFlipbookMode();
          const res = await configApi.save({
            config: readForm(),
            assignments: uploads.map((u, index) => ({
              sourcePath: u.filePath,
              state: flipbook ? "idle" : u.state,
              order: index,
            })),
          });
          if (res.ok) {
            uploads.length = 0;
            renderList();
            setStatus(`已生成宠物：${res.summary}`);
          }
        } catch (err) {
          setStatus(`保存失败：${err?.message || err}`);
        }
      });

      el.launch?.addEventListener("click", async () => {
        if (!configApi) return setStatus("页面桥接失败，请重启应用");
        try {
          const res = await configApi.launchPet();
          setStatus(res.ok ? "宠物已启动，看看桌面吧~" : res.reason || "启动失败");
        } catch (err) {
          setStatus(`启动失败：${err?.message || err}`);
        }
      });

      el.clear?.addEventListener("click", async () => {
        if (!configApi) return setStatus("页面桥接失败，请重启应用");
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

      if (!configApi) {
        setStatus("页面桥接失败：configApi 未加载，请完全关闭后重启");
        return;
      }

      setStatus("就绪，点击「选择图片」上传素材");
      configApi
        .getConfig()
        .then(async (cfg) => {
          fillForm(cfg);
          const frames = cfg.frames;
          if (!frames) return;
          const flipbook = (cfg.animationMode ?? "flipbook") === "flipbook";
          const frameOrder = [
            "idle",
            "walk",
            "click",
            "happy",
            "drag",
            "eat",
            "sleep",
            "sad",
            "angry",
          ];
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
              for (const item of list || []) {
                entries.push({ item, state });
              }
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
              state: state,
            });
          }
          renderList();
          if (uploads.length) setStatus("已加载当前宠物配置，可继续编辑");
        })
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
