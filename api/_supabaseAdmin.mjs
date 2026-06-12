import { createClient } from "@supabase/supabase-js";

const supabaseUrl = process.env.VITE_SUPABASE_URL || process.env.SUPABASE_URL || "";
const supabaseAnonKey = process.env.VITE_SUPABASE_ANON_KEY || process.env.SUPABASE_ANON_KEY || "";
const serviceRoleKey = process.env.SUPABASE_SERVICE_ROLE_KEY || "";

export function hasServerSupabaseConfig() {
  return Boolean(supabaseUrl && supabaseAnonKey && serviceRoleKey);
}

export function getConfigError() {
  if (!supabaseUrl || !supabaseAnonKey) return "Missing Supabase URL or anon key.";
  if (!serviceRoleKey) return "Missing SUPABASE_SERVICE_ROLE_KEY on the server.";
  return "";
}

export function getAnonClient() {
  return createClient(supabaseUrl, supabaseAnonKey, {
    auth: {
      persistSession: false,
      autoRefreshToken: false
    }
  });
}

export function getServiceClient() {
  return createClient(supabaseUrl, serviceRoleKey, {
    auth: {
      persistSession: false,
      autoRefreshToken: false
    }
  });
}

export async function getAuthenticatedUser(req) {
  const token = getBearerToken(req);
  if (!token) return { user: null, token: "", error: "Missing Authorization bearer token." };

  const { data, error } = await getAnonClient().auth.getUser(token);
  if (error || !data?.user) {
    return { user: null, token, error: error?.message || "Invalid session." };
  }

  return { user: data.user, token, error: "" };
}

export async function requireParentForBaby(service, babyId, userId) {
  const { data, error } = await service
    .from("baby_members")
    .select("role")
    .eq("baby_id", babyId)
    .eq("user_id", userId)
    .single();

  if (error || data?.role !== "parent") {
    return {
      ok: false,
      role: data?.role || "",
      error: "Only a parent can manage invitations for this baby."
    };
  }

  return { ok: true, role: data.role, error: "" };
}

export async function readJsonBody(req) {
  if (req.body && typeof req.body === "object") return req.body;
  if (typeof req.body === "string") return JSON.parse(req.body || "{}");

  const chunks = [];
  for await (const chunk of req) chunks.push(chunk);
  const raw = Buffer.concat(chunks).toString("utf8");
  return raw ? JSON.parse(raw) : {};
}

export function sendJson(res, status, payload) {
  res.statusCode = status;
  res.setHeader("content-type", "application/json; charset=utf-8");
  res.end(JSON.stringify(payload));
}

export function getRequestOrigin(req) {
  const protocol = req.headers["x-forwarded-proto"] || "https";
  const host = req.headers["x-forwarded-host"] || req.headers.host;
  return host ? `${protocol}://${host}` : "";
}

function getBearerToken(req) {
  const header = req.headers.authorization || req.headers.Authorization || "";
  const match = String(header).match(/^Bearer\s+(.+)$/i);
  return match?.[1] || "";
}
