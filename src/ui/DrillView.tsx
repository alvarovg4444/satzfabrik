import { useEffect, useMemo, useRef, useState } from "react";
import { BUILTIN_ITEMS } from "../content/catalog";
import type { Item } from "../content/types";
import { buildDrillRound, checkDrill, DRILL_LABELS, drillSeed, type DrillQ } from "../engine/drills";
import { applyDrill } from "../game/actions";
import { drillReward, drillSeconds, fmt } from "../game/economy";
import { store, useCatalog, useGame } from "../store/store";
import { floatCoins, Icon, toast } from "./common";
import { sfx } from "./fx";

type Phase = { k: "idle" } | { k: "run" } | { k: "done" };

export function DrillView() {
  const s = useGame();
  const catalog = useCatalog();
  const [phase, setPhase] = useState<Phase>({ k: "idle" });
  const [qs, setQs] = useState<DrillQ[]>([]);
  const [i, setI] = useState(0);
  const [typed, setTyped] = useState("");
  const [flash, setFlash] = useState<{ ok: boolean; answer: string; explain: string } | null>(null);
  const [score, setScore] = useState({ ok: 0, total: 0, streak: 0, earned: 0 });
  const [left, setLeft] = useState(0);
  const endAt = useRef(0);
  const rounds = useRef(0);
  const finished = useRef(true);
  const scoreRef = useRef(score);
  const boxRef = useRef<HTMLDivElement>(null);
  const seconds = drillSeconds(s);

  const owned = useMemo<Item[]>(
    () => Object.keys(s.cards).map((id) => catalog.get(id)).filter((x): x is Item => !!x),
    [s.cards, catalog],
  );

  const finish = () => {
    if (finished.current) return;
    finished.current = true;
    const final = scoreRef.current;
    setPhase({ k: "done" });
    const r = store.update((d, c) => applyDrill(d, c, Date.now(), { correct: final.ok, total: final.total, earned: final.earned }));
    for (const o of r.orders) toast(<span>Auftrag erledigt: <b>+{fmt(o.reward)}</b></span>);
    for (const a of r.achievements) toast(<span>Erfolg: <b>{a.de}</b> +{fmt(a.reward)}</span>);
  };

  useEffect(() => {
    if (phase.k !== "run") return;
    const id = setInterval(() => {
      const ms = endAt.current - Date.now();
      setLeft(Math.max(0, ms));
      if (ms <= 0) {
        clearInterval(id);
        finish();
      }
    }, 200);
    return () => clearInterval(id);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [phase.k]);

  const start = () => {
    rounds.current++;
    const round = buildDrillRound(owned, BUILTIN_ITEMS, drillSeed(Date.now(), rounds.current), 40);
    const zero = { ok: 0, total: 0, streak: 0, earned: 0 };
    setQs(round);
    setI(0);
    setTyped("");
    setFlash(null);
    setScore(zero);
    scoreRef.current = zero;
    finished.current = false;
    endAt.current = Date.now() + seconds * 1000;
    setLeft(seconds * 1000);
    setPhase({ k: "run" });
  };

  const q = qs[i];
  const answer = (given: string) => {
    if (!q || flash || finished.current) return;
    const ok = checkDrill(q, given);
    const gain = ok ? drillReward(s, score.streak) : 0;
    const nextScore = {
      ok: score.ok + (ok ? 1 : 0),
      total: score.total + 1,
      streak: ok ? score.streak + 1 : 0,
      earned: score.earned + gain,
    };
    setScore(nextScore);
    scoreRef.current = nextScore;
    if (ok) {
      sfx.coin();
      floatCoins(gain, boxRef.current);
    } else sfx.bad();
    setFlash({ ok, answer: q.answer, explain: q.explain });
    const advance = () => {
      setFlash(null);
      setTyped("");
      if (i + 1 >= qs.length) finish();
      else setI(i + 1);
    };
    setTimeout(advance, ok ? 450 : 1700);
  };

  if (phase.k === "idle") {
    return (
      <section className="card stack">
        <span className="eyebrow">Akkord-Runde</span>
        <h1>{seconds} Sekunden Akkordarbeit</h1>
        <p className="muted">
          Formen auf Zeit: der/die/das, Plural, Perfekt, Präteritum, Kasus nach Präpositionen, Pronomen, Possessivartikel und
          Adjektivendungen. Kein Nachdenken, nur Tempo. So werden die Formen automatisch.
        </p>
        <p className="small muted">Die Wörter kommen aus deinen eigenen Maschinen. Jede Serie richtiger Antworten erhöht den Lohn.</p>
        <button type="button" className="btn primary block" onClick={start}>
          <Icon name="bolt" size={18} /> Los geht's
        </button>
      </section>
    );
  }

  if (phase.k === "done") {
    const pct = score.total ? Math.round((score.ok / score.total) * 100) : 0;
    return (
      <section className="card stack">
        <span className="eyebrow">Akkord-Runde vorbei</span>
        <h1>
          {score.ok} Treffer · {pct} %
        </h1>
        <p className="muted">
          +{fmt(score.earned)} Taler verdient. {pct >= 90 ? "Stark, das sitzt!" : pct >= 70 ? "Gut! Noch eine Runde?" : "Übung macht den Meister."}
        </p>
        <div className="row">
          <button type="button" className="btn primary" onClick={start}>
            Noch eine Runde
          </button>
        </div>
      </section>
    );
  }

  if (!q) return null;
  return (
    <section className="stack">
      <div className="timer" aria-label="Restzeit">
        <i style={{ width: `${(left / (seconds * 1000)) * 100}%` }} />
      </div>
      <div className="spread">
        <span className="eyebrow">{DRILL_LABELS[q.kind]}</span>
        <span className="num">
          {score.ok}/{score.total} · Serie {score.streak} · +{fmt(score.earned)}
        </span>
      </div>
      <div ref={boxRef} className={`card stack ${flash ? (flash.ok ? "flash-ok" : "flash-bad") : ""}`}>
        <div className="drill-prompt">{q.prompt}</div>
        {q.hint ? <p className="en" style={{ textAlign: "center" }}>{q.hint}</p> : null}
        {q.options ? (
          <div className="options">
            {q.options.map((o) => (
              <button
                key={o}
                type="button"
                className={`btn ${flash && o === q.answer ? "primary" : ""}`}
                disabled={!!flash}
                onClick={() => answer(o)}
              >
                {o}
              </button>
            ))}
          </div>
        ) : (
          <form
            className="row"
            onSubmit={(e) => {
              e.preventDefault();
              answer(typed);
            }}
          >
            <input
              id="drill-answer"
              className="input"
              style={{ flex: 1 }}
              lang="de"
              autoComplete="off"
              autoCapitalize="none"
              spellCheck={false}
              autoFocus
              value={typed}
              disabled={!!flash}
              onChange={(e) => setTyped(e.target.value)}
              placeholder="Antwort"
            />
            <button type="submit" className="btn primary" disabled={!!flash || !typed.trim()}>
              OK
            </button>
          </form>
        )}
        {flash ? (
          <p className="small" style={{ textAlign: "center", color: flash.ok ? "var(--ok)" : "var(--brick)" }}>
            {flash.ok ? "Richtig!" : `Richtig wäre: ${flash.answer}`} · {flash.explain}
          </p>
        ) : null}
      </div>
    </section>
  );
}
