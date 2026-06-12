import { getAuthSession } from "./localAuth.mjs";
import { isSupabaseConfigured, supabase } from "./supabaseClient.mjs";

export const viewOnlyMessage = "You have view-only access for this baby.";

export function permissionsForRole(role) {
  const normalized = String(role || "viewer").toLowerCase();
  return {
    role: normalized,
    canView: ["parent", "caregiver", "viewer"].includes(normalized),
    canAddLogs: ["parent", "caregiver"].includes(normalized),
    canEditLogs: ["parent", "caregiver"].includes(normalized),
    canManageBaby: normalized === "parent",
    canManageFamily: normalized === "parent"
  };
}

export async function getBabyPermissions(babyId) {
  if (!babyId) return permissionsForRole("viewer");
  if (!isSupabaseConfigured) return permissionsForRole("parent");

  const session = await getAuthSession();
  if (!session?.user?.id) return permissionsForRole("viewer");

  const { data, error } = await supabase
    .from("baby_members")
    .select("role")
    .eq("baby_id", babyId)
    .eq("user_id", session.user.id)
    .maybeSingle();

  if (error) {
    console.warn("Could not load baby permissions.", error);
    return permissionsForRole("viewer");
  }

  return permissionsForRole(data?.role || "viewer");
}

export function showViewOnlyNotice(message = viewOnlyMessage) {
  let notice = document.getElementById("viewOnlyNotice");
  if (!notice) {
    notice = document.createElement("div");
    notice.id = "viewOnlyNotice";
    notice.className = "fixed left-4 right-4 top-4 z-[120] mx-auto max-w-md rounded-2xl bg-surface-container-lowest border border-primary-container p-4 text-center soft-shadow";
    notice.innerHTML = `
      <p class="font-label-md text-label-md text-on-surface" data-view-only-message></p>
    `;
    document.body.appendChild(notice);
  }
  notice.querySelector("[data-view-only-message]").textContent = message;
  notice.classList.remove("hidden");
  return notice;
}

export function redirectViewOnly(screenUrl, delay = 900) {
  showViewOnlyNotice();
  setTimeout(() => {
    window.location.href = screenUrl("home_dashboard");
  }, delay);
}
