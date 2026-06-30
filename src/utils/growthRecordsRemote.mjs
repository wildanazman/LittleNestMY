import {
  deleteLocalGrowthRecord,
  getLogsForBaby,
  getPersistedGrowthRecords,
  saveLocalGrowthRecord
} from "./localState.mjs";
import { getAuthSession, isGuestMode } from "./localAuth.mjs";
import { isSupabaseConfigured, supabase, supabaseConfigMessage } from "./supabaseClient.mjs";

const growthMigrationKey = "littlenest:growthRecordsSupabaseMigratedAt";

export { growthMigrationKey };

export async function loadGrowthRecordsRemote(selectedBabyId, fallback = []) {
  const local = getLogsForBaby(getPersistedGrowthRecords(fallback), selectedBabyId);
  if (!selectedBabyId) return { growthRecords: local, source: "localStorage", error: "Create a baby profile first." };
  if (!isSupabaseConfigured || isGuestMode()) return { growthRecords: local, source: "localStorage", error: isGuestMode() ? "" : supabaseConfigMessage };

  const session = await getAuthSession();
  if (!session) return { growthRecords: local, source: "localStorage", error: "Please log in to sync growth records." };

  try {
    await migrateGrowthRecordsOnce(selectedBabyId, local);
    const { data, error } = await supabase
      .from("growth_records")
      .select("*")
      .eq("baby_id", selectedBabyId)
      .order("measured_at", { ascending: false });
    if (error) throw error;
    const remote = (data || []).map(fromGrowthRow);
    const remoteIds = new Set(remote.map((item) => item.id));
    // Drop locally-cached synced records that no longer exist on the server (e.g.
    // deleted on another device) so stale "zombie" rows never reappear here.
    local
      .filter((item) => item?.id && isUuid(item.id) && !remoteIds.has(item.id))
      .forEach((item) => deleteLocalGrowthRecord(item.id));
    remote.forEach(saveLocalGrowthRecord);
    return { growthRecords: mergeById(remote, pendingLocalItems(local)), source: "supabase", error: "" };
  } catch (error) {
    console.warn("Supabase growth record load failed.", error);
    return { growthRecords: local, source: "localStorage", error: friendlyGrowthError(error, "load growth records").message };
  }
}

export async function saveGrowthRecordRemote(record) {
  saveLocalGrowthRecord(record);
  if (!canUseSupabase(record.babyId)) return record;

  const session = await getAuthSession();
  if (!session?.user) return record;

  try {
    const remoteId = stableUuid(record.id, "growth");
    const { data, error } = await supabase
      .from("growth_records")
      .upsert(toGrowthRow({ ...record, id: remoteId }, session.user.id), { onConflict: "id" })
      .select("*")
      .single();
    if (error) throw error;

    if (record.id !== data.id) deleteLocalGrowthRecord(record.id);
    const savedItem = fromGrowthRow(data);
    saveLocalGrowthRecord(savedItem);
    return savedItem;
  } catch (error) {
    throw friendlyGrowthError(error, "save growth record");
  }
}

export async function deleteGrowthRecordRemote(recordId) {
  deleteLocalGrowthRecord(recordId);
  if (!isSupabaseConfigured || isGuestMode() || !isUuid(recordId) || !(await getAuthSession())) return;
  const { error } = await supabase.from("growth_records").delete().eq("id", recordId);
  if (error) throw friendlyGrowthError(error, "delete growth record");
}

async function migrateGrowthRecordsOnce(selectedBabyId, local) {
  const marker = readMigrationMarker();
  if (marker[selectedBabyId]) return;

  const candidates = (local || []).filter((item) => item?.id && !isUuid(item.id));
  if (!candidates.length) {
    writeMigrationMarker(selectedBabyId);
    return;
  }

  const session = await getAuthSession();
  if (!session?.user) return;

  for (const record of candidates) {
    const remoteId = stableUuid(record.id, "growth");
    const { error } = await supabase
      .from("growth_records")
      .upsert(toGrowthRow({ ...record, id: remoteId }, session.user.id), { onConflict: "id" });
    if (error) {
      console.warn("Migration of growth record skipped.", record.id, error);
    } else if (record.id !== remoteId) {
      deleteLocalGrowthRecord(record.id);
    }
  }
  writeMigrationMarker(selectedBabyId);
}

function fromGrowthRow(row) {
  return {
    id: row.id,
    babyId: row.baby_id,
    measuredAt: row.measured_at,
    weightKg: row.weight_kg ? Number(row.weight_kg) : undefined,
    lengthCm: row.length_cm ? Number(row.length_cm) : undefined,
    heightCm: row.height_cm ? Number(row.height_cm) : undefined,
    headCircumferenceCm: row.head_circumference_cm ? Number(row.head_circumference_cm) : undefined,
    notes: row.notes || undefined,
    createdAt: row.created_at || "",
    updatedAt: row.updated_at || ""
  };
}

function toGrowthRow(record, createdBy) {
  return {
    id: stableUuid(record.id, "growth"),
    baby_id: record.babyId,
    created_by: createdBy,
    weight_kg: record.weightKg ?? null,
    length_cm: record.lengthCm ?? null,
    height_cm: record.heightCm ?? null,
    head_circumference_cm: record.headCircumferenceCm ?? null,
    measured_at: record.measuredAt || record.recordedAt || new Date().toISOString(),
    notes: record.notes || null
  };
}

function canUseSupabase(babyId) {
  return Boolean(isSupabaseConfigured && babyId && !isGuestMode());
}

function mergeById(primary = [], secondary = []) {
  const seen = new Set(primary.map((item) => item.id));
  return [...primary, ...secondary.filter((item) => !seen.has(item.id))];
}

function pendingLocalItems(items = []) {
  return items.filter((item) => item?.id && !isUuid(item.id));
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

function friendlyGrowthError(error, action) {
  const message = error?.message || String(error || "");
  if (/row-level security|permission denied|violates row-level security/i.test(message)) {
    return new Error(`Supabase RLS blocked ${action}. Check growth_records policies. Original error: ${message}`);
  }
  return new Error(message || `Could not ${action}.`);
}

function readMigrationMarker() {
  try {
    const value = window.localStorage.getItem(growthMigrationKey);
    return value ? JSON.parse(value) || {} : {};
  } catch {
    return {};
  }
}

function writeMigrationMarker(selectedBabyId) {
  try {
    window.localStorage.setItem(growthMigrationKey, JSON.stringify({
      ...readMigrationMarker(),
      [selectedBabyId]: new Date().toISOString()
    }));
  } catch {
  }
}
