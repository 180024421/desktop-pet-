import { powerMonitor } from "electron";

let pollTimer: ReturnType<typeof setInterval> | null = null;
let lastIdle = 999;
let activityLevel = 0;

export function getSystemIdleSec(): number {
  try {
    return powerMonitor.getSystemIdleTime();
  } catch {
    return 0;
  }
}

export function getActivityLevel(): number {
  return activityLevel;
}

export function startActivityPoll(onChange?: (level: number) => void): void {
  if (pollTimer) return;
  pollTimer = setInterval(() => {
    const idle = getSystemIdleSec();
    if (idle < 3) activityLevel = Math.min(100, activityLevel + 12);
    else if (idle > 60) activityLevel = Math.max(0, activityLevel - 8);
    else activityLevel = Math.max(0, activityLevel - 2);
    if (idle < 3 && lastIdle >= 30) activityLevel = Math.min(100, activityLevel + 20);
    lastIdle = idle;
    onChange?.(activityLevel);
  }, 2000);
}

export function stopActivityPoll(): void {
  if (pollTimer) clearInterval(pollTimer);
  pollTimer = null;
}
