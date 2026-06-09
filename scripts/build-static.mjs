import { cpSync, existsSync, mkdirSync, readdirSync, rmSync, statSync } from "node:fs";
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
  throw new Error(`Missing screen.png in: ${missingScreens.join(", ")}`);
}

rmSync(dist, { recursive: true, force: true });
mkdirSync(dist, { recursive: true });

for (const screen of screens) {
  const screenId = screen.id;
  cpSync(join(screensRoot, screenId), join(dist, screenId), { recursive: true });
}

cpSync(join(root, "src"), join(dist, "src"), { recursive: true });

for (const entry of readdirSync(root, { withFileTypes: true })) {
  if (["dist", "node_modules", ".git"].includes(entry.name)) continue;
  if (entry.isFile()) {
    cpSync(join(root, entry.name), join(dist, entry.name));
  }
}

console.log(`Validated ${screens.length} screens and copied static files to dist.`);
