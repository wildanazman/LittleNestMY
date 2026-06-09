import { existsSync, statSync } from "node:fs";
import { join, normalize, relative, sep } from "node:path";

export function isInsideRoot(root, candidate) {
  const rel = relative(root, candidate);
  return rel !== "" && !rel.startsWith("..") && !rel.includes(`..${sep}`);
}

export function resolveSafePath(root, requestPath) {
  const candidate = normalize(join(root, requestPath));
  return isInsideRoot(root, candidate) ? candidate : null;
}

export function resolveDirectoryIndex(candidate) {
  if (candidate && existsSync(candidate) && statSync(candidate).isDirectory()) {
    return join(candidate, "code.html");
  }

  return candidate;
}
