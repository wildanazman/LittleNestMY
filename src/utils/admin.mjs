// Admin accounts. Matched against the authenticated Supabase session email
// (a signed JWT claim, so a normal user can't spoof it client-side).
//
// Admins get: premium unlocked everywhere, and single-device login skipped
// (multiple concurrent sessions allowed) — for the owner's own testing/use.

const ADMIN_EMAILS = [
  "wildanazman072@gmail.com",
  "athifahyus@gmail.com"
];

export function isAdminEmail(email) {
  return ADMIN_EMAILS.includes(String(email || "").trim().toLowerCase());
}
