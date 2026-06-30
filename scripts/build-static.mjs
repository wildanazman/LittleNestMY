import { cpSync, existsSync, mkdirSync, readFileSync, readdirSync, rmSync, writeFileSync } from "node:fs";
import { join, resolve } from "node:path";
import { fileURLToPath } from "node:url";
import { screens } from "../src/data/screens.mjs";
import { loadRuntimeEnv } from "./runtime-env.mjs";

const root = resolve(fileURLToPath(new URL("..", import.meta.url)));
const dist = join(root, "dist");
const screensRoot = join(root, "src", "screens");
await loadRuntimeEnv();

const missingScreens = screens
  .filter((screen) => !existsSync(join(screensRoot, screen.path)) || !existsSync(join(screensRoot, screen.preview)))
  .map((screen) => screen.id);

if (screens.length === 0) {
  throw new Error("No Stitch screen folders with code.html were found.");
}

if (missingScreens.length > 0) {
  throw new Error(`Missing screen assets in: ${missingScreens.join(", ")}`);
}

rmSync(dist, { recursive: true, force: true });
mkdirSync(dist, { recursive: true });

for (const screen of screens) {
  cpSync(join(screensRoot, screen.id), join(dist, screen.id), { recursive: true });
  cpSync(join(screensRoot, screen.path), join(dist, screen.id, "index.html"));
  injectCapacitorCompat(join(dist, screen.id, "index.html"));
  injectVercelAnalytics(join(dist, screen.id, "index.html"));
}

const defaultScreen = screens.find((screen) => screen.id === "auth_welcome") || screens[0];
cpSync(join(screensRoot, defaultScreen.path), join(dist, "index.html"));
injectCapacitorCompat(join(dist, "index.html"));
injectVercelAnalytics(join(dist, "index.html"));

cpSync(join(root, "src"), join(dist, "src"), { recursive: true });

if (existsSync(join(root, "icons"))) {
  cpSync(join(root, "icons"), join(dist, "icons"), { recursive: true });
}

// Never copy secrets, VCS, or build metadata into the public output. dist is
// served as-is by the host; .env.local etc. must not ship to the web root.
const SKIP_ROOT_FILES = new Set(["package.json", "package-lock.json", "vercel.json", "README.md"]);
for (const entry of readdirSync(root, { withFileTypes: true })) {
  if (["dist", "node_modules", ".git"].includes(entry.name)) continue;
  if (entry.isFile()) {
    if (entry.name.startsWith(".")) continue;            // .env*, .gitignore, .dockerignore, …
    if (SKIP_ROOT_FILES.has(entry.name)) continue;
    cpSync(join(root, entry.name), join(dist, entry.name));
  }
}

console.log(`Validated ${screens.length} screens and copied static files to dist.`);

function injectCapacitorCompat(filePath) {
  const tag = '<script src="/src/utils/capacitorCompat.js"></script>';
  let html = readFileSync(filePath, "utf8");
  if (html.includes("capacitorCompat.js")) return;
  if (html.includes("</head>")) {
    html = html.replace("</head>", `${tag}\n</head>`);
  } else {
    html = `${tag}\n${html}`;
  }
  writeFileSync(filePath, html);
}

function injectVercelAnalytics(filePath) {
  const tag = '<script src="/src/utils/vercel-analytics.js"></script>';
  let html = readFileSync(filePath, "utf8");
  if (html.includes("vercel-analytics.js")) return;
  if (html.includes("</head>")) {
    html = html.replace("</head>", `${tag}\n</head>`);
  } else {
    html = `${tag}\n${html}`;
  }
  writeFileSync(filePath, html);
}
