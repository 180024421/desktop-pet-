import fs from "fs";
import path from "path";
import os from "os";
import sharp from "sharp";
import { PetConfig } from "./types";
import { primaryIdleFrames } from "./types";
import { readOfficeBuddyStats } from "./office-bridge";

export function diaryDir(): string {
  return path.join(os.homedir(), "Documents", "desktop-pet", "diary");
}

function escapeXml(s: string): string {
  return s.replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;");
}

function weekBarSvg(weekly: Array<{ date: string; interactCount: number }>, w: number): string {
  const max = Math.max(1, ...weekly.map((x) => x.interactCount));
  const barW = Math.floor((w - 120) / Math.max(weekly.length, 1));
  let svg = `<svg width="${w}" height="120">`;
  weekly.forEach((entry, i) => {
    const h = Math.round((entry.interactCount / max) * 80);
    const x = 60 + i * barW;
    const y = 100 - h;
    svg += `<rect x="${x}" y="${y}" width="${barW - 6}" height="${h}" rx="4" fill="#f472b6"/>`;
    svg += `<text x="${x + (barW - 6) / 2}" y="115" text-anchor="middle" font-size="10" fill="#64748b">${entry.date.slice(5)}</text>`;
  });
  svg += "</svg>";
  return svg;
}

export async function renderDiaryCard(config: PetConfig, weekly = false): Promise<string> {
  const dir = diaryDir();
  fs.mkdirSync(dir, { recursive: true });
  const date = new Date().toISOString().slice(0, 10);
  const suffix = weekly ? "weekly" : date;
  const outPath = path.join(dir, `${config.petName || "pet"}-${suffix}.png`);

  const w = 1080;
  const h = weekly ? 1500 : 1350;
  const stats = config.dailyStats?.date === date ? config.dailyStats : { date, interactCount: 0 };
  const office = readOfficeBuddyStats();
  const weekData = (config.weeklyStats || []).slice(-7);
  const weekTotal = weekData.reduce((n, x) => n + x.interactCount, 0);
  const ls = config.lifetimeStats;

  const gradient = Buffer.from(
    `<svg width="${w}" height="${h}"><defs><linearGradient id="g" x1="0" y1="0" x2="1" y2="1"><stop offset="0%" stop-color="#fdf2f8"/><stop offset="100%" stop-color="#e0e7ff"/></linearGradient></defs><rect width="100%" height="100%" fill="url(#g)"/></svg>`
  );

  const composites: sharp.OverlayOptions[] = [{ input: gradient, top: 0, left: 0 }];

  const idle = primaryIdleFrames(config.frames)[0];
  if (idle && fs.existsSync(idle)) {
    const petBuf = await sharp(idle).resize(480, 480, { fit: "inside" }).png().toBuffer();
    composites.push({ input: petBuf, top: 240, left: Math.round((w - 480) / 2) });
  }

  const title = weekly
    ? `「${config.petName}」周报 · ${date}`
    : `「${config.petName}」的日记 · ${date}`;

  const lines = [
    title,
    `好感度 ${config.affection}/100 · 解锁档位 ${(config.unlockedTiers || []).join("/") || "无"}`,
    `今日互动 ${stats.interactCount} 次 · 本周 ${weekTotal} 次`,
    `累计互动 ${ls?.totalInteracts ?? 0} · 陪伴 ${ls?.daysActive ?? 1} 天`,
  ];
  if (office) {
    lines.push(`Office：敲键 ${office.keystrokesToday} · 摸鱼 ${office.slackMinutes} 分钟`);
  }
  lines.push(config.affection >= 80 ? "今天也超喜欢你~" : "继续陪我玩嘛");

  let svgText = `<svg width="${w}" height="${h}">`;
  lines.forEach((line, i) => {
    const y = 820 + i * 48;
    const size = i === 0 ? 40 : 28;
    const weight = i === 0 ? "700" : "500";
    svgText += `<text x="60" y="${y}" font-family="Microsoft YaHei, sans-serif" font-size="${size}" font-weight="${weight}" fill="#334155">${escapeXml(line)}</text>`;
  });
  svgText += "</svg>";
  composites.push({ input: Buffer.from(svgText), top: 0, left: 0 });

  if (weekly && weekData.length) {
    composites.push({
      input: Buffer.from(weekBarSvg(weekData, w)),
      top: 1120,
      left: 0,
    });
  }

  await sharp({ create: { width: w, height: h, channels: 4, background: { r: 255, g: 255, b: 255, alpha: 1 } } })
    .composite(composites)
    .png()
    .toFile(outPath);

  return outPath;
}
