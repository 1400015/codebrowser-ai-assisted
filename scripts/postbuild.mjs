import { copyFileSync, mkdirSync, readdirSync, statSync, readFileSync, writeFileSync } from "node:fs";
import { dirname, resolve } from "node:path";

const root = resolve(import.meta.dirname, "..");
const dist = resolve(root, "dist");

mkdirSync(dist, { recursive: true });
copyFileSync(resolve(root, "manifest.json"), resolve(dist, "manifest.json"));

const manifest = JSON.parse(readFileSync(resolve(dist, "manifest.json"), "utf8"));
manifest.background.service_worker = "sw.js";
manifest.side_panel.default_path = "src/ui/sidepanel.html";
manifest.content_scripts[0].js = ["content.js"];
writeFileSync(resolve(dist, "manifest.json"), JSON.stringify(manifest, null, 2));

copyDir(resolve(root, "platforms"), resolve(dist, "platforms"));
copyDir(resolve(root, "prompts"), resolve(dist, "prompts"));

function copyDir(from, to) {
  mkdirSync(to, { recursive: true });
  for (const name of readdirSync(from)) {
    const src = resolve(from, name);
    const dst = resolve(to, name);
    if (statSync(src).isDirectory()) copyDir(src, dst);
    else {
      mkdirSync(dirname(dst), { recursive: true });
      copyFileSync(src, dst);
    }
  }
}
