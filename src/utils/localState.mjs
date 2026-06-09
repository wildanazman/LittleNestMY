const feedingLogsKey = "littlenest:feedingLogs";
const sleepLogsKey = "littlenest:sleepLogs";
const activeSleepKey = "littlenest:activeSleep";
const diaperLogsKey = "littlenest:diaperLogs";
const healthNotesKey = "littlenest:healthNotes";
const milestonesKey = "littlenest:milestones";
const calendarEventsKey = "littlenest:calendarEvents";

export function getLocalFeedingLogs() {
  return readJson(feedingLogsKey, []);
}

export function getPersistedFeedingLogs(fallback = []) {
  return readCollectionWithFallback(feedingLogsKey, fallback);
}

export function saveLocalFeedingLog(log) {
  const logs = getLocalFeedingLogs();
  const nextLogs = [log, ...logs.filter((item) => item.id !== log.id)];
  writeJson(feedingLogsKey, nextLogs);
  return nextLogs;
}

export function getLocalSleepLogs() {
  return readJson(sleepLogsKey, []);
}

export function getPersistedSleepLogs(fallback = []) {
  return readCollectionWithFallback(sleepLogsKey, fallback);
}

export function saveLocalSleepLog(log) {
  const logs = getLocalSleepLogs();
  const nextLogs = [log, ...logs.filter((item) => item.id !== log.id)];
  writeJson(sleepLogsKey, nextLogs);
  return nextLogs;
}

export function getActiveSleepSession() {
  return readJson(activeSleepKey, null);
}

export function saveActiveSleepSession(session) {
  writeJson(activeSleepKey, session);
  return session;
}

export function clearActiveSleepSession() {
  try {
    window.localStorage.removeItem(activeSleepKey);
  } catch {
    // Local storage can be unavailable in private or restricted contexts.
  }
}

export function getLocalDiaperLogs() {
  return readJson(diaperLogsKey, []);
}

export function getPersistedDiaperLogs(fallback = []) {
  return readCollectionWithFallback(diaperLogsKey, fallback);
}

export function saveLocalDiaperLog(log) {
  const logs = getLocalDiaperLogs();
  const nextLogs = [log, ...logs.filter((item) => item.id !== log.id)];
  writeJson(diaperLogsKey, nextLogs);
  return nextLogs;
}

export function getLocalHealthNotes() {
  return readJson(healthNotesKey, []);
}

export function getPersistedHealthNotes(fallback = []) {
  return readCollectionWithFallback(healthNotesKey, fallback);
}

export function saveLocalHealthNote(note) {
  const notes = getLocalHealthNotes();
  const nextNotes = [note, ...notes.filter((item) => item.id !== note.id)];
  writeJson(healthNotesKey, nextNotes);
  return nextNotes;
}

export function getLocalMilestones() {
  return readJson(milestonesKey, []);
}

export function getPersistedMilestones(fallback = []) {
  return readCollectionWithFallback(milestonesKey, fallback);
}

export function saveLocalMilestone(milestone) {
  const milestones = getLocalMilestones();
  const nextMilestones = [milestone, ...milestones.filter((item) => item.id !== milestone.id)];
  writeJson(milestonesKey, nextMilestones);
  return nextMilestones;
}

export function getLocalCalendarEvents() {
  return readJson(calendarEventsKey, []);
}

export function getPersistedCalendarEvents(fallback = []) {
  return readCollectionWithFallback(calendarEventsKey, fallback);
}

export function saveLocalCalendarEvent(event) {
  const events = getLocalCalendarEvents();
  const nextEvents = [event, ...events.filter((item) => item.id !== event.id)];
  writeJson(calendarEventsKey, nextEvents);
  return nextEvents;
}

export function getMvpCollections(fallbacks = {}) {
  return {
    feedingLogs: getPersistedFeedingLogs(fallbacks.feedingLogs),
    sleepLogs: getPersistedSleepLogs(fallbacks.sleepLogs),
    diaperLogs: getPersistedDiaperLogs(fallbacks.diaperLogs),
    healthNotes: getPersistedHealthNotes(fallbacks.healthNotes),
    milestones: getPersistedMilestones(fallbacks.milestones),
    calendarEvents: getPersistedCalendarEvents(fallbacks.calendarEvents)
  };
}

function readJson(key, fallback) {
  try {
    const value = window.localStorage.getItem(key);
    return value ? JSON.parse(value) : fallback;
  } catch {
    return fallback;
  }
}

function readCollectionWithFallback(key, fallback = []) {
  const value = readJson(key, null);
  return Array.isArray(value) ? value : fallback;
}

function writeJson(key, value) {
  try {
    window.localStorage.setItem(key, JSON.stringify(value));
  } catch {
    // Local storage can be unavailable in private or restricted contexts.
  }
}
