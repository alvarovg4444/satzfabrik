import { useEffect, useState } from "react";
import { gradeAnswer } from "../ai/corrector";
import { EXPLAIN_LANGS, type ExplainLang } from "../ai/prompts";
import { AIError, ANTHROPIC_MODELS, type AISettings, type ProviderId } from "../ai/providers";
import { BUILTIN_ITEMS } from "../content/catalog";
import { importText } from "../engine/importer";
import type { Task } from "../engine/tasks";
import { migrate, newGame, type Settings } from "../game/state";
import { clearLocal, MAX_CUSTOM } from "../store/persist";
import { store, useCatalog, useGame, useMeta } from "../store/store";
import { toast } from "./common";
import { canSpeak, germanVoices, onVoicesChanged, setSound, speak, voiceScore } from "./fx";

function patchSettings(p: Partial<Settings>) {
  store.update((d) => {
    d.settings = { ...d.settings, ...p };
  });
  if (p.sound !== undefined) setSound(p.sound);
}

function patchAI(p: Partial<AISettings>) {
  store.update((d) => {
    d.settings.ai = { ...d.settings.ai, ...p };
  });
  void store.refreshProvider();
}

const TEST_TASK: Task = {
  key: "test",
  type: "produce",
  targets: [],
  instruction: "Schreib einen Satz.",
  instructionEn: "Write a sentence.",
  cues: [],
  reason: "practice",
};

function AISection() {
  const s = useGame();
  const meta = useMeta();
  const catalog = useCatalog();
  const ai = s.settings.ai;
  const [testing, setTesting] = useState<string | null>(null);
  const onClaude = typeof window !== "undefined" && typeof window.claude?.use === "function";

  const test = async () => {
    setTesting("Teste …");
    const t0 = performance.now();
    try {
      const g = await gradeAnswer(meta.provider, TEST_TASK, "Gestern ich bin mit der Bus zur Arbeit gefahren.", catalog, {
        lang: s.settings.explainLang,
        careful: false,
      });
      const secs = ((performance.now() - t0) / 1000).toFixed(1);
      setTesting(`Funktioniert (${secs} s). Korrektur: „${g.corrected}“`);
    } catch (e) {
      setTesting(e instanceof AIError ? e.message : "Test fehlgeschlagen.");
    }
  };

  return (
    <section className="card stack">
      <h3>KI-Korrektor</h3>
      <p className="small muted">
        Aktiv: <b>{meta.providerReady ? meta.provider.label : "wird verbunden …"}</b>.{" "}
        {meta.provider.id === "claude-app"
          ? "Läuft über dein Claude-Konto und zählt zu deinem normalen Nutzungslimit."
          : meta.provider.id === "offline"
            ? "Ohne Korrektor bewertest du dich selbst."
            : ""}
      </p>
      <div className="field">
        <label htmlFor="ai-pref">Woher kommen die Korrekturen?</label>
        <select id="ai-pref" className="input" value={ai.preferred} onChange={(e) => patchAI({ preferred: e.target.value as ProviderId | "auto" })}>
          <option value="auto">Automatisch (Claude-Abo, wenn verfügbar)</option>
          <option value="anthropic">Claude API mit eigenem Schlüssel</option>
          <option value="openai">Lokales Open-Source-Modell (OpenAI-kompatibel)</option>
          <option value="offline">Ohne KI (Selbstkontrolle)</option>
        </select>
        {!onClaude && ai.preferred === "auto" ? (
          <p className="small muted">
            Das Claude-Abo funktioniert nur, wenn du die Satzfabrik auf claude.ai öffnest. Hier brauchst du einen API-Schlüssel oder ein
            lokales Modell.
          </p>
        ) : null}
      </div>
      {ai.preferred === "anthropic" || (ai.preferred === "auto" && !onClaude) ? (
        <>
          <div className="field">
            <label htmlFor="ai-key">Claude API-Schlüssel</label>
            <input
              id="ai-key"
              className="input"
              type="password"
              autoComplete="off"
              placeholder="sk-ant-…"
              value={ai.anthropicKey}
              onChange={(e) => patchAI({ anthropicKey: e.target.value.trim() })}
            />
            <p className="small muted">Bleibt nur in diesem Browser und wird nie in die Cloud gespeichert. Abgerechnet wird pro Nutzung.</p>
          </div>
          <div className="field">
            <label htmlFor="ai-model">Modell</label>
            <select id="ai-model" className="input" value={ai.anthropicModel} onChange={(e) => patchAI({ anthropicModel: e.target.value })}>
              {ANTHROPIC_MODELS.map((m) => (
                <option key={m.id} value={m.id}>
                  {m.label}: {m.note}
                </option>
              ))}
            </select>
          </div>
        </>
      ) : null}
      {ai.preferred === "openai" ? (
        <>
          <div className="field">
            <label htmlFor="oa-base">Adresse</label>
            <input id="oa-base" className="input" value={ai.openaiBase} onChange={(e) => patchAI({ openaiBase: e.target.value.trim() })} />
            <p className="small muted">
              Ollama: http://localhost:11434/v1 (starte Ollama mit OLLAMA_ORIGINS=* damit diese Seite zugreifen darf). LM Studio:
              http://localhost:1234/v1.
            </p>
          </div>
          <div className="field">
            <label htmlFor="oa-model">Modellname</label>
            <input id="oa-model" className="input" placeholder="z. B. qwen3:14b oder gemma3:12b" value={ai.openaiModel} onChange={(e) => patchAI({ openaiModel: e.target.value.trim() })} />
            <p className="small muted">Kleine Modelle übersehen Fehler oder erfinden welche. Für Korrekturen lieber 12B oder größer.</p>
          </div>
          <div className="field">
            <label htmlFor="oa-key">Schlüssel (optional)</label>
            <input id="oa-key" className="input" type="password" autoComplete="off" value={ai.openaiKey} onChange={(e) => patchAI({ openaiKey: e.target.value.trim() })} />
          </div>
        </>
      ) : null}
      <label className="toggle" htmlFor="careful">
        <span>
          Gründlich korrigieren
          <span className="small muted" style={{ display: "block" }}>
            Langsamer (5–30 s), dafür sorgfältiger. Sonst gibt es „Einspruch“ bei Zweifeln.
          </span>
        </span>
        <input id="careful" type="checkbox" checked={s.settings.careful} onChange={(e) => patchSettings({ careful: e.target.checked })} />
      </label>
      <label className="toggle" htmlFor="fresh">
        <span>
          Neue Situationen von der KI
          <span className="small muted" style={{ display: "block" }}>
            Jede Schicht bekommt frische Alltagssituationen statt der eingebauten.
          </span>
        </span>
        <input id="fresh" type="checkbox" checked={s.settings.freshTasks} onChange={(e) => patchSettings({ freshTasks: e.target.checked })} />
      </label>
      <div className="field">
        <label htmlFor="lang">Sprache der Erklärungen</label>
        <select id="lang" className="input" value={s.settings.explainLang} onChange={(e) => patchSettings({ explainLang: e.target.value as ExplainLang })}>
          {(Object.keys(EXPLAIN_LANGS) as ExplainLang[]).map((k) => (
            <option key={k} value={k}>
              {EXPLAIN_LANGS[k].label}
            </option>
          ))}
        </select>
      </div>
      <div className="row">
        <button type="button" className="btn small" onClick={test} disabled={meta.provider.id === "offline"}>
          Verbindung testen
        </button>
        {testing ? <span className="small muted">{testing}</span> : null}
      </div>
    </section>
  );
}

/** Pick the German voice; natural ones first. Better voices are free downloads on most devices. */
function VoicePicker() {
  const s = useGame();
  const [voices, setVoices] = useState(germanVoices);
  useEffect(() => {
    setVoices(germanVoices());
    return onVoicesChanged(() => setVoices(germanVoices()));
  }, []);
  if (!canSpeak()) return <p className="small muted">Dieses Gerät kann nicht vorlesen.</p>;
  const auto = voices[0];
  const natural = voices.some((v) => voiceScore(v) >= 9);
  const sample = () => speak("Hallo! Hast du heute Abend Zeit? Wir könnten zusammen kochen.", s.settings.speechRate, s.settings.voice);
  return (
    <div className="field">
      <label htmlFor="voice">Stimme</label>
      <div className="row">
        <select id="voice" className="input" style={{ flex: "1 1 200px" }} value={s.settings.voice} onChange={(e) => patchSettings({ voice: e.target.value })}>
          <option value="">Automatisch{auto ? ` (${auto.name})` : ""}</option>
          {voices.map((v) => (
            <option key={v.voiceURI} value={v.voiceURI}>
              {v.name}
              {voiceScore(v) >= 9 ? " · natürlich" : ""}
            </option>
          ))}
        </select>
        <button type="button" className="btn small" onClick={sample}>
          Probe hören
        </button>
      </div>
      {!natural ? (
        <details className="small muted">
          <summary>Klingt roboterhaft? Natürlichere Stimmen sind kostenlos</summary>
          <ul className="tips">
            <li>
              <b>iPhone/iPad:</b> Einstellungen → Bedienungshilfen → Gesprochene Inhalte → Stimmen → Deutsch → eine Stimme mit
              „Erweitert“ oder „Premium“ laden.
            </li>
            <li>
              <b>Android:</b> Einstellungen → Sprachausgabe (Text-in-Sprache) → Google-Sprachausgabe → Deutsch installieren und eine
              Stimme wählen.
            </li>
            <li>
              <b>Mac:</b> Systemeinstellungen → Bedienungshilfen → Gesprochene Inhalte → Systemstimme → Stimmen verwalten → Deutsch.
            </li>
            <li>
              <b>Windows:</b> im Edge-Browser sind die natürlichen Microsoft-Stimmen (z. B. „Katja Online (Natural)“) schon da.
            </li>
          </ul>
          Danach die App neu laden: Die App nimmt automatisch die natürlichste Stimme, die sie findet.
        </details>
      ) : null}
    </div>
  );
}

function LearnSection() {
  const s = useGame();
  return (
    <section className="card stack">
      <h3>Lernen</h3>
      <div className="row">
        <div className="field" style={{ flex: "1 1 140px" }}>
          <label htmlFor="goal">Tagesziel (Sätze)</label>
          <select id="goal" className="input" value={s.settings.dailyGoal} onChange={(e) => patchSettings({ dailyGoal: Number(e.target.value) })}>
            {[10, 15, 20, 30, 40, 60].map((n) => (
              <option key={n} value={n}>
                {n} Sätze
              </option>
            ))}
          </select>
        </div>
        <div className="field" style={{ flex: "1 1 140px" }}>
          <label htmlFor="newday">Neue Maschinen pro Tag</label>
          <select id="newday" className="input" value={s.settings.newPerDay} onChange={(e) => patchSettings({ newPerDay: Number(e.target.value) })}>
            {[5, 8, 10, 15, 20, 30].map((n) => (
              <option key={n} value={n}>
                {n}
              </option>
            ))}
          </select>
        </div>
        <div className="field" style={{ flex: "1 1 140px" }}>
          <label htmlFor="shift">Aufgaben pro Schicht</label>
          <select id="shift" className="input" value={s.settings.shiftSize} onChange={(e) => patchSettings({ shiftSize: Number(e.target.value) })}>
            {[6, 8, 10, 12, 15].map((n) => (
              <option key={n} value={n}>
                {n}
              </option>
            ))}
          </select>
        </div>
      </div>
      <label className="toggle" htmlFor="deliver">
        <span>Neue Baupläne automatisch liefern (jeden Tag passend zu deinem Niveau)</span>
        <input id="deliver" type="checkbox" checked={s.settings.autoDeliver} onChange={(e) => patchSettings({ autoDeliver: e.target.checked })} />
      </label>
      <label className="toggle" htmlFor="refresh">
        <span>A1-Grundlagen ab und zu auffrischen</span>
        <input id="refresh" type="checkbox" checked={s.settings.refresh} onChange={(e) => patchSettings({ refresh: e.target.checked })} />
      </label>
      <label className="toggle" htmlFor="english">
        <span>Englische Übersetzung immer zeigen (sonst: Situation antippen)</span>
        <input id="english" type="checkbox" checked={s.settings.alwaysEnglish} onChange={(e) => patchSettings({ alwaysEnglish: e.target.checked })} />
      </label>
      <label className="toggle" htmlFor="speak">
        <span>Korrigierte Sätze automatisch vorlesen</span>
        <input id="speak" type="checkbox" checked={s.settings.autoSpeak} onChange={(e) => patchSettings({ autoSpeak: e.target.checked })} />
      </label>
      <VoicePicker />
      <div className="field">
        <label htmlFor="rate">Vorlesetempo: {s.settings.speechRate.toFixed(2)}</label>
        <input id="rate" type="range" min={0.6} max={1.2} step={0.05} value={s.settings.speechRate} onChange={(e) => patchSettings({ speechRate: Number(e.target.value) })} />
      </div>
      <label className="toggle" htmlFor="sound">
        <span>Geräusche</span>
        <input id="sound" type="checkbox" checked={s.settings.sound} onChange={(e) => patchSettings({ sound: e.target.checked })} />
      </label>
    </section>
  );
}

function DataSection() {
  const s = useGame();
  const meta = useMeta();
  const catalog = useCatalog();
  const [importBox, setImportBox] = useState("");
  const [saveBox, setSaveBox] = useState("");
  const [confirmReset, setConfirmReset] = useState(false);
  const [note, setNote] = useState("");

  const runImport = (text: string) => {
    const res = importText(text, [...BUILTIN_ITEMS, ...s.custom]);
    if (!res.items.length) {
      setNote(`Nichts Neues gefunden (${res.duplicates} schon vorhanden, ${res.skipped} unlesbar).`);
      return;
    }
    const items = res.items.slice(0, Math.max(0, MAX_CUSTOM - s.custom.length));
    store.update((d) => {
      d.custom = [...d.custom, ...items];
    });
    const cut = res.items.length - items.length;
    setNote(
      `${items.length} Wörter importiert. Sie stehen jetzt im Lernplan unter „Importiert“ und kommen mit der Lieferung dran. ${res.duplicates} gab es schon.` +
        (cut ? ` ${cut} passten nicht mehr (maximal ${MAX_CUSTOM} importierte Wörter).` : ""),
    );
    setImportBox("");
  };

  const exportSave = async () => {
    const json = JSON.stringify({ ...store.get(), settings: { ...store.get().settings, ai: { ...store.get().settings.ai, anthropicKey: "", openaiKey: "" } } });
    setSaveBox(json);
    try {
      await navigator.clipboard.writeText(json);
      toast("Spielstand kopiert.");
    } catch {
      toast("Markiere den Text und kopiere ihn.");
    }
  };

  const restore = () => {
    try {
      const parsed = migrate(JSON.parse(saveBox), Date.now());
      parsed.settings.ai.anthropicKey = s.settings.ai.anthropicKey;
      parsed.settings.ai.openaiKey = s.settings.ai.openaiKey;
      parsed.updatedAt = Date.now();
      store.replace(parsed);
      toast("Spielstand geladen.");
    } catch {
      toast("Das ist kein gültiger Spielstand.");
    }
  };

  return (
    <section className="card stack">
      <h3>Daten</h3>
      <p className="small muted">
        Speicherort: {meta.cloud === "on" ? "claude.ai-Cloud (privat, auf allen Geräten) und dieser Browser" : "dieser Browser"}.{" "}
        {catalog.items.length} Bausteine im Katalog, davon {s.custom.length} importiert.
      </p>
      <div className="field">
        <label htmlFor="anki">Anki-Wörter importieren</label>
        <textarea
          id="anki"
          className="input"
          placeholder={"Anki: Exportieren → „Notizen als Text“, dann hier einfügen.\nder Termin, -e\tappointment\nanrufen, ruft an, rief an, hat angerufen\tto call"}
          value={importBox}
          onChange={(e) => setImportBox(e.target.value)}
        />
        <div className="row">
          <button type="button" className="btn small" disabled={!importBox.trim()} onClick={() => runImport(importBox)}>
            Importieren
          </button>
          <label className="btn small ghost" htmlFor="anki-file">
            Datei wählen
          </label>
          <input
            id="anki-file"
            type="file"
            accept=".txt,.csv,.tsv"
            hidden
            onChange={async (e) => {
              const f = e.target.files?.[0];
              if (f) runImport(await f.text());
              e.target.value = "";
            }}
          />
        </div>
        {note ? <p className="small">{note}</p> : null}
      </div>
      <hr className="divider" />
      <div className="field">
        <label htmlFor="save">Spielstand sichern oder übertragen</label>
        <textarea id="save" className="input" value={saveBox} onChange={(e) => setSaveBox(e.target.value)} placeholder="Hier erscheint dein Spielstand als Text. Zum Laden einen gesicherten Text einfügen." />
        <div className="row">
          <button type="button" className="btn small" onClick={exportSave}>
            Spielstand kopieren
          </button>
          <button type="button" className="btn small ghost" disabled={!saveBox.trim()} onClick={restore}>
            Text als Spielstand laden
          </button>
        </div>
      </div>
      <hr className="divider" />
      {confirmReset ? (
        <div className="row">
          <span className="small" style={{ color: "var(--brick)" }}>
            Alles löschen: Maschinen, Taler, Statistik?
          </span>
          <button
            type="button"
            className="btn small"
            style={{ borderColor: "var(--brick)", color: "var(--brick)" }}
            onClick={() => {
              const keep = s.settings;
              clearLocal();
              const fresh = newGame(Date.now());
              fresh.settings = keep;
              fresh.updatedAt = Date.now();
              store.replace(fresh);
              setConfirmReset(false);
              toast("Neue Fabrik eröffnet.");
            }}
          >
            Ja, alles löschen
          </button>
          <button type="button" className="btn small ghost" onClick={() => setConfirmReset(false)}>
            Abbrechen
          </button>
        </div>
      ) : (
        <button type="button" className="btn small ghost" style={{ alignSelf: "flex-start" }} onClick={() => setConfirmReset(true)}>
          Fabrik zurücksetzen
        </button>
      )}
    </section>
  );
}

export function SettingsView({ onClose }: { onClose: () => void }) {
  return (
    <>
      <div className="spread">
        <h1>Einstellungen</h1>
        <button type="button" className="btn ghost small" onClick={onClose}>
          Fertig
        </button>
      </div>
      <AISection />
      <LearnSection />
      <DataSection />
    </>
  );
}
