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

export async function requirePremium(message) {
  const plan = await getCurrentPlan();
  if (!isPremium(plan)) {
    throw new Error(message || "This feature requires LittleNest Premium.");
  }
}
