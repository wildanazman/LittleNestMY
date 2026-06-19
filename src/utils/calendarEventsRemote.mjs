import {
  deleteLocalCalendarEvent,
  getLogsForBaby,
  getPersistedCalendarEvents,
  saveLocalCalendarEvent
} from "./localState.mjs";
import { getAuthSession, isGuestMode } from "./localAuth.mjs";
import { isSupabaseConfigured, supabase, supabaseConfigMessage } from "./supabaseClient.mjs";

const calendarMigrationKey = "littlenest:calendarEventsSupabaseMigratedAt";

export { calendarMigrationKey };

export async function loadCalendarEventsRemote(selectedBabyId, fallback = []) {
  const local = getLogsForBaby(getPersistedCalendarEvents(fallback), selectedBabyId);
  if (!selectedBabyId) return { calendarEvents: local, source: "localStorage", error: "Create a baby profile first." };
  if (!isSupabaseConfigured || isGuestMode()) return { calendarEvents: local, source: "localStorage", error: isGuestMode() ? "" : supabaseConfigMessage };

  const session = await getAuthSession();
  if (!session) return { calendarEvents: local, source: "localStorage", error: "Please log in to sync appointments." };

  try {
    await migrateCalendarEventsOnce(selectedBabyId, local);
    const { data, error } = await supabase
      .from("calendar_events")
      .select("*")
      .eq("baby_id", selectedBabyId)
      .order("starts_at", { ascending: true });
    if (error) throw error;
    const remote = (data || []).map(fromCalendarEventRow);
    remote.forEach(saveLocalCalendarEvent);
    return { calendarEvents: mergeById(remote, pendingLocalItems(local)), source: "supabase", error: "" };
  } catch (error) {
    console.warn("Supabase calendar event load failed.", error);
    return { calendarEvents: local, source: "localStorage", error: friendlyCalendarError(error, "load appointments").message };
  }
}

export async function saveCalendarEventRemote(event) {
  saveLocalCalendarEvent(event);
  if (!canUseSupabase(event.babyId)) return event;

  const session = await getAuthSession();
  if (!session?.user) return event;

  try {
    const remoteId = stableUuid(event.id, "event");
    const { data, error } = await supabase
      .from("calendar_events")
      .upsert(toCalendarEventRow({ ...event, id: remoteId }, session.user.id), { onConflict: "id" })
      .select("*")
      .single();
    if (error) throw error;

    if (event.id !== data.id) deleteLocalCalendarEvent(event.id);
    const savedItem = fromCalendarEventRow(data);
    saveLocalCalendarEvent(savedItem);
    return savedItem;
  } catch (error) {
    throw friendlyCalendarError(error, "save appointment");
  }
}

export async function deleteCalendarEventRemote(eventId) {
  deleteLocalCalendarEvent(eventId);
  if (!isSupabaseConfigured || isGuestMode() || !isUuid(eventId) || !(await getAuthSession())) return;
  const { error } = await supabase.from("calendar_events").delete().eq("id", eventId);
  if (error) throw friendlyCalendarError(error, "delete appointment");
}

async function migrateCalendarEventsOnce(selectedBabyId, local) {
  const marker = readMigrationMarker();
  if (marker[selectedBabyId]) return;

  const candidates = (local || []).filter((item) => item?.id && !isUuid(item.id));
  if (!candidates.length) {
    writeMigrationMarker(selectedBabyId);
    return;
  }

  const session = await getAuthSession();
  if (!session?.user) return;

  for (const event of candidates) {
    const remoteId = stableUuid(event.id, "event");
    const { error } = await supabase
      .from("calendar_events")
      .upsert(toCalendarEventRow({ ...event, id: remoteId }, session.user.id), { onConflict: "id" });
    if (error) {
      console.warn("Migration of calendar event skipped.", event.id, error);
    } else if (event.id !== remoteId) {
      deleteLocalCalendarEvent(event.id);
    }
  }
  writeMigrationMarker(selectedBabyId);
}

function fromCalendarEventRow(row) {
  return {
    id: row.id,
    babyId: row.baby_id,
    type: fromRemoteCategory(row.category),
    title: row.title,
    startsAt: row.starts_at,
    endsAt: row.ends_at || undefined,
    reminderMinutesBefore: row.reminder_minutes_before || undefined,
    notes: row.notes || undefined,
    isAllDay: false,
    createdAt: row.created_at || "",
    updatedAt: row.updated_at || ""
  };
}

function toCalendarEventRow(event, createdBy) {
  return {
    id: stableUuid(event.id, "event"),
    baby_id: event.babyId,
    created_by: createdBy,
    title: event.title,
    category: toRemoteCategory(event.type),
    starts_at: event.startsAt,
    ends_at: event.endsAt || null,
    reminder_minutes_before: event.reminderMinutesBefore || null,
    notes: event.notes || null
  };
}

function toRemoteCategory(type) {
  if (type === "reminder") return "other";
  return type || "other";
}

function fromRemoteCategory(category) {
  return category || "other";
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

function friendlyCalendarError(error, action) {
  const message = error?.message || String(error || "");
  if (/row-level security|permission denied|violates row-level security/i.test(message)) {
    return new Error(`Supabase RLS blocked ${action}. Check calendar_events policies. Original error: ${message}`);
  }
  return new Error(message || `Could not ${action}.`);
}

function readMigrationMarker() {
  try {
    const value = window.localStorage.getItem(calendarMigrationKey);
    return value ? JSON.parse(value) || {} : {};
  } catch {
    return {};
  }
}

function writeMigrationMarker(selectedBabyId) {
  try {
    window.localStorage.setItem(calendarMigrationKey, JSON.stringify({
      ...readMigrationMarker(),
      [selectedBabyId]: new Date().toISOString()
    }));
  } catch {
  }
}
