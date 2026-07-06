(function () {
  function bootAdvanced() {
    const api = window.configApi;
    if (!api) return;

    const el = {
      loopStart: document.getElementById("flipbook-loop-start"),
      loopEnd: document.getElementById("flipbook-loop-end"),
      clickOnce: document.getElementById("toggle-click-once"),
      edgeMargin: document.getElementById("edge-margin"),
      frameCache: document.getElementById("frame-cache-max"),
      bubbleStyle: document.getElementById("bubble-style"),
      sound: document.getElementById("toggle-sound"),
      soundVol: document.getElementById("sound-volume"),
      randomEv: document.getElementById("toggle-random-events"),
      throwEv: document.getElementById("toggle-throw"),
      petBump: document.getElementById("toggle-pet-bump"),
      sceneHide: document.getElementById("toggle-scene-hide"),
      sceneShrink: document.getElementById("toggle-scene-shrink"),
      reminders: document.getElementById("toggle-reminders"),
      reminderMin: document.getElementById("reminder-interval"),
      lmStudio: document.getElementById("toggle-lmstudio"),
      lmUrl: document.getElementById("lmstudio-url"),
      lmMin: document.getElementById("lmstudio-interval"),
      officeWrite: document.getElementById("toggle-office-write"),
      plugins: document.getElementById("toggle-plugins"),
      autoUpdate: document.getElementById("toggle-auto-update"),
      multiSelect: document.getElementById("multi-pet-select"),
      timeline: document.getElementById("timeline-bar"),
      chromaPick: document.getElementById("btn-chroma-pick"),
      status: document.getElementById("status"),
    };

    function setStatus(t) {
      if (el.status) el.status.textContent = t;
    }

    window.configAdvancedRead = function configAdvancedRead(base) {
      const multi = [];
      el.multiSelect?.querySelectorAll("input:checked").forEach((n) => multi.push(n.value));
      return {
        ...base,
        flipbookLoopStart: Number(el.loopStart?.value) || 0,
        flipbookLoopEnd: Number.isFinite(Number(el.loopEnd?.value))
          ? Number(el.loopEnd.value)
          : -1,
        clickOnceRevert: el.clickOnce?.checked !== false,
        edgeMargin: Number(el.edgeMargin?.value) || 12,
        frameCacheMax: Number(el.frameCache?.value) || 120,
        bubbleStyle: el.bubbleStyle?.value || "round",
        soundEnabled: el.sound?.checked !== false,
        soundVolume: Number(el.soundVol?.value) || 0.35,
        randomEventsEnabled: el.randomEv?.checked !== false,
        throwInteractionEnabled: el.throwEv?.checked !== false,
        petInteractEnabled: el.petBump?.checked !== false,
        sceneAutoHide: Boolean(el.sceneHide?.checked),
        sceneAutoShrink: el.sceneShrink?.checked !== false,
        remindersEnabled: Boolean(el.reminders?.checked),
        reminderIntervalMin: Number(el.reminderMin?.value) || 45,
        lmStudioEnabled: Boolean(el.lmStudio?.checked),
        lmStudioBaseUrl: el.lmUrl?.value?.trim() || "http://127.0.0.1:1234",
        lmStudioIntervalMin: Number(el.lmMin?.value) || 60,
        officeBridgeWriteEnabled: el.officeWrite?.checked !== false,
        pluginsEnabled: el.plugins?.checked !== false,
        autoUpdateCheck: el.autoUpdate?.checked !== false,
        multiPetProfileIds: multi.slice(0, 2),
      };
    };

    window.configAdvancedFill = function configAdvancedFill(cfg) {
      if (el.loopStart) el.loopStart.value = String(cfg.flipbookLoopStart ?? 0);
      if (el.loopEnd) el.loopEnd.value = String(cfg.flipbookLoopEnd ?? -1);
      if (el.clickOnce) el.clickOnce.checked = cfg.clickOnceRevert !== false;
      if (el.edgeMargin) el.edgeMargin.value = String(cfg.edgeMargin ?? 12);
      if (el.frameCache) el.frameCache.value = String(cfg.frameCacheMax ?? 120);
      if (el.bubbleStyle) el.bubbleStyle.value = cfg.bubbleStyle || "round";
      if (el.sound) el.sound.checked = cfg.soundEnabled !== false;
      if (el.soundVol) el.soundVol.value = String(cfg.soundVolume ?? 0.35);
      if (el.randomEv) el.randomEv.checked = cfg.randomEventsEnabled !== false;
      if (el.throwEv) el.throwEv.checked = cfg.throwInteractionEnabled !== false;
      if (el.petBump) el.petBump.checked = cfg.petInteractEnabled !== false;
      if (el.sceneHide) el.sceneHide.checked = Boolean(cfg.sceneAutoHide);
      if (el.sceneShrink) el.sceneShrink.checked = cfg.sceneAutoShrink !== false;
      if (el.reminders) el.reminders.checked = Boolean(cfg.remindersEnabled);
      if (el.reminderMin) el.reminderMin.value = String(cfg.reminderIntervalMin ?? 45);
      if (el.lmStudio) el.lmStudio.checked = Boolean(cfg.lmStudioEnabled);
      if (el.lmUrl) el.lmUrl.value = cfg.lmStudioBaseUrl || "http://127.0.0.1:1234";
      if (el.lmMin) el.lmMin.value = String(cfg.lmStudioIntervalMin ?? 60);
      if (el.officeWrite) el.officeWrite.checked = cfg.officeBridgeWriteEnabled !== false;
      if (el.plugins) el.plugins.checked = cfg.pluginsEnabled !== false;
      if (el.autoUpdate) el.autoUpdate.checked = cfg.autoUpdateCheck !== false;
      void fillMultiSelect(cfg.multiPetProfileIds || []);
    };

    async function fillMultiSelect(selected) {
      if (!el.multiSelect || !api.listProfiles) return;
      const data = await api.listProfiles();
      const active = data.activeId;
      el.multiSelect.innerHTML = "";
      for (const p of data.profiles || []) {
        if (p.id === active) continue;
        const label = document.createElement("label");
        label.className = "multi-pet-opt";
        label.innerHTML = `<input type="checkbox" value="${p.id}" ${selected.includes(p.id) ? "checked" : ""}/> ${p.name}`;
        el.multiSelect.appendChild(label);
      }
    }

    window.renderTimeline = function renderTimeline(uploads) {
      if (!el.timeline) return;
      if (!uploads?.length) {
        el.timeline.innerHTML = "<span class='muted'>上传图片后显示时间轴</span>";
        return;
      }
      el.timeline.innerHTML = uploads
        .map(
          (u, i) =>
            `<button type="button" class="tl-frame" data-i="${i}" title="${u.fileName}">${i + 1}</button>`
        )
        .join("");
      el.timeline.querySelectorAll(".tl-frame").forEach((btn) => {
        btn.addEventListener("click", () => {
          const idx = Number(btn.dataset.i);
          const preview = document.getElementById("preview-img");
          const row = uploads[idx];
          if (preview && row?.previewUrl) {
            preview.src = row.previewUrl;
            preview.onload = () => window.applyChromakeyPreview?.();
          }
        });
      });
    };

    document.getElementById("btn-export-gif")?.addEventListener("click", async () => {
      const res = await api.exportGif();
      setStatus(res.ok ? `GIF：${res.path}` : "导出失败");
      if (res.ok) await api.openExports?.();
    });

    document.getElementById("btn-export-webp")?.addEventListener("click", async () => {
      const res = await api.exportWebp();
      setStatus(res.ok ? `WebP：${res.path}` : "导出失败");
      if (res.ok) await api.openExports?.();
    });

    document.getElementById("btn-weekly-diary")?.addEventListener("click", async () => {
      const res = await api.diary(true);
      setStatus(res.ok ? `周报：${res.path}` : "失败");
      if (res.ok) await api.openDiary?.();
    });

    document.getElementById("btn-stats")?.addEventListener("click", () => api.openStatsWindow?.());
    document.getElementById("btn-batch-rename")?.addEventListener("click", async () => {
      const uploads = window.__configUploads;
      if (!uploads?.length) return setStatus("请先上传图片");
      const mode = document.getElementById("animation-mode")?.value || "flipbook";
      const plan = await api.batchRename({
        files: uploads.map((u) => ({ fileName: u.fileName, state: u.state })),
        mode,
      });
      plan.forEach((row, i) => {
        uploads[i].fileName = row.to;
        uploads[i].suggestedName = row.to;
      });
      window.__configRenderList?.();
      setStatus(`已生成 ${plan.length} 个建议文件名（保存时仍用原路径导入）`);
    });

    document.getElementById("btn-bundled-packs")?.addEventListener("click", async () => {
      const packs = await api.bundledPacks();
      if (!packs?.length) return setStatus("无内置素材包");
      const names = packs.map((p, i) => `${i + 1}. ${p.name}`).join("\n");
      const pick = prompt(`选择素材包序号：\n${names}`, "1");
      const idx = Number(pick) - 1;
      if (idx < 0 || !packs[idx]) return;
      const res = await api.importBundled(packs[idx].id);
      if (res.ok) {
        setStatus(`已导入：${packs[idx].name}`);
        location.reload();
      } else setStatus(res.reason || "导入失败");
    });

    document.getElementById("btn-plugins-dir")?.addEventListener("click", () => api.openPluginsDir?.());

    el.chromaPick?.addEventListener("click", () => {
      setStatus("色度键：在预览图上点击可取色（开发中简化为手动输入 #RRGGBB）");
    });

    const origFill = window.configAdvancedFill;
    window.configAdvancedFill = (cfg) => origFill(cfg);
  }

  if (document.readyState === "loading") {
    document.addEventListener("DOMContentLoaded", bootAdvanced);
  } else {
    bootAdvanced();
  }
})();
