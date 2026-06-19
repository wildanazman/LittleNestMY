const NOTIF_PREFIX = "littlenest:notif";
const FEEDING_KEY = `${NOTIF_PREFIX}:feeding`;
const APPOINTMENT_KEY = `${NOTIF_PREFIX}:appointment`;
const PERMISSION_KEY = `${NOTIF_PREFIX}:permissionAsked`;
let feedingTimer = null;
let appointmentTimer = null;

export function getNotifPrefs() {
  const feeding = window.localStorage.getItem(FEEDING_KEY) === "true";
  const appointment = window.localStorage.getItem(APPOINTMENT_KEY) === "true";
  return { feeding, appointment };
}

export function setNotifPrefs(feeding, appointment) {
  window.localStorage.setItem(FEEDING_KEY, String(feeding));
  window.localStorage.setItem(APPOINTMENT_KEY, String(appointment));
  if (!feeding && !appointment) clearAll();
}

export async function requestNotifPermission() {
  if (!("Notification" in window)) return "denied";
  if (Notification.permission === "granted") return "granted";
  if (Notification.permission === "denied") return "denied";
  window.localStorage.setItem(PERMISSION_KEY, "true");
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
  } catch { /* silent */ }
}

export function scheduleFeedingReminder(allFeedingLogs, babyName) {
  clearInterval(feedingTimer);
  const prefs = getNotifPrefs();
  if (!prefs.feeding) return;
  if (!allFeedingLogs?.length) return;
  const todayStart = new Date(); todayStart.setHours(0, 0, 0, 0);
  const todayLogs = allFeedingLogs.filter((l) => new Date(l.startedAt) >= todayStart);
  if (!todayLogs.length) return;
  const sorted = [...todayLogs].sort((a, b) => new Date(b.startedAt) - new Date(a.startedAt));
  const last = sorted[0];
  if (!last) return;
  const lastTime = new Date(last.startedAt).getTime();
  const intervalMs = 3 * 60 * 60 * 1000;
  const nextTime = lastTime + intervalMs;
  const delay = nextTime - Date.now();
  if (delay <= 0) return;
  feedingTimer = setTimeout(() => {
    showNotif("Feeding time?", `${babyName || "Baby"} hasn't been fed in 3 hours.`);
    scheduleFeedingReminder(allFeedingLogs, babyName);
  }, delay);
}

export function scheduleAppointmentReminder(allCalendarEvents, allReminders, babyName) {
  clearInterval(appointmentTimer);
  const prefs = getNotifPrefs();
  if (!prefs.appointment) return;
  const now = Date.now();
  const tomorrow = now + 24 * 60 * 60 * 1000;
  const allItems = [...(allCalendarEvents || []), ...(allReminders || [])];
  let nearest = null;
  for (const item of allItems) {
    const t = new Date(item.startsAt || item.dueDate || item.measuredAt).getTime();
    if (t > now && t <= tomorrow + 24 * 60 * 60 * 1000) {
      if (!nearest || t < nearest.time) nearest = { time: t, title: item.title || item.type || "Reminder" };
    }
  }
  if (!nearest) return;
  const delay = nearest.time - now;
  if (delay <= 0) return;
  appointmentTimer = setTimeout(() => {
    showNotif("Upcoming appointment", `${babyName || "Baby"} has "${nearest.title}" tomorrow.`);
    scheduleAppointmentReminder(allCalendarEvents, allReminders, babyName);
  }, delay);
}

export function clearAll() {
  clearInterval(feedingTimer);
  clearInterval(appointmentTimer);
  feedingTimer = null;
  appointmentTimer = null;
}
