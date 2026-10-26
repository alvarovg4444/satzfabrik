import { useEffect, useLayoutEffect, useMemo, useRef, useState, type MouseEvent, type PointerEvent } from "react";
import type { Catalog } from "../content/catalog";
import { HALLS, type Item } from "../content/types";
import { STAGE_NAMES } from "../engine/srs";
import { shortName } from "../engine/tasks";
import { fmt, levelOf } from "../game/economy";
import { layout, mapInput, type FactoryScene, type Station } from "../pixel/layout";
import { FactoryRenderer, type Hit } from "../pixel/scene";
import { useCatalog, useGame } from "../store/store";
import { toast } from "./common";

/** Animation steps per second: pixel art reads best a little choppy, and it saves battery. */
const FPS = 12;
/** Whether the whole factory is shown or just the top of it. */
const OPEN_KEY = "satzfabrik.mapOpen";

function themeIsDark(): boolean {
  const t = document.documentElement.dataset.theme;
  if (t === "dark") return true;
  if (t === "light") return false;
  return window.matchMedia?.("(prefers-color-scheme: dark)").matches ?? false;
}

function useDark(): boolean {
  const [dark, setDark] = useState(themeIsDark);
  useEffect(() => {
    const update = () => setDark(themeIsDark());
    const mq = window.matchMedia?.("(prefers-color-scheme: dark)");
    mq?.addEventListener("change", update);
    const mo = new MutationObserver(update);
    mo.observe(document.documentElement, { attributes: true, attributeFilter: ["data-theme"] });
    return () => {
      mq?.removeEventListener("change", update);
      mo.disconnect();
    };
  }, []);
  return dark;
}

function useReducedMotion(): boolean {
  const [reduced, setReduced] = useState(() => window.matchMedia?.("(prefers-reduced-motion: reduce)").matches ?? false);
  useEffect(() => {
    const mq = window.matchMedia?.("(prefers-reduced-motion: reduce)");
    const update = () => setReduced(mq?.matches ?? false);
    mq?.addEventListener("change", update);
    return () => mq?.removeEventListener("change", update);
  }, []);
  return reduced;
}

/**
 * Logical width and device pixels per logical pixel. Integer device-pixel scaling keeps
 * every pixel the same size; about 1.6 CSS px per pixel on a phone, chunkier on wide screens.
 */
function geometry(cssW: number, dpr: number): { W: number; k: number } {
  const device = cssW * dpr;
  const target = Math.max(180, Math.min(320, cssW / 1.6));
  const k = Math.max(1, Math.round(device / target));
  return { W: Math.floor(device / k), k };
}

function stationItems(st: Station, catalog: Catalog): Item[] {
  return st.items.map((i) => catalog.get(i.id)).filter((x): x is Item => !!x);
}

function describe(st: Station, catalog: Catalog): string {
  if (st.kind === "rack" || st.items.length > 1) {
    const due = st.items.filter((i) => i.due).length;
    const what = st.kind === "rack" ? `Regal mit ${st.items.length} Wörtern` : `${st.items.length} Maschinen`;
    return `${what}${due ? ` · ${due} rosten` : ""}`;
  }
  const it = catalog.get(st.items[0].id);
  const name = it ? shortName(it) : st.items[0].id;
  const stage = st.items[0].stage;
  return `${name} · ${stage === 0 ? "Bauplan" : STAGE_NAMES[stage]}${st.due ? " · rostet" : ""}`;
}

export function FactoryMap({
  onOpen,
  onOpenRack,
  onShop,
}: {
  onOpen: (it: Item) => void;
  onOpenRack: (items: Item[]) => void;
  onShop: () => void;
}) {
  const s = useGame();
  const catalog = useCatalog();
  const frame = useRef<HTMLDivElement>(null);
  const canvas = useRef<HTMLCanvasElement>(null);
  const renderer = useRef<FactoryRenderer | null>(null);
  const [cssW, setCssW] = useState(0);
  const [, setMinute] = useState(() => Math.floor(Date.now() / 60_000));
  const [tip, setTip] = useState<{ x: number; y: number; text: string } | null>(null);
  const [openAll, setOpenAll] = useState(() => {
    try {
      return localStorage.getItem(OPEN_KEY) === "1";
    } catch {
      return false;
    }
  });
  const dark = useDark();
  const reduced = useReducedMotion();
  const dpr = window.devicePixelRatio || 1;

  useLayoutEffect(() => {
    const el = frame.current;
    if (!el) return;
    const measure = () => setCssW(el.clientWidth);
    const ro = new ResizeObserver(measure);
    ro.observe(el);
    measure();
    return () => ro.disconnect();
  }, []);

  // Rust appears while the app is open, so the map is checked again every minute.
  useEffect(() => {
    const id = window.setInterval(() => setMinute(Math.floor(Date.now() / 60_000)), 60_000);
    return () => window.clearInterval(id);
  }, []);

  const geo = useMemo(() => (cssW > 0 ? geometry(cssW, dpr) : null), [cssW, dpr]);
  // The store changes every few seconds (Taler); the map only when something on it changes.
  const input = geo ? mapInput(s, catalog, Date.now(), geo.W) : null;
  const key = input ? JSON.stringify(input) : "";
  const scene: FactoryScene | null = useMemo(() => (input ? layout(input) : null), [key]);

  useEffect(() => {
    const el = canvas.current;
    if (!el || !scene) return;
    renderer.current ??= new FactoryRenderer(el);
    renderer.current.set(scene, { night: dark, reduced });
    renderer.current.frame(performance.now() / 1000);
  }, [scene, dark, reduced]);

  // Animate only while the map is on screen and the tab is visible.
  useEffect(() => {
    const el = canvas.current;
    if (!el || !scene || reduced) return;
    let raf = 0;
    let last = 0;
    let onScreen = true;
    const tick = (now: number) => {
      raf = 0;
      if (!onScreen || document.hidden) return;
      raf = requestAnimationFrame(tick);
      if (now - last < 1000 / FPS) return;
      last = now;
      renderer.current?.frame(now / 1000);
    };
    const start = () => {
      if (!raf) raf = requestAnimationFrame(tick);
    };
    const io = new IntersectionObserver(([e]) => {
      onScreen = e.isIntersecting;
      if (onScreen) start();
    });
    io.observe(el);
    document.addEventListener("visibilitychange", start);
    start();
    return () => {
      cancelAnimationFrame(raf);
      io.disconnect();
      document.removeEventListener("visibilitychange", start);
    };
  }, [scene, reduced]);

  const hitAt = (e: MouseEvent<HTMLCanvasElement>): Hit | null => {
    if (!scene || !renderer.current) return null;
    const r = e.currentTarget.getBoundingClientRect();
    return renderer.current.hit(((e.clientX - r.left) / r.width) * scene.w, ((e.clientY - r.top) / r.height) * scene.h);
  };

  const onTap = (e: MouseEvent<HTMLCanvasElement>) => {
    const hit = hitAt(e);
    setTip(null);
    if (!hit) return;
    const lvl = levelOf(s.xp);
    switch (hit.kind) {
      case "station": {
        const items = stationItems(hit.station!, catalog);
        if (hit.station!.kind === "rack" || items.length > 1) onOpenRack(items);
        else if (items[0]) onOpen(items[0]);
        break;
      }
      case "free":
        toast(`Freier Platz in der ${HALLS[hit.hall!.id].de}. Neue Maschinen gibt es im Laden.`);
        onShop();
        break;
      case "site":
        toast(`${HALLS[hit.site!.id].de}: wird ab Level ${hit.site!.unlockLevel} gebaut. Du bist Level ${lvl}.`, 4500);
        break;
      case "hall": {
        const h = hit.hall!;
        toast(`${HALLS[h.id].de}: ${h.built} von ${h.total} Maschinen gebaut. ${HALLS[h.id].blurb}`, 4500);
        break;
      }
      case "hq":
        toast(
          `Zentrale, Level ${lvl}. ${s.streak.current} Tage Streak, ${fmt(s.stats.sentences)} Sätze gebaut. Alle zwei Level kommt ein Stockwerk dazu.`,
          5000,
        );
        break;
      case "lot":
        toast(`Heute ${scene?.lot.today ?? 0} Autos vom Band: jeder Satz, den du schreibst, wird ein Auto.`, 4500);
        break;
    }
  };

  const onHover = (e: PointerEvent<HTMLCanvasElement>) => {
    if (e.pointerType !== "mouse") return;
    const hit = hitAt(e);
    const el = e.currentTarget;
    el.style.cursor = hit ? "pointer" : "default";
    if (hit?.kind !== "station") {
      if (tip) setTip(null);
      return;
    }
    const box = frame.current!.getBoundingClientRect();
    setTip({ x: e.clientX - box.left, y: e.clientY - box.top, text: describe(hit.station!, catalog) });
  };

  const cards = Object.values(s.cards);
  const label = `Pixel-Karte deiner Fabrik: ${cards.length} Maschinen. Tippe auf eine Maschine für Details.`;
  const cssWidth = geo && scene ? (scene.w * geo.k) / dpr : 0;
  const cssHeight = geo && scene ? (scene.h * geo.k) / dpr : 0;
  const cap = Math.round(Math.max(380, Math.min(560, window.innerHeight * 0.62)));
  const long = cssHeight > cap + 60;
  const toggle = () => {
    setOpenAll(!openAll);
    try {
      localStorage.setItem(OPEN_KEY, openAll ? "0" : "1");
    } catch {
      // not remembered in private mode
    }
  };

  return (
    <div className="stack" style={{ gap: 8 }}>
      <div className={`factory-map${long && !openAll ? " clipped" : ""}`} ref={frame} style={long && !openAll ? { maxHeight: cap } : undefined}>
        <canvas
          ref={canvas}
          role="img"
          aria-label={label}
          style={{ width: cssWidth || "100%", height: cssHeight || 320 }}
          onClick={onTap}
          onPointerMove={onHover}
          onPointerLeave={() => setTip(null)}
        />
        {tip ? (
          <div className="map-tip" style={{ left: Math.max(4, Math.min(tip.x + 12, cssW - 190)), top: tip.y + 14 }}>
            {tip.text}
          </div>
        ) : null}
      </div>
      {long ? (
        <button type="button" className="btn ghost small map-more" aria-expanded={openAll} onClick={toggle}>
          {openAll ? "Weniger zeigen" : "Ganze Fabrik zeigen"}
        </button>
      ) : null}
    </div>
  );
}
