import { createClient } from "https://esm.sh/@supabase/supabase-js@2.108.1";
import { runtimeEnv } from "../config/runtime-env.mjs";

const supabaseUrl = runtimeEnv.VITE_SUPABASE_URL || "";
const supabaseAnonKey = runtimeEnv.VITE_SUPABASE_ANON_KEY || "";

export const isSupabaseConfigured = Boolean(supabaseUrl && supabaseAnonKey);
export const supabaseConfigMessage = "Supabase is not configured. Set VITE_SUPABASE_URL and VITE_SUPABASE_ANON_KEY in .env.local.";

export const supabase = isSupabaseConfigured
  ? createClient(supabaseUrl, supabaseAnonKey, {
      auth: {
        persistSession: true,
        autoRefreshToken: true
      }
    })
  : null;

export function requireSupabaseClient() {
  if (!supabase) {
    throw new Error("Supabase is not configured. Set VITE_SUPABASE_URL and VITE_SUPABASE_ANON_KEY.");
  }

  return supabase;
}
