import {
  babyProfilesKey,
  cacheSupabaseBabyProfiles,
  getBabyIdMap,
  getBabyProfiles,
  readSelectedBabyId,
  rememberSupabaseBabyMapping,
  selectedBabyIdKey
} from "./localState.mjs";
import { getAuthSession } from "./localAuth.mjs";
import { isSupabaseConfigured, supabase, supabaseConfigMessage } from "./supabaseClient.mjs";

const babyProfileMigrationKey = "littlenest:babyProfilesSupabaseMigratedAt";

export { babyProfileMigrationKey };

export async function loadBabyProfilesRemote(fallbackProfile) {
  const fallbackProfiles = getBabyProfiles(fallbackProfile);

  if (!isSupabaseConfigured) {
    return fallbackResult(fallbackProfiles, "Supabase is not configured. Using local baby profiles for now.");
  }

  const session = await getAuthSession();
  if (!session) {
    return fallbackResult(fallbackProfiles, "Please log in to load synced baby profiles.");
  }

  try {
    let profiles = await fetchRemoteBabyProfiles();
    if (!profiles.length && fallbackProfiles.length) {
      profiles = await migrateLocalBabyProfiles(fallbackProfiles);
    }

    const selectedBabyId = chooseSelectedBabyId(profiles);
    cacheSupabaseBabyProfiles(profiles, selectedBabyId);

    return {
      profiles,
      selectedBabyId,
      selectedBaby: profiles.find((profile) => profile.id === selectedBabyId) || profiles[0] || null,
      source: "supabase",
      error: ""
    };
  } catch (error) {
    console.warn("Supabase baby profile load failed.", error);
    return fallbackResult(
      fallbackProfiles,
      `${error.message || "Could not load Supabase baby profiles."} Using local baby profiles for now.`
    );
  }
}

export async function hasAnyBabyProfileRemote(fallbackProfile) {
  const result = await loadBabyProfilesRemote(fallbackProfile);
  return result.profiles.length > 0;
}

export async function createBabyProfileRemote(profile, fallbackProfile) {
  if (!isSupabaseConfigured) throw new Error(supabaseConfigMessage);
  const session = await getAuthSession();
  if (!session) throw new Error("Please log in before creating a baby profile.");

  const { data, error } = await supabase
    .from("babies")
    .insert(toBabyRow(profile, session.user.id))
    .select("*")
    .single();

  if (error) throw rlsFriendlyError(error, "create baby");

  await ensureParentMembership(data.id, session.user.id);
  const baby = fromBabyRow(data);
  setSelectedBabyIdRemote(baby.id);
  cacheSupabaseBabyProfiles(await fetchRemoteBabyProfiles(), baby.id);
  return baby;
}

export async function updateBabyProfileRemote(profile, fallbackProfile) {
  if (!isSupabaseConfigured) throw new Error(supabaseConfigMessage);
  const session = await getAuthSession();
  if (!session) throw new Error("Please log in before editing a baby profile.");
  if (!profile?.id) throw new Error("Missing baby profile id.");
  const babyId = resolveSupabaseBabyId(profile.id);

  const { data, error } = await supabase
    .from("babies")
    .update(toBabyRow(profile))
    .eq("id", babyId)
    .select("*")
    .single();

  if (error) throw rlsFriendlyError(error, "update baby");

  const baby = fromBabyRow(data);
  rememberSupabaseBabyMapping(profile.id, baby.id);
  setSelectedBabyIdRemote(baby.id);
  cacheSupabaseBabyProfiles(await fetchRemoteBabyProfiles(), baby.id);
  return baby;
}

export async function getBabyProfileByIdRemote(babyId, fallbackProfile) {
  const result = await loadBabyProfilesRemote(fallbackProfile);
  const resolvedBabyId = resolveSupabaseBabyId(babyId, { allowMissing: true });
  return result.profiles.find((profile) => profile.id === resolvedBabyId || profile.id === babyId) || result.selectedBaby || null;
}

export function setSelectedBabyIdRemote(babyId) {
  const resolvedBabyId = resolveSupabaseBabyId(babyId, { allowMissing: true });
  try {
    window.localStorage.setItem(selectedBabyIdKey, JSON.stringify(resolvedBabyId || ""));
  } catch {
    // Local selected-baby persistence is a UI convenience.
  }
  return resolvedBabyId;
}

export function fromBabyRow(row) {
  if (!row) return null;
  return {
    id: row.id,
    name: row.name,
    dateOfBirth: row.date_of_birth,
    gender: row.gender || "",
    photoUrl: row.photo_url || "",
    feedingPreference: row.feeding_preference || "",
    notes: row.notes || "",
    createdAt: row.created_at || "",
    updatedAt: row.updated_at || ""
  };
}

export function toBabyRow(profile, createdBy = "") {
  const row = {
    name: String(profile.name || "").trim(),
    date_of_birth: profile.dateOfBirth || profile.date_of_birth,
    gender: profile.gender || null,
    photo_url: profile.photoUrl || profile.photo_url || null,
    feeding_preference: profile.feedingPreference || profile.feeding_preference || null,
    notes: profile.notes || null
  };

  if (createdBy) {
    row.created_by = createdBy;
  }

  return row;
}

async function fetchRemoteBabyProfiles() {
  const { data, error } = await supabase
    .from("babies")
    .select("*")
    .order("created_at", { ascending: true });

  if (error) throw rlsFriendlyError(error, "read babies");
  return (data || []).map(fromBabyRow).filter(Boolean);
}

async function migrateLocalBabyProfiles(localProfiles) {
  const session = await getAuthSession();
  if (!session) throw new Error("Please log in before migrating baby profiles.");
  const migrated = [];

  for (const localProfile of localProfiles) {
    const { data, error } = await supabase
      .from("babies")
      .insert(toBabyRow(localProfile, session.user.id))
      .select("*")
      .single();

    if (error) throw rlsFriendlyError(error, "migrate local baby");

    const baby = fromBabyRow(data);
    rememberSupabaseBabyMapping(localProfile.id, baby.id);
    migrated.push(baby);
  }

  try {
    window.localStorage.setItem(babyProfileMigrationKey, new Date().toISOString());
  } catch {
    // Migration marker is only local bookkeeping.
  }

  return migrated;
}

async function ensureParentMembership(babyId, userId) {
  const { error } = await supabase
    .from("baby_members")
    .upsert({
      baby_id: babyId,
      user_id: userId,
      role: "parent",
      invited_by: userId
    }, { onConflict: "baby_id,user_id" });

  if (error) {
    console.warn("Could not explicitly upsert parent membership. The database trigger may already handle it.", error);
  }
}

function chooseSelectedBabyId(profiles) {
  const selectedBabyId = readSelectedBabyId();
  const mappedSelectedBabyId = resolveSupabaseBabyId(selectedBabyId, { allowMissing: true });
  if (profiles.some((profile) => profile.id === mappedSelectedBabyId)) return mappedSelectedBabyId;
  if (profiles.some((profile) => profile.id === selectedBabyId)) return selectedBabyId;
  return profiles[0]?.id || "";
}

function fallbackResult(profiles, error) {
  const selectedBabyId = chooseSelectedBabyId(profiles);
  return {
    profiles,
    selectedBabyId,
    selectedBaby: profiles.find((profile) => profile.id === selectedBabyId) || profiles[0] || null,
    source: "localStorage",
    error
  };
}

function rlsFriendlyError(error, action) {
  const message = error?.message || String(error || "");
  const details = error?.details ? ` ${error.details}` : "";
  if (/row-level security|permission denied|violates row-level security/i.test(`${message}${details}`)) {
    return new Error(
      `Supabase RLS blocked ${action}. Check policies for babies and baby_members: the signed-in user must be able to create a baby, become parent member, and read babies where they are a member. Original error: ${message}`
    );
  }
  return new Error(message || `Could not ${action}.`);
}

function resolveSupabaseBabyId(babyId, options = {}) {
  if (!babyId) return "";
  if (isUuid(babyId)) return babyId;

  const map = getBabyIdMap();
  const mappedId = map[babyId]
    || Object.entries(map || {}).find(([, remoteId]) => remoteId === babyId)?.[1]
    || "";

  if (mappedId && isUuid(mappedId)) return mappedId;
  if (options.allowMissing) return babyId;

  throw new Error("Baby profile sync is incomplete. Please refresh and try again.");
}

function isUuid(value) {
  return /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i.test(String(value || ""));
}
