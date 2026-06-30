import {
  getAuthenticatedUser,
  getConfigError,
  hasServerSupabaseConfig,
  readJsonBody,
  sendJson
} from "./_supabaseAdmin.mjs";
import { isEmailProviderConfigured, sendEmail } from "./_email.mjs";

const FEEDBACK_TO = "wildanazman072@gmail.com";
const MAX_MESSAGE_CHARS = 5000;
const MAX_SCREENSHOT_BYTES = 3 * 1024 * 1024;
const ALLOWED_IMAGE_TYPES = new Set(["image/png", "image/jpeg", "image/webp"]);
const rateMap = new Map();
const MAX_ATTEMPTS = 5;
const WINDOW_MS = 15 * 60 * 1000;

function checkRateLimit(key) {
  const now = Date.now();
  const recent = (rateMap.get(key) || []).filter((t) => t > now - WINDOW_MS);
  rateMap.set(key, recent);
  return recent.length >= MAX_ATTEMPTS;
}

function recordAttempt(key) {
  const attempts = rateMap.get(key) || [];
  attempts.push(Date.now());
  rateMap.set(key, attempts);
}

export default async function handler(req, res) {
  if (req.method !== "POST") {
    res.setHeader("allow", "POST");
    return sendJson(res, 405, { error: "Method not allowed." });
  }
  if (!hasServerSupabaseConfig()) {
    return sendJson(res, 500, { error: getConfigError() });
  }
  if (!isEmailProviderConfigured()) {
    return sendJson(res, 500, { error: "Email provider is not configured." });
  }

  const auth = await getAuthenticatedUser(req);
  if (!auth.user) return sendJson(res, 401, { error: auth.error });

  const ip = req.headers["x-forwarded-for"]?.split(",")[0]?.trim() || req.socket?.remoteAddress || "unknown";
  const userKey = auth.user.id || auth.user.email || ip;
  if (checkRateLimit(userKey) || checkRateLimit(ip)) {
    return sendJson(res, 429, { error: "Too many reports. Please wait 15 minutes." });
  }

  const body = await readJsonBody(req);
  const message = String(body.message || "").trim();
  const pageUrl = String(body.pageUrl || "").trim().slice(0, 500);
  const profileName = String(body.name || "").trim().slice(0, 120);
  const profileEmail = String(body.email || auth.user.email || "").trim().slice(0, 180);
  const userAgent = String(body.userAgent || req.headers["user-agent"] || "").trim().slice(0, 500);
  const screenshot = normalizeScreenshot(body.screenshot);

  if (message.length < 8) {
    return sendJson(res, 400, { error: "Write a little more detail before sending." });
  }
  if (message.length > MAX_MESSAGE_CHARS) {
    return sendJson(res, 400, { error: `Keep the report under ${MAX_MESSAGE_CHARS} characters.` });
  }
  if (screenshot.error) {
    return sendJson(res, 400, { error: screenshot.error });
  }

  recordAttempt(userKey);
  recordAttempt(ip);

  const submittedAt = new Date().toISOString();
  const html = feedbackEmailHtml({
    message,
    pageUrl,
    profileName,
    profileEmail,
    authEmail: auth.user.email || "",
    userId: auth.user.id || "",
    userAgent,
    submittedAt,
    hasScreenshot: Boolean(screenshot.attachment)
  });

  try {
    await sendEmail({
      to: FEEDBACK_TO,
      subject: `LittleNest MY feedback - ${profileName || profileEmail || auth.user.email || "user"}`,
      replyTo: profileEmail || auth.user.email || "",
      html,
      attachments: screenshot.attachment ? [screenshot.attachment] : []
    });
    return sendJson(res, 200, { sent: true });
  } catch (error) {
    return sendJson(res, 502, { error: error.message || "Could not send feedback." });
  }
}

function normalizeScreenshot(input) {
  if (!input) return { attachment: null, error: "" };
  const filename = String(input.filename || "screenshot").replace(/[^\w.-]+/g, "_").slice(0, 80) || "screenshot";
  const contentType = String(input.contentType || "").toLowerCase();
  const content = String(input.content || "").replace(/^data:[^;]+;base64,/, "");
  const size = Number(input.size || Math.floor((content.length * 3) / 4));

  if (!ALLOWED_IMAGE_TYPES.has(contentType)) {
    return { attachment: null, error: "Screenshot must be PNG, JPG, or WebP." };
  }
  if (!content || !/^[A-Za-z0-9+/=]+$/.test(content)) {
    return { attachment: null, error: "Screenshot could not be read." };
  }
  if (!Number.isFinite(size) || size > MAX_SCREENSHOT_BYTES) {
    return { attachment: null, error: "Screenshot must be under 3MB." };
  }

  return {
    attachment: {
      filename,
      content,
      content_type: contentType
    },
    error: ""
  };
}

function feedbackEmailHtml(details) {
  const rows = [
    ["Name", details.profileName || "-"],
    ["Profile email", details.profileEmail || "-"],
    ["Auth email", details.authEmail || "-"],
    ["User ID", details.userId || "-"],
    ["Page", details.pageUrl || "-"],
    ["Submitted", details.submittedAt],
    ["Screenshot", details.hasScreenshot ? "Attached" : "Not attached"],
    ["User agent", details.userAgent || "-"]
  ].map(([label, value]) => `
    <tr>
      <td style="padding:8px 10px;border-bottom:1px solid #f0e7e1;color:#7a655b;font-size:12px;width:120px;">${escapeHtml(label)}</td>
      <td style="padding:8px 10px;border-bottom:1px solid #f0e7e1;color:#2b211d;font-size:13px;">${escapeHtml(value)}</td>
    </tr>`).join("");

  return `<!DOCTYPE html><html><body style="margin:0;background:#fbf9f4;font-family:Arial,sans-serif;color:#211a17;">
    <div style="max-width:680px;margin:0 auto;padding:24px;">
      <h1 style="margin:0 0 14px;color:#83533c;font-size:22px;">LittleNest MY feedback</h1>
      <div style="background:#fff;border-radius:18px;padding:20px;border:1px solid #f0e7e1;">
        <h2 style="margin:0 0 10px;font-size:16px;color:#211a17;">Message</h2>
        <p style="white-space:pre-wrap;line-height:1.55;font-size:14px;color:#2b211d;">${escapeHtml(details.message)}</p>
        <h2 style="margin:22px 0 10px;font-size:16px;color:#211a17;">Details</h2>
        <table style="width:100%;border-collapse:collapse;">${rows}</table>
      </div>
    </div>
  </body></html>`;
}

function escapeHtml(value) {
  return String(value || "")
    .replaceAll("&", "&amp;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;")
    .replaceAll('"', "&quot;")
    .replaceAll("'", "&#039;");
}
