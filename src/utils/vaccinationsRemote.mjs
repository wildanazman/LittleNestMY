import {
  deleteLocalVaccinationRecord,
  getLogsForBaby,
  getPersistedVaccinationRecords,
  saveLocalVaccinationRecord
} from "./localState.mjs";
import { getAuthSession, isGuestMode } from "./localAuth.mjs";
import { isSupabaseConfigured, supabase, supabaseConfigMessage } from "./supabaseClient.mjs";
import { withTimeout } from "./withTimeout.mjs";

export async function loadVaccinationRecordsRemote(selectedBabyId, fallback = []) {
  const local = getLogsForBaby(getPersistedVaccinationRecords(fallback), selectedBabyId);
  if (!selectedBabyId) return { records: local, source: "localStorage", error: "Create a baby profile first." };
  if (!isSupabaseConfigured || isGuestMode()) return { records: local, source: "localStorage", error: "" };

  const session = await getAuthSession();
  if (!session) return { records: local, source: "localStorage", error: "Please log in to sync vaccinations." };

  try {
    const { data, error } = await withTimeout(
      supabase.from("vaccination_records").select("*").eq("baby_id", selectedBabyId),
      undefined,
      "load vaccinations"
    );
    if (error) throw error;
    const remote = (data || []).map(fromRow);
    remote.forEach(saveLocalVaccinationRecord);
    return { records: mergeByKey(remote, pendingLocalItems(local)), source: "supabase", error: "" };
  } catch (error) {
    console.warn("Supabase vaccination load failed.", error);
    return { records: local, source: "localStorage", error: friendlyError(error, "load vaccinations").message };
  }
}

export async function saveVaccinationRecordRemote(record) {
  saveLocalVaccinationRecord(record);
  if (!canUseSupabase(record.babyId)) return record;

  const session = await getAuthSession();
  if (!session?.user) return record;

  try {
    const remoteId = stableUuid(record.id, "vacc");
    const { data, error } = await withTimeout(
      supabase
        .from("vaccination_records")
        .upsert(toRow({ ...record, id: remoteId }, session.user.id), { onConflict: "baby_id,vaccine_key" })
        .select("*")
        .single(),
      undefined,
      "save vaccination"
    );
    if (error) throw error;
    const saved = fromRow(data);
    if (record.id !== saved.id) deleteLocalVaccinationRecord(record.id);
    saveLocalVaccinationRecord(saved);
    return saved;
  } catch (error) {
    throw friendlyError(error, "save vaccination");
  }
}

export async function deleteVaccinationRecordRemote(recordId) {
  deleteLocalVaccinationRecord(recordId);
  if (!isSupabaseConfigured || isGuestMode() || !isUuid(recordId) || !(await getAuthSession())) return;
  const { error } = await withTimeout(
    supabase.from("vaccination_records").delete().eq("id", recordId),
    undefined,
    "delete vaccination"
  );
  if (error) throw friendlyError(error, "delete vaccination");
}

function fromRow(row) {
  return {
    id: row.id,
    babyId: row.baby_id,
    vaccineKey: row.vaccine_key,
    givenOn: row.given_on || ""
  };
}

function toRow(record, createdBy) {
  return {
    id: stableUuid(record.id, "vacc"),
    baby_id: record.babyId,
    created_by: createdBy,
    vaccine_key: record.vaccineKey,
    given_on: record.givenOn || null,
    updated_at: new Date().toISOString()
  };
}

function canUseSupabase(babyId) {
  return Boolean(isSupabaseConfigured && babyId && !isGuestMode());
}

function mergeByKey(primary = [], secondary = []) {
  const seen = new Set(primary.map((item) => item.vaccineKey));
  return [...primary, ...secondary.filter((item) => !seen.has(item.vaccineKey))];
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

function friendlyError(error, action) {
  const message = error?.message || String(error || "");
  if (/row-level security|permission denied/i.test(message)) {
    return new Error(`Supabase RLS blocked ${action}. Check vaccination_records policies. Original: ${message}`);
  }
  if (/does not exist|schema cache|find the table/i.test(message)) {
    return new Error(`Vaccination sync needs migration 014. ${message}`);
  }
  return new Error(message || `Could not ${action}.`);
}

export { supabaseConfigMessage };
