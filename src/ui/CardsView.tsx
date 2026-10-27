import { useMemo, useRef, useState } from "react";
import { applyCard, applyMistakeCard } from "../game/actions";
import { fmt } from "../game/economy";
import { cardHint, checkCard, trainingCards, type CardCheck, type CardEntry } from "../game/training";
import { MISTAKE_DAYS } from "../game/mistakes";
import { store, useCatalog } from "../store/store";
import { showAchievements } from "./Celebrations";
import { floatCoins, Icon, SpeakButton, toast } from "./common";
import { sfx } from "./fx";
import { Keyboard, useInAppKeyboard } from "./Keyboard";

/** The forms that belong to the word: shown with the answer. */
function forms(it: CardEntry["item"]): string {
  switch (it.kind) {
    case "noun":
      return it.plural ? `Plural: die ${it.plural}` : "kein Plural";
    case "verb":
      return [it.pres.er, it.prat, it.perf].join(" · ");
    case "adj":
      return it.comp ? `${it.comp} · ${it.sup ?? ""}` : "";
    default:
      return "";
  }
}

type Result = { check: CardCheck; given: string; first: boolean };

/** Where a Fehlerwort goes after a right answer (its step before this answer). */
function mistakeNext(m: { step: number }): string {
  const days = MISTAKE_DAYS[m.step + 1];
  return days ? `Fehlerwort: wieder in ${days} Tagen.` : "Fehlerwort geschafft, es verlässt den Stapel.";
}

/**
 * Schnellkarten: "Welches Wort?" The English meaning, and the learner types the German
 * word with its article. Due machines first, then today's new words. A word known on
 * the first try keeps its machine from rusting for a few days; a missed one comes back
 * at the end of the round and in the next shift.
 */
export function CardsView({ onBack }: { onBack: () => void }) {
  const catalog = useCatalog();
  const [queue, setQueue] = useState<CardEntry[]>(() => trainingCards(store.get(), catalog, Date.now()));
  const [round, setRound] = useState(() => ({ size: queue.length, firstOk: 0, earned: 0 }));
  /** Words already answered once this round (re-asks earn nothing and change nothing). */
  const seen = useRef(new Set<string>());
  const [typedText, setTyped] = useState("");
  const [result, setResult] = useState<Result | null>(null);
  const [keys, setKeys] = useState(true);
  const inApp = useInAppKeyboard();
  const inputRef = useRef<HTMLInputElement>(null);
  const boxRef = useRef<HTMLDivElement>(null);
  const entry = queue[0];
  const it = entry?.item;
  const mistake = entry?.mistake;
  const waiting = useMemo(() => (entry ? 0 : trainingCards(store.get(), catalog, Date.now()).length), [entry, catalog]);

  const restart = () => {
    const q = trainingCards(store.get(), catalog, Date.now());
    seen.current = new Set();
    setQueue(q);
    setRound({ size: q.length, firstOk: 0, earned: 0 });
    setResult(null);
    setTyped("");
  };

  const answer = (given: string) => {
    if (!entry || !it || result) return;
    const check = checkCard(it, given);
    const first = !seen.current.has(entry.key);
    seen.current.add(entry.key);
    if (first) {
      const r = store.update((d, c) =>
        entry.mistake ? applyMistakeCard(d, c, Date.now(), entry.key.slice(2), check === "ok") : applyCard(d, c, Date.now(), it.id, check === "ok"),
      );
      if ("result" in r && r.result === "done") toast(<span>Fehlerwort geschafft: <b>{it.de}</b> sitzt jetzt</span>, 4000);
      if (r.taler) floatCoins(r.taler, boxRef.current);
      setRound((x) => ({ ...x, firstOk: x.firstOk + (check === "ok" ? 1 : 0), earned: x.earned + r.taler }));
      if (r.streakUp) toast(<span>Die Flamme brennt heute: <b>{store.get().streak.current}</b> {store.get().streak.current === 1 ? "Tag" : "Tage"} in Folge</span>, 5000);
      showAchievements(r.achievements);
    }
    if (check === "ok") sfx.coin();
    else sfx.bad();
    setResult({ check, given, first });
  };

  const next = () => {
    if (!entry) return;
    const missed = result && result.check !== "ok";
    // a missed word comes back at the end: the round ends with every word typed right once
    setQueue((q) => (missed ? [...q.slice(1), q[0]] : q.slice(1)));
    setResult(null);
    setTyped("");
    setKeys(true);
  };

  if (!entry || !it) {
    const done = round.size > 0;
    return (
      <section className="card stack">
        <span className="eyebrow">Schnellkarten · Welches Wort?</span>
        {done ? (
          <>
            <h1>
              {round.firstOk} von {round.size} auf Anhieb
            </h1>
            <p className="muted">
              +{fmt(round.earned)} Taler. Gewusste Wörter rosten ein paar Tage nicht, die anderen kommen in der nächsten Schicht wieder.
            </p>
          </>
        ) : (
          <>
            <h1>Alles frisch</h1>
            <p className="muted">Gerade rostet keine Maschine und es gibt keine neuen Wörter von heute. Schreib eine Schicht oder versuch den Akkord.</p>
          </>
        )}
        <div className="row">
          {waiting ? (
            <button type="button" className="btn primary" onClick={restart}>
              Noch {waiting} {waiting === 1 ? "Karte" : "Karten"}
            </button>
          ) : null}
          <button type="button" className="btn ghost" onClick={onBack}>
            Zurück zum Training
          </button>
        </div>
      </section>
    );
  }

  const left = queue.length;
  return (
    <section className="stack">
      <div className="spread">
        <button type="button" className="btn ghost small" onClick={onBack}>
          ← Training
        </button>
        <span className="num small muted">noch {left}</span>
      </div>
      <div ref={boxRef} className={`card stack flashcard ${result ? (result.check === "ok" ? "flash-ok" : "flash-bad") : ""}`}>
        <span className="eyebrow">
          {mistake ? "Dein Fehlerwort · " : ""}
          {cardHint(it)}
        </span>
        <div className="drill-prompt">{it.en}</div>
        {!result ? (
          <>
            <form
              className="row"
              onSubmit={(e) => {
                e.preventDefault();
                if (typedText.trim()) answer(typedText);
              }}
            >
              <input
                ref={inputRef}
                id="card-answer"
                className="input"
                style={{ flex: 1 }}
                lang="de"
                autoComplete="off"
                autoCapitalize="none"
                autoCorrect="off"
                spellCheck={false}
                inputMode={inApp ? "none" : undefined}
                autoFocus
                value={typedText}
                onChange={(e) => setTyped(e.target.value)}
                onClick={() => setKeys(true)}
                placeholder={it.kind === "noun" ? "der/die/das …" : "auf Deutsch"}
              />
              <button type="submit" className="btn primary" disabled={!typedText.trim()}>
                Prüfen
              </button>
            </form>
            <button type="button" className="btn ghost small" onClick={() => answer("")}>
              Weiß ich nicht
            </button>
          </>
        ) : (
          <div className="stack" style={{ gap: 8 }}>
            {result.check === "ok" ? (
              <p className="verdict-line ok">
                <Icon name="check" size={18} /> Richtig!
              </p>
            ) : result.given.trim() ? (
              <p className="verdict-line bad">
                <s>{result.given}</s> {result.check === "article" ? "– fast, nur der Artikel stimmt nicht" : ""}
              </p>
            ) : null}
            {mistake ? (
              <p className="small">
                Im Satz hattest du: <s className="was">{mistake.wrong}</s>
              </p>
            ) : null}
            <div className="sentence">
              <p className="answer-big">{it.de}</p>
              <SpeakButton text={it.de} />
            </div>
            {forms(it) ? <p className="small">{forms(it)}</p> : null}
            <p className="small muted">{mistake ? `Richtig: ${mistake.sentence}` : it.example.de}</p>
            {result.check !== "ok" ? (
              <p className="small muted">
                Die Karte kommt am Ende der Runde noch einmal{mistake ? ", und das Fehlerwort fängt wieder bei einem Tag an." : "."}
              </p>
            ) : mistake && result.first ? (
              <p className="small muted">{mistakeNext(mistake)}</p>
            ) : null}
            <button type="button" className="btn primary block" autoFocus onClick={next}>
              Weiter <Icon name="arrow" size={18} />
            </button>
          </div>
        )}
        {inApp && keys && !result ? (
          <Keyboard
            field={inputRef}
            value={typedText}
            onChange={setTyped}
            action={{ label: "Prüfen", onPress: () => typedText.trim() && answer(typedText), disabled: !typedText.trim() }}
            onHide={() => setKeys(false)}
            sentences={false}
          />
        ) : null}
      </div>
    </section>
  );
}
