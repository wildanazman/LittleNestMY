import {
  deleteLocalReminder,
  getLogsForBaby,
  getPersistedReminders,
  saveLocalReminder
} from "./localState.mjs";
import { getAuthSession, isGuestMode } from "./localAuth.mjs";
import { isSupabaseConfigured, supabase, supabaseConfigMessage } from "./supabaseClient.mjs";

const remindersMigrationKey = "littlenest:remindersSupabaseMigratedAt";

export { remindersMigrationKey };

export async function loadRemindersRemote(selectedBabyId, fallback = []) {
  const local = getLogsForBaby(getPersistedReminders(fallback), selectedBabyId);
  if (!selectedBabyId) return { reminders: local, source: "localStorage", error: "Create a baby profile first." };
  if (!isSupabaseConfigured || isGuestMode()) return { reminders: local, source: "localStorage", error: isGuestMode() ? "" : supabaseConfigMessage };

  const session = await getAuthSession();
  if (!session) return { reminders: local, source: "localStorage", error: "Please log in to sync reminders." };

  try {
    await migrateRemindersOnce(selectedBabyId, local);
    const { data, error } = await supabase
      .from("reminders")
      .select("*")
      .eq("baby_id", selectedBabyId)
      .order("scheduled_at", { ascending: true });
    if (error) throw error;
    const remote = (data || []).map(fromReminderRow);
    remote.forEach(saveLocalReminder);
    return { reminders: mergeById(remote, pendingLocalItems(local)), source: "supabase", error: "" };
  } catch (error) {
    console.warn("Supabase reminder load failed.", error);
    return { reminders: local, source: "localStorage", error: friendlyReminderError(error, "load reminders").message };
  }
}

export async function saveReminderRemote(reminder) {
  saveLocalReminder(reminder);
  if (!canUseSupabase(reminder.babyId)) return reminder;

  const session = await getAuthSession();
  if (!session?.user) return reminder;

  try {
    const remoteId = stableUuid(reminder.id, "reminder");
    const { data, error } = await supabase
      .from("reminders")
      .upsert(toReminderRow({ ...reminder, id: remoteId }, session.user.id), { onConflict: "id" })
      .select("*")
      .single();
    if (error) throw error;

    if (reminder.id !== data.id) deleteLocalReminder(reminder.id);
    const savedItem = fromReminderRow(data);
    saveLocalReminder(savedItem);
    return savedItem;
  } catch (error) {
    throw friendlyReminderError(error, "save reminder");
  }
}

export async function deleteReminderRemote(reminderId) {
  deleteLocalReminder(reminderId);
  if (!isSupabaseConfigured || isGuestMode() || !isUuid(reminderId) || !(await getAuthSession())) return;
  const { error } = await supabase.from("reminders").delete().eq("id", reminderId);
  if (error) throw friendlyReminderError(error, "delete reminder");
}

async function migrateRemindersOnce(selectedBabyId, local) {
  const marker = readMigrationMarker();
  if (marker[selectedBabyId]) return;

  const candidates = (local || []).filter((item) => item?.id && !isUuid(item.id));
  if (!candidates.length) {
    writeMigrationMarker(selectedBabyId);
    return;
  }

  const session = await getAuthSession();
  if (!session?.user) return;

  for (const reminder of candidates) {
    const remoteId = stableUuid(reminder.id, "reminder");
    const { error } = await supabase
      .from("reminders")
      .upsert(toReminderRow({ ...reminder, id: remoteId }, session.user.id), { onConflict: "id" });
    if (error) {
      console.warn("Migration of reminder skipped.", reminder.id, error);
    } else if (reminder.id !== remoteId) {
      deleteLocalReminder(reminder.id);
    }
  }
  writeMigrationMarker(selectedBabyId);
}

function fromReminderRow(row) {
  return {
    id: row.id,
    babyId: row.baby_id,
    type: row.reminder_type || "custom",
    title: row.title,
    scheduledAt: row.scheduled_at,
    enabled: row.enabled ?? true,
    repeatRule: row.repeat_rule || undefined,
    sourceId: row.calendar_event_id || undefined,
    createdAt: row.created_at || "",
    updatedAt: row.updated_at || ""
  };
}

function toReminderRow(reminder, createdBy) {
  return {
    id: stableUuid(reminder.id, "reminder"),
    baby_id: reminder.babyId,
    created_by: createdBy,
    title: reminder.title,
    reminder_type: reminder.type || "custom",
    scheduled_at: reminder.scheduledAt,
    enabled: reminder.enabled ?? true,
    repeat_rule: reminder.repeatRule || null,
    calendar_event_id: isUuid(reminder.sourceId) ? reminder.sourceId : null
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

function friendlyReminderError(error, action) {
  const message = error?.message || String(error || "");
  if (/row-level security|permission denied|violates row-level security/i.test(message)) {
    return new Error(`Supabase RLS blocked ${action}. Check reminders policies. Original error: ${message}`);
  }
  return new Error(message || `Could not ${action}.`);
}

function readMigrationMarker() {
  try {
    const value = window.localStorage.getItem(remindersMigrationKey);
    return value ? JSON.parse(value) || {} : {};
  } catch {
    return {};
  }
}

function writeMigrationMarker(selectedBabyId) {
  try {
    window.localStorage.setItem(remindersMigrationKey, JSON.stringify({
      ...readMigrationMarker(),
      [selectedBabyId]: new Date().toISOString()
    }));
  } catch {
  }
}
