import { createReadStream, existsSync, statSync } from "node:fs";
import { createServer } from "node:http";
import { extname, join, resolve } from "node:path";
import { fileURLToPath } from "node:url";
import { defaultScreenId, getScreenById } from "../src/data/screens.mjs";
import { resolveDirectoryIndex, resolveSafePath } from "../src/utils/paths.mjs";

const root = resolve(fileURLToPath(new URL("..", import.meta.url)));
const screensRoot = join(root, "src", "screens");
const port = Number(process.env.PORT || 5173);

const contentTypes = {
  ".html": "text/html; charset=utf-8",
  ".js": "text/javascript; charset=utf-8",
  ".mjs": "text/javascript; charset=utf-8",
  ".css": "text/css; charset=utf-8",
  ".json": "application/json; charset=utf-8",
  ".md": "text/markdown; charset=utf-8",
  ".png": "image/png",
  ".jpg": "image/jpeg",
  ".jpeg": "image/jpeg",
  ".svg": "image/svg+xml",
  ".ico": "image/x-icon"
};

function resolveRequestPath(url) {
  const pathname = decodeURIComponent(new URL(url, `http://localhost:${port}`).pathname);
  const firstSegment = pathname.split("/").filter(Boolean)[0] || defaultScreenId;
  const screen = getScreenById(firstSegment);

  if (pathname === "/") {
    return resolveDirectoryIndex(resolveSafePath(screensRoot, getScreenById(defaultScreenId)?.path || ""));
  }

  if (screen) {
    const screenPath = pathname.slice(firstSegment.length + 2);
    const requestPath = screenPath && screenPath.length > 0 ? join(firstSegment, screenPath) : join(firstSegment, "code.html");
    return resolveDirectoryIndex(resolveSafePath(screensRoot, requestPath));
  }

  return resolveDirectoryIndex(resolveSafePath(root, pathname));
}

const server = createServer((req, res) => {
  const filePath = resolveRequestPath(req.url || "/");

  if (!filePath || !existsSync(filePath) || !statSync(filePath).isFile()) {
    res.writeHead(404, { "content-type": "text/plain; charset=utf-8" });
    res.end("Not found");
    return;
  }

  res.writeHead(200, {
    "content-type": contentTypes[extname(filePath).toLowerCase()] || "application/octet-stream"
  });
  createReadStream(filePath).pipe(res);
});

server.listen(port, () => {
  console.log(`LittleNest MY is running at http://localhost:${port}`);
});
