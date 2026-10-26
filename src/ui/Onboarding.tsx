import { useState } from "react";
import { TOPICS, type Level, type TopicId } from "../content/types";
import { newLevelState } from "../engine/level";
import { grantStarter, rollover } from "../game/actions";
import { DEFAULT_TOPICS, starterItems } from "../game/starter";
import { store, useCatalog, useMeta } from "../store/store";
import { Icon } from "./common";

const START: Record<Level, number> = { A1: 1.6, A2: 2.3, B1: 3.0, B2: 3.6 };

export function Onboarding({ onDone }: { onDone: () => void }) {
  const catalog = useCatalog();
  const meta = useMeta();
  const [step, setStep] = useState(0);
  const [topics, setTopics] = useState<TopicId[]>(DEFAULT_TOPICS);
  const [level, setLevel] = useState<Level>("A2");

  const toggle = (t: TopicId) => setTopics((cur) => (cur.includes(t) ? cur.filter((x) => x !== t) : [...cur, t].slice(-4)));

  const finish = () => {
    const items = starterItems(catalog, topics.length ? topics : DEFAULT_TOPICS);
    store.update((d, c) => {
      // A rough self-assessment is only the starting point; the level engine corrects it from the answers.
      d.level = newLevelState(START[level]);
      grantStarter(d, items, Date.now());
      d.onboarded = true;
      rollover(d, c, Date.now());
    });
    onDone();
  };

  return (
    <div className="onboard wrap">
      <div className="card stack">
        {step === 0 ? (
          <>
            <span className="eyebrow">Willkommen</span>
            <h1>Deine Satzfabrik</h1>
            <p>Hier lernst du Deutsch, indem du es benutzt. Jedes Wort und jede Struktur ist eine Maschine in deiner Fabrik.</p>
            <ul className="errs">
              <li>
                <b>Bauen:</b> Eine Maschine läuft erst, wenn du einen eigenen, richtigen Satz damit schreibst.
              </li>
              <li>
                <b>Produzieren:</b> Laufende Maschinen verdienen Taler, auch wenn die App zu ist. Jeden Tag kommen neue Baupläne passend
                zu deinem Niveau, mit Talern holst du dir mehr und baust die Fabrik aus.
              </li>
              <li>
                <b>Warten:</b> Wenn du ein Wort bald vergessen würdest, rostet die Maschine. Benutze es in einem neuen Satz, dann läuft
                sie wieder, und zwar länger als vorher.
              </li>
              <li>
                <b>Qualitätskontrolle:</b> Claude korrigiert jeden Satz sofort, erklärt deine Fehler und merkt sich deine Schwachstellen.
              </li>
            </ul>
            <button type="button" className="btn primary block" onClick={() => setStep(1)}>
              Fabrik einrichten <Icon name="arrow" size={18} />
            </button>
          </>
        ) : step === 1 ? (
          <>
            <span className="eyebrow">Schritt 1 von 2</span>
            <h2>Worüber sprichst du im Alltag?</h2>
            <p className="muted">Wähle bis zu vier Themen. Daraus kommen deine ersten Wörter. Konnektoren wie weil, trotzdem, dass, obwohl und das Perfekt sind immer dabei.</p>
            <div className="topic-grid">
              {(Object.keys(TOPICS) as TopicId[]).map((t) => (
                <button key={t} type="button" aria-pressed={topics.includes(t)} onClick={() => toggle(t)}>
                  {TOPICS[t].de}
                  <span className="en" style={{ display: "block" }}>
                    {TOPICS[t].en}
                  </span>
                </button>
              ))}
            </div>
            <h3>Dein Niveau ungefähr</h3>
            <div className="seg" role="group" aria-label="Niveau">
              {(["A1", "A2", "B1", "B2"] as Level[]).map((l) => (
                <button key={l} type="button" aria-pressed={level === l} onClick={() => setLevel(l)}>
                  {l}
                </button>
              ))}
            </div>
            <p className="small muted">Nur ein Startwert: die Fabrik schätzt dein Niveau danach aus deinen Antworten.</p>
            <button type="button" className="btn primary block" disabled={!topics.length} onClick={() => setStep(2)}>
              Weiter <Icon name="arrow" size={18} />
            </button>
          </>
        ) : (
          <>
            <span className="eyebrow">Schritt 2 von 2</span>
            <h2>Dein Korrektor</h2>
            {meta.provider.id === "claude-app" ? (
              <p>
                Verbunden: <b>Claude über dein Abo</b>. Korrekturen laufen über dein Claude-Konto und zählen zu deinem normalen
                Nutzungslimit. Beim ersten Satz fragt Claude einmal um Erlaubnis.
              </p>
            ) : meta.providerReady ? (
              <p>
                {meta.provider.id === "offline"
                  ? "Noch kein KI-Korrektor verbunden. Auf claude.ai läuft er automatisch über dein Abo. Hier kannst du in den Einstellungen einen API-Schlüssel oder ein lokales Modell eintragen. Bis dahin vergleichst du selbst mit Musterlösungen."
                  : `Verbunden: ${meta.provider.label}.`}
              </p>
            ) : (
              <p className="muted">Suche Korrektor …</p>
            )}
            <p className="small muted">
              Plan für jeden Tag: 2–3 Schichten à 10 Minuten, dazu eine Akkord-Runde für die Formen. Das Tagesziel hält deinen Streak am
              Leben.
            </p>
            <button type="button" className="btn primary block" onClick={finish}>
              Erste Schicht starten <Icon name="play" size={18} />
            </button>
          </>
        )}
      </div>
    </div>
  );
}
