/** @type {import("../types/screen.mjs").ScreenDefinition[]} */
export const screens = [
  { id: "auth_welcome", title: "Welcome", group: "auth", path: "auth_welcome/code.html", preview: "auth_welcome/screen.png" },
  { id: "login", title: "Login", group: "auth", path: "login/code.html", preview: "login/screen.png" },
  { id: "signup", title: "Sign Up", group: "auth", path: "signup/code.html", preview: "signup/screen.png" },
  { id: "accept_invite", title: "Accept Invite", group: "auth", path: "accept_invite/code.html", preview: "auth_welcome/screen.png" },
  { id: "set_password", title: "Set Password", group: "auth", path: "set_password/code.html", preview: "auth_welcome/screen.png" },
  { id: "onboarding", title: "Onboarding", group: "core", path: "onboarding/code.html", preview: "onboarding/screen.png" },
  { id: "add_baby_profile", title: "Add Baby Profile", group: "core", path: "add_baby_profile/code.html", preview: "add_baby_profile/screen.png" },
  { id: "baby_profiles", title: "Baby Profiles", group: "core", path: "baby_profiles/code.html", preview: "add_baby_profile/screen.png" },
  { id: "home_dashboard", title: "Home Dashboard", group: "core", path: "home_dashboard/code.html", preview: "home_dashboard/screen.png" },
  { id: "quick_log", title: "Quick Log", group: "log", path: "quick_log/code.html", preview: "quick_log/screen.png" },
  { id: "feeding_log", title: "Feeding Log", group: "log", path: "feeding_log/code.html", preview: "feeding_log/screen.png" },
  { id: "sleep_log", title: "Sleep Log", group: "log", path: "sleep_log/code.html", preview: "sleep_log/screen.png" },
  { id: "diaper_log", title: "Diaper Log", group: "log", path: "diaper_log/code.html", preview: "diaper_log/screen.png" },
  { id: "health_records", title: "Health Records", group: "log", path: "health_records/code.html", preview: "quick_log/screen.png" },
  { id: "mama_care", title: "Mama Care", group: "core", path: "mama_care/code.html", preview: "home_dashboard/screen.png" },
  { id: "daily_summary", title: "Daily Summary", group: "core", path: "daily_summary/code.html", preview: "home_dashboard/screen.png" },
  { id: "calendar", title: "Calendar", group: "core", path: "calendar/code.html", preview: "calendar/screen.png" },
  { id: "growth_tracker", title: "Growth Tracker", group: "core", path: "growth_tracker/code.html", preview: "growth_tracker/screen.png" },
  { id: "weekly_insights", title: "Weekly Insights", group: "insight", path: "weekly_insights/code.html", preview: "weekly_insights/screen.png" },
  { id: "doctor_report", title: "Doctor Report", group: "insight", path: "doctor_report/code.html", preview: "growth_tracker/screen.png" },
  { id: "milestones", title: "Milestones", group: "core", path: "milestones/code.html", preview: "milestones/screen.png" },
  { id: "memory_book", title: "Memory Book", group: "core", path: "memory_book/code.html", preview: "memory_book/screen.png" },
  { id: "assistant", title: "Assistant", group: "core", path: "assistant/code.html", preview: "assistant/screen.png" },
  { id: "family_sharing", title: "Family Sharing", group: "settings", path: "family_sharing/code.html", preview: "family_sharing/screen.png" },
  { id: "mommy_guide", title: "Mommy Guide", group: "settings", path: "mommy_guide/code.html", preview: "mommy_guide/screen.png" },
  { id: "privacy_safety", title: "Privacy & Safety", group: "settings", path: "privacy_safety/code.html", preview: "privacy_safety/screen.png" },
  { id: "settings", title: "Settings", group: "settings", path: "settings/code.html", preview: "settings/screen.png" }
];

export const defaultScreenId = "auth_welcome";

export function getScreenById(id) {
  return screens.find((screen) => screen.id === id);
}
