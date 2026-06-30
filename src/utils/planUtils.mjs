import { requireSupabaseClient, isSupabaseConfigured } from "./supabaseClient.mjs";
import { getAuthSession, isGuestMode } from "./localAuth.mjs";
import { isAdminEmail } from "./admin.mjs";

const PLAN_KEY = "littlenest:plan";
const PLAN_CACHE_TTL = 5 * 60 * 1000;
let planCache = { plan: "free", fetchedAt: 0 };

export async function getCurrentPlan() {
  const guest = isGuestMode();
  if (guest) return "free";

  const now = Date.now();
  if (planCache.fetchedAt && (now - planCache.fetchedAt) < PLAN_CACHE_TTL) {
    return planCache.plan;
  }

  const session = await getAuthSession();
  if (!session?.user?.id || !isSupabaseConfigured) {
    planCache = { plan: getLocalPlan(), fetchedAt: now };
    return planCache.plan;
  }

  // Admin accounts always have premium.
  if (isAdminEmail(session.user.email)) {
    planCache = { plan: "premium", fetchedAt: now };
    return "premium";
  }

  try {
    const supabase = requireSupabaseClient();
    const { data, error } = await supabase
      .from("profiles")
      .select("plan")
      .eq("id", session.user.id)
      .maybeSingle();

    if (error || !data) {
      planCache = { plan: getLocalPlan(), fetchedAt: now };
      return planCache.plan;
    }

    const plan = data.plan === "premium" ? "premium" : "free";
    planCache = { plan, fetchedAt: now };
    localStorage.setItem(PLAN_KEY, plan);
    return plan;
  } catch {
    planCache = { plan: getLocalPlan(), fetchedAt: now };
    return planCache.plan;
  }
}

export function getLocalPlan() {
  return localStorage.getItem(PLAN_KEY) || "free";
}

export function setLocalPlan(plan) {
  planCache = { plan, fetchedAt: Date.now() };
  localStorage.setItem(PLAN_KEY, plan);
}

export function isPremium(plan) {
  return plan === "premium";
}

// Length of the automatic premium trial granted to new accounts.
export const TRIAL_DAYS = 14;

// Resolves the user-facing plan state for the header/badges.
// - "premium": paid (or admin) account.
// - "trial":   free plan, still inside the 14-day premium trial window
//              (derived from the Supabase account creation date — no DB column needed).
// - "free":    free plan, trial expired, or guest.
// Returns { state, plan, daysLeft }.
export async function getPlanStatus() {
  const plan = await getCurrentPlan();
  if (plan === "premium") return { state: "premium", plan, daysLeft: 0 };

  if (isGuestMode()) return { state: "free", plan, daysLeft: 0 };

  const session = await getAuthSession();
  const createdAt = session?.user?.created_at;
  if (!createdAt) return { state: "free", plan, daysLeft: 0 };

  const created = new Date(createdAt).getTime();
  if (Number.isNaN(created)) return { state: "free", plan, daysLeft: 0 };

  const ageDays = (Date.now() - created) / 86400000;
  const daysLeft = Math.ceil(TRIAL_DAYS - ageDays);
  if (daysLeft > 0) return { state: "trial", plan, daysLeft };
  return { state: "free", plan, daysLeft: 0 };
}

// True when premium features should be unlocked (paid OR active trial).
export function isPremiumActive(status) {
  return status?.state === "premium" || status?.state === "trial";
}

export async function requirePremium(message) {
  const plan = await getCurrentPlan();
  if (!isPremium(plan)) {
    throw new Error(message || "This feature requires LittleNest Premium.");
  }
}
