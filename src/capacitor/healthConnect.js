// src/capacitor/healthConnect.js
import { registerPlugin } from '@capacitor/core';

export const HealthConnect = registerPlugin('HealthConnect');

// Safe wrapper so web/iOS don't explode & errors return sane defaults
async function safe(fn, fallback) {
  try {
    if (!fn) return fallback;
    return await fn();
  } catch {
    return fallback;
  }
}

// ---------- Capability ----------
export async function checkAvailability() {
  return safe(() => HealthConnect.checkAvailability(), { available: false });
}

export async function hasPermissions() {
  const res = await safe(() => HealthConnect.hasPermissions(), { hasAll: false });
  return !!res.hasAll;
}

export async function requestPermissions() {
  // Only open Health Connect if already missing
  const ok = await hasPermissions();
  if (ok) return { launched: false, alreadyGranted: true };
  return safe(() => HealthConnect.requestHCPermissions(), { launched: false, alreadyGranted: false });
}

// ---------- Reads ----------
export async function readTodaySteps() {
  const { steps } = await safe(() => HealthConnect.readTodaySteps(), { steps: 0 });
  return steps ?? 0;
}

export async function readTodaySleepSummary() {
  const res = await safe(() => HealthConnect.readTodaySleepSummary(), {
    sessionCount: 0,
    totalMinutes: 0,
  });
  return {
    sessionCount: res?.sessionCount ?? 0,
    totalMinutes: res?.totalMinutes ?? 0,
  };
}

export async function readTodayHeartRate() {
  const res = await safe(() => HealthConnect.readTodayHeartRate(), {
    avgBpm: 0,
    minBpm: 0,
    maxBpm: 0,
    samples: 0,
  });
  return {
    avgBpm: res?.avgBpm ?? 0,
    minBpm: res?.minBpm ?? 0,
    maxBpm: res?.maxBpm ?? 0,
    samples: res?.samples ?? 0,
  };
}

// ---------- New: 7-day sleep ----------
export async function readSleepSummary7() {
  const res = await safe(() => HealthConnect.readSleepSummary7(), { days: [] });
  return {
    today: res?.today,
    days: Array.isArray(res?.days) ? res.days : [],
  };
}

export async function getCachedSleep7() {
  const res = await safe(() => HealthConnect.getCachedSleep7(), {});
  return { days: Array.isArray(res?.days) ? res.days : [] };
}

// ---------- Native Alarms (Android) ----------
/**
 * Schedule an exact alarm on Android.
 * @param {number} hour24 - 0..23
 * @param {number} minute - 0..59
 * @param {{label?: string}} [options] - Optional label shown by the native side
 */
export async function scheduleNativeAlarm(hour24, minute, options = {}) {
  if (Capacitor.getPlatform() !== 'android') {
    throw new Error('Native alarms are Android-only');
  }
  if (!HealthConnect?.scheduleNativeAlarm) {
    throw new Error('scheduleNativeAlarm not available');
  }

  const payload = { hour: hour24, minute };
  if (options && options.label) payload.label = options.label;

  return HealthConnect.scheduleNativeAlarm(payload);
}

export async function cancelNativeAlarm() {
  if (Capacitor.getPlatform() !== 'android') return { skipped: true };
  if (!HealthConnect?.cancelNativeAlarm) return { skipped: true };
  return HealthConnect.cancelNativeAlarm();
}
