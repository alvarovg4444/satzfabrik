// Turns the single-file build (dist/index.html) into a claude.ai artifact page
// (dist/artifact.html): the artifact host adds <html>/<head>/<body> itself, so the
// page is written as title, styles, markup and the inline module script.
import { readFileSync, writeFileSync } from "node:fs";

const indexUrl = new URL("../dist/index.html", import.meta.url);
// The minifier writes "�" (used by a library to replace broken surrogates) as a raw
// replacement character; write it back as an escape so the file has no U+FFFD in it.
const src = readFileSync(indexUrl, "utf8").replace(/�/g, "\\uFFFD");
writeFileSync(indexUrl, src);

const grab = (re) => [...src.matchAll(re)].map((m) => m[0]);
const title = src.match(/<title>[\s\S]*?<\/title>/)?.[0] ?? "<title>Satzfabrik</title>";
const sides = grab(/<meta name="claude:viewport-fit-sides"[^>]*>/g);
const links = grab(/<link\s+rel="(?:preconnect|stylesheet)"[^>]*>/g).filter((l) => /fonts\.(googleapis|gstatic)\.com/.test(l));
const styles = grab(/<style[^>]*>[\s\S]*?<\/style>/g);
const scripts = grab(/<script type="module"[^>]*>[\s\S]*?<\/script>/g).map((s) => s.replace(/\scrossorigin(="[^"]*")?/, ""));

if (!scripts.length) throw new Error("No inline module script found: is vite-plugin-singlefile active?");

const page = [title, ...sides, ...links, ...styles, '<div id="root"></div>', ...scripts].join("\n");
writeFileSync(new URL("../dist/artifact.html", import.meta.url), page);
console.log(`dist/artifact.html written (${(page.length / 1024).toFixed(0)} KiB)`);
