import { useMemo, useState } from "react";
import { DRILL_LABELS } from "../engine/drills";
import { cardsWaiting, drillFocus } from "../game/training";
import { useCatalog, useGame } from "../store/store";
import { CardsView } from "./CardsView";
import { Icon } from "./common";
import { DrillView } from "./DrillView";

type Mode = "menu" | "cards" | "akkord";

/**
 * Training: two short exercises next to the shifts, each with its own job.
 * Schnellkarten when the word does not come to mind, Akkord when the word comes but its
 * ending is wrong. The menu suggests the one that fits today.
 */
export function TrainingView() {
  const s = useGame();
  const catalog = useCatalog();
  const [mode, setMode] = useState<Mode>("menu");
  const waiting = useMemo(() => cardsWaiting(s, catalog, Date.now()), [s, catalog]);
  const focus = useMemo(() => drillFocus(s), [s]);

  if (mode === "cards") return <CardsView onBack={() => setMode("menu")} />;
  if (mode === "akkord") return <DrillView onBack={() => setMode("menu")} />;

  // rusting words first; otherwise the forms behind recent mistakes
  const suggest: Mode = waiting.total >= 5 || waiting.mistakes > 0 || (waiting.total > 0 && !focus.focus.length) ? "cards" : "akkord";
  return (
    <section className="stack">
      <div>
        <span className="eyebrow">Training</span>
        <h1>Kurz und gezielt</h1>
        <p className="muted small">Schnellkarten, wenn dir das Wort nicht einfällt. Akkord, wenn das Wort kommt, aber die Endung nicht stimmt.</p>
      </div>
      <button type="button" className={`card train-pick ${suggest === "cards" ? "suggested" : ""}`} onClick={() => setMode("cards")}>
        <span className="train-icon" aria-hidden="true">
          <Icon name="spark" size={22} />
        </span>
        <span className="train-text">
          <span className="eyebrow">Schnellkarten · Welches Wort?{suggest === "cards" ? " · Empfohlen" : ""}</span>
          <b>Englisch sehen, Deutsch mit Artikel schreiben</b>
          <span className="small muted">
            {waiting.total
              ? `${waiting.total} ${waiting.total === 1 ? "Wort wartet" : "Wörter warten"}: rostende Maschinen, neue Wörter von heute${waiting.mistakes ? ` und ${waiting.mistakes} ${waiting.mistakes === 1 ? "Fehlerwort" : "Fehlerwörter"} aus deinen Sätzen` : ""}.`
              : "Alles frisch: gerade rostet nichts."}
            {waiting.pile ? ` Im Fehlerstapel: ${waiting.pile} ${waiting.pile === 1 ? "Wort" : "Wörter"} (wieder nach 1, 3, 7, 14 und 30 Tagen).` : ""}
          </span>
        </span>
      </button>
      <button type="button" className={`card train-pick ${suggest === "akkord" ? "suggested" : ""}`} onClick={() => setMode("akkord")}>
        <span className="train-icon" aria-hidden="true">
          <Icon name="bolt" size={22} />
        </span>
        <span className="train-text">
          <span className="eyebrow">Akkord · Welche Form?{suggest === "akkord" ? " · Empfohlen" : ""}</span>
          <b>Kasus, Endungen und Verbformen im Tempo</b>
          <span className="small muted">
            {focus.focus.length ? `Heute im Fokus: ${focus.focus.map((k) => DRILL_LABELS[k]).join(", ")} (aus deinen Sätzen).` : "Gemischte Formen mit deinen Wörtern."}
          </span>
        </span>
      </button>
    </section>
  );
}
