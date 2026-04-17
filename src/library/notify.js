// src/lib/notify.js
export const isNative = () => {
  try { return window.Capacitor?.getPlatform?.() !== 'web'; } catch { return false; }
};

export const toLocalDateTime = (hour12, minute, amPm) => {
  let h = parseInt(hour12, 10) % 12; if (amPm === 'PM') h += 12;
  const now = new Date();
  const t = new Date(now.getFullYear(), now.getMonth(), now.getDate(), h, parseInt(minute,10), 0, 0);
  if (t.getTime() <= Date.now()) t.setDate(t.getDate() + 1); // if time already passed → tomorrow
  return t;
};

export const format12h = (d) => {
  const h24 = d.getHours();
  const m = d.getMinutes();
  const ampm = h24 >= 12 ? 'PM' : 'AM';
  const h12 = (h24 % 12) || 12;
  return `${String(h12)}:${String(m).padStart(2,'0')} ${ampm}`;
};

export const STORAGE_ALARMS = 'alarms_v1';
export const getAlarms = () => {
  try { return JSON.parse(localStorage.getItem(STORAGE_ALARMS) ?? '[]'); } catch { return []; }
};
export const setAlarms = (arr) => localStorage.setItem(STORAGE_ALARMS, JSON.stringify(arr));
