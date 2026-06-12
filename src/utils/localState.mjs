import { shouldUseDemoData } from "./demoData.mjs";

const feedingLogsKey = "littlenest:feedingLogs";
const sleepLogsKey = "littlenest:sleepLogs";
const activeSleepKey = "littlenest:activeSleep";
const diaperLogsKey = "littlenest:diaperLogs";
const healthNotesKey = "littlenest:healthNotes";
const growthRecordsKey = "littlenest:growthRecords";
const milestonesKey = "littlenest:milestones";
const calendarEventsKey = "littlenest:calendarEvents";
const familyMembersKey = "littlenest:familyMembers";
const remindersKey = "littlenest:reminders";
const babyProfilesKey = "littlenest:babyProfiles";
const selectedBabyIdKey = "littlenest:selectedBabyId";
const legacyBabyProfileKey = "littlenest:babyProfile";
const legacyBabyProfilesBackupKey = "littlenest:legacyBabyProfilesBeforeSupabase";
const babyIdMapKey = "littlenest:babyIdMap";

export {
  babyProfilesKey,
  babyIdMapKey,
  calendarEventsKey,
  diaperLogsKey,
  feedingLogsKey,
  healthNotesKey,
  legacyBabyProfilesBackupKey,
  remindersKey,
  selectedBabyIdKey,
  sleepLogsKey
};

export function getBabyProfiles(fallbackProfile) {
  const existingProfiles = readJson(babyProfilesKey, null);
  if (Array.isArray(existingProfiles) && existingProfiles.length > 0) {
    ensureSelectedBaby(existingProfiles);
    return existingProfiles;
  }

  const legacyProfile = readJson(legacyBabyProfileKey, null);
  const initialProfile = normalizeBabyProfile(legacyProfile || (shouldUseDemoData() ? fallbackProfile : null));
  if (!initialProfile) return [];

  writeJson(babyProfilesKey, [initialProfile]);
  writeJson(selectedBabyIdKey, initialProfile.id);
  return [initialProfile];
}

export function getSelectedBabyId(fallbackProfile) {
  const profiles = getBabyProfiles(fallbackProfile);
  const savedId = readJson(selectedBabyIdKey, "");
  if (profiles.some((profile) => profile.id === savedId)) {
    migrateLogsToSelectedBaby(savedId);
    return savedId;
  }
  const fallbackId = profiles[0]?.id || "";
  if (fallbackId) writeJson(selectedBabyIdKey, fallbackId);
  migrateLogsToSelectedBaby(fallbackId);
  return fallbackId;
}

export function getSelectedBabyProfile(fallbackProfile) {
  const profiles = getBabyProfiles(fallbackProfile);
  const selectedId = getSelectedBabyId(fallbackProfile);
  return profiles.find((profile) => profile.id === selectedId) || profiles[0] || (shouldUseDemoData() ? fallbackProfile : null);
}

export function saveBabyProfile(profile, fallbackProfile) {
  const profiles = getBabyProfiles(fallbackProfile);
  const now = new Date().toISOString();
  const normalized = normalizeBabyProfile({
    ...profile,
    createdAt: profile.createdAt || now,
    updatedAt: now
  });
  const nextProfiles = profiles.some((item) => item.id === normalized.id)
    ? profiles.map((item) => item.id === normalized.id ? normalized : item)
    : [...profiles, normalized];
  writeJson(babyProfilesKey, nextProfiles);
  return normalized;
}

export function createBabyProfile(profile, fallbackProfile) {
  const now = new Date().toISOString();
  const created = saveBabyProfile({
    ...profile,
    id: profile.id || `baby-${Date.now()}`,
    createdAt: now,
    updatedAt: now
  }, fallbackProfile);
  setSelectedBabyId(created.id, fallbackProfile);
  return created;
}

export function setSelectedBabyId(babyId, fallbackProfile) {
  const profiles = getBabyProfiles(fallbackProfile);
  if (!profiles.some((profile) => profile.id === babyId)) return getSelectedBabyId(fallbackProfile);
  writeJson(selectedBabyIdKey, babyId);
  return babyId;
}

export function getLocalFeedingLogs() {
  return readJson(feedingLogsKey, []);
}

export function getPersistedFeedingLogs(fallback = []) {
  return readCollectionWithFallback(feedingLogsKey, fallback);
}

export function saveLocalFeedingLog(log) {
  return upsertCollectionItem(feedingLogsKey, log);
}

export function deleteLocalFeedingLog(logId) {
  return deleteCollectionItem(feedingLogsKey, logId);
}

export function getLogsForBaby(logs, babyId) {
  const aliases = getBabyIdAliases(babyId);
  return (logs || []).filter((log) => log.babyId && aliases.includes(log.babyId));
}

export function migrateLogsToSelectedBaby(babyId) {
  if (!babyId) return;
  [
    feedingLogsKey,
    sleepLogsKey,
    diaperLogsKey,
    healthNotesKey,
    growthRecordsKey,
    milestonesKey,
    calendarEventsKey,
    familyMembersKey,
    remindersKey
  ].forEach((key) => {
    const collection = readJson(key, null);
    if (!Array.isArray(collection) || !collection.some((item) => item && !item.babyId)) return;
    writeJson(key, collection.map((item) => item && !item.babyId ? { ...item, babyId } : item));
  });
}

export function getBabyIdAliases(babyId) {
  const map = readJson(babyIdMapKey, {});
  const aliases = new Set([babyId].filter(Boolean));

  Object.entries(map || {}).forEach(([localId, remoteId]) => {
    if (localId === babyId) aliases.add(remoteId);
    if (remoteId === babyId) aliases.add(localId);
  });

  return [...aliases];
}

export function rememberSupabaseBabyMapping(localBabyId, supabaseBabyId) {
  if (!localBabyId || !supabaseBabyId || localBabyId === supabaseBabyId) return;
  const map = readJson(babyIdMapKey, {});
  writeJson(babyIdMapKey, {
    ...map,
    [localBabyId]: supabaseBabyId
  });
}

export function getBabyIdMap() {
  return readJson(babyIdMapKey, {});
}

export function cacheSupabaseBabyProfiles(profiles, selectedBabyId = "") {
  if (!Array.isArray(profiles)) return [];

  const existingProfiles = readJson(babyProfilesKey, []);
  const hasBackup = readJson(legacyBabyProfilesBackupKey, null);
  if (!hasBackup && Array.isArray(existingProfiles) && existingProfiles.length > 0) {
    writeJson(legacyBabyProfilesBackupKey, existingProfiles);
  }

  const normalized = profiles.map((profile) => normalizeBabyProfile(profile)).filter(Boolean);
  writeJson(babyProfilesKey, normalized);
  if (selectedBabyId) writeJson(selectedBabyIdKey, selectedBabyId);
  else if (!normalized.length) writeJson(selectedBabyIdKey, "");
  else ensureSelectedBaby(normalized);
  return normalized;
}

export function readSelectedBabyId() {
  return readJson(selectedBabyIdKey, "");
}

export function getLocalSleepLogs() {
  return readJson(sleepLogsKey, []);
}

export function getPersistedSleepLogs(fallback = []) {
  return readCollectionWithFallback(sleepLogsKey, fallback);
}

export function saveLocalSleepLog(log) {
  return upsertCollectionItem(sleepLogsKey, log);
}

export function deleteLocalSleepLog(logId) {
  return deleteCollectionItem(sleepLogsKey, logId);
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
  return upsertCollectionItem(diaperLogsKey, log);
}

export function deleteLocalDiaperLog(logId) {
  return deleteCollectionItem(diaperLogsKey, logId);
}

export function getLocalHealthNotes() {
  return readJson(healthNotesKey, []);
}

export function getPersistedHealthNotes(fallback = []) {
  return readCollectionWithFallback(healthNotesKey, fallback);
}

export function saveLocalHealthNote(note) {
  return upsertCollectionItem(healthNotesKey, note);
}

export function deleteLocalHealthNote(noteId) {
  return deleteCollectionItem(healthNotesKey, noteId);
}

export function getLocalGrowthRecords() {
  return readJson(growthRecordsKey, []);
}

export function getPersistedGrowthRecords(fallback = []) {
  return readCollectionWithFallback(growthRecordsKey, fallback);
}

export function saveLocalGrowthRecord(record) {
  return upsertCollectionItem(growthRecordsKey, record);
}

export function deleteLocalGrowthRecord(recordId) {
  return deleteCollectionItem(growthRecordsKey, recordId);
}

export function getLocalMilestones() {
  return readJson(milestonesKey, []);
}

export function getPersistedMilestones(fallback = []) {
  return readCollectionWithFallback(milestonesKey, fallback);
}

export function saveLocalMilestone(milestone) {
  return upsertCollectionItem(milestonesKey, milestone);
}

export function deleteLocalMilestone(milestoneId) {
  return deleteCollectionItem(milestonesKey, milestoneId);
}

export function getLocalCalendarEvents() {
  return readJson(calendarEventsKey, []);
}

export function getPersistedCalendarEvents(fallback = []) {
  return readCollectionWithFallback(calendarEventsKey, fallback);
}

export function saveLocalCalendarEvent(event) {
  return upsertCollectionItem(calendarEventsKey, event);
}

export function deleteLocalCalendarEvent(eventId) {
  return deleteCollectionItem(calendarEventsKey, eventId);
}

export function getLocalFamilyMembers() {
  return readJson(familyMembersKey, []);
}

export function getPersistedFamilyMembers(fallback = []) {
  return readCollectionWithFallback(familyMembersKey, fallback);
}

export function saveLocalFamilyMember(member) {
  return upsertCollectionItem(familyMembersKey, member);
}

export function deleteLocalFamilyMember(memberId) {
  return deleteCollectionItem(familyMembersKey, memberId);
}

export function getLocalReminders() {
  return readJson(remindersKey, []);
}

export function getPersistedReminders(fallback = []) {
  return readCollectionWithFallback(remindersKey, fallback);
}

export function saveLocalReminder(reminder) {
  return upsertCollectionItem(remindersKey, reminder);
}

export function deleteLocalReminder(reminderId) {
  return deleteCollectionItem(remindersKey, reminderId);
}

export function getMvpCollections(fallbacks = {}) {
  return {
    feedingLogs: getPersistedFeedingLogs(fallbacks.feedingLogs),
    sleepLogs: getPersistedSleepLogs(fallbacks.sleepLogs),
    diaperLogs: getPersistedDiaperLogs(fallbacks.diaperLogs),
    healthNotes: getPersistedHealthNotes(fallbacks.healthNotes),
    growthRecords: getPersistedGrowthRecords(fallbacks.growthRecords),
    milestones: getPersistedMilestones(fallbacks.milestones),
    calendarEvents: getPersistedCalendarEvents(fallbacks.calendarEvents),
    familyMembers: getPersistedFamilyMembers(fallbacks.familyMembers),
    reminders: getPersistedReminders(fallbacks.reminders)
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
  return Array.isArray(value) ? value : (shouldUseDemoData() ? fallback : []);
}

function writeJson(key, value) {
  try {
    window.localStorage.setItem(key, JSON.stringify(value));
  } catch {
    // Local storage can be unavailable in private or restricted contexts.
  }
}

function upsertCollectionItem(key, item) {
  const items = readJson(key, []);
  const now = new Date().toISOString();
  const nextItem = {
    ...item,
    id: item.id || `${key.split(":").pop()}-${Date.now()}`,
    updatedAt: now,
    createdAt: item.createdAt || now
  };
  const nextItems = [nextItem, ...items.filter((existing) => existing.id !== nextItem.id)];
  writeJson(key, nextItems);
  return nextItems;
}

function deleteCollectionItem(key, itemId) {
  const items = readJson(key, []);
  const nextItems = items.filter((item) => item.id !== itemId);
  writeJson(key, nextItems);
  return nextItems;
}

function ensureSelectedBaby(profiles) {
  const selectedId = readJson(selectedBabyIdKey, "");
  if (!profiles.some((profile) => profile.id === selectedId) && profiles[0]?.id) {
    writeJson(selectedBabyIdKey, profiles[0].id);
  }
}

function normalizeBabyProfile(profile) {
  if (!profile) return null;
  const now = new Date().toISOString();
  const name = String(profile.name || "Baby").trim() || "Baby";
  return {
    id: profile.id || `baby-${Date.now()}`,
    name,
    dateOfBirth: profile.dateOfBirth || profile.dob || new Date().toISOString().slice(0, 10),
    gender: profile.gender || "",
    photoUrl: profile.photoUrl || profile.avatarUrl || profile.avatar || "",
    feedingPreference: profile.feedingPreference || "",
    notes: profile.notes || "",
    createdAt: profile.createdAt || now,
    updatedAt: profile.updatedAt || now
  };
}
