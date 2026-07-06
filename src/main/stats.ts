import { DailyStats, LifetimeStats, PetConfig, WeeklyStatEntry } from "./types";

export function defaultLifetimeStats(): LifetimeStats {
  return {
    totalInteracts: 0,
    daysActive: 0,
    firstRunDate: new Date().toISOString().slice(0, 10),
    actionCounts: {},
  };
}

export function bumpLifetimeStats(
  config: PetConfig,
  action = "interact"
): { daily: DailyStats; lifetime: LifetimeStats; weekly: WeeklyStatEntry[] } {
  const today = new Date().toISOString().slice(0, 10);
  if (!config.dailyStats || config.dailyStats.date !== today) {
    config.dailyStats = { date: today, interactCount: 0 };
  }
  config.dailyStats.interactCount += 1;

  if (!config.lifetimeStats) config.lifetimeStats = defaultLifetimeStats();
  if (!config.lifetimeStats.firstRunDate) {
    config.lifetimeStats.firstRunDate = today;
  }
  config.lifetimeStats.totalInteracts += 1;
  config.lifetimeStats.actionCounts[action] = (config.lifetimeStats.actionCounts[action] || 0) + 1;

  if (!config.weeklyStats) config.weeklyStats = [];
  let weekEntry = config.weeklyStats.find((w) => w.date === today);
  if (!weekEntry) {
    weekEntry = { date: today, interactCount: 0 };
    config.weeklyStats.push(weekEntry);
  }
  weekEntry.interactCount += 1;
  config.weeklyStats = config.weeklyStats
    .sort((a, b) => a.date.localeCompare(b.date))
    .slice(-14);

  const first = config.lifetimeStats.firstRunDate || today;
  const days = Math.max(1, Math.ceil((Date.now() - new Date(first).getTime()) / 86400000));
  config.lifetimeStats.daysActive = days;

  return {
    daily: config.dailyStats,
    lifetime: config.lifetimeStats,
    weekly: config.weeklyStats,
  };
}

export function statsSummary(config: PetConfig) {
  const ls = config.lifetimeStats || defaultLifetimeStats();
  const week = (config.weeklyStats || []).slice(-7);
  const weekTotal = week.reduce((n, w) => n + w.interactCount, 0);
  return {
    today: config.dailyStats?.interactCount ?? 0,
    weekTotal,
    totalInteracts: ls.totalInteracts,
    daysActive: ls.daysActive,
    topActions: Object.entries(ls.actionCounts)
      .sort((a, b) => b[1] - a[1])
      .slice(0, 5)
      .map(([action, count]) => ({ action, count })),
    unlockedTiers: config.unlockedTiers || [],
  };
}
