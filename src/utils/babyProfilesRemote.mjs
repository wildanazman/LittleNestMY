import {
  babyProfilesKey,
  cacheSupabaseBabyProfiles,
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
    .insert(toBabyRow(profile))
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

  const { data, error } = await supabase
    .from("babies")
    .update(toBabyRow(profile))
    .eq("id", profile.id)
    .select("*")
    .single();

  if (error) throw rlsFriendlyError(error, "update baby");

  const baby = fromBabyRow(data);
  setSelectedBabyIdRemote(baby.id);
  cacheSupabaseBabyProfiles(await fetchRemoteBabyProfiles(), baby.id);
  return baby;
}

export async function getBabyProfileByIdRemote(babyId, fallbackProfile) {
  const result = await loadBabyProfilesRemote(fallbackProfile);
  return result.profiles.find((profile) => profile.id === babyId) || result.selectedBaby || null;
}

export function setSelectedBabyIdRemote(babyId) {
  try {
    window.localStorage.setItem(selectedBabyIdKey, JSON.stringify(babyId || ""));
  } catch {
    // Local selected-baby persistence is a UI convenience.
  }
  return babyId;
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

export function toBabyRow(profile) {
  return {
    name: String(profile.name || "").trim(),
    date_of_birth: profile.dateOfBirth || profile.date_of_birth,
    gender: profile.gender || null,
    photo_url: profile.photoUrl || profile.photo_url || null,
    feeding_preference: profile.feedingPreference || profile.feeding_preference || null,
    notes: profile.notes || null
  };
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
  const migrated = [];

  for (const localProfile of localProfiles) {
    const { data, error } = await supabase
      .from("babies")
      .insert(toBabyRow(localProfile))
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
