export const TEST_USER_EMAIL = "test@littlenest.my";

const TEST_PLAN_KEY_PREFIX = "littlenest:testPlan";
const VALID_TEST_PLANS = new Set(["free", "trial", "premium"]);

export function isTestPlanUser(userOrEmail) {
  const email = typeof userOrEmail === "string" ? userOrEmail : userOrEmail?.email;
  return normalizeEmail(email) === TEST_USER_EMAIL;
}

export function getTestPlanOverride(user) {
  if (!isTestPlanUser(user)) return "";
  const stored = readPlan(testPlanStorageKey(user?.id || user?.email || TEST_USER_EMAIL));
  return stored || "free";
}

export function setTestPlanOverride(user, plan) {
  if (!isTestPlanUser(user)) return "";
  const normalizedPlan = VALID_TEST_PLANS.has(String(plan)) ? String(plan) : "free";
  try {
    window.localStorage.setItem(testPlanStorageKey(user?.id || user?.email || TEST_USER_EMAIL), normalizedPlan);
  } catch {
    // Test override is local-only and best-effort.
  }
  return normalizedPlan;
}

function readPlan(key) {
  try {
    const value = window.localStorage.getItem(key);
    return VALID_TEST_PLANS.has(value) ? value : "";
  } catch {
    return "";
  }
}

function testPlanStorageKey(scope) {
  return `${TEST_PLAN_KEY_PREFIX}:${String(scope || TEST_USER_EMAIL).toLowerCase()}`;
}

function normalizeEmail(email) {
  return String(email || "").trim().toLowerCase();
}
