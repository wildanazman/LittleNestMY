import {
  deleteLocalMilestone,
  getLogsForBaby,
  getPersistedMilestones,
  saveLocalMilestone
} from "./localState.mjs";
import { getAuthSession, isGuestMode } from "./localAuth.mjs";
import { isSupabaseConfigured, supabase, supabaseConfigMessage } from "./supabaseClient.mjs";

const memoryBucket = "littlenest-memories";
const milestoneMigrationKey = "littlenest:milestonesSupabaseMigratedAt";

export async function loadMilestonesRemote(selectedBabyId, fallback = []) {
  const local = getLogsForBaby(getPersistedMilestones(fallback), selectedBabyId);
  if (!selectedBabyId) return { milestones: local, source: "localStorage", error: "Create a baby profile first." };
  if (!isSupabaseConfigured || isGuestMode()) return { milestones: local, source: "localStorage", error: isGuestMode() ? "" : supabaseConfigMessage };

  const session = await getAuthSession();
  if (!session) return { milestones: local, source: "localStorage", error: "Please log in to sync memories." };

  try {
    await migrateMilestonesOnce(selectedBabyId, local);
    const { data, error } = await supabase
      .from("milestones")
      .select("*")
      .eq("baby_id", selectedBabyId)
      .order("happened_on", { ascending: false });
    if (error) throw error;
    const remote = (data || []).map(fromMilestoneRow);
    remote.forEach(saveLocalMilestone);
    return { milestones: mergeById(remote, pendingLocalItems(local)), source: "supabase", error: "" };
  } catch (error) {
    console.warn("Supabase milestone load failed.", error);
    return { milestones: local, source: "localStorage", error: friendlyMilestoneError(error, "load memories").message };
  }
}

export { milestoneMigrationKey };

export async function saveMilestoneRemote(milestone) {
  // saveLocalMilestone returns the whole collection, so always return the
  // milestone object itself — callers rely on saved.id to delete/edit, and
  // the remote branch must hand back the real server id.
  saveLocalMilestone(milestone);
  if (!canUseSupabase(milestone.babyId)) return milestone;

  const session = await getAuthSession();
  if (!session?.user) return milestone;

  try {
    const remoteId = stableUuid(milestone.id, "milestone");
    let photoUrl = milestone.photoUrl || "";
    let photoPath = "";

    if (photoUrl.startsWith("data:")) {
      const uploaded = await uploadMilestonePhoto(photoUrl, {
        babyId: milestone.babyId,
        milestoneId: remoteId,
        userId: session.user.id
      });
      photoUrl = uploaded.publicUrl || photoUrl;
      photoPath = uploaded.path || "";
    }

    const { data, error } = await supabase
      .from("milestones")
      .upsert(toMilestoneRow({ ...milestone, id: remoteId, photoUrl }, session.user.id), { onConflict: "id" })
      .select("*")
      .single();
    if (error) throw error;

    if (photoPath) await savePhotoMetadata({ babyId: milestone.babyId, path: photoPath, milestoneId: remoteId });
    if (milestone.id !== data.id) deleteLocalMilestone(milestone.id);
    const savedItem = fromMilestoneRow(data);
    saveLocalMilestone(savedItem);
    return savedItem;
  } catch (error) {
    throw friendlyMilestoneError(error, "save memory");
  }
}

export async function deleteMilestoneRemote(milestoneId) {
  deleteLocalMilestone(milestoneId);
  if (!isSupabaseConfigured || isGuestMode() || !isUuid(milestoneId) || !(await getAuthSession())) return;
  const { error } = await supabase.from("milestones").delete().eq("id", milestoneId);
  if (error) throw friendlyMilestoneError(error, "delete memory");
}

async function uploadMilestonePhoto(dataUrl, { babyId, milestoneId }) {
  const blob = await (await fetch(dataUrl)).blob();
  const ext = (blob.type.split("/")[1] || "jpg").replace("jpeg", "jpg");
  const path = `milestones/${babyId}/${milestoneId}-${Date.now()}.${ext}`;
  const { error } = await supabase.storage
    .from(memoryBucket)
    .upload(path, blob, { upsert: true, contentType: blob.type || "image/jpeg" });
  if (error) throw error;
  const { data } = supabase.storage.from(memoryBucket).getPublicUrl(path);
  return { path, publicUrl: data?.publicUrl || "" };
}

async function savePhotoMetadata({ babyId, path, milestoneId }) {
  try {
    await supabase.from("photo_metadata").insert({
      baby_id: babyId,
      storage_bucket: memoryBucket,
      storage_path: path,
      purpose: "milestone_photo",
      related_table: "milestones",
      related_id: milestoneId
    });
  } catch {
    // Metadata is useful for audit, but the photo and milestone are already saved.
  }
}

async function migrateMilestonesOnce(selectedBabyId, local) {
  const marker = readMigrationMarker();
  if (marker[selectedBabyId]) return;

  const candidates = (local || []).filter((item) => item?.id && (!isUuid(item.id) || String(item.photoUrl || "").startsWith("data:")));
  if (!candidates.length) {
    writeMigrationMarker(selectedBabyId);
    return;
  }

  for (const milestone of candidates) {
    await saveMilestoneRemote({ ...milestone, babyId: selectedBabyId });
  }
  writeMigrationMarker(selectedBabyId);
}

function fromMilestoneRow(row) {
  return {
    id: row.id,
    babyId: row.baby_id,
    title: row.title,
    category: row.milestone_type || "memory",
    achievedAt: row.happened_on,
    notes: row.note || "",
    photoUrl: row.photo_url || "",
    createdAt: row.created_at || "",
    updatedAt: row.updated_at || ""
  };
}

function toMilestoneRow(milestone, createdBy) {
  return {
    id: stableUuid(milestone.id, "milestone"),
    baby_id: milestone.babyId,
    created_by: createdBy,
    title: milestone.title,
    milestone_type: milestone.category || "memory",
    happened_on: milestone.achievedAt,
    note: milestone.notes || null,
    photo_url: milestone.photoUrl || null
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
  // Note: the 4th group needs its own dash — the old regex merged groups 4
  // and 5, so it rejected every real uuid. That made deleteMilestoneRemote
  // skip the remote delete (milestones "came back") and made stableUuid
  // regenerate ids instead of reusing the client uuid.
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

function friendlyMilestoneError(error, action) {
  const message = error?.message || String(error || "");
  if (/bucket not found|storage/i.test(message)) {
    return new Error(`Could not ${action} photo to cloud yet. Please run the milestone Storage SQL, then try again.`);
  }
  if (/row-level security|permission denied|violates row-level security/i.test(message)) {
    return new Error(`Supabase RLS blocked ${action}. Parent/caregiver write access may need checking. Original error: ${message}`);
  }
  return new Error(message || `Could not ${action}.`);
}

function readMigrationMarker() {
  try {
    const value = window.localStorage.getItem(milestoneMigrationKey);
    return value ? JSON.parse(value) || {} : {};
  } catch {
    return {};
  }
}

function writeMigrationMarker(selectedBabyId) {
  try {
    window.localStorage.setItem(milestoneMigrationKey, JSON.stringify({
      ...readMigrationMarker(),
      [selectedBabyId]: new Date().toISOString()
    }));
  } catch {
    // Migration marker is best-effort only.
  }
}
