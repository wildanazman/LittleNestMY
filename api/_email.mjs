// Own-brand transactional email via Resend's REST API (no SDK dependency).
//
// Enabled only when RESEND_API_KEY is set. When it isn't, isEmailProviderConfigured()
// returns false and callers fall back to Supabase's built-in emails, so nothing
// breaks before the provider + sending domain are set up.

const RESEND_API_KEY = process.env.RESEND_API_KEY || "";
// Must be an address on a domain you've verified in Resend.
const EMAIL_FROM = process.env.RESEND_FROM || "LittleNest MY <noreply@littlenestmy.com>";
const BRAND = "LittleNest MY";
const PRIMARY = "#83533c";

export function isEmailProviderConfigured() {
  return Boolean(RESEND_API_KEY);
}

export async function sendEmail({ to, subject, html }) {
  if (!RESEND_API_KEY) throw new Error("RESEND_API_KEY is not set.");
  const response = await fetch("https://api.resend.com/emails", {
    method: "POST",
    headers: {
      "Authorization": `Bearer ${RESEND_API_KEY}`,
      "Content-Type": "application/json"
    },
    body: JSON.stringify({ from: EMAIL_FROM, to: [to], subject, html })
  });
  if (!response.ok) {
    const detail = await response.text().catch(() => "");
    throw new Error(`Resend send failed (${response.status}): ${detail.slice(0, 300)}`);
  }
  return response.json().catch(() => ({}));
}

function shell(title, bodyHtml) {
  return `<!DOCTYPE html><html><body style="margin:0;background:#fbf9f4;font-family:'Segoe UI',Arial,sans-serif;color:#211a17;">
  <div style="max-width:480px;margin:0 auto;padding:28px 20px;">
    <div style="text-align:center;margin-bottom:18px;">
      <span style="font-size:22px;font-weight:800;color:${PRIMARY};">${BRAND}</span>
    </div>
    <div style="background:#ffffff;border-radius:20px;padding:28px 24px;box-shadow:0 10px 30px rgba(131,83,60,.10);">
      <h1 style="margin:0 0 12px;font-size:20px;color:${PRIMARY};">${title}</h1>
      ${bodyHtml}
    </div>
    <p style="text-align:center;color:#8a7d76;font-size:12px;margin-top:18px;">
      You received this email from ${BRAND}. If you didn't expect it, you can ignore it.
    </p>
  </div></body></html>`;
}

function button(href, label) {
  return `<a href="${href}" style="display:inline-block;background:${PRIMARY};color:#ffffff;text-decoration:none;font-weight:700;padding:13px 22px;border-radius:9999px;margin:8px 0;">${label}</a>`;
}

export function inviteEmailHtml({ inviteUrl, babyName, inviterName, role }) {
  const who = inviterName ? `${escapeHtml(inviterName)} invited you` : "You've been invited";
  const baby = babyName ? ` to help care for <strong>${escapeHtml(babyName)}</strong>` : "";
  const roleLine = role ? `<p style="color:#53433d;font-size:14px;">Your role: <strong>${escapeHtml(role)}</strong>.</p>` : "";
  const body = `
    <p style="color:#53433d;font-size:15px;line-height:1.6;">${who}${baby} on ${BRAND}.</p>
    ${roleLine}
    <p style="margin:16px 0;">${button(inviteUrl, "Accept invitation")}</p>
    <p style="color:#8a7d76;font-size:13px;line-height:1.6;">Or paste this link into your browser:<br><a href="${inviteUrl}" style="color:${PRIMARY};word-break:break-all;">${inviteUrl}</a></p>
    <p style="color:#8a7d76;font-size:13px;">This invitation expires in 7 days.</p>`;
  return shell("Join the care circle", body);
}

export function resetEmailHtml({ resetUrl }) {
  const body = `
    <p style="color:#53433d;font-size:15px;line-height:1.6;">We got a request to reset your ${BRAND} password. Tap below to choose a new one.</p>
    <p style="margin:16px 0;">${button(resetUrl, "Reset password")}</p>
    <p style="color:#8a7d76;font-size:13px;line-height:1.6;">Or paste this link into your browser:<br><a href="${resetUrl}" style="color:${PRIMARY};word-break:break-all;">${resetUrl}</a></p>
    <p style="color:#8a7d76;font-size:13px;">If you didn't request this, you can safely ignore this email — your password won't change.</p>`;
  return shell("Reset your password", body);
}

function escapeHtml(value) {
  return String(value || "")
    .replaceAll("&", "&amp;").replaceAll("<", "&lt;").replaceAll(">", "&gt;")
    .replaceAll('"', "&quot;").replaceAll("'", "&#039;");
}
