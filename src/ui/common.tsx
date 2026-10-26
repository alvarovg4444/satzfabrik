import { useEffect, useState, useSyncExternalStore, type ReactNode } from "react";
import { canSpeak, speak } from "./fx";
import { store } from "../store/store";

type IconName =
  | "factory"
  | "shop"
  | "play"
  | "bolt"
  | "chart"
  | "gear"
  | "speaker"
  | "mic"
  | "check"
  | "x"
  | "flame"
  | "chest"
  | "close"
  | "arrow"
  | "spark"
  | "book";

const PATHS: Record<IconName, string> = {
  factory: "M3 21V10l5 3V10l5 3V7l5 3v11H3zm4-4h2m4 0h2",
  shop: "M4 7h16l-1.5 12h-13L4 7zm4 0V5a4 4 0 0 1 8 0v2",
  play: "M8 5v14l11-7L8 5z",
  bolt: "M13 2 4 14h7l-1 8 9-12h-7l1-8z",
  chart: "M4 20V10m6 10V4m6 16v-7m4 7H2",
  gear: "M12 15a3 3 0 1 0 0-6 3 3 0 0 0 0 6zm7.4-3a7.4 7.4 0 0 0-.1-1.2l2-1.6-2-3.4-2.4 1a7.4 7.4 0 0 0-2-1.2L14.5 2h-5l-.4 2.6a7.4 7.4 0 0 0-2 1.2l-2.4-1-2 3.4 2 1.6a7.4 7.4 0 0 0 0 2.4l-2 1.6 2 3.4 2.4-1a7.4 7.4 0 0 0 2 1.2l.4 2.6h5l.4-2.6a7.4 7.4 0 0 0 2-1.2l2.4 1 2-3.4-2-1.6c.1-.4.1-.8.1-1.2z",
  speaker: "M4 9v6h4l5 4V5L8 9H4zm12 0a4 4 0 0 1 0 6m2.5-9a8 8 0 0 1 0 12",
  mic: "M12 15a3 3 0 0 0 3-3V6a3 3 0 0 0-6 0v6a3 3 0 0 0 3 3zm6-3a6 6 0 0 1-12 0m6 6v3",
  check: "M5 12.5 10 17l9-10",
  x: "M6 6l12 12M18 6 6 18",
  flame: "M12 22a7 7 0 0 0 7-7c0-4-3-6-4-10-2 2-2 4-2 6-1-1-2-2-2-4-3 3-6 5-6 8a7 7 0 0 0 7 7z",
  chest: "M3 10h18v10H3V10zm0 0 2-5h14l2 5M10 14h4",
  close: "M6 6l12 12M18 6 6 18",
  arrow: "M5 12h14m-6-6 6 6-6 6",
  spark: "M12 3v4m0 10v4m9-9h-4M7 12H3m14.5-6.5-2.8 2.8M9.3 14.7l-2.8 2.8m11 0-2.8-2.8M9.3 9.3 6.5 6.5",
  book: "M4 5a2 2 0 0 1 2-2h13v16H6a2 2 0 0 0-2 2V5zm0 14V5",
};

export function Icon({ name, size = 22 }: { name: IconName; size?: number }) {
  return (
    <svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2} strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
      <path d={PATHS[name]} fill={name === "play" || name === "bolt" ? "currentColor" : "none"} />
    </svg>
  );
}

/** Cogwheel that spins faster when the machine produces more. */
export function Gear({ speed, className = "" }: { speed: number; className?: string }) {
  const spinning = speed > 0;
  const duration = spinning ? Math.max(1.2, 9 - speed * 1.4) : 0;
  return (
    <svg
      className={`gear ${spinning ? "spin" : ""} ${className}`}
      style={{ ["--spin" as string]: `${duration}s` }}
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth={1.8}
      aria-hidden="true"
    >
      <path d={PATHS.gear} />
    </svg>
  );
}

export function Pips({ stage }: { stage: number }) {
  return (
    <span className="pips" aria-label={`Stufe ${stage} von 5`}>
      {[1, 2, 3, 4, 5].map((i) => (
        <i key={i} className={i <= stage ? "on" : ""} />
      ))}
    </span>
  );
}

export function Sheet({ onClose, children, label }: { onClose: () => void; children: ReactNode; label: string }) {
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => e.key === "Escape" && onClose();
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [onClose]);
  return (
    <div className="sheet-backdrop" onClick={onClose}>
      <div className="sheet" role="dialog" aria-modal="true" aria-label={label} onClick={(e) => e.stopPropagation()}>
        {children}
      </div>
    </div>
  );
}

export function SpeakButton({ text, small }: { text: string; small?: boolean }) {
  if (!canSpeak() || !text) return null;
  return (
    <button
      type="button"
      className={`iconbtn ${small ? "" : ""}`}
      aria-label="Vorlesen"
      title="Vorlesen"
      onClick={() => speak(text, store.get().settings.speechRate, store.get().settings.voice)}
    >
      <Icon name="speaker" size={small ? 18 : 22} />
    </button>
  );
}

// --- toasts ----------------------------------------------------------------

export interface Toast {
  id: number;
  node: ReactNode;
}

let toasts: Toast[] = [];
let toastId = 1;
const toastListeners = new Set<() => void>();

export function toast(node: ReactNode, ms = 3200) {
  const id = toastId++;
  toasts = [...toasts, { id, node }].slice(-4);
  toastListeners.forEach((l) => l());
  setTimeout(() => {
    toasts = toasts.filter((t) => t.id !== id);
    toastListeners.forEach((l) => l());
  }, ms);
}

export function Toasts() {
  const list = useSyncExternalStore(
    (l) => {
      toastListeners.add(l);
      return () => toastListeners.delete(l);
    },
    () => toasts,
  );
  return (
    <div className="toasts" aria-live="polite">
      {list.map((t) => (
        <div key={t.id} className="toast">
          {t.node}
        </div>
      ))}
    </div>
  );
}

/** "+42" that floats up from where the coins were earned. */
export function floatCoins(amount: number, from?: HTMLElement | null) {
  if (typeof document === "undefined" || amount <= 0) return;
  const el = document.createElement("div");
  el.className = "floaty";
  el.textContent = `+${Math.round(amount).toLocaleString("de-DE")}`;
  const r = from?.getBoundingClientRect();
  el.style.left = `${r ? r.left + r.width / 2 : window.innerWidth / 2}px`;
  el.style.top = `${r ? r.top : window.innerHeight / 2}px`;
  document.body.appendChild(el);
  setTimeout(() => el.remove(), 1200);
}

/**
 * A coin counter that ticks up live at the production rate between store
 * updates. Writes to the DOM directly so it does not re-render React 60× a second.
 */
export function LiveCoins({ value, perSecond, format }: { value: number; perSecond: number; format: (n: number) => string }) {
  const [el, setEl] = useState<HTMLSpanElement | null>(null);
  useEffect(() => {
    if (!el) return;
    let raf = 0;
    let shown = Number(el.dataset.shown ?? value);
    let last = performance.now();
    const step = (t: number) => {
      const dt = Math.min(0.5, (t - last) / 1000);
      last = t;
      const gap = value - shown;
      // Catch up fast after a reward, then creep forward at the production rate.
      if (gap > perSecond * 6 || gap < 0) shown += gap * Math.min(1, dt * 5);
      else shown += perSecond * dt;
      el.dataset.shown = String(shown);
      el.textContent = format(shown);
      raf = requestAnimationFrame(step);
    };
    raf = requestAnimationFrame(step);
    return () => cancelAnimationFrame(raf);
  }, [el, value, perSecond, format]);
  return (
    <span ref={setEl} className="coins">
      {format(value)}
    </span>
  );
}
