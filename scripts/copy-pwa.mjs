import { cpSync, existsSync, mkdirSync, readdirSync } from "node:fs";
import { join } from "node:path";

const root = process.cwd();
const fromDir = join(root, "dist");
const toDir = join(root, ".output", "public");

if (!existsSync(fromDir) || !existsSync(toDir)) {
  console.warn("[pwa] skip copy: dist or .output/public missing");
  process.exit(0);
}

mkdirSync(toDir, { recursive: true });

for (const name of readdirSync(fromDir)) {
  if (name === "sw.js" || name.startsWith("workbox-")) {
    cpSync(join(fromDir, name), join(toDir, name));
    console.info(`[pwa] copied ${name} → .output/public/`);
  }
}
