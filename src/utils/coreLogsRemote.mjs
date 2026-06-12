import {
  deleteLocalDiaperLog,
  deleteLocalFeedingLog,
  deleteLocalHealthNote,
  deleteLocalSleepLog,
  getBabyIdAliases,
  getLogsForBaby,
  getPersistedDiaperLogs,
  getPersistedFeedingLogs,
  getPersistedHealthNotes,
  getPersistedSleepLogs,
  saveLocalDiaperLog,
  saveLocalFeedingLog,
  saveLocalHealthNote,
  saveLocalSleepLog
} from "./localState.mjs";
import { getAuthSession } from "./localAuth.mjs";
import { isSupabaseConfigured, supabase, supabaseConfigMessage } from "./supabaseClient.mjs";

const coreLogsMigrationKey = "littlenest:coreLogsSupabaseMigratedAt";

export { coreLogsMigrationKey };

export async function loadCoreLogsRemote(selectedBabyId, fallbacks = {}) {
  const local = getLocalCoreLogs(selectedBabyId, fallbacks);

  if (!selectedBabyId) return { ...local, source: "localStorage", error: "Create a baby profile first." };
  if (!isSupabaseConfigured) return { ...local, source: "localStorage", error: supabaseConfigMessage };
  if (!(await getAuthSession())) return { ...local, source: "localStorage", error: "Please log in to sync logs." };

  try {
    await migrateCoreLogsOnce(selectedBabyId, local);
    const remote = await fetchCoreLogs(selectedBabyId);
    cacheCoreLogs(remote);
    return { ...remote, source: "supabase", error: "" };
  } catch (error) {
    console.warn("Supabase core log sync failed.", error);
    return {
      ...local,
      source: "localStorage",
      error: `${friendlyRlsError(error, "sync logs")} Using local logs for now.`
    };
  }
}

export async function saveFeedingLogRemote(log) {
  const local = saveLocalFeedingLog(log);
  if (!canUseSupabase(log.babyId)) return local;

  try {
    const { data, error } = await supabase
      .from("feeding_logs")
      .upsert(toFeedingRow(log), { onConflict: "id" })
      .select("*")
      .single();
    if (error) throw error;
    return saveLocalFeedingLog(fromFeedingRow(data));
  } catch (error) {
    throw friendlyRlsError(error, "save feeding log");
  }
}

export async function deleteFeedingLogRemote(logId) {
  deleteLocalFeedingLog(logId);
  await deleteRemoteById("feeding_logs", logId, "delete feeding log");
}

export async function saveSleepLogRemote(log) {
  const local = saveLocalSleepLog(log);
  if (!canUseSupabase(log.babyId)) return local;

  try {
    const { data, error } = await supabase
      .from("sleep_logs")
      .upsert(toSleepRow(log), { onConflict: "id" })
      .select("*")
      .single();
    if (error) throw error;
    return saveLocalSleepLog(fromSleepRow(data));
  } catch (error) {
    throw friendlyRlsError(error, "save sleep log");
  }
}

export async function deleteSleepLogRemote(logId) {
  deleteLocalSleepLog(logId);
  await deleteRemoteById("sleep_logs", logId, "delete sleep log");
}

export async function saveDiaperLogRemote(log) {
  const local = saveLocalDiaperLog(log);
  if (!canUseSupabase(log.babyId)) return local;

  try {
    const { data, error } = await supabase
      .from("diaper_logs")
      .upsert(toDiaperRow(log), { onConflict: "id" })
      .select("*")
      .single();
    if (error) throw error;
    return saveLocalDiaperLog(fromDiaperRow(data));
  } catch (error) {
    throw friendlyRlsError(error, "save diaper log");
  }
}

export async function deleteDiaperLogRemote(logId) {
  deleteLocalDiaperLog(logId);
  await deleteRemoteById("diaper_logs", logId, "delete diaper log");
}

export async function saveHealthNoteRemote(note) {
  const local = saveLocalHealthNote(note);
  if (!canUseSupabase(note.babyId)) return local;

  try {
    const { data, error } = await supabase
      .from("health_notes")
      .upsert(toHealthRow(note), { onConflict: "id" })
      .select("*")
      .single();
    if (error) throw error;
    return saveLocalHealthNote(fromHealthRow(data));
  } catch (error) {
    throw friendlyRlsError(error, "save health note");
  }
}

export async function deleteHealthNoteRemote(noteId) {
  deleteLocalHealthNote(noteId);
  await deleteRemoteById("health_notes", noteId, "delete health note");
}

function getLocalCoreLogs(selectedBabyId, fallbacks) {
  return {
    feedingLogs: getLogsForBaby(getPersistedFeedingLogs(fallbacks.feedingLogs || []), selectedBabyId),
    sleepLogs: getLogsForBaby(getPersistedSleepLogs(fallbacks.sleepLogs || []), selectedBabyId),
    diaperLogs: getLogsForBaby(getPersistedDiaperLogs(fallbacks.diaperLogs || []), selectedBabyId),
    healthNotes: getLogsForBaby(getPersistedHealthNotes(fallbacks.healthNotes || []), selectedBabyId)
  };
}

async function fetchCoreLogs(selectedBabyId) {
  const [feeding, sleep, diaper, health] = await Promise.all([
    fetchTable("feeding_logs", selectedBabyId, "started_at"),
    fetchTable("sleep_logs", selectedBabyId, "started_at"),
    fetchTable("diaper_logs", selectedBabyId, "logged_at"),
    fetchTable("health_notes", selectedBabyId, "logged_at")
  ]);

  return {
    feedingLogs: feeding.map(fromFeedingRow),
    sleepLogs: sleep.map(fromSleepRow),
    diaperLogs: diaper.map(fromDiaperRow),
    healthNotes: health.map(fromHealthRow)
  };
}

async function fetchTable(table, selectedBabyId, orderColumn) {
  const { data, error } = await supabase
    .from(table)
    .select("*")
    .eq("baby_id", selectedBabyId)
    .order(orderColumn, { ascending: false });
  if (error) throw error;
  return data || [];
}

async function migrateCoreLogsOnce(selectedBabyId, local) {
  const marker = readMigrationMarker();
  if (marker[selectedBabyId]) return;

  const aliases = getBabyIdAliases(selectedBabyId);
  const hasAny = [
    local.feedingLogs,
    local.sleepLogs,
    local.diaperLogs,
    local.healthNotes
  ].some((items) => items.some((item) => item.babyId && aliases.includes(item.babyId)));

  if (!hasAny) {
    writeMigrationMarker(selectedBabyId);
    return;
  }

  try {
    await Promise.all([
      upsertMany("feeding_logs", local.feedingLogs.map((log) => toFeedingRow({ ...log, babyId: selectedBabyId }))),
      upsertMany("sleep_logs", local.sleepLogs.map((log) => toSleepRow({ ...log, babyId: selectedBabyId }))),
      upsertMany("diaper_logs", local.diaperLogs.map((log) => toDiaperRow({ ...log, babyId: selectedBabyId }))),
      upsertMany("health_notes", local.healthNotes.map((note) => toHealthRow({ ...note, babyId: selectedBabyId })))
    ]);
    writeMigrationMarker(selectedBabyId);
  } catch (error) {
    throw friendlyRlsError(error, "migrate local core logs");
  }
}

async function upsertMany(table, rows) {
  if (!rows.length) return;
  const { error } = await supabase.from(table).upsert(rows, { onConflict: "id" });
  if (error) throw error;
}

function cacheCoreLogs(remote) {
  remote.feedingLogs.forEach(saveLocalFeedingLog);
  remote.sleepLogs.forEach(saveLocalSleepLog);
  remote.diaperLogs.forEach(saveLocalDiaperLog);
  remote.healthNotes.forEach(saveLocalHealthNote);
}

function toFeedingRow(log) {
  return {
    id: stableUuid(log.id, "feed"),
    baby_id: log.babyId,
    feeding_type: toRemoteFeedingType(log.type),
    amount_ml: log.amountMl || null,
    amount_grams: log.amountGrams || null,
    duration_minutes: log.durationMinutes || null,
    started_at: log.startedAt,
    ended_at: log.endedAt || null,
    note: log.notes || null
  };
}

function fromFeedingRow(row) {
  return {
    id: row.id,
    babyId: row.baby_id,
    type: fromRemoteFeedingType(row.feeding_type),
    amountMl: row.amount_ml ? Number(row.amount_ml) : undefined,
    amountGrams: row.amount_grams ? Number(row.amount_grams) : undefined,
    durationMinutes: row.duration_minutes || undefined,
    startedAt: row.started_at,
    endedAt: row.ended_at || undefined,
    notes: row.note || undefined
  };
}

function toSleepRow(log) {
  return {
    id: stableUuid(log.id, "sleep"),
    baby_id: log.babyId,
    started_at: log.startedAt,
    ended_at: log.endedAt || null,
    duration_minutes: log.durationMinutes || durationMinutes(log.startedAt, log.endedAt),
    sleep_type: log.status || "nap",
    note: log.notes || null
  };
}

function fromSleepRow(row) {
  return {
    id: row.id,
    babyId: row.baby_id,
    status: row.sleep_type || "nap",
    startedAt: row.started_at,
    endedAt: row.ended_at || undefined,
    durationMinutes: row.duration_minutes || undefined,
    notes: row.note || undefined
  };
}

function toDiaperRow(log) {
  return {
    id: stableUuid(log.id, "diaper"),
    baby_id: log.babyId,
    diaper_type: toRemoteDiaperType(log.type),
    color: log.color || null,
    texture: log.texture || null,
    note: log.notes || null,
    logged_at: log.changedAt || log.loggedAt || new Date().toISOString()
  };
}

function fromDiaperRow(row) {
  return {
    id: row.id,
    babyId: row.baby_id,
    type: fromRemoteDiaperType(row.diaper_type),
    color: row.color || undefined,
    texture: row.texture || undefined,
    notes: row.note || undefined,
    changedAt: row.logged_at
  };
}

function toHealthRow(note) {
  return {
    id: stableUuid(note.id, "health"),
    baby_id: note.babyId,
    note_type: note.type || "note",
    title: note.title || "Health note",
    body: note.details || note.body || null,
    temperature_c: note.temperatureC || null,
    medicine_name: note.medicineName || null,
    logged_at: note.recordedAt || note.loggedAt || new Date().toISOString()
  };
}

function fromHealthRow(row) {
  return {
    id: row.id,
    babyId: row.baby_id,
    type: row.note_type || "note",
    title: row.title,
    details: row.body || undefined,
    temperatureC: row.temperature_c ? Number(row.temperature_c) : undefined,
    medicineName: row.medicine_name || undefined,
    recordedAt: row.logged_at
  };
}

async function deleteRemoteById(table, logId, action) {
  if (!isSupabaseConfigured || !(await getAuthSession()) || !isUuid(logId)) return;
  const { error } = await supabase.from(table).delete().eq("id", logId);
  if (error) throw friendlyRlsError(error, action);
}

function canUseSupabase(babyId) {
  return Boolean(isSupabaseConfigured && babyId);
}

function stableUuid(id, prefix) {
  if (isUuid(id)) return id;
  return cryptoUuidFromString(`${prefix}:${id || Date.now()}`);
}

function isUuid(value) {
  return /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i.test(String(value || ""));
}

function cryptoUuidFromString(value) {
  let hash = 2166136261;
  for (let index = 0; index < String(value).length; index += 1) {
    hash ^= String(value).charCodeAt(index);
    hash += (hash << 1) + (hash << 4) + (hash << 7) + (hash << 8) + (hash << 24);
  }
  const hex = (n) => Math.abs(n >>> 0).toString(16).padStart(8, "0");
  const seed = `${hex(hash)}${hex(hash * 31)}${hex(hash * 131)}${hex(hash * 197)}`;
  return `${seed.slice(0, 8)}-${seed.slice(8, 12)}-4${seed.slice(13, 16)}-8${seed.slice(17, 20)}-${seed.slice(20, 32)}`;
}

function toRemoteFeedingType(type) {
  return type === "breast" ? "breastfeeding" : type || "bottle";
}

function fromRemoteFeedingType(type) {
  return type === "breastfeeding" ? "breast" : type || "bottle";
}

function toRemoteDiaperType(type) {
  if (type === "wet") return "pee";
  if (type === "dirty") return "poop";
  return type || "mixed";
}

function fromRemoteDiaperType(type) {
  if (type === "pee") return "wet";
  if (type === "poop") return "dirty";
  return type || "mixed";
}

function durationMinutes(startedAt, endedAt) {
  if (!startedAt || !endedAt) return null;
  return Math.max(0, Math.round((new Date(endedAt) - new Date(startedAt)) / 60000));
}

function friendlyRlsError(error, action) {
  const message = error?.message || String(error || "");
  if (/row-level security|permission denied|violates row-level security/i.test(message)) {
    return new Error(`Supabase RLS blocked ${action}. Check core log policies for parent/caregiver write access and viewer read-only access. Original error: ${message}`);
  }
  return new Error(message || `Could not ${action}.`);
}

function readMigrationMarker() {
  try {
    const value = window.localStorage.getItem(coreLogsMigrationKey);
    if (!value) return {};
    if (value.startsWith("{")) return JSON.parse(value);
    return { legacy: value };
  } catch {
    return {};
  }
}

function writeMigrationMarker(selectedBabyId) {
  try {
    window.localStorage.setItem(coreLogsMigrationKey, JSON.stringify({
      ...readMigrationMarker(),
      [selectedBabyId]: new Date().toISOString()
    }));
  } catch {
    // Migration marker is best-effort only.
  }
}
