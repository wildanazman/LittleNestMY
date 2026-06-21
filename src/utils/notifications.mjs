const PREFIX = "littlenest:notif";
const PREFS = {
  feeding: `${PREFIX}:feeding`,
  medicine: `${PREFIX}:medicine`,
  appointment: `${PREFIX}:appointment`,
  vaccine: `${PREFIX}:vaccine`
};
const PENDING_KEY = `${PREFIX}:pending`;
let timers = {};

export function getNotifPrefs() {
  const r = {};
  for (const [k, v] of Object.entries(PREFS)) r[k] = localStorage.getItem(v) === "true";
  return r;
}

export function setNotifPrefs(prefs) {
  for (const [k, v] of Object.entries(PREFS)) localStorage.setItem(v, String(Boolean(prefs[k])));
  const anyOn = Object.values(getNotifPrefs()).some(Boolean);
  if (!anyOn) clearAll();
}

export async function requestNotifPermission() {
  if (!("Notification" in window)) return "denied";
  if (Notification.permission === "granted") return "granted";
  if (Notification.permission === "denied") return "denied";
  const result = await Notification.requestPermission();
  return result;
}

export function showNotif(title, body) {
  if (!("Notification" in window) || Notification.permission !== "granted") return;
  if (document.visibilityState === "visible") return;
  try {
    const n = new Notification(title, { body, icon: "/icons/icon-192.png", badge: "/icons/icon-192.png", tag: "littlenest" });
    n.onclick = () => { window.focus(); n.close(); };
    setTimeout(() => n.close(), 8000);
  } catch { }
  persistFiredReminder(title, body);
}

export function scheduleAllReminders({ feedingLogs, calendarEvents, reminders, babyName }) {
  clearAll();
  const prefs = getNotifPrefs();
  restorePendingReminders(babyName);
  if (prefs.feeding) scheduleFeedingReminder(feedingLogs, babyName);
  if (prefs.medicine) scheduleMedicineReminder(calendarEvents, reminders, babyName);
  if (prefs.appointment) scheduleAppointmentReminder(calendarEvents, reminders, babyName);
  if (prefs.vaccine) scheduleVaccineReminder(calendarEvents, reminders, babyName);
}

function scheduleFeedingReminder(logs, name) {
  if (!logs?.length) return;
  const todayStart = new Date(); todayStart.setHours(0, 0, 0, 0);
  const todayLogs = logs.filter((l) => new Date(l.startedAt) >= todayStart);
  if (!todayLogs.length) return;
  const last = todayLogs.sort((a, b) => new Date(b.startedAt) - new Date(a.startedAt))[0];
  const next = new Date(last.startedAt).getTime() + 3 * 3600000;
  const delay = next - Date.now();
  if (delay <= 0) return;
  timers.feeding = setTimeout(() => {
    showNotif("Feeding time?", `${name || "Baby"} hasn't been fed in 3 hours.`);
    persistPendingReminder("feeding", Date.now() + 3 * 3600000, name);
  }, delay);
}

function scheduleMedicineReminder(events, reminders, name) {
  const items = [...(events || []), ...(reminders || [])];
  const now = Date.now();
  const nearest = findNearest(items, now, "medicine");
  if (!nearest) return;
  const delay = nearest.time - now - 30 * 60000;
  if (delay <= 0) return;
  timers.medicine = setTimeout(() => {
    showNotif("Medicine reminder", `${name || "Baby"} has "${nearest.title}" in about 30 minutes.`);
  }, delay);
}

function scheduleAppointmentReminder(events, reminders, name) {
  const items = [...(events || []), ...(reminders || [])];
  const now = Date.now();
  const tomorrow = now + 24 * 3600000;
  const nearest = findNearest(items, now, "appointment");
  if (!nearest) return;
  const delay = nearest.time - now;
  if (delay <= 0 || delay > tomorrow) return;
  timers.appointment = setTimeout(() => {
    showNotif("Upcoming appointment", `${name || "Baby"} has "${nearest.title}" tomorrow.`);
  }, delay);
}

function scheduleVaccineReminder(events, reminders, name) {
  const items = [...(events || []), ...(reminders || [])];
  const now = Date.now();
  const week = now + 7 * 24 * 3600000;
  const nearest = findNearest(items, now, "vaccine");
  if (!nearest) return;
  const delay = nearest.time - now - 24 * 3600000;
  if (delay <= 0 || nearest.time > week) return;
  timers.vaccine = setTimeout(() => {
    showNotif("Vaccine due", `${name || "Baby"} has a vaccine "${nearest.title}" tomorrow.`);
  }, delay);
}

function findNearest(items, after, type) {
  let best = null;
  for (const item of items) {
    const t = new Date(item.startsAt || item.dueDate || item.measuredAt || item.date).getTime();
    if (isNaN(t) || t <= after) continue;
    const title = item.title || item.type || item.medicineName || "Reminder";
    if (type && item.type !== type && item.category !== type) continue;
    if (!best || t < best.time) best = { time: t, title };
  }
  return best;
}

function persistPendingReminder(type, time, babyName) {
  try {
    const existing = JSON.parse(localStorage.getItem(PENDING_KEY) || "[]");
    existing.push({ type, time, babyName, createdAt: Date.now() });
    localStorage.setItem(PENDING_KEY, JSON.stringify(existing.slice(-20)));
  } catch { }
}

function persistFiredReminder(title, body) {
  try {
    const existing = JSON.parse(localStorage.getItem(`${PREFIX}:history`) || "[]");
    existing.unshift({ title, body, at: new Date().toISOString() });
    localStorage.setItem(`${PREFIX}:history`, JSON.stringify(existing.slice(0)));
  } catch { }
}

function restorePendingReminders(babyName) {
  try {
    const pending = JSON.parse(localStorage.getItem(PENDING_KEY) || "[]");
    if (!pending.length) return;
    const now = Date.now();
    const prefs = getNotifPrefs();
    for (const p of pending) {
      if (!prefs[p.type]) continue;
      const delay = p.time - now;
      if (delay <= 0) continue;
      timers[p.type] = setTimeout(() => {
        showNotif("Reminder", `${babyName || "Baby"} — reminder from earlier.`);
      }, delay);
    }
    localStorage.removeItem(PENDING_KEY);
  } catch { }
}

export function clearAll() {
  for (const k of Object.keys(timers)) { clearTimeout(timers[k]); delete timers[k]; }
}
