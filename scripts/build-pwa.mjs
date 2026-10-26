// Writes the installable app version to ../docs (GitHub Pages: branch, folder /docs):
// the single-file game plus a web manifest, icons and a service worker for offline play.
import { createHash } from "node:crypto";
import { copyFileSync, mkdirSync, readdirSync, readFileSync, writeFileSync } from "node:fs";

const root = new URL("../", import.meta.url);
const out = new URL("../docs/", root);
mkdirSync(out, { recursive: true });

const html = readFileSync(new URL("dist/index.html", root), "utf8");
const head = [
  '<link rel="manifest" href="manifest.webmanifest" />',
  '<link rel="icon" type="image/png" href="favicon.png" />',
  '<link rel="apple-touch-icon" href="apple-touch-icon.png" />',
  '<meta name="theme-color" content="#e9e6df" media="(prefers-color-scheme: light)" />',
  '<meta name="theme-color" content="#14191d" media="(prefers-color-scheme: dark)" />',
  '<meta name="mobile-web-app-capable" content="yes" />',
  '<meta name="apple-mobile-web-app-capable" content="yes" />',
  '<meta name="apple-mobile-web-app-title" content="Satzfabrik" />',
  '<meta name="apple-mobile-web-app-status-bar-style" content="default" />',
].join("\n    ");
if (!html.includes("</title>")) throw new Error("dist/index.html has no <title>");
const page = html.replace("</title>", `</title>\n    ${head}`);
writeFileSync(new URL("index.html", out), page);

const pwa = new URL("pwa/", root);
for (const f of readdirSync(pwa)) if (f !== "sw.js") copyFileSync(new URL(f, pwa), new URL(f, out));
const version = createHash("sha256").update(page).digest("hex").slice(0, 12);
writeFileSync(new URL("sw.js", out), readFileSync(new URL("sw.js", pwa), "utf8").replace("__VERSION__", version));
// serve files as they are (no Jekyll processing)
writeFileSync(new URL(".nojekyll", out), "");
console.log(`docs/ written: app version ${version} (${(page.length / 1024).toFixed(0)} KiB page)`);
