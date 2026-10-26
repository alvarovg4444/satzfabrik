import { useState } from "react";
import { ERROR_TYPES, type ErrorType, type Item } from "../content/types";
import { STAGE_NAMES, stageOf } from "../engine/srs";
import { shortName } from "../engine/tasks";
import { dayKey } from "../engine/text";
import { AREA_DE, AREAS, confidence, levelLabel, overall, type Skill } from "../engine/level";
import { weakRules } from "../game/actions";
import { fmt } from "../game/economy";
import { ACHIEVEMENTS } from "../game/achievements";
import { useCatalog, useGame } from "../store/store";
import { SpeakButton } from "./common";

function lastDays(n: number, now: number): string[] {
  const out: string[] = [];
  for (let i = n - 1; i >= 0; i--) {
    const d = new Date(now);
    d.setDate(d.getDate() - i);
    out.push(dayKey(d.getTime()));
  }
  return out;
}

const BAND_START = 1;
const BAND_END = 5;

/** A bar from A1 to C1 with the estimate marked. */
function LevelBar({ sk, label }: { sk: Skill; label: string }) {
  const l = levelLabel(sk.theta);
  const pct = ((Math.min(BAND_END, Math.max(BAND_START, sk.theta)) - BAND_START) / (BAND_END - BAND_START)) * 100;
  return (
    <div className="level-row">
      <span className="small">{label}</span>
      <div className="level-bar" aria-label={`${label}: ${l.code}`}>
        <i style={{ width: `${pct}%` }} />
      </div>
      <b className="num small">{sk.n < 2 ? "?" : l.code}</b>
    </div>
  );
}

/** The level engine's estimate, overall and per area. */
export function LevelCard() {
  const s = useGame();
  const o = overall(s.level);
  const l = levelLabel(o.theta);
  const conf = confidence(o.n);
  return (
    <section className="card stack" aria-label="Dein Niveau">
      <div className="spread">
        <h3>Dein Niveau</h3>
        <span className="small muted">{conf}</span>
      </div>
      <div className="row" style={{ alignItems: "baseline", gap: 10 }}>
        <span className="big num">{l.code}</span>
        <span className="muted">
          {l.next && l.frac >= 0.6 ? `auf dem Weg zu ${l.next}` : l.next ? `${Math.round(l.frac * 100)} % von ${l.band} geschafft` : "sehr gut"}
        </span>
      </div>
      <div className="level-row" aria-hidden="true">
        <span />
        <div className="level-scale small muted">
          <span>A1</span>
          <span>A2</span>
          <span>B1</span>
          <span>B2</span>
          <span>C1</span>
        </div>
        <span />
      </div>
      {AREAS.map((a) => (
        <LevelBar key={a} sk={s.level.areas[a]} label={AREA_DE[a]} />
      ))}
      <p className="small muted">
        Geschätzt aus deinen Antworten: Wenn du Bausteine eines Niveaus sicher benutzt, steigt der Wert, bei Fehlern sinkt er. Die
        KI liest außerdem jeden Satz mit. Danach richten sich die täglichen Baupläne{s.level.basics >= 1 ? " und wie oft A1-Grundlagen wiederkommen" : ""}.
      </p>
    </section>
  );
}

function Overview({ onPractice }: { onPractice: (id: string) => void }) {
  const s = useGame();
  const catalog = useCatalog();
  const now = Date.now();
  const days = lastDays(14, now);
  const maxTasks = Math.max(1, ...days.map((d) => s.stats.days[d]?.tasks ?? 0));
  const recentErrors: Partial<Record<ErrorType, number>> = {};
  for (const d of days) {
    for (const [k, v] of Object.entries(s.stats.days[d]?.errors ?? {})) {
      recentErrors[k as ErrorType] = (recentErrors[k as ErrorType] ?? 0) + (v ?? 0);
    }
  }
  const errorRows = (Object.entries(recentErrors) as [ErrorType, number][]).sort((a, b) => b[1] - a[1]).slice(0, 8);
  const maxErr = Math.max(1, ...errorRows.map((r) => r[1]));
  const stages = [0, 0, 0, 0, 0, 0];
  for (const c of Object.values(s.cards)) stages[stageOf(c)]++;
  const weak = weakRules(s)
    .map((id) => catalog.get(id))
    .filter((x): x is Item => !!x)
    .slice(0, 5);
  const goodRate = s.stats.sentences ? Math.round((s.stats.perfect / s.stats.sentences) * 100) : 0;

  return (
    <>
      <LevelCard />
      <section className="card stack">
        <div className="stat-grid">
          <div className="stat">
            <span className="v">{fmt(s.stats.sentences)}</span>
            <span className="l">Sätze geschrieben</span>
          </div>
          <div className="stat">
            <span className="v">{goodRate} %</span>
            <span className="l">fehlerfrei</span>
          </div>
          <div className="stat">
            <span className="v">{s.streak.best}</span>
            <span className="l">längste Serie (Tage)</span>
          </div>
        </div>
      </section>

      <section className="card stack">
        <h3>Sätze pro Tag</h3>
        <div className="spark" role="img" aria-label="Sätze pro Tag in den letzten 14 Tagen">
          {days.map((d) => {
            const n = s.stats.days[d]?.tasks ?? 0;
            return (
              <div key={d} className={`col ${n >= s.settings.dailyGoal ? "goal" : ""}`} title={`${d}: ${n}`}>
                <i style={{ height: `${(n / maxTasks) * 100}%` }} />
                <span>{d.slice(8)}</span>
              </div>
            );
          })}
        </div>
        <p className="small muted">Grün: Tagesziel ({s.settings.dailyGoal} Sätze) erreicht.</p>
      </section>

      <section className="card stack">
        <h3>Deine Schwachstellen</h3>
        {errorRows.length ? (
          <div className="bars">
            {errorRows.map(([k, n]) => (
              <div key={k} className="hbar">
                <span>{ERROR_TYPES[k].de}</span>
                <span className="track">
                  <i style={{ width: `${(n / maxErr) * 100}%` }} />
                </span>
                <span className="n">{n}</span>
              </div>
            ))}
          </div>
        ) : (
          <p className="small muted">Noch keine Fehler in den letzten 14 Tagen. Oder noch keine Sätze.</p>
        )}
        {weak.length ? (
          <div className="stack" style={{ gap: 8 }}>
            <p className="small muted">Diese Strukturen kommen als Schwachstellen-Aufgaben in deine Schichten:</p>
            <div className="row">
              {weak.map((w) =>
                s.cards[w.id] ? (
                  <button key={w.id} type="button" className="btn small" onClick={() => onPractice(w.id)}>
                    {shortName(w)} üben
                  </button>
                ) : (
                  <span key={w.id} className="chip">
                    {shortName(w)} (im Lernplan)
                  </span>
                ),
              )}
            </div>
          </div>
        ) : null}
      </section>

      <section className="card stack">
        <h3>Maschinen nach Stufe</h3>
        <div className="bars">
          {stages.map((n, i) => (
            <div key={i} className="hbar">
              <span>{STAGE_NAMES[i]}</span>
              <span className="track">
                <i style={{ width: `${(n / Math.max(1, ...stages)) * 100}%`, background: i === 5 ? "var(--gold)" : "var(--steel)" }} />
              </span>
              <span className="n">{n}</span>
            </div>
          ))}
        </div>
        <p className="small muted">Stufen steigen, wenn du ein Wort über Tage und Wochen hinweg richtig benutzt.</p>
      </section>

      <section className="card stack">
        <h3>Erfolge</h3>
        <div className="row">
          {ACHIEVEMENTS.map((a) => (
            <span key={a.id} className={`chip ${s.achievements[a.id] ? "on" : ""}`} title={a.en}>
              {a.de}
            </span>
          ))}
        </div>
      </section>
    </>
  );
}

function Journal() {
  const s = useGame();
  const catalog = useCatalog();
  const [onlyErrors, setOnlyErrors] = useState(false);
  const list = s.journal.filter((j) => !onlyErrors || j.errors.length > 0).slice(0, 120);
  return (
    <section className="card stack">
      <div className="spread">
        <h3>Satzarchiv</h3>
        <label className="row small">
          <input id="journal-errors" type="checkbox" checked={onlyErrors} onChange={(e) => setOnlyErrors(e.target.checked)} /> nur mit Fehlern
        </label>
      </div>
      <p className="small muted">Deine eigenen Sätze, korrigiert. Lies sie laut: Das sind Sätze, die du wirklich brauchst.</p>
      {list.length === 0 ? <p className="small muted">Noch leer. Nach deiner ersten Schicht stehen deine Sätze hier.</p> : null}
      {list.map((j) => (
        <div key={j.t} className="journal-item">
          <span className="eyebrow">
            {new Date(j.t).toLocaleDateString("de-DE")} ·{" "}
            {j.targets
              .map((id) => catalog.get(id))
              .filter((x): x is Item => !!x)
              .map(shortName)
              .join(" + ")}
          </span>
          {j.answer !== j.corrected ? <p className="small" style={{ textDecoration: "line-through", color: "var(--ink-3)" }}>{j.answer}</p> : null}
          <div className="sentence">
            <p style={{ fontWeight: 700 }}>{j.corrected}</p>
            <SpeakButton text={j.corrected} small />
          </div>
          {j.better ? <p className="small muted">Natürlicher: {j.better}</p> : null}
          {j.errors.length ? (
            <p className="small muted">
              {j.errors.map((e) => `${e.wrong} → ${e.right}`).join(" · ")}
            </p>
          ) : null}
        </div>
      ))}
    </section>
  );
}

export function StatsView({ onPractice }: { onPractice: (id: string) => void }) {
  const [tab, setTab] = useState<"overview" | "journal">("overview");
  return (
    <>
      <div className="spread">
        <h1>Statistik</h1>
        <div className="seg" role="group" aria-label="Ansicht">
          <button type="button" aria-pressed={tab === "overview"} onClick={() => setTab("overview")}>
            Übersicht
          </button>
          <button type="button" aria-pressed={tab === "journal"} onClick={() => setTab("journal")}>
            Satzarchiv
          </button>
        </div>
      </div>
      {tab === "overview" ? <Overview onPractice={onPractice} /> : <Journal />}
    </>
  );
}
