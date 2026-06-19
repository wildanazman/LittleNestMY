// Frontend-safe public config.
// Do not put service role keys or private secrets here.
// Real values come from .env.local at build time via scripts/runtime-env.mjs.
export const publicEnv = {
  VITE_SUPABASE_URL: "",
  VITE_SUPABASE_ANON_KEY: ""
};
