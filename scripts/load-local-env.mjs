import { existsSync, readFileSync } from "node:fs";
import { resolve } from "node:path";

export function loadLocalEnv(fileName = ".env.local") {
  const path = resolve(process.cwd(), fileName);
  if (!existsSync(path)) return;

  const lines = readFileSync(path, "utf8").split(/\r?\n/);
  for (const line of lines) {
    const trimmed = line.trim();
    if (!trimmed || trimmed.startsWith("#")) continue;

    const separator = trimmed.indexOf("=");
    if (separator === -1) continue;

    const key = trimmed.slice(0, separator).trim();
    const value = trimmed.slice(separator + 1).trim();
    if (!key || process.env[key]) continue;

    process.env[key] = value.replace(/^['"]|['"]$/g, "");
  }
}
