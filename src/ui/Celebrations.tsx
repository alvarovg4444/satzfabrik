import { useSyncExternalStore } from "react";
import { dayKey } from "../engine/text";
import { STREAK_MIN } from "../game/actions";
import type { Achievement } from "../game/achievements";
import { fmt, streakBonus } from "../game/economy";
import { useGame } from "../store/store";
import { Sheet } from "./common";
import { sfx } from "./fx";

/*
 * The bigger moments: an achievement gets its own card (it stays until tapped, so it is
 * never missed behind other notes), and the flame opens a card about the streak.
 */

// --- pixel pictures -----------------------------------------------------------

function Pixels({ rows, palette, size = 8, className }: { rows: string[]; palette: Record<string, string>; size?: number; className?: string }) {
  const w = Math.max(...rows.map((r) => r.length));
  return (
    <svg
      className={className}
      width={w * size}
      height={rows.length * size}
      viewBox={`0 0 ${w} ${rows.length}`}
      shapeRendering="crispEdges"
      aria-hidden="true"
    >
      {rows.flatMap((r, y) =>
        [...r].map((c, x) => (palette[c] ? <rect key={`${x}-${y}`} x={x} y={y} width={1} height={1} fill={palette[c]} /> : null)),
      )}
    </svg>
  );
}

const TROPHY = [
  "..yyyyyyy..",
  "yyYyyyyyyyy",
  "y.Yyyyyyy.y",
  "y.Yyyyyyy.y",
  ".yyYyyyyyy.",
  "..yyyyyyy..",
  "...yyyyy...",
  "....yyy....",
  ".....y.....",
  "....yyy....",
  "..ddddddd..",
  "..dDDDDDd..",
  "..ddddddd..",
];
const TROPHY_COLORS = { y: "#f2b705", Y: "#ffe27a", d: "#5a4630", D: "#7b6346" };

const FLAME_SMALL = [
  "....r....",
  "...rr....",
  "...rrr...",
  "..rroor..",
  "..roooor.",
  ".rrooyorr",
  ".rooyyyor",
  ".rooyyyor",
  "..rooyor.",
  "...rrrr..",
];
const FLAME_BIG = [
  "......r......",
  ".....rr...r..",
  "..r..rrr..rr.",
  "..rr.rorr.rr.",
  ".rrr.roor.rrr",
  ".rorrooorrror",
  "rroorooyoroor",
  "rooooyyyoooor",
  "roooyyyyyooor",
  "rooyyyWyyyoor",
  "rooyyWWWyyoor",
  ".rooyyWyyyor.",
  ".rrooyyyyoor.",
  "..rrooooorr..",
  "...rrrrrrr...",
];
const FLAME_COLORS = { r: "#c8401f", o: "#f28c1b", y: "#ffd447", W: "#fff6d5" };
// from a month on the fire burns blue-hot
const FLAME_HOT = { r: "#2c6a78", o: "#3f9fb5", y: "#9fe3f0", W: "#ffffff" };

export function Flame({ days, size = 8 }: { days: number; size?: number }) {
  if (days <= 0)
    return <Pixels rows={FLAME_SMALL} palette={{ r: "#8b8f93", o: "#b6babd", y: "#d6d9db" }} size={size} className="pixel-flame out" />;
  return (
    <Pixels
      rows={days >= 7 ? FLAME_BIG : FLAME_SMALL}
      palette={days >= 30 ? FLAME_HOT : FLAME_COLORS}
      size={size}
      className="pixel-flame"
    />
  );
}

// --- achievements -------------------------------------------------------------

let queue: Achievement[] = [];
const listeners = new Set<() => void>();
const emit = () => listeners.forEach((l) => l());

/** Shows each new achievement as its own card, one after the other. */
export function showAchievements(list: Achievement[]) {
  if (!list.length) return;
  queue = [...queue, ...list];
  emit();
}

export function AchievementPopup() {
  const list = useSyncExternalStore(
    (l) => {
      listeners.add(l);
      return () => listeners.delete(l);
    },
    () => queue,
  );
  const a = list[0];
  if (!a) return null;
  const close = () => {
    sfx.coin();
    queue = queue.slice(1);
    emit();
  };
  return (
    <Sheet onClose={close} label="Erfolg">
      <div className="celebrate">
        <Pixels rows={TROPHY} palette={TROPHY_COLORS} size={9} className="pixel-pop" />
        <span className="eyebrow">Erfolg freigeschaltet</span>
        <h2>{a.de}</h2>
        <p className="muted">{a.how}</p>
        <p className="celebrate-reward num">+{fmt(a.reward)} Taler</p>
      </div>
      <button type="button" className="btn primary block" onClick={close}>
        Einsammeln
      </button>
    </Sheet>
  );
}

// --- the streak -----------------------------------------------------------------

export function FlameSheet({ onClose }: { onClose: () => void }) {
  const s = useGame();
  const n = s.streak.current;
  const pct = Math.round(streakBonus(s) * 100);
  const done = Math.min(STREAK_MIN, s.stats.days[dayKey(Date.now())]?.tasks ?? 0);
  const keptToday = done >= STREAK_MIN;
  return (
    <Sheet onClose={onClose} label="Flamme">
      <div className="celebrate">
        <Flame days={n} size={9} />
        <span className="eyebrow">Deine Flamme</span>
        <h2>{n === 0 ? "Noch aus" : n === 1 ? "1 Tag in Folge" : `${fmt(n)} Tage in Folge`}</h2>
        {n > 0 ? (
          <p className="celebrate-reward num">+{pct} % Produktion</p>
        ) : (
          <p className="muted">Schreib heute {STREAK_MIN} Sätze, dann brennt sie.</p>
        )}
      </div>
      <p className="small">
        Heute: <b className="num">{done}/{STREAK_MIN}</b> Sätze {keptToday ? "– die Flamme ist für heute sicher." : "für die Flamme."}
      </p>
      <p className="small muted">
        Jeder Tag mit mindestens {STREAK_MIN} Sätzen hält sie am Brennen. Jeder Tag in Folge gibt deiner Fabrik +5 % Produktion, bis +50 % ab Tag 10.
        {n < 10 ? ` Noch ${10 - n} ${10 - n === 1 ? "Tag" : "Tage"} bis zum Maximum.` : ""} Ab einer Woche wird sie groß, ab einem Monat brennt sie blau.
      </p>
      {s.streak.freezes > 0 ? (
        <p className="small muted">
          Streak-Schutz: {s.streak.freezes}× (ein verpasster Tag zählt nicht).
        </p>
      ) : null}
      {s.streak.best > n ? <p className="small muted">Rekord: {fmt(s.streak.best)} Tage.</p> : null}
      <button type="button" className="btn primary block" onClick={onClose}>
        Weiter
      </button>
    </Sheet>
  );
}
