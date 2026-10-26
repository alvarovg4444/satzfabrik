import { useEffect, useMemo, useRef, useState, type RefObject } from "react";
import { checkRework, diagnoseShift, freshenTasks, gradeAnswer, selfGrade, type SelfRating } from "../ai/corrector";
import { AIError } from "../ai/providers";
import type { GradeResult, TargetStatus } from "../ai/schema";
import { ERROR_TYPES, type Item } from "../content/types";
import { isDue, stageOf } from "../engine/srs";
import { buildShift, introTask, shortName, taskForItem, taskTitle, type Task } from "../engine/tasks";
import { dayKey, diffWords, mentions, wordCount } from "../engine/text";
import { refreshCount, refreshers, levelLabel, overall } from "../engine/level";
import { applyGrade, applyRework, deliver, finishShift, hallUnlocked, newLeftToday, weakRules, type TaskEvents } from "../game/actions";
import { afterShift, applyDiagnosis, cleanShift, coachInput, emptyLog, FOCUS_DONE, focusForShift, localDiagnosis, type ShiftLog } from "../game/coach";
import { fmt } from "../game/economy";
import { orderText } from "../game/orders";
import type { GameState } from "../game/state";
import { store, useCatalog, useGame, useMeta } from "../store/store";
import { floatCoins, Icon, SpeakButton, toast } from "./common";
import { canDictate, confetti, dictate, DICTATION_ERRORS, hasKeyboardDictation, sfx, speak } from "./fx";
import { ItemDetails } from "./ItemSheet";
import { Keyboard, useInAppKeyboard, type KeyboardProps } from "./Keyboard";

interface Summary {
  done: number;
  good: number;
  perfect: number;
  taler: number;
  built: string[];
  confirmed: string[];
  repaired: string[];
  stageUps: number;
  errors: Record<string, number>;
  /** Mistakes and target results, for the coach. */
  log: ShiftLog;
}

const emptySummary = (): Summary => ({
  done: 0,
  good: 0,
  perfect: 0,
  taler: 0,
  built: [],
  confirmed: [],
  repaired: [],
  stageUps: 0,
  errors: {},
  log: emptyLog(),
});

/** The learner's current level for the AI prompts, e.g. "A2+". */
function levelCode(s: GameState): string {
  return levelLabel(overall(s.level).theta).code;
}

/** Game state and shift summary from before a grade was applied, so "Einspruch" can undo it. */
interface Snapshot {
  state: GameState;
  summary: Summary;
}

/** Answer text recorded when the learner taps "Weiß ich nicht". */
const GAVE_UP = "—";

type Phase =
  | { k: "idle" }
  | { k: "task" }
  | { k: "grading" }
  | { k: "error"; message: string; answer: string }
  | { k: "selfcheck"; answer: string }
  | { k: "feedback"; grade: GradeResult; events: TaskEvents; answer: string; before: Snapshot }
  | { k: "done"; bonus: number };

const STATUS_LABEL: Record<TargetStatus, string> = {
  correct: "richtig",
  flawed: "fast richtig",
  synonym: "Synonym benutzt",
  wrong: "falsch benutzt",
  missing: "fehlt",
};

function celebrate(events: TaskEvents, grade: GradeResult, anchor: HTMLElement | null) {
  const perfect = grade.quality === "perfect" && events.success;
  if (perfect) sfx.perfect();
  else if (events.success) sfx.good();
  else sfx.bad();
  floatCoins(events.taler, anchor);
  const catalog = store.catalog();
  for (const id of events.built) {
    const it = catalog.get(id);
    if (it) toast(<span>Neue Maschine läuft: <b>{shortName(it)}</b></span>);
  }
  for (const id of events.confirmed) {
    const it = catalog.get(id);
    if (it) toast(<span>Grundlage sitzt: <b>{shortName(it)}</b> läuft sofort</span>);
  }
  for (const up of events.stageUps) {
    const it = catalog.get(up.id);
    if (it) toast(<span><b>{shortName(it)}</b> steigt auf Stufe {up.to}</span>);
  }
  for (const o of events.orders) toast(<span>Auftrag erledigt: <b>+{fmt(o.reward)}</b> · {orderText(o).de}</span>, 4500);
  for (const a of events.achievements) toast(<span>Erfolg: <b>{a.de}</b> +{fmt(a.reward)}</span>, 5000);
  if (events.streakUp) toast(<span>Tagesziel erreicht! Streak: <b>{store.get().streak.current}</b></span>, 5000);
  if (events.levelUp) {
    sfx.levelUp();
    confetti(["#f2b705", "#2c6a78", "#b0432b", "#2f8a52"]);
    toast(<span>Level <b>{events.levelUp}</b>! Ein neuer Arbeiter fängt in deiner Fabrik an.</span>, 6000);
  } else if (perfect) {
    confetti(["#f2b705", "#2c6a78"]);
  }
}

function Cues({ task, items, grade }: { task: Task; items: Map<string, Item>; grade?: GradeResult }) {
  const [shown, setShown] = useState<Record<string, boolean>>({});
  return (
    <div className="cues">
      {task.cues.map((c) => {
        const st = grade?.targets.find((t) => t.id === c.itemId)?.status;
        const cls = st ? (st === "correct" || st === "flawed" ? "ok" : "bad") : "";
        return (
          <button
            key={c.itemId}
            type="button"
            className={`cue ${cls}`}
            onClick={() => setShown((s) => ({ ...s, [c.itemId]: !s[c.itemId] }))}
            aria-expanded={!!shown[c.itemId]}
            title="Antippen für Details"
          >
            <span className="l">{c.label}</span>
            {c.sub ? <span className="s">{c.sub}</span> : null}
            {shown[c.itemId] || grade ? <span className="r">{c.reveal}</span> : null}
            {st ? (
              <span className="s" style={{ fontWeight: 700 }}>
                {STATUS_LABEL[st]}
              </span>
            ) : null}
            {!items.get(c.itemId) ? null : null}
          </button>
        );
      })}
    </div>
  );
}

function TaskHeader({ task, index, total, onEnd }: { task: Task; index: number; total: number; onEnd: () => void }) {
  const s = useGame();
  const title = taskTitle(task);
  return (
    <div className="stack" style={{ gap: 8 }}>
      <div className="progress-steps" aria-label={`Aufgabe ${index + 1} von ${total}`}>
        {Array.from({ length: total }, (_, i) => (
          <i key={i} className={i < index ? "done" : i === index ? "now" : ""} />
        ))}
      </div>
      <div className="spread">
        <span className="task-type">
          {title.de}
          {task.reason === "due" ? <span className="tag due">Wartung</span> : null}
          {task.reason === "new" ? <span className="tag new">Neu</span> : null}
          {task.reason === "weak" ? <span className="tag due">Schwachstelle</span> : null}
          {task.reason === "practice" ? <span className="tag">Extra</span> : null}
          {task.reason === "refresh" ? <span className="tag new">Grundlagen</span> : null}
          {task.reason === "focus" ? <span className="tag coach">Coach</span> : null}
        </span>
        <span className="row" style={{ gap: 8 }}>
          {s.combo > 1 ? <span className="combo">×{s.combo.toFixed(1)}</span> : null}
          <button type="button" className="btn ghost small" onClick={onEnd}>
            Schicht beenden
          </button>
        </span>
      </div>
    </div>
  );
}

/**
 * The task in German. The English translation stays hidden until the learner taps the
 * situation (or the EN button), so they read German and can borrow its words.
 */
function Prompt({ task, alwaysEnglish }: { task: Task; alwaysEnglish: boolean }) {
  const [english, setEnglish] = useState(alwaysEnglish);
  useEffect(() => setEnglish(alwaysEnglish), [task.key, alwaysEnglish]);
  const hasEnglish = !!(task.instructionEn || task.scenario?.en);
  return (
    <div className="stack prompt-top" style={{ gap: 10 }}>
      <p style={{ fontWeight: 700 }}>
        {task.instruction}
        {english && task.instructionEn ? <span className="en"> · {task.instructionEn}</span> : null}
        {hasEnglish && !task.scenario ? (
          <button type="button" className="en-toggle" aria-pressed={english} onClick={() => setEnglish(!english)}>
            EN
          </button>
        ) : null}
      </p>
      {task.scenario ? (
        <button
          type="button"
          className="scenario"
          aria-expanded={english}
          onClick={() => setEnglish(!english)}
          title={english ? "Antippen: Englisch ausblenden" : "Antippen: auf Englisch zeigen"}
        >
          <span className="de" lang="de">
            {task.scenario.de}
          </span>
          {english && task.scenario.en ? (
            <span className="en" lang="en">
              {task.scenario.en}
            </span>
          ) : task.scenario.en ? (
            <span className="hint">Nicht verstanden? Antippen für Englisch</span>
          ) : null}
        </button>
      ) : null}
      {task.source ? <div className="source">{task.source}</div> : null}
    </div>
  );
}

/**
 * Scrolls so the situation sits at the top of what is visible, unless that would push the
 * answer box under the keyboard (the phone's, or the in-app one: its height is --kb-h).
 */
function keepInView(box: HTMLElement) {
  const prompt = box.closest(".task-card")?.querySelector<HTMLElement>(".prompt-top");
  const vv = window.visualViewport;
  const top = vv?.offsetTop ?? 0;
  const kb = parseFloat(getComputedStyle(document.documentElement).getPropertyValue("--kb-h")) || 0;
  const height = (vv?.height ?? window.innerHeight) - kb;
  const b = box.getBoundingClientRect();
  let delta = prompt ? prompt.getBoundingClientRect().top - top - 8 : 0;
  const overflow = b.bottom - delta - (top + height - 8);
  if (overflow > 0) delta += overflow;
  if (Math.abs(delta) > 4) window.scrollBy({ top: delta });
}

/** While the learner types with the phone's keyboard: the page makes room, and the situation stays in view. */
function useWritingMode(box: RefObject<HTMLTextAreaElement | null>, enabled: boolean) {
  useEffect(() => {
    const el = box.current;
    if (!el || !enabled) return;
    let timer = 0;
    const onFocus = () => {
      // Only phones and tablets: there the keyboard takes half the screen.
      if (!hasKeyboardDictation()) return;
      window.clearTimeout(timer);
      document.documentElement.classList.add("writing");
      timer = window.setTimeout(() => keepInView(el), 350);
    };
    // Late, so a tap on "Prüfen" lands before the layout changes back.
    const onBlur = () => {
      window.clearTimeout(timer);
      timer = window.setTimeout(() => document.documentElement.classList.remove("writing"), 300);
    };
    const onResize = () => {
      if (document.activeElement === el) keepInView(el);
    };
    el.addEventListener("focus", onFocus);
    el.addEventListener("blur", onBlur);
    window.visualViewport?.addEventListener("resize", onResize);
    if (document.activeElement === el) onFocus();
    return () => {
      window.clearTimeout(timer);
      el.removeEventListener("focus", onFocus);
      el.removeEventListener("blur", onBlur);
      window.visualViewport?.removeEventListener("resize", onResize);
      document.documentElement.classList.remove("writing");
    };
  }, [box, enabled]);
}

function Answer({
  value,
  onChange,
  minWords,
  onSubmit,
  autoFocus,
  active = true,
  notice,
}: {
  value: string;
  onChange: (v: string) => void;
  minWords?: number;
  onSubmit: () => void;
  autoFocus?: boolean;
  /** Typing is possible now (not while the corrector checks). */
  active?: boolean;
  /** A message for the learner while typing, e.g. that a target word is missing. */
  notice?: KeyboardProps["notice"];
}) {
  const [listening, setListening] = useState(false);
  const [micOk, setMicOk] = useState(canDictate);
  const stopRef = useRef<(() => void) | null>(null);
  const baseRef = useRef("");
  const boxRef = useRef<HTMLTextAreaElement>(null);
  const inApp = useInAppKeyboard();
  // the in-app keyboard stays open until hidden; a tap on the box brings it back
  const [open, setOpen] = useState(!!autoFocus);
  // the phone's own keyboard, for its microphone, until the box loses focus
  const [system, setSystem] = useState(false);
  const ownKeys = inApp && !system;
  useWritingMode(boxRef, !ownKeys);
  useEffect(() => () => stopRef.current?.(), []);
  // after a check, read the result first: the keyboard waits for a tap
  useEffect(() => {
    if (!active) setOpen(false);
  }, [active]);
  const words = wordCount(value);
  const mic = () => {
    if (listening) {
      stopRef.current?.();
      return;
    }
    baseRef.current = value ? `${value.trim()} ` : "";
    setListening(true);
    stopRef.current = dictate(
      (text) => onChange(baseRef.current + text),
      (err) => {
        setListening(false);
        if (!err || err === "no-speech" || err === "aborted") return;
        const keyboard = ownKeys
          ? " Tippe noch einmal auf „Diktieren“: Dann öffnet sich die Handy-Tastatur mit ihrem Mikrofon."
          : hasKeyboardDictation()
            ? " Tipp: Tippe auf das Mikrofon deiner Tastatur und sprich Deutsch."
            : "";
        toast(`${DICTATION_ERRORS[err] ?? "Diktieren hat nicht geklappt."}${keyboard}`, 6000);
        if (err === "not-allowed" || err === "service-not-allowed" || err === "language-not-supported") setMicOk(false);
      },
    );
  };
  // Dictation where the page may not listen: hand over to the phone's keyboard and its microphone.
  const phoneKeyboard = () => {
    const el = boxRef.current;
    if (!el) return;
    setSystem(true);
    el.inputMode = "text";
    el.blur();
    el.focus();
    toast("Tippe auf das Mikrofon der Tastatur und sprich Deutsch. Danach geht es mit der Satzfabrik-Tastatur weiter.", 6000);
  };
  return (
    <div className="stack" style={{ gap: 6 }}>
      <textarea
        ref={boxRef}
        id="answer"
        className="input"
        lang="de"
        spellCheck={false}
        autoCapitalize={ownKeys ? "off" : "sentences"}
        autoCorrect={ownKeys ? "off" : undefined}
        autoComplete="off"
        inputMode={ownKeys ? "none" : undefined}
        placeholder="Schreib hier auf Deutsch …"
        value={value}
        autoFocus={autoFocus}
        onChange={(e) => onChange(e.target.value)}
        // after the tap, not during it: the layout moves when the keyboard opens, and a tap
        // still in progress would land on whatever moved under the finger
        onClick={() => ownKeys && active && setOpen(true)}
        onBlur={() => {
          if (!system) return;
          setSystem(false);
          setOpen(false);
        }}
        onKeyDown={(e) => {
          if (e.key === "Enter" && (e.metaKey || e.ctrlKey)) {
            e.preventDefault();
            onSubmit();
          }
        }}
      />
      <div className="spread">
        <span className="wordcount">
          {words} Wörter{minWords ? ` · Ziel ${minWords}+` : ""}
        </span>
        {ownKeys ? (
          !open && active ? (
            <button type="button" className="btn small ghost" onClick={() => setOpen(true)}>
              <Icon name="keyboard" size={16} /> Tastatur
            </button>
          ) : null
        ) : micOk ? (
          <button type="button" className={`btn small ${listening ? "primary" : "ghost"}`} onClick={mic} aria-pressed={listening}>
            <Icon name="mic" size={16} /> {listening ? "Fertig" : "Sprechen"}
          </button>
        ) : hasKeyboardDictation() ? (
          <span className="small muted mic-hint">
            <Icon name="mic" size={14} /> Diktieren: Mikrofon auf der Tastatur
          </span>
        ) : null}
      </div>
      {ownKeys && open && active ? (
        <Keyboard
          field={boxRef}
          value={value}
          onChange={(v) => {
            if (listening) stopRef.current?.();
            onChange(v);
          }}
          action={{ label: "Prüfen", onPress: onSubmit, disabled: !value.trim() }}
          mic={{ label: micOk ? "Sprechen" : "Diktieren", on: listening, onPress: micOk ? mic : phoneKeyboard }}
          notice={notice}
          onHide={() => {
            setOpen(false);
            boxRef.current?.blur();
          }}
          writing
          onShown={() => boxRef.current && keepInView(boxRef.current)}
        />
      ) : null}
    </div>
  );
}

function Diff({ from, to }: { from: string; to: string }) {
  const tokens = diffWords(from, to);
  return (
    <p className="diff">
      {tokens.map((t, i) =>
        t.op === "same" ? (
          <span key={i}>{t.t} </span>
        ) : t.op === "del" ? (
          <del key={i}>{t.t}</del>
        ) : (
          <ins key={i}>{t.t}</ins>
        ),
      ).flatMap((n, i, arr) => (i < arr.length - 1 && (tokens[i].op !== "same") ? [n, " "] : [n]))}
    </p>
  );
}

/** How each target was used, in Claude's words. */
function TargetNotes({ grade, items }: { grade: GradeResult; items: Map<string, Item> }) {
  const notes = grade.targets.filter((t) => t.comment);
  if (!notes.length) return null;
  return (
    <ul className="errs">
      {notes.map((t) => (
        <li key={t.id}>
          <span className="errtype">{items.get(t.id) ? shortName(items.get(t.id)!) : t.id}</span>
          <span>{t.comment}</span>
        </li>
      ))}
    </ul>
  );
}

/** Each mistake: what was written, the fix, and why. */
function ErrorList({ errors }: { errors: GradeResult["errors"] }) {
  if (!errors.length) return null;
  return (
    <ul className="errs" aria-label="Fehler">
      {errors.map((e, i) => (
        <li key={i}>
          <span className="errtype">{ERROR_TYPES[e.type]?.de ?? e.type}</span>
          <span className="fix">
            <s>{e.wrong || "—"}</s> → <b>{e.right || "—"}</b>
          </span>
          {e.explain ? <span className="small muted">{e.explain}</span> : null}
        </li>
      ))}
    </ul>
  );
}

/** Claude's second check of a repaired sentence: the same explanations as the first time. */
function ReworkCheck({ check, items, ok }: { check: { grade: GradeResult; attempt: string }; items: Map<string, Item>; ok: boolean }) {
  const { grade, attempt } = check;
  const changed = grade.corrected && grade.corrected.trim() !== attempt;
  return (
    <div className="stack" style={{ gap: 8 }}>
      {grade.praise && ok ? <p className="small">{grade.praise}</p> : null}
      {changed ? (
        <div className="card plain stack" style={{ gap: 6 }}>
          <span className="eyebrow">Deine Reparatur, korrigiert</span>
          <Diff from={attempt} to={grade.corrected} />
          <div className="sentence">
            <p style={{ fontWeight: 700 }}>{grade.corrected}</p>
            <SpeakButton text={grade.corrected} />
          </div>
        </div>
      ) : null}
      <TargetNotes grade={grade} items={items} />
      <ErrorList errors={grade.errors} />
      {grade.tip ? <p className="small muted">Tipp: {grade.tip}</p> : null}
      {grade.better && ok ? (
        <p className="small muted">
          Noch natürlicher: <b>{grade.better}</b>
        </p>
      ) : null}
    </div>
  );
}

function Feedback({
  phase,
  task,
  items,
  onNext,
  onRegrade,
  canRegrade,
}: {
  phase: Extract<Phase, { k: "feedback" }>;
  task: Task;
  items: Map<string, Item>;
  onNext: () => void;
  onRegrade: () => void;
  canRegrade: boolean;
}) {
  const s = useGame();
  const catalog = useCatalog();
  const meta = useMeta();
  const { grade, events, answer } = phase;
  const perfect = grade.quality === "perfect" && events.success;
  const gaveUp = answer === GAVE_UP;
  const changed = !gaveUp && grade.corrected && grade.corrected.trim() !== answer.trim();
  const [rework, setRework] = useState<string | null>(null);
  const [reworkState, setReworkState] = useState<"idle" | "checking" | "ok" | "nope">("idle");
  const [reworkNote, setReworkNote] = useState("");
  /** Claude's second check of the repaired sentence, with explanations. */
  const [reworkGrade, setReworkGrade] = useState<{ grade: GradeResult; attempt: string } | null>(null);
  const verdictRef = useRef<HTMLDivElement>(null);
  const ctlRef = useRef<AbortController | null>(null);

  useEffect(() => {
    if (s.settings.autoSpeak) speak(grade.corrected || answer, s.settings.speechRate, s.settings.voice);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const tryRework = async () => {
    const attempt = rework?.trim();
    if (!attempt) return;
    setReworkState("checking");
    setReworkNote("");
    ctlRef.current = new AbortController();
    try {
      // Same check as the first time: Claude reads the whole sentence again and explains.
      const res = await checkRework(meta.provider, task, grade, attempt, catalog, { lang: s.settings.explainLang, signal: ctlRef.current.signal, level: levelCode(s) });
      const ok = res === "match" || (res.targets.every((t) => t.status === "correct" || t.status === "flawed") && res.quality !== "major" && res.errors.length === 0);
      setReworkGrade(res === "match" ? null : { grade: res, attempt });
      if (ok) {
        const bonus = store.update((d) => applyRework(d, Date.now(), events.taler, attempt));
        floatCoins(bonus, verdictRef.current);
        sfx.good();
        setReworkState("ok");
        setReworkNote(
          res === "match" ? `Genau wie die Korrektur: repariert! +${bonus} Taler Nacharbeitsbonus.` : `Repariert! +${bonus} Taler Nacharbeitsbonus.`,
        );
      } else {
        sfx.bad();
        setReworkState("nope");
        setReworkNote("Noch nicht ganz. Das hat die zweite Prüfung gefunden:");
      }
    } catch (e) {
      if (e instanceof AIError && e.code === "cancelled") {
        setReworkState("idle");
        return;
      }
      setReworkState("nope");
      setReworkNote(e instanceof AIError ? e.message : "Prüfen fehlgeschlagen.");
    }
  };

  return (
    <div className="stack">
      <div ref={verdictRef} className={`verdict ${perfect ? "perfect" : events.success ? "good" : "fix"}`}>
        <Icon name={events.success ? "check" : "x"} />
        <div>
          <div className="title">{perfect ? "Perfekt!" : events.success ? "Gut gebaut" : "Nacharbeit"}</div>
          {grade.praise ? <div className="small" style={{ color: "var(--ink-2)", fontWeight: 400 }}>{grade.praise}</div> : null}
        </div>
        <span className="reward">+{fmt(events.taler)}</span>
      </div>

      {gaveUp ? (
        <div className="card plain stack" style={{ gap: 8 }}>
          <span className="eyebrow">So könnte es gehen</span>
          <div className="sentence">
            <p style={{ fontWeight: 700 }}>{grade.corrected}</p>
            <SpeakButton text={grade.corrected} />
          </div>
          <p className="small muted">Lies den Satz einmal laut. Die Maschine kommt morgen wieder dran.</p>
        </div>
      ) : changed ? (
        <div className="card plain stack" style={{ gap: 8 }}>
          <span className="eyebrow">Deine Version, korrigiert</span>
          <Diff from={answer} to={grade.corrected} />
          <div className="sentence">
            <p style={{ fontWeight: 700 }}>{grade.corrected}</p>
            <SpeakButton text={grade.corrected} />
          </div>
        </div>
      ) : (
        <div className="sentence card plain">
          <p style={{ fontWeight: 700 }}>{grade.corrected || answer}</p>
          <SpeakButton text={grade.corrected || answer} />
        </div>
      )}

      {grade.better ? (
        <div className="card plain stack" style={{ gap: 6 }}>
          <span className="eyebrow">So klingt es natürlicher</span>
          <div className="sentence">
            <p>{grade.better}</p>
            <SpeakButton text={grade.better} />
          </div>
        </div>
      ) : null}

      <Cues task={task} items={items} grade={grade} />
      <TargetNotes grade={grade} items={items} />
      <ErrorList errors={grade.errors} />
      {grade.tip ? <p className="small muted">Tipp: {grade.tip}</p> : null}
      {task.reference && grade.source !== "exact" && !events.success && !gaveUp ? (
        <p className="small muted">Musterlösung: {task.reference}</p>
      ) : null}

      {rework !== null ? (
        <div className="card stack">
          <span className="eyebrow">Nacharbeit: repariere deinen Satz selbst</span>
          {reworkState !== "ok" ? (
            <Answer value={rework} onChange={setRework} onSubmit={tryRework} autoFocus active={reworkState !== "checking"} />
          ) : null}
          {reworkState === "checking" ? (
            <div className="qc" role="status">
              <Icon name="spark" />
              <span>Zweite Prüfung …</span>
              <span className="conveyor" />
            </div>
          ) : null}
          {reworkNote ? (
            <p className="small" style={{ color: reworkState === "ok" ? "var(--ok)" : "var(--brick)", fontWeight: 700 }}>
              {reworkNote}
            </p>
          ) : null}
          {reworkGrade && reworkState !== "checking" ? <ReworkCheck check={reworkGrade} items={items} ok={reworkState === "ok"} /> : null}
          {reworkState !== "ok" && reworkState !== "checking" ? (
            <div className="row">
              <button type="button" className="btn steel" onClick={tryRework}>
                {reworkGrade ? "Nochmal prüfen" : "Reparatur prüfen"}
              </button>
              <button type="button" className="btn ghost" onClick={() => setRework(reworkGrade?.grade.corrected || grade.corrected)}>
                Korrektur einsetzen
              </button>
            </div>
          ) : null}
        </div>
      ) : null}

      <div className="row">
        {changed && rework === null ? (
          <button type="button" className="btn steel" onClick={() => setRework(answer)}>
            Selbst reparieren (+Bonus)
          </button>
        ) : null}
        <button type="button" className="btn primary" onClick={onNext} autoFocus={!changed}>
          Weiter <Icon name="arrow" size={18} />
        </button>
        {canRegrade && grade.source === "ai" ? (
          <button type="button" className="btn ghost small" onClick={onRegrade} title="Gründlicher nachprüfen lassen">
            Einspruch
          </button>
        ) : null}
      </div>
      <p className="small muted">{grade.source === "self" ? "Selbst bewertet (ohne KI)" : `Korrigiert von ${grade.by}`}</p>
    </div>
  );
}

function SelfCheck({ task, answer, onRate }: { task: Task; answer: string; onRate: (r: SelfRating) => void }) {
  const catalog = useCatalog();
  const examples = task.targets
    .map((id) => catalog.get(id))
    .filter((x): x is Item => !!x)
    .map((it) => (it.kind === "gram" ? it.examples[0] : it.example));
  return (
    <div className="stack">
      <div className="card plain stack" style={{ gap: 6 }}>
        <span className="eyebrow">Dein Satz</span>
        <p style={{ fontWeight: 700 }}>{answer}</p>
      </div>
      <div className="card plain stack" style={{ gap: 6 }}>
        <span className="eyebrow">{task.reference ? "Musterlösung" : "Beispiel"}</span>
        {task.reference ? <p>{task.reference}</p> : examples.map((ex) => <p key={ex.de}>{ex.de}</p>)}
      </div>
      <p className="small muted">
        Kein KI-Korrektor verbunden. Vergleiche selbst und sei ehrlich: davon hängt ab, wann die Maschine wiederkommt.
      </p>
      <div className="row">
        <button type="button" className="btn" onClick={() => onRate("right")}>
          Richtig
        </button>
        <button type="button" className="btn" onClick={() => onRate("almost")}>
          Fast
        </button>
        <button type="button" className="btn" onClick={() => onRate("wrong")}>
          Falsch
        </button>
      </div>
    </div>
  );
}

/** The coach's reading of the shift that just ended. */
export function CoachNote({ thinking = false, compact = false, onPractice }: { thinking?: boolean; compact?: boolean; onPractice?: (id: string) => void }) {
  const s = useGame();
  const catalog = useCatalog();
  if (thinking) {
    return (
      <div className="coach-box">
        <span className="eyebrow">Dein Coach</span>
        <p className="muted">Der Coach liest deine Schicht …</p>
      </div>
    );
  }
  const c = s.coach;
  if (!c || (compact && !c.focus.length)) return null;
  return (
    <div className="coach-box">
      <span className="eyebrow">Dein Coach{c.by === "local" ? " (ohne KI)" : ""}</span>
      <p>{c.note}</p>
      {c.focus.length ? (
        <ul className="coach-focus">
          {c.focus.map((f) => {
            const it = catalog.get(f.id);
            const name = it?.kind === "gram" ? it.name : f.id;
            return (
              <li key={f.id}>
                <div className="coach-topic">
                  <b>{name}</b>
                  {f.why ? <span className="small muted">{f.why}</span> : null}
                </div>
                <div className="coach-actions">
                  <span className="tag coach">{f.left === 1 ? "noch 1 Schicht" : `noch ${f.left} Schichten`}</span>
                  {onPractice ? (
                    <button type="button" className="btn small" onClick={() => onPractice(f.id)}>
                      Üben
                    </button>
                  ) : null}
                </div>
              </li>
            );
          })}
        </ul>
      ) : null}
    </div>
  );
}

function StartScreen({ onStart }: { onStart: (extra: boolean) => void }) {
  const s = useGame();
  const now = Date.now();
  const cards = Object.values(s.cards);
  const due = cards.filter((c) => isDue(c, now)).length;
  const fresh = cards.filter((c) => stageOf(c) === 0).length;
  const newLeft = newLeftToday(s, now);
  const weak = weakRules(s).filter((id) => s.cards[id]).length;
  const built = cards.length - fresh;
  const meta = useMeta();
  return (
    <section className="card stack">
      <span className="eyebrow">Schicht</span>
      <h1>Ab an die Werkbank</h1>
      <p className="muted">
        Eine Schicht sind etwa {s.settings.shiftSize} Aufgaben, 8–12 Minuten. Du schreibst echte Sätze, die KI kontrolliert die Qualität,
        und jede richtige Antwort bringt Taler und hält deine Maschinen in Schuss.
      </p>
      <div className="stat-grid">
        <div className="stat">
          <span className="v" style={due ? { color: "var(--rust)" } : undefined}>
            {due}
          </span>
          <span className="l">rostige Maschinen</span>
        </div>
        <div className="stat">
          <span className="v">{fresh}</span>
          <span className="l">Baupläne (heute noch {Math.min(fresh, newLeft)})</span>
        </div>
        <div className="stat">
          <span className="v">{weak}</span>
          <span className="l">Schwachstellen</span>
        </div>
      </div>
      {due + fresh > 0 ? (
        <button type="button" className="btn primary block" onClick={() => onStart(false)}>
          <Icon name="play" size={18} /> Schicht starten
        </button>
      ) : built > 0 ? (
        <>
          <p className="small muted">Alles gewartet, nichts rostet. Hol dir neue Baupläne oder übe freiwillig.</p>
          <button type="button" className="btn primary block" onClick={() => onStart(true)}>
            <Icon name="play" size={18} /> Extra-Schicht (üben)
          </button>
        </>
      ) : (
        <p className="small muted">Du hast noch keine Maschinen. Die nächste Lieferung bringt neue Baupläne, oder such dir im Lernplan welche aus.</p>
      )}
      <p className="small muted">
        Korrektor: <b>{meta.providerReady ? meta.provider.label : "wird verbunden …"}</b>
        {meta.provider.id === "offline" && meta.providerReady ? " — in den Einstellungen kannst du einen verbinden." : ""}
      </p>
    </section>
  );
}

export interface StartRequest {
  n: number;
  /** Practise exactly these items instead of the scheduled mix. */
  focus?: string[];
}

export function ShiftView({ startReq, goFactory, goDrill }: { startReq: StartRequest; goFactory: () => void; goDrill: () => void }) {
  const s = useGame();
  const catalog = useCatalog();
  const meta = useMeta();
  const [tasks, setTasks] = useState<Task[]>([]);
  const [index, setIndex] = useState(0);
  const [phase, setPhase] = useState<Phase>({ k: "idle" });
  const [answer, setAnswer] = useState("");
  const [warn, setWarn] = useState<string | null>(null);
  const [summary, setSummary] = useState<Summary>(emptySummary);
  const [coaching, setCoaching] = useState(false);
  const ctlRef = useRef<AbortController | null>(null);
  const coachRef = useRef<AbortController | null>(null);
  const genRef = useRef<AbortController | null>(null);

  const task = tasks[index];
  const indexRef = useRef(index);
  indexRef.current = index;
  const items = useMemo(() => {
    const m = new Map<string, Item>();
    for (const t of tasks) for (const id of t.targets) {
      const it = catalog.get(id);
      if (it) m.set(id, it);
    }
    return m;
  }, [tasks, catalog]);

  useEffect(() => () => {
    ctlRef.current?.abort();
    genRef.current?.abort();
    coachRef.current?.abort();
  }, []);

  // "Start shift" pressed elsewhere (factory floor, onboarding): start right away unless one is running.
  const lastReq = useRef(0);
  useEffect(() => {
    if (startReq.n === lastReq.current) return;
    lastReq.current = startReq.n;
    if (phase.k === "idle" || phase.k === "done" || startReq.focus) {
      const now = Date.now();
      const cards = Object.values(store.get().cards);
      const work = cards.some((c) => isDue(c, now) || stageOf(c) === 0);
      start(!work, startReq.focus);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [startReq.n]);

  /** Three varied tasks for each focused item (types rotate with the review count). */
  const focusTasks = (ids: string[], now: number): Task[] => {
    const st = store.get();
    const out: Task[] = [];
    for (const id of ids) {
      const it = catalog.get(id);
      const card = st.cards[id];
      if (!it || !card) continue;
      if (stageOf(card) === 0) out.push(introTask(it));
      for (let k = 0; k < 3; k++) {
        out.push(taskForItem(it, { ...card, reps: card.reps + k }, catalog, now + k * 86_400_000, "practice"));
      }
    }
    return out;
  };

  const start = (extra: boolean, focus?: string[]) => {
    ctlRef.current?.abort();
    const now = Date.now();
    // Top up today's delivery of blueprints before building the shift.
    const delivered = store.update((d, c) => deliver(d, c, now));
    if (delivered.length) toast(`Lieferung: ${delivered.length} neue Baupläne, passend zu deinem Niveau.`, 4000);
    const st = store.get();
    const dueCount = Object.values(st.cards).filter((c) => isDue(c, now)).length;
    const size = st.settings.shiftSize;
    const newLeft = newLeftToday(st, now);
    const build = (asExtra: boolean) =>
      buildShift({
        cards: st.cards,
        catalog,
        now,
        weakRules: weakRules(st),
        focus: focusForShift(st),
        size,
        extra: asExtra,
        maxNew: Math.min(newLeft, Math.max(3, Math.min(6, size - dueCount))),
        refresh: st.settings.refresh
          ? refreshers(
              { catalog, cards: st.cards, level: st.level, hallOpen: (h) => hallUnlocked(st, h), seed: `${dayKey(now)}|${st.stats.shifts}` },
              refreshCount(st.level, size),
            )
          : [],
      });
    let list = focus?.length ? focusTasks(focus, now) : build(extra);
    if (!list.length && !focus?.length && !extra) {
      // Nothing due and today's new machines are built: offer free practice instead.
      list = build(true);
      if (list.length) toast(`Heute schon ${st.settings.newPerDay} neue Maschinen gebaut. Jetzt gibt es eine Übungsschicht.`, 4500);
    }
    if (!list.length) {
      toast("Nichts zu tun. Such dir im Lernplan neue Baupläne aus.");
      return;
    }
    setTasks(list);
    setIndex(0);
    setAnswer("");
    setWarn(null);
    setSummary(emptySummary());
    setPhase({ k: "task" });
    if (st.settings.freshTasks && meta.provider.id !== "offline") {
      genRef.current?.abort();
      const ctl = new AbortController();
      genRef.current = ctl;
      freshenTasks(meta.provider, list, catalog, ctl.signal, levelCode(store.get()))
        .then((updates) => {
          if (ctl.signal.aborted || !updates.size) return;
          // Only swap situations the learner has not reached yet, never the one on screen.
          setTasks((cur) => cur.map((t, i) => (i > indexRef.current && updates.has(t.key) ? { ...t, ...updates.get(t.key) } : t)));
        })
        .catch(() => undefined);
    }
  };

  const end = () => {
    ctlRef.current?.abort();
    genRef.current?.abort();
    const graded = summary.done;
    if (graded >= 3) {
      const r = store.update((d, c) => finishShift(d, c, Date.now()));
      sfx.coin();
      setPhase({ k: "done", bonus: r.bonus });
      for (const o of r.orders) toast(<span>Auftrag erledigt: <b>+{fmt(o.reward)}</b></span>);
      for (const a of r.achievements) toast(<span>Erfolg: <b>{a.de}</b> +{fmt(a.reward)}</span>);
      const practised = new Set(tasks.slice(0, index + 1).flatMap((t) => t.targets));
      const learned = store.update((d) => afterShift(d, practised));
      for (const f of learned) {
        const it = catalog.get(f.id);
        if (it?.kind === "gram" && f.streak >= FOCUS_DONE) toast(<span>Coach: <b>{it.name}</b> sitzt jetzt. Fokus erledigt!</span>, 4000);
      }
      runCoach(summary.log, graded);
    } else {
      setPhase(graded > 0 ? { k: "done", bonus: 0 } : { k: "idle" });
    }
  };

  /** The coach reads the shift: with the AI when there is one, else from the corrector's grammar ids. */
  const runCoach = (log: ShiftLog, sentences: number) => {
    const st = store.get();
    const local = () => store.update((d, c) => applyDiagnosis(d, c, localDiagnosis(d, c, log), "local", Date.now()));
    if (cleanShift(log) || meta.provider.id === "offline") {
      local();
      return;
    }
    coachRef.current?.abort();
    const ctl = new AbortController();
    coachRef.current = ctl;
    setCoaching(true);
    diagnoseShift(meta.provider, coachInput(st, catalog, log, sentences), catalog, {
      lang: st.settings.explainLang,
      level: levelCode(st),
      signal: ctl.signal,
    })
      .then((d) => {
        if (!ctl.signal.aborted) store.update((x, c) => applyDiagnosis(x, c, d, "ai", Date.now()));
      })
      .catch(() => {
        if (!ctl.signal.aborted) local();
      })
      .finally(() => {
        if (coachRef.current === ctl) setCoaching(false);
      });
  };

  const next = () => {
    setWarn(null);
    setAnswer("");
    if (index + 1 >= tasks.length) {
      end();
      return;
    }
    setIndex(index + 1);
    setPhase({ k: "task" });
  };

  const record = (grade: GradeResult, text: string, before?: Snapshot) => {
    const snapshot: Snapshot = before ?? { state: store.get(), summary };
    const events = store.update((d, c) => applyGrade(d, c, task, grade, text, Date.now(), { gaveUp: text === GAVE_UP }));
    setSummary((sm) => {
      const errors = { ...sm.errors };
      for (const e of grade.errors) errors[e.type] = (errors[e.type] ?? 0) + 1;
      return {
        done: sm.done + 1,
        good: sm.good + (events.success ? 1 : 0),
        perfect: sm.perfect + (events.success && grade.quality === "perfect" ? 1 : 0),
        taler: sm.taler + events.taler,
        built: [...sm.built, ...events.built],
        confirmed: [...sm.confirmed, ...events.confirmed],
        repaired: [...sm.repaired, ...events.repaired],
        stageUps: sm.stageUps + events.stageUps.length,
        errors,
        log: {
          mistakes: [...sm.log.mistakes, ...grade.errors.map((e) => ({ wrong: e.wrong, right: e.right, type: e.type, rule: e.rule, explain: e.explain }))],
          results: [...sm.log.results, ...grade.targets.map((t) => ({ id: t.id, status: t.status }))],
        },
      };
    });
    setPhase({ k: "feedback", grade, events, answer: text, before: snapshot });
    requestAnimationFrame(() => celebrate(events, grade, document.querySelector(".verdict")));
  };

  const submit = async (force = false, careful?: boolean, regradeOf?: Snapshot) => {
    const text = answer.trim();
    if (!text || !task) return;
    if (!force) {
      const missing = task.targets.map((id) => catalog.get(id)).filter((it): it is Item => !!it && !mentions(text, it));
      if (missing.length) {
        // When the cue only shows the meaning, naming the German word would give the answer away.
        const hidden = missing.some((m) => task.cues.find((c) => c.itemId === m.id)?.label === m.en);
        setWarn(
          hidden
            ? "Ich finde das gesuchte Wort nicht in deinem Satz."
            : `Ich finde ${missing.map((m) => `„${shortName(m)}“`).join(", ")} nicht in deinem Satz.`,
        );
        return;
      }
    }
    setWarn(null);
    setPhase({ k: "grading" });
    ctlRef.current?.abort();
    const ctl = new AbortController();
    ctlRef.current = ctl;
    try {
      const grade = await gradeAnswer(meta.provider, task, text, catalog, {
        lang: store.get().settings.explainLang,
        careful: careful ?? store.get().settings.careful,
        signal: ctl.signal,
        level: levelCode(store.get()),
      });
      if (regradeOf) {
        // Undo the first verdict completely, then apply the careful one.
        store.replace(regradeOf.state);
        setSummary(regradeOf.summary);
      }
      record(grade, text, regradeOf);
    } catch (e) {
      if (e instanceof AIError && e.code === "cancelled") {
        setPhase({ k: "task" });
        return;
      }
      if (e instanceof AIError && e.code === "no_access" && meta.provider.id === "offline") {
        setPhase({ k: "selfcheck", answer: text });
        return;
      }
      setPhase({ k: "error", message: e instanceof AIError ? e.message : "Die Korrektur hat nicht geklappt.", answer: text });
    }
  };

  const giveUp = () => {
    if (!task) return;
    const first = catalog.get(task.targets[0]);
    const example = first ? (first.kind === "gram" ? first.examples[0].de : first.example.de) : "";
    const grade: GradeResult = {
      targets: task.targets.map((id) => ({ id, status: "missing", comment: "" })),
      quality: "major",
      corrected: task.reference ?? example,
      better: "",
      errors: [],
      praise: "",
      tip: "",
      source: "self",
      by: "Selbstkontrolle",
    };
    record(grade, GAVE_UP);
  };

  if (phase.k === "idle" || !task) {
    return <StartScreen onStart={start} />;
  }

  if (phase.k === "done") {
    return (
      <section className="card stack">
        <span className="eyebrow">Schichtende</span>
        <h1>Feierabend!</h1>
        <div className="stat-grid">
          <div className="stat">
            <span className="v">
              {summary.good}/{summary.done}
            </span>
            <span className="l">alle Bausteine richtig</span>
          </div>
          <div className="stat">
            <span className="v">{summary.perfect}</span>
            <span className="l">fehlerfrei</span>
          </div>
          <div className="stat">
            <span className="v">+{fmt(summary.taler + phase.bonus)}</span>
            <span className="l">Taler{phase.bonus ? ` (inkl. ${fmt(phase.bonus)} Bonus)` : ""}</span>
          </div>
        </div>
        {summary.built.length ? (
          <p>
            Neu gebaut:{" "}
            <b>
              {summary.built
                .map((id) => catalog.get(id))
                .filter((x): x is Item => !!x)
                .map(shortName)
                .join(", ")}
            </b>
          </p>
        ) : null}
        {summary.confirmed.length ? (
          <p>
            Grundlagen sitzen:{" "}
            <b>
              {summary.confirmed
                .map((id) => catalog.get(id))
                .filter((x): x is Item => !!x)
                .map(shortName)
                .join(", ")}
            </b>
          </p>
        ) : null}
        {summary.repaired.length ? <p>Repariert: {summary.repaired.length} Maschinen</p> : null}
        {summary.stageUps ? <p>Aufgestiegen: {summary.stageUps} Maschinen</p> : null}
        {Object.keys(summary.errors).length ? (
          <p className="small muted">
            Häufigste Fehler:{" "}
            {Object.entries(summary.errors)
              .sort((a, b) => b[1] - a[1])
              .slice(0, 3)
              .map(([k, n]) => `${ERROR_TYPES[k as keyof typeof ERROR_TYPES]?.de ?? k} (${n})`)
              .join(", ")}
          </p>
        ) : null}
        <CoachNote thinking={coaching} />
        <div className="row">
          <button type="button" className="btn primary" onClick={() => start(false)}>
            Noch eine Schicht
          </button>
          <button type="button" className="btn" onClick={goDrill}>
            <Icon name="bolt" size={18} /> Akkord-Runde
          </button>
          <button type="button" className="btn ghost" onClick={goFactory}>
            Zur Fabrik
          </button>
        </div>
      </section>
    );
  }

  if (task.type === "intro") {
    const it = catalog.get(task.targets[0]);
    return (
      <section className="stack">
        <TaskHeader task={task} index={index} total={tasks.length} onEnd={end} />
        {it ? (
          <div className="blueprint-card">
            <span className="eyebrow" style={{ color: "rgba(255,255,255,0.75)" }}>
              Neuer Bauplan · {it.level}
            </span>
            <div className="row" style={{ alignItems: "flex-start" }}>
              <div style={{ flex: 1, minWidth: 0 }}>
                <h2>{it.kind === "gram" ? it.name : it.de}</h2>
                <p className="muted">{it.en}</p>
              </div>
              {it.kind !== "gram" ? <SpeakButton text={it.de} /> : null}
            </div>
            <div className="ex" style={{ color: "#fff" }}>
              <ItemDetails it={it} />
            </div>
          </div>
        ) : null}
        <p className="small muted">{task.instruction}</p>
        <button type="button" className="btn primary block" onClick={next}>
          Verstanden, jetzt bauen <Icon name="arrow" size={18} />
        </button>
      </section>
    );
  }

  return (
    <section className="stack">
      <TaskHeader task={task} index={index} total={tasks.length} onEnd={end} />
      <div className="card stack task-card">
        <Prompt task={task} alwaysEnglish={s.settings.alwaysEnglish} />
        {phase.k !== "feedback" ? <Cues task={task} items={items} /> : null}

        {phase.k === "task" || phase.k === "grading" ? (
          <>
            <Answer
              value={answer}
              onChange={setAnswer}
              minWords={task.minWords}
              onSubmit={() => void submit()}
              autoFocus
              active={phase.k === "task"}
              notice={warn ? { text: warn, button: { label: "Trotzdem prüfen", onPress: () => void submit(true) } } : null}
            />
            {warn ? (
              <div className="row" role="alert">
                <span className="small" style={{ color: "var(--brick)" }}>
                  {warn}
                </span>
                <button type="button" className="btn small" onClick={() => void submit(true)}>
                  Trotzdem prüfen
                </button>
              </div>
            ) : null}
            {phase.k === "grading" ? (
              <div className="qc" role="status">
                <Icon name="spark" />
                <span>Qualitätskontrolle …</span>
                <span className="conveyor" />
                <button type="button" className="btn ghost small" onClick={() => ctlRef.current?.abort()}>
                  Abbrechen
                </button>
              </div>
            ) : (
              <div className="row">
                <button type="button" className="btn primary" disabled={!answer.trim()} onClick={() => void submit()}>
                  Prüfen
                </button>
                <button type="button" className="btn ghost" onClick={giveUp}>
                  Weiß ich nicht
                </button>
              </div>
            )}
          </>
        ) : null}

        {phase.k === "error" ? (
          <div className="stack">
            <p style={{ color: "var(--brick)" }}>{phase.message}</p>
            <div className="row">
              <button type="button" className="btn primary" onClick={() => void submit(true)}>
                Nochmal versuchen
              </button>
              <button type="button" className="btn" onClick={() => setPhase({ k: "selfcheck", answer: phase.answer })}>
                Selbst bewerten
              </button>
              <button type="button" className="btn ghost" onClick={() => setPhase({ k: "task" })}>
                Zurück
              </button>
            </div>
          </div>
        ) : null}

        {phase.k === "selfcheck" ? (
          <SelfCheck task={task} answer={phase.answer} onRate={(r) => record(selfGrade(task, phase.answer, r, catalog), phase.answer)} />
        ) : null}

        {phase.k === "feedback" ? (
          <Feedback
            key={task.key}
            phase={phase}
            task={task}
            items={items}
            onNext={next}
            canRegrade={meta.provider.id === "claude-app" && !s.settings.careful}
            onRegrade={() => void submit(true, true, phase.before)}
          />
        ) : null}
      </div>
    </section>
  );
}
