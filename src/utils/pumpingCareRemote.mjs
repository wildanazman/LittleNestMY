import { getAuthSession } from "./localAuth.mjs";
import { isSupabaseConfigured, supabase } from "./supabaseClient.mjs";

const keys = {
  sessions: "littlenest:pumpSessions",
  schedules: "littlenest:pumpSchedules",
  storage: "littlenest:milkStorage",
  parts: "littlenest:pumpParts"
};

const tables = {
  sessions: "mama_pump_sessions",
  schedules: "mama_pump_schedules",
  storage: "mama_milk_storage",
  parts: "mama_pump_parts"
};

export async function loadPumpingCareData(babyId) {
  const local = getLocalPumpingData(babyId);
  if (!babyId || !isSupabaseConfigured || !(await getAuthSession())) return local;
  try {
    const [sessions, schedules, storage, parts] = await Promise.all([
      fetchTable(tables.sessions, babyId, "started_at", false),
      fetchTable(tables.schedules, babyId, "pump_time", true),
      fetchTable(tables.storage, babyId, "pump_date", true),
      fetchTable(tables.parts, babyId, "part_type", true)
    ]);
    const remote = {
      sessions: sessions.map(fromSessionRow),
      schedules: schedules.map(fromScheduleRow),
      storage: storage.map(fromStorageRow),
      parts: parts.map(fromPartRow),
      error: ""
    };
    cachePumpingData(remote);
    return remote;
  } catch (error) {
    return { ...local, error: friendlyError(error).message };
  }
}

export async function savePumpSession(session) {
  const local = saveLocal(keys.sessions, session);
  await upsertRemote(tables.sessions, toSessionRow(local), "save pumping session");
  return local;
}

export async function deletePumpSession(id) {
  deleteLocal(keys.sessions, id);
  await deleteRemote(tables.sessions, id, "delete pumping session");
}

export async function savePumpSchedule(schedule) {
  const local = saveLocal(keys.schedules, schedule);
  await upsertRemote(tables.schedules, toScheduleRow(local), "save pumping schedule");
  return local;
}

export async function deletePumpSchedule(id) {
  deleteLocal(keys.schedules, id);
  await deleteRemote(tables.schedules, id, "delete pumping schedule");
}

export async function saveMilkStorage(entry) {
  const local = saveLocal(keys.storage, entry);
  await upsertRemote(tables.storage, toStorageRow(local), "save milk storage");
  return local;
}

export async function useMilkStorage(id, usedMl) {
  const items = readJson(keys.storage, []);
  const item = items.find((entry) => entry.id === id);
  if (!item) return;
  const next = { ...item, remainingMl: Math.max(0, Number(item.remainingMl ?? item.quantityMl) - Number(usedMl || 0)) };
  saveLocal(keys.storage, next);
  await upsertRemote(tables.storage, toStorageRow(next), "update milk storage");
}

export async function deleteMilkStorage(id) {
  deleteLocal(keys.storage, id);
  await deleteRemote(tables.storage, id, "delete milk storage");
}

export async function savePumpPart(part) {
  const local = saveLocal(keys.parts, part);
  await upsertRemote(tables.parts, toPartRow(local), "save pump part");
  return local;
}

function getLocalPumpingData(babyId) {
  return {
    sessions: forBaby(readJson(keys.sessions, []), babyId),
    schedules: forBaby(readJson(keys.schedules, []), babyId),
    storage: forBaby(readJson(keys.storage, []), babyId),
    parts: forBaby(readJson(keys.parts, []), babyId),
    error: ""
  };
}

async function fetchTable(table, babyId, orderColumn, ascending) {
  const { data, error } = await supabase
    .from(table)
    .select("*")
    .eq("baby_id", babyId)
    .order(orderColumn, { ascending, nullsFirst: false });
  if (error) throw error;
  return data || [];
}

async function upsertRemote(table, row, action) {
  if (!isSupabaseConfigured) return;
  const session = await getAuthSession();
  if (!session?.user?.id) return;
  const { error } = await supabase.from(table).upsert({ ...row, created_by: session.user.id }, { onConflict: "id" });
  if (error) console.warn(friendlyError(error, action).message);
}

async function deleteRemote(table, id, action) {
  if (!isSupabaseConfigured) return;
  const session = await getAuthSession();
  if (!session?.user?.id) return;
  const { error } = await supabase.from(table).delete().eq("id", id);
  if (error) console.warn(friendlyError(error, action).message);
}

function cachePumpingData(data) {
  writeBabyItems(keys.sessions, data.sessions);
  writeBabyItems(keys.schedules, data.schedules);
  writeBabyItems(keys.storage, data.storage);
  writeBabyItems(keys.parts, data.parts);
}

function writeBabyItems(key, nextItems) {
  const babyIds = new Set(nextItems.map((item) => item.babyId));
  const existing = readJson(key, []).filter((item) => !babyIds.has(item.babyId));
  writeJson(key, [...nextItems, ...existing]);
}

function saveLocal(key, item) {
  const now = new Date().toISOString();
  const nextItem = {
    ...item,
    id: item.id || `${key.split(":").pop()}-${Date.now()}`,
    createdAt: item.createdAt || now,
    updatedAt: now
  };
  const items = readJson(key, []);
  writeJson(key, [nextItem, ...items.filter((entry) => entry.id !== nextItem.id)]);
  return nextItem;
}

function deleteLocal(key, id) {
  writeJson(key, readJson(key, []).filter((item) => item.id !== id));
}

function forBaby(items, babyId) {
  return (items || []).filter((item) => item.babyId === babyId);
}

function toSessionRow(session) {
  return {
    id: session.id,
    baby_id: session.babyId,
    started_at: session.startedAt,
    ended_at: session.endedAt,
    duration_minutes: Number(session.durationMinutes || 0),
    left_ml: Number(session.leftMl || 0),
    right_ml: Number(session.rightMl || 0),
    total_ml: Number(session.totalMl || 0),
    pump_used: clean(session.pumpUsed),
    notes: clean(session.notes)
  };
}

function fromSessionRow(row) {
  return {
    id: row.id,
    babyId: row.baby_id,
    startedAt: row.started_at,
    endedAt: row.ended_at,
    durationMinutes: row.duration_minutes ?? 0,
    leftMl: row.left_ml ?? 0,
    rightMl: row.right_ml ?? 0,
    totalMl: row.total_ml ?? 0,
    pumpUsed: row.pump_used || "",
    notes: row.notes || "",
    createdAt: row.created_at,
    updatedAt: row.updated_at
  };
}

function toScheduleRow(schedule) {
  return {
    id: schedule.id,
    baby_id: schedule.babyId,
    pump_time: schedule.pumpTime,
    label: clean(schedule.label),
    active: schedule.active !== false,
    skipped_dates: schedule.skippedDates || []
  };
}

function fromScheduleRow(row) {
  return {
    id: row.id,
    babyId: row.baby_id,
    pumpTime: row.pump_time,
    label: row.label || "",
    active: row.active !== false,
    skippedDates: row.skipped_dates || [],
    createdAt: row.created_at,
    updatedAt: row.updated_at
  };
}

function toStorageRow(entry) {
  return {
    id: entry.id,
    baby_id: entry.babyId,
    quantity_ml: Number(entry.quantityMl || 0),
    remaining_ml: Number(entry.remainingMl ?? entry.quantityMl ?? 0),
    storage_type: entry.storageType,
    container_type: entry.containerType,
    pump_date: entry.pumpDate,
    expiration_date: entry.expirationDate,
    label: clean(entry.label),
    notes: clean(entry.notes)
  };
}

function fromStorageRow(row) {
  return {
    id: row.id,
    babyId: row.baby_id,
    quantityMl: row.quantity_ml ?? 0,
    remainingMl: row.remaining_ml ?? row.quantity_ml ?? 0,
    storageType: row.storage_type,
    containerType: row.container_type,
    pumpDate: row.pump_date,
    expirationDate: row.expiration_date,
    label: row.label || "",
    notes: row.notes || "",
    createdAt: row.created_at,
    updatedAt: row.updated_at
  };
}

function toPartRow(part) {
  return {
    id: part.id,
    baby_id: part.babyId,
    part_type: part.partType,
    last_changed_date: part.lastChangedDate,
    interval_days: Number(part.intervalDays || 30),
    notes: clean(part.notes)
  };
}

function fromPartRow(row) {
  return {
    id: row.id,
    babyId: row.baby_id,
    partType: row.part_type,
    lastChangedDate: row.last_changed_date,
    intervalDays: row.interval_days ?? 30,
    notes: row.notes || "",
    createdAt: row.created_at,
    updatedAt: row.updated_at
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

function writeJson(key, value) {
  try {
    window.localStorage.setItem(key, JSON.stringify(value));
  } catch {
    // Local storage can be unavailable in restricted browser contexts.
  }
}

function clean(value) {
  const text = String(value || "").trim();
  return text || null;
}

function friendlyError(error, action = "sync pumping data") {
  const message = error?.message || String(error || "");
  if (/Could not find the table|schema cache|does not exist/i.test(message)) {
    return new Error(`Breast Pumping database tables are not ready. Run supabase/migrations/016_mama_pumping.sql to enable sync.`);
  }
  if (/row-level security|permission denied|violates row-level security/i.test(message)) {
    return new Error(`Supabase RLS blocked ${action}. Check pumping policies. Original error: ${message}`);
  }
  return new Error(message || `Could not ${action}.`);
}
