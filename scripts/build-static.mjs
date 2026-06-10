import { cpSync, existsSync, mkdirSync, readdirSync, rmSync } from "node:fs";
import { join, resolve } from "node:path";
import { fileURLToPath } from "node:url";
import { screens } from "../src/data/screens.mjs";

const root = resolve(fileURLToPath(new URL("..", import.meta.url)));
const dist = join(root, "dist");
const screensRoot = join(root, "src", "screens");

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
}

const defaultScreen = screens.find((screen) => screen.id === "auth_welcome") || screens[0];
cpSync(join(screensRoot, defaultScreen.path), join(dist, "index.html"));

cpSync(join(root, "src"), join(dist, "src"), { recursive: true });

if (existsSync(join(root, "icons"))) {
  cpSync(join(root, "icons"), join(dist, "icons"), { recursive: true });
}

for (const entry of readdirSync(root, { withFileTypes: true })) {
  if (["dist", "node_modules", ".git"].includes(entry.name)) continue;
  if (entry.isFile()) {
    cpSync(join(root, entry.name), join(dist, entry.name));
  }
}

console.log(`Validated ${screens.length} screens and copied static files to dist.`);
