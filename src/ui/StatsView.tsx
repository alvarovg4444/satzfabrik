import { useState } from "react";
import { ERROR_TYPES, type ErrorType, type Item } from "../content/types";
import { STAGE_NAMES, stageOf } from "../engine/srs";
import { shortName } from "../engine/tasks";
import { dayKey } from "../engine/text";
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
                    {shortName(w)} (im Laden)
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
