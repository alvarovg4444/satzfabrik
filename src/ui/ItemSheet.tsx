import type { Item } from "../content/types";
import { HALLS, TOPICS } from "../content/types";
import { dueInDays, retrievability, rustOf, STAGE_NAMES, stageOf } from "../engine/srs";
import { fmt } from "../game/economy";
import { machineRate } from "../game/economy";
import { useCatalog, useGame } from "../store/store";
import { Pips, Sheet, SpeakButton } from "./common";

function genderName(g: "m" | "f" | "n") {
  return g === "m" ? "maskulin (der)" : g === "f" ? "feminin (die)" : "neutral (das)";
}

/** Everything about one item: the blueprint details plus the learner's own record with it. */
export function ItemDetails({ it }: { it: Item }) {
  return (
    <div className="stack">
      <dl className="kv" style={{ display: "grid", gridTemplateColumns: "auto 1fr", gap: "4px 12px", margin: 0 }}>
        {it.kind === "noun" ? (
          <>
            <dt className="eyebrow">Genus</dt>
            <dd style={{ margin: 0 }}>{genderName(it.gender)}</dd>
            <dt className="eyebrow">Plural</dt>
            <dd style={{ margin: 0 }}>{it.plural ? `die ${it.plural}` : "kein Plural"}</dd>
          </>
        ) : null}
        {it.kind === "verb" ? (
          <>
            <dt className="eyebrow">Präsens</dt>
            <dd style={{ margin: 0 }}>
              du {it.pres.du}, er {it.pres.er}
            </dd>
            <dt className="eyebrow">Präteritum</dt>
            <dd style={{ margin: 0 }}>er {it.prat}</dd>
            <dt className="eyebrow">Perfekt</dt>
            <dd style={{ margin: 0 }}>er {it.perf}</dd>
            {it.gov ? (
              <>
                <dt className="eyebrow">Mit</dt>
                <dd style={{ margin: 0 }}>{it.gov}</dd>
              </>
            ) : null}
          </>
        ) : null}
        {it.kind === "adj" && it.comp ? (
          <>
            <dt className="eyebrow">Steigerung</dt>
            <dd style={{ margin: 0 }}>
              {it.comp}, {it.sup}
            </dd>
          </>
        ) : null}
        {it.kind === "gram" ? (
          <>
            <dt className="eyebrow">Regel</dt>
            <dd style={{ margin: 0 }}>{it.rule}</dd>
            <dt className="eyebrow">Muster</dt>
            <dd style={{ margin: 0, fontWeight: 700 }}>{it.pattern}</dd>
          </>
        ) : null}
        {it.kind === "expr" ? (
          <>
            <dt className="eyebrow">Wann</dt>
            <dd style={{ margin: 0 }}>{it.use}</dd>
          </>
        ) : null}
      </dl>
      {(it.kind === "gram" ? it.examples : [it.example]).map((ex) => (
        <div key={ex.de} className="sentence">
          <div style={{ flex: 1, minWidth: 0 }}>
            <p style={{ fontWeight: 700 }}>{ex.de}</p>
            <p className="en">{ex.en}</p>
          </div>
          <SpeakButton text={ex.de} small />
        </div>
      ))}
      {it.kind === "gram" ? <p className="small muted">Typischer Fehler: {it.tip}</p> : it.note ? <p className="small muted">{it.note}</p> : null}
    </div>
  );
}

export function ItemSheet({ it, onClose, onPractice }: { it: Item; onClose: () => void; onPractice?: (id: string) => void }) {
  const s = useGame();
  const catalog = useCatalog();
  const card = s.cards[it.id];
  const now = Date.now();
  const stage = card ? stageOf(card) : 0;
  const due = card ? dueInDays(card, now) : 0;
  return (
    <Sheet onClose={onClose} label={it.de}>
      <div className="spread">
        <span className="eyebrow">
          {HALLS[it.hall].de} · {it.level}
          {it.topic ? ` · ${TOPICS[it.topic].de}` : ""}
        </span>
        <button type="button" className="btn ghost small" onClick={onClose}>
          Schließen
        </button>
      </div>
      <div className="row" style={{ alignItems: "flex-start" }}>
        <div style={{ flex: 1, minWidth: 0 }}>
          <h2>{it.kind === "gram" ? it.name : it.de}</h2>
          <p className="muted">{it.en}</p>
        </div>
        {it.kind !== "gram" ? <SpeakButton text={it.de} /> : null}
      </div>
      {card ? (
        <div className="card plain stack" style={{ background: "var(--surface-2)" }}>
          <div className="spread">
            <span className="row">
              <Pips stage={stage} /> <b>{STAGE_NAMES[stage]}</b>
            </span>
            <span className="num small">{fmt(machineRate(s, it, card, now, catalog))} Taler/h</span>
          </div>
          <p className="small muted">
            {stage === 0
              ? "Noch ein Bauplan: schreib deinen ersten richtigen Satz damit, dann läuft die Maschine."
              : rustOf(card, now) > 0
                ? `Rostet seit ${Math.max(1, Math.round(-due))} Tag(en). Benutze es in der nächsten Schicht.`
                : `Nächste Wartung in ${Math.max(1, Math.round(due))} Tag(en). Erinnerung jetzt: ${Math.round(retrievability(card, now) * 100)} %.`}
          </p>
          <div className="spread">
            <p className="small muted num">
              {card.ok}× richtig · {card.fail}× daneben
            </p>
            {onPractice ? (
              <button
                type="button"
                className="btn small steel"
                onClick={() => {
                  onClose();
                  onPractice(it.id);
                }}
              >
                {stage === 0 ? "Jetzt bauen" : "Jetzt üben"}
              </button>
            ) : null}
          </div>
          {card.ctx?.length ? (
            <div className="stack" style={{ gap: 6 }}>
              <span className="eyebrow">Deine Sätze</span>
              {card.ctx.map((c) => (
                <p key={c} className="small">
                  „{c}“
                </p>
              ))}
            </div>
          ) : null}
        </div>
      ) : null}
      <ItemDetails it={it} />
    </Sheet>
  );
}
