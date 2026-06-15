import {
  cacheSupabaseBabyProfiles,
  createBabyProfile,
  deleteBabyProfile,
  getBabyIdMap,
  getBabyProfiles,
  readSelectedBabyId,
  rememberSupabaseBabyMapping,
  saveBabyProfile,
  selectedBabyIdKey
} from "./localState.mjs";
import { getAuthSession, isGuestMode } from "./localAuth.mjs";
import { isSupabaseConfigured, supabase, supabaseConfigMessage } from "./supabaseClient.mjs";

const babyProfileMigrationKey = "littlenest:babyProfilesSupabaseMigratedAt";

export { babyProfileMigrationKey };

export async function loadBabyProfilesRemote(fallbackProfile) {
  if (!isSupabaseConfigured) {
    const fallbackProfiles = getBabyProfiles(fallbackProfile);
    return fallbackResult(fallbackProfiles, "Supabase is not configured. Using local baby profiles for now.");
  }

  const session = await getAuthSession();
  if (!session) {
    const fallbackProfiles = getBabyProfiles(fallbackProfile);
    return fallbackResult(fallbackProfiles, isGuestMode() ? "" : "Please log in to load synced baby profiles.");
  }

  try {
    const profiles = await fetchRemoteBabyProfiles();
    const selectedBabyId = chooseSelectedBabyId(profiles, session.user.id);
    cacheSupabaseBabyProfiles(profiles, selectedBabyId);
    cacheUserBabyProfiles(session.user.id, profiles, selectedBabyId);

    return {
      profiles,
      selectedBabyId,
      selectedBaby: profiles.find((profile) => profile.id === selectedBabyId) || profiles[0] || null,
      source: "supabase",
      error: ""
    };
  } catch (error) {
    console.warn("Supabase baby profile load failed.", error);
    const cached = readUserBabyProfiles(session.user.id);
    return {
      profiles: cached.profiles,
      selectedBabyId: cached.selectedBabyId,
      selectedBaby: cached.profiles.find((profile) => profile.id === cached.selectedBabyId) || cached.profiles[0] || null,
      source: "supabase-cache",
      error: `${error.message || "Could not load Supabase baby profiles."} Using this account's cached baby profiles for now.`
    };
  }
}

export async function hasAnyBabyProfileRemote(fallbackProfile) {
  const result = await loadBabyProfilesRemote(fallbackProfile);
  return result.profiles.length > 0;
}

export async function createBabyProfileRemote(profile, fallbackProfile) {
  if (isGuestMode()) return createBabyProfile(profile, fallbackProfile);
  if (!isSupabaseConfigured) throw new Error(supabaseConfigMessage);
  const session = await getAuthSession();
  if (!session) throw new Error("Please log in before creating a baby profile.");
  const babyRow = toBabyRow(profile, session.user.id);
  console.log("Creating baby row:", babyRow);

  const { data, error } = await supabase
    .from("babies")
    .insert(babyRow)
    .select("*")
    .single();

  if (error) throw rlsFriendlyError(error, "create baby");

  await ensureParentMembership(data.id, session.user.id);
  const baby = fromBabyRow(data);
  setSelectedBabyIdRemote(baby.id);
  const profiles = await fetchRemoteBabyProfiles();
  cacheSupabaseBabyProfiles(profiles, baby.id);
  cacheUserBabyProfiles(session.user.id, profiles, baby.id);
  return baby;
}

export async function updateBabyProfileRemote(profile, fallbackProfile) {
  if (isGuestMode()) {
    const saved = saveBabyProfile(profile, fallbackProfile);
    setSelectedBabyIdRemote(saved.id);
    return saved;
  }
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
  const profiles = await fetchRemoteBabyProfiles();
  cacheSupabaseBabyProfiles(profiles, baby.id);
  cacheUserBabyProfiles(session.user.id, profiles, baby.id);
  return baby;
}

export async function deleteBabyProfileRemote(babyId, fallbackProfile) {
  if (isGuestMode()) return deleteBabyProfile(babyId, fallbackProfile);
  if (!isSupabaseConfigured) return deleteBabyProfile(babyId, fallbackProfile);
  const session = await getAuthSession();
  if (!session) throw new Error("Please log in before deleting a baby profile.");

  const currentProfiles = await fetchRemoteBabyProfiles();
  if (currentProfiles.length < 2) {
    throw new Error("Add another baby before deleting this profile.");
  }

  const resolvedBabyId = resolveSupabaseBabyId(babyId);
  const { data: membership, error: membershipError } = await supabase
    .from("baby_members")
    .select("role")
    .eq("baby_id", resolvedBabyId)
    .eq("user_id", session.user.id)
    .maybeSingle();

  if (membershipError) throw rlsFriendlyError(membershipError, "check baby permission");
  if (membership?.role !== "parent") throw new Error("Only a parent can delete a baby profile.");

  const { error } = await supabase
    .from("babies")
    .delete()
    .eq("id", resolvedBabyId);

  if (error) throw rlsFriendlyError(error, "delete baby");

  const profiles = (await fetchRemoteBabyProfiles()).filter((profile) => profile.id !== resolvedBabyId);
  const selectedBabyId = profiles[0]?.id || "";
  setSelectedBabyIdRemote(selectedBabyId);
  cacheSupabaseBabyProfiles(profiles, selectedBabyId);
  cacheUserBabyProfiles(session.user.id, profiles, selectedBabyId);
  return { profiles, selectedBabyId };
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
  getAuthSession().then((session) => {
    if (!session?.user?.id) return;
    try {
      window.localStorage.setItem(userSelectedBabyKey(session.user.id), JSON.stringify(resolvedBabyId || ""));
    } catch {
      // User-scoped selected baby is a sync fallback only.
    }
  }).catch(() => {});
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
    const babyRow = toBabyRow(localProfile, session.user.id);
    console.log("Creating baby row:", babyRow);

    const { data, error } = await supabase
      .from("babies")
      .insert(babyRow)
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

function chooseSelectedBabyId(profiles, userId = "") {
  const userSelectedBabyId = readUserSelectedBabyId(userId);
  const selectedBabyId = userSelectedBabyId || readSelectedBabyId();
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

function userCacheKey(userId) {
  return `littlenest:user:${userId}:babyProfiles`;
}

function userSelectedBabyKey(userId) {
  return `littlenest:user:${userId}:selectedBabyId`;
}

function cacheUserBabyProfiles(userId, profiles, selectedBabyId = "") {
  if (!userId) return;
  try {
    window.localStorage.setItem(userCacheKey(userId), JSON.stringify(profiles || []));
    window.localStorage.setItem(userSelectedBabyKey(userId), JSON.stringify(selectedBabyId || ""));
  } catch {
    // User-scoped baby cache is a sync fallback only.
  }
}

function readUserBabyProfiles(userId) {
  if (!userId) return { profiles: [], selectedBabyId: "" };
  try {
    const profiles = JSON.parse(window.localStorage.getItem(userCacheKey(userId)) || "[]");
    const selectedBabyId = JSON.parse(window.localStorage.getItem(userSelectedBabyKey(userId)) || "\"\"");
    return {
      profiles: Array.isArray(profiles) ? profiles : [],
      selectedBabyId: typeof selectedBabyId === "string" ? selectedBabyId : ""
    };
  } catch {
    return { profiles: [], selectedBabyId: "" };
  }
}

function readUserSelectedBabyId(userId) {
  return readUserBabyProfiles(userId).selectedBabyId;
}
