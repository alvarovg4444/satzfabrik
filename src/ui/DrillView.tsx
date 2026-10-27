import { useEffect, useMemo, useRef, useState } from "react";
import { BUILTIN_ITEMS } from "../content/catalog";
import type { Item } from "../content/types";
import { buildDrillRound, checkDrill, DRILL_LABELS, drillSeed, typed as typedQ, type DrillQ } from "../engine/drills";
import { applyDrill } from "../game/actions";
import { drillReward, drillSeconds, fmt } from "../game/economy";
import { drillFocus } from "../game/training";
import { store, useCatalog, useGame } from "../store/store";
import { showAchievements } from "./Celebrations";
import { floatCoins, Icon, toast } from "./common";
import { sfx } from "./fx";
import { Keyboard, useInAppKeyboard } from "./Keyboard";

/** Questions in a round without the clock. */
const UNTIMED = 15;

type Phase = { k: "idle" } | { k: "run"; calm: boolean } | { k: "done"; calm: boolean };
type Score = { ok: number; total: number; streak: number; earned: number };
const ZERO: Score = { ok: 0, total: 0, streak: 0, earned: 0 };

/**
 * Akkord: "Welche Form?" Cases, endings and verb forms of the learner's own words, aimed
 * at the grammar that goes wrong in their sentences. A wrong answer stops the round (and the
 * clock) until the learner has read the right form; the misses come back in a calm round
 * without a clock, typed, and count as weak spots for the shifts.
 */
export function DrillView({ onBack }: { onBack: () => void }) {
  const s = useGame();
  const catalog = useCatalog();
  const [phase, setPhase] = useState<Phase>({ k: "idle" });
  const [qs, setQs] = useState<DrillQ[]>([]);
  const [i, setI] = useState(0);
  const [typedText, setTyped] = useState("");
  const [flash, setFlash] = useState<{ ok: boolean; given: string } | null>(null);
  const [score, setScore] = useState<Score>(ZERO);
  const [misses, setMisses] = useState<DrillQ[]>([]);
  const [left, setLeft] = useState(0);
  const endAt = useRef(0);
  const pausedAt = useRef(0);
  const rounds = useRef(0);
  const finished = useRef(true);
  const scoreRef = useRef(score);
  const missRef = useRef<DrillQ[]>([]);
  const boxRef = useRef<HTMLDivElement>(null);
  const inputRef = useRef<HTMLInputElement>(null);
  const inApp = useInAppKeyboard();
  const [keys, setKeys] = useState(true);
  const seconds = drillSeconds(s);
  const timer = s.settings.drillTimer;
  const focus = useMemo(() => drillFocus(s), [s]);
  const timed = phase.k === "run" && !phase.calm && timer;

  const owned = useMemo<Item[]>(
    () => Object.keys(s.cards).map((id) => catalog.get(id)).filter((x): x is Item => !!x),
    [s.cards, catalog],
  );

  const finish = () => {
    if (finished.current) return;
    finished.current = true;
    const calm = phase.k === "run" && phase.calm;
    const final = scoreRef.current;
    setPhase({ k: "done", calm });
    const r = store.update((d, c) =>
      applyDrill(d, c, Date.now(), {
        correct: final.ok,
        total: final.total,
        earned: final.earned,
        misses: calm ? [] : missRef.current.map((q) => ({ kind: q.kind, itemId: q.itemId })),
      }),
    );
    for (const o of r.orders) toast(<span>Auftrag erledigt: <b>+{fmt(o.reward)}</b></span>);
    showAchievements(r.achievements);
  };

  // the clock; it stands still while a mistake is on screen
  useEffect(() => {
    if (!timed) return;
    const id = setInterval(() => {
      if (pausedAt.current) return;
      const ms = endAt.current - Date.now();
      setLeft(Math.max(0, ms));
      if (ms <= 0) {
        clearInterval(id);
        finish();
      }
    }, 200);
    return () => clearInterval(id);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [timed, phase]);

  const begin = (questions: DrillQ[], calm: boolean) => {
    setQs(questions);
    setI(0);
    setTyped("");
    setFlash(null);
    setScore(ZERO);
    scoreRef.current = ZERO;
    if (!calm) {
      setMisses([]);
      missRef.current = [];
    }
    finished.current = false;
    pausedAt.current = 0;
    endAt.current = Date.now() + seconds * 1000;
    setLeft(seconds * 1000);
    setKeys(true);
    setPhase({ k: "run", calm });
  };

  const start = () => {
    rounds.current++;
    const round = buildDrillRound(owned, BUILTIN_ITEMS, drillSeed(Date.now(), rounds.current), timer ? 40 : UNTIMED, focus.mix, focus.words);
    begin(round, false);
  };

  const calmRound = () => begin(missRef.current.map(typedQ), true);

  const q = qs[i];
  const calm = phase.k === "run" && phase.calm;

  const advance = () => {
    if (pausedAt.current) {
      // give back the time spent reading the mistake
      endAt.current += Date.now() - pausedAt.current;
      pausedAt.current = 0;
    }
    setFlash(null);
    setTyped("");
    if (i + 1 >= qs.length) finish();
    else setI(i + 1);
  };

  const answer = (given: string) => {
    if (!q || flash || finished.current) return;
    const ok = checkDrill(q, given);
    // the calm round pays a little for each fixed form, no series bonus
    const gain = ok ? drillReward(s, calm ? 0 : score.streak) : 0;
    const nextScore = { ok: score.ok + (ok ? 1 : 0), total: score.total + 1, streak: ok ? score.streak + 1 : 0, earned: score.earned + gain };
    setScore(nextScore);
    scoreRef.current = nextScore;
    if (ok) {
      sfx.coin();
      floatCoins(gain, boxRef.current);
      setFlash({ ok, given });
      setTimeout(advance, 450);
      return;
    }
    sfx.bad();
    if (!calm && !missRef.current.some((m) => m.id === q.id)) {
      missRef.current = [...missRef.current, q];
      setMisses(missRef.current);
    }
    // stop and show the mistake until the learner taps on
    pausedAt.current = Date.now();
    setFlash({ ok, given });
  };

  if (phase.k === "idle") {
    return (
      <section className="card stack">
        <button type="button" className="btn ghost small" style={{ alignSelf: "flex-start" }} onClick={onBack}>
          ← Training
        </button>
        <span className="eyebrow">Akkord · Welche Form?</span>
        <h1>{timer ? `${seconds} Sekunden Formen` : `${UNTIMED} Formen in Ruhe`}</h1>
        <p className="muted">
          Kasus nach Präpositionen, Adjektivendungen, Perfekt, Präteritum, Präsens, Pronomen und Possessivartikel, mit deinen eigenen Wörtern.
        </p>
        <div className="focus-box">
          <span className="eyebrow">Heute im Fokus</span>
          {focus.focus.length ? (
            <p>
              <b>{focus.focus.map((k) => DRILL_LABELS[k]).join(", ")}</b>
              <span className="small muted" style={{ display: "block" }}>
                aus den Fehlern in deinen Sätzen{focus.words.size ? ` · dazu ${focus.words.size} Wörter, die zuletzt schiefgingen` : ""}
              </span>
            </p>
          ) : (
            <p className="small muted">Eine bunte Mischung. Sobald in deinen Sätzen Formfehler auftauchen, übt der Akkord genau die.</p>
          )}
        </div>
        <label className="toggle" htmlFor="drill-timer">
          <span>
            Gegen die Uhr
            <span className="small muted" style={{ display: "block" }}>
              Aus: {UNTIMED} Fragen ohne Zeitdruck.
            </span>
          </span>
          <input id="drill-timer" type="checkbox" checked={timer} onChange={(e) => store.update((d) => void (d.settings.drillTimer = e.target.checked))} />
        </label>
        <button type="button" className="btn primary block" onClick={start}>
          <Icon name="bolt" size={18} /> Los geht's
        </button>
      </section>
    );
  }

  if (phase.k === "done") {
    const pct = score.total ? Math.round((score.ok / score.total) * 100) : 0;
    const open = !phase.calm && misses.length > 0;
    return (
      <section className="card stack">
        <span className="eyebrow">{phase.calm ? "Fehlerrunde geschafft" : "Akkord-Runde vorbei"}</span>
        <h1>
          {score.ok} {score.ok === 1 ? "Treffer" : "Treffer"} · {pct} %
        </h1>
        <p className="muted">+{fmt(score.earned)} Taler verdient.</p>
        {open ? (
          <div className="stack" style={{ gap: 6 }}>
            <p>
              <b>{misses.length} {misses.length === 1 ? "Fehler" : "Fehler"}</b> – schreib sie jetzt noch einmal, in Ruhe und ohne Uhr. Sie zählen als
              Schwachstellen und kommen auch in deinen Schichten dran.
            </p>
            <ul className="miss-list">
              {misses.map((m) => (
                <li key={m.id} className="small">
                  {m.prompt.replace("___", "…")} → <b>{m.answer}</b>
                </li>
              ))}
            </ul>
          </div>
        ) : null}
        <div className="row">
          {open ? (
            <button type="button" className="btn primary" onClick={calmRound}>
              Nochmal die Fehler
            </button>
          ) : null}
          <button type="button" className={`btn ${open ? "" : "primary"}`} onClick={start}>
            Neue Runde
          </button>
          <button type="button" className="btn ghost" onClick={onBack}>
            Training
          </button>
        </div>
      </section>
    );
  }

  if (!q) return null;
  const showOptions = !!q.options && !calm;
  return (
    <section className="stack">
      {timed ? (
        <div className={`timer ${pausedAt.current ? "paused" : ""}`} aria-label="Restzeit">
          <i style={{ width: `${(left / (seconds * 1000)) * 100}%` }} />
        </div>
      ) : null}
      <div className="spread">
        <span className="eyebrow">
          {calm ? "Fehlerrunde · " : ""}
          {DRILL_LABELS[q.kind]}
        </span>
        <span className="num">
          {calm ? `${i + 1}/${qs.length}` : `${score.ok}/${score.total} · Serie ${score.streak}`} · +{fmt(score.earned)}
        </span>
      </div>
      <div ref={boxRef} className={`card stack ${flash ? (flash.ok ? "flash-ok" : "flash-bad") : ""}`}>
        <div className="drill-prompt">{q.prompt}</div>
        {q.hint ? <p className="en" style={{ textAlign: "center" }}>{q.hint}</p> : null}
        {flash && !flash.ok ? (
          <div className="mistake">
            {flash.given ? (
              <p className="small">
                Deine Antwort: <s>{flash.given}</s>
              </p>
            ) : null}
            <p className="answer-big">{q.prompt.replace("___", q.answer)}</p>
            {q.prompt.replace("___", q.answer).includes(q.explain) ? null : <p className="small">{q.explain}</p>}
            {timed ? <p className="small muted">Die Uhr steht, bis du weitertippst.</p> : null}
            <button type="button" className="btn primary block" autoFocus onClick={advance}>
              Weiter <Icon name="arrow" size={18} />
            </button>
          </div>
        ) : showOptions ? (
          <div className="options">
            {q.options!.map((o) => (
              <button key={o} type="button" className={`btn ${flash && o === q.answer ? "primary" : ""}`} disabled={!!flash} onClick={() => answer(o)}>
                {o}
              </button>
            ))}
          </div>
        ) : (
          <form
            className="row"
            onSubmit={(e) => {
              e.preventDefault();
              if (typedText.trim()) answer(typedText);
            }}
          >
            <input
              ref={inputRef}
              id="drill-answer"
              className="input"
              style={{ flex: 1 }}
              lang="de"
              autoComplete="off"
              autoCapitalize="none"
              autoCorrect="off"
              inputMode={inApp ? "none" : undefined}
              spellCheck={false}
              autoFocus
              value={typedText}
              disabled={!!flash}
              onChange={(e) => setTyped(e.target.value)}
              onClick={() => setKeys(true)}
              placeholder="Antwort"
            />
            <button type="submit" className="btn primary" disabled={!!flash || !typedText.trim()}>
              OK
            </button>
          </form>
        )}
        {inApp && keys && !showOptions && !flash ? (
          <Keyboard
            field={inputRef}
            value={typedText}
            onChange={setTyped}
            action={{ label: "OK", onPress: () => typedText.trim() && answer(typedText), disabled: !typedText.trim() }}
            onHide={() => setKeys(false)}
            sentences={false}
          />
        ) : null}
        {flash?.ok ? (
          <p className="small" style={{ textAlign: "center", color: "var(--ok)" }}>
            Richtig!
          </p>
        ) : null}
      </div>
    </section>
  );
}
