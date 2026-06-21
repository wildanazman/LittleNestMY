import { existsSync, mkdirSync, readFileSync, writeFileSync } from "node:fs";
import { dirname, join, resolve } from "node:path";
import { fileURLToPath, pathToFileURL } from "node:url";

const root = resolve(fileURLToPath(new URL("..", import.meta.url)));
const outputPath = join(root, "src", "config", "runtime-env.mjs");
const publicEnvPath = join(root, "src", "config", "public-env.mjs");

export async function loadRuntimeEnv() {
  loadDotEnvFile(join(root, ".env"));
  loadDotEnvFile(join(root, ".env.local"));
  const publicEnv = await loadPublicEnvFallback();

  const safeEnv = {
    VITE_SUPABASE_URL: process.env.VITE_SUPABASE_URL || publicEnv.VITE_SUPABASE_URL || "",
    VITE_SUPABASE_ANON_KEY: process.env.VITE_SUPABASE_ANON_KEY || publicEnv.VITE_SUPABASE_ANON_KEY || "",
    // Public VAPID key for Web Push (safe to expose). Private key stays server-side.
    VITE_VAPID_PUBLIC_KEY: process.env.VITE_VAPID_PUBLIC_KEY || publicEnv.VITE_VAPID_PUBLIC_KEY || ""
  };

  mkdirSync(dirname(outputPath), { recursive: true });
  writeFileSync(
    outputPath,
    `export const runtimeEnv = ${JSON.stringify(safeEnv, null, 2)};\n`,
    "utf8"
  );

  return safeEnv;
}

async function loadPublicEnvFallback() {
  if (!existsSync(publicEnvPath)) return {};
  try {
    const module = await import(`${pathToFileURL(publicEnvPath).href}?t=${Date.now()}`);
    return module.publicEnv || {};
  } catch {
    return {};
  }
}

function loadDotEnvFile(filePath) {
  if (!existsSync(filePath)) return;

  const content = readFileSync(filePath, "utf8");
  for (const line of content.split(/\r?\n/)) {
    const trimmed = line.trim();
    if (!trimmed || trimmed.startsWith("#")) continue;

    const equalsIndex = trimmed.indexOf("=");
    if (equalsIndex <= 0) continue;

    const key = trimmed.slice(0, equalsIndex).trim();
    if (process.env[key] !== undefined) continue;

    process.env[key] = unquote(trimmed.slice(equalsIndex + 1).trim());
  }
}

function unquote(value) {
  if (
    (value.startsWith('"') && value.endsWith('"'))
    || (value.startsWith("'") && value.endsWith("'"))
  ) {
    return value.slice(1, -1);
  }

  return value;
}
