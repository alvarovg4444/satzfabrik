/*
 * The installable app version: GitHub Pages serves the same game with a web manifest
 * and a service worker, so it can live on the home screen, start without the browser
 * around it and work offline.
 */

/** Where the app version is published (GitHub Pages, from the repository's docs/ folder). */
export const APP_URL = "https://filler6117.github.io/parrotgame/";

interface InstallPromptEvent extends Event {
  prompt(): Promise<void>;
  userChoice: Promise<{ outcome: "accepted" | "dismissed" }>;
}

let deferred: InstallPromptEvent | null = null;
const listeners = new Set<() => void>();

/** The app build carries a manifest link; the claude.ai page and app.html do not. */
export function isAppBuild(): boolean {
  return typeof document !== "undefined" && !!document.querySelector('link[rel="manifest"]');
}

/** Started from the home screen (or as an installed desktop app). */
export function isStandalone(): boolean {
  if (typeof window === "undefined") return false;
  return window.matchMedia?.("(display-mode: standalone)").matches || (navigator as { standalone?: boolean }).standalone === true;
}

export function isIOS(): boolean {
  if (typeof navigator === "undefined") return false;
  return /iPhone|iPad|iPod/.test(navigator.userAgent) || (navigator.platform === "MacIntel" && navigator.maxTouchPoints > 1);
}

/** Registers the service worker and keeps Chrome's install prompt for a button. */
export function setUpApp() {
  if (!isAppBuild()) return;
  window.addEventListener("beforeinstallprompt", (e) => {
    e.preventDefault();
    deferred = e as InstallPromptEvent;
    listeners.forEach((l) => l());
  });
  if ("serviceWorker" in navigator && window.isSecureContext) {
    window.addEventListener("load", () => {
      navigator.serviceWorker.register("./sw.js").catch(() => undefined);
    });
  }
  // keep the save and the voices when the device runs low on space
  if (isStandalone()) void navigator.storage?.persist?.();
}

export const canPromptInstall = () => deferred !== null;
export function onInstallChange(l: () => void): () => void {
  listeners.add(l);
  return () => listeners.delete(l);
}

export async function promptInstall(): Promise<boolean> {
  if (!deferred) return false;
  const e = deferred;
  deferred = null;
  listeners.forEach((l) => l());
  await e.prompt();
  return (await e.userChoice).outcome === "accepted";
}
