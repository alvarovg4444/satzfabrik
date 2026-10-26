import { useEffect, useLayoutEffect, useRef, useState, type RefObject } from "react";
import { createPortal } from "react-dom";
import { useGame } from "../store/store";
import { Icon } from "./common";
import { hasKeyboardDictation } from "./fx";
import { deleteBack, insertText, sentenceStart, upper, type Edit } from "./keys";

/*
 * The in-app keyboard: German QWERTZ with ä, ö, ü and ß on their own keys and no
 * autocorrect "fixing" mistakes the learner should see. It replaces the phone's keyboard
 * while writing, so the page keeps its size and the situation stays in view.
 */

const LETTERS = ["qwertzuiopü", "asdfghjklöä", "yxcvbnmß"];
const SYMBOLS = ["1234567890", "-/:;()€&@%", "?!'\"„“+="];

type Shift = "off" | "once" | "lock";

/** Touch device with the in-app keyboard switched on in the settings. */
export function useInAppKeyboard(): boolean {
  const s = useGame();
  return s.settings.keyboard && hasKeyboardDictation();
}

export interface KeyboardProps {
  /** The field the keys type into (at its caret when it has focus, else at the end). */
  field: RefObject<HTMLTextAreaElement | HTMLInputElement | null>;
  value: string;
  onChange: (v: string) => void;
  /** The big key at the bottom right. */
  action: { label: string; onPress: () => void; disabled?: boolean };
  /** A button above the keys for dictation. */
  mic?: { label: string; on: boolean; onPress: () => void } | null;
  /** A message above the keys (e.g. a target word is missing), with an optional button. */
  notice?: { text: string; button?: { label: string; onPress: () => void } } | null;
  onHide: () => void;
  /** Capital letter at the start of each sentence (answers yes, drill forms no). */
  sentences?: boolean;
  /** Also hide the top bar (more room for the task). */
  writing?: boolean;
  /** Called once the keyboard is on screen and its height is known. */
  onShown?: () => void;
}

export function Keyboard({ field, value, onChange, action, mic, notice, onHide, sentences = true, writing = false, onShown }: KeyboardProps) {
  const [layer, setLayer] = useState<"abc" | "123">("abc");
  const [shift, setShift] = useState<Shift>(() => (sentences && sentenceStart(value, value.length) ? "once" : "off"));
  const root = useRef<HTMLDivElement>(null);
  const keys = useRef<HTMLDivElement>(null);
  // the latest text, also between a key press and the parent's re-render (key repeat)
  const latest = useRef(value);
  const caret = useRef<number | null>(null);
  const live = useRef({ layer, shift, onChange, action, sentences });
  live.current = { layer, shift, onChange, action, sentences };
  useEffect(() => {
    latest.current = value;
  }, [value]);

  // put the caret after what was typed, once the field shows the new text
  useLayoutEffect(() => {
    const el = field.current;
    const c = caret.current;
    caret.current = null;
    if (el && c !== null && document.activeElement === el) el.setSelectionRange(c, c);
  }, [value, field]);

  // room for the keyboard: the page gets its height as bottom padding
  useLayoutEffect(() => {
    const el = root.current;
    if (!el) return;
    const doc = document.documentElement;
    const measure = () => doc.style.setProperty("--kb-h", `${el.offsetHeight}px`);
    measure();
    const ro = typeof ResizeObserver !== "undefined" ? new ResizeObserver(measure) : null;
    ro?.observe(el);
    doc.classList.add("kb-open");
    if (writing) doc.classList.add("writing");
    const shown = window.setTimeout(() => onShown?.(), 30);
    return () => {
      window.clearTimeout(shown);
      ro?.disconnect();
      doc.classList.remove("kb-open");
      if (writing) doc.classList.remove("writing");
      doc.style.removeProperty("--kb-h");
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [writing]);

  useEffect(() => {
    const el = keys.current;
    if (!el) return;
    let delay = 0;
    let repeat = 0;
    let lastShift = 0;

    const type = (key: string) => {
      const f = field.current;
      const v = latest.current;
      const focused = !!f && document.activeElement === f;
      const start = focused ? (f.selectionStart ?? v.length) : v.length;
      const end = focused ? (f.selectionEnd ?? v.length) : v.length;
      // typing again after a tap elsewhere: back into the field, at the end
      if (f && !focused && !f.disabled) f.focus({ preventScroll: true });
      const { layer, shift, sentences } = live.current;
      let edit: Edit;
      if (key === "back") edit = deleteBack(v, start, end);
      else if (key === "space") edit = insertText(v, start, end, " ");
      else edit = insertText(v, start, end, layer === "abc" && shift !== "off" ? upper(key) : key);
      if (edit.value === v && edit.caret === start) return;
      latest.current = edit.value;
      caret.current = edit.caret;
      live.current.onChange(edit.value);
      if (shift !== "lock") setShift(sentences && sentenceStart(edit.value, edit.caret) ? "once" : "off");
    };

    const press = (key: string) => {
      if (key === "shift") {
        const now = Date.now();
        const { shift } = live.current;
        setShift(shift === "lock" ? "off" : now - lastShift < 350 ? "lock" : shift === "once" ? "off" : "once");
        lastShift = now;
        return;
      }
      if (key === "layer") {
        setLayer((l) => (l === "abc" ? "123" : "abc"));
        return;
      }
      type(key);
    };

    const keyOf = (t: EventTarget | null) => (t instanceof Element ? t.closest<HTMLElement>("[data-k]") : null);
    const clear = () => {
      window.clearTimeout(delay);
      window.clearInterval(repeat);
      el.querySelectorAll(".down").forEach((n) => n.classList.remove("down"));
    };
    const down = (e: PointerEvent) => {
      // keep the focus (and the caret) in the text field
      e.preventDefault();
      const k = keyOf(e.target);
      if (!k || k.hasAttribute("disabled")) return;
      clear();
      k.classList.add("down");
      const key = k.dataset.k!;
      // the big key acts when the finger lifts, like a button
      if (key === "action") return;
      press(key);
      if (key === "back") {
        delay = window.setTimeout(() => {
          repeat = window.setInterval(() => type("back"), 70);
        }, 450);
      }
    };
    const up = (e: PointerEvent) => {
      const k = keyOf(e.target);
      clear();
      if (!k || k.hasAttribute("disabled")) return;
      if (k.dataset.k === "action") live.current.action.onPress();
    };
    const stopTouch = (e: TouchEvent) => e.preventDefault();
    const stopMouse = (e: MouseEvent) => e.preventDefault();
    el.addEventListener("pointerdown", down);
    el.addEventListener("pointerup", up);
    el.addEventListener("pointercancel", clear);
    el.addEventListener("touchstart", stopTouch, { passive: false });
    el.addEventListener("mousedown", stopMouse);
    return () => {
      clear();
      el.removeEventListener("pointerdown", down);
      el.removeEventListener("pointerup", up);
      el.removeEventListener("pointercancel", clear);
      el.removeEventListener("touchstart", stopTouch);
      el.removeEventListener("mousedown", stopMouse);
    };
  }, [field]);

  const rows = layer === "abc" ? LETTERS : SYMBOLS;
  const label = (ch: string) => (layer === "abc" && shift !== "off" ? upper(ch) : ch);
  const charKey = (ch: string) => (
    <button key={ch} type="button" tabIndex={-1} className="kb-key" data-k={ch} data-show={label(ch)}>
      {label(ch)}
    </button>
  );

  return createPortal(
    <div ref={root} className="kb" role="group" aria-label="Tastatur">
      {notice ? (
        <div className="kb-notice" role="alert">
          <span>{notice.text}</span>
          {notice.button ? (
            <button type="button" className="kb-chip" onClick={notice.button.onPress}>
              {notice.button.label}
            </button>
          ) : null}
        </div>
      ) : null}
      {/* ordinary buttons: a full tap, which iPhones need before they open their own keyboard */}
      <div className="kb-strip">
        {mic ? (
          <button type="button" className={`kb-chip${mic.on ? " on" : ""}`} aria-pressed={mic.on} onClick={mic.onPress}>
            <Icon name="mic" size={16} /> {mic.on ? "Fertig" : mic.label}
          </button>
        ) : (
          <span />
        )}
        <button type="button" className="kb-chip" aria-label="Tastatur ausblenden" title="Tastatur ausblenden" onClick={onHide}>
          <Icon name="down" size={18} />
        </button>
      </div>
      <div ref={keys} className="kb-keys">
        <div className="kb-row">{[...rows[0]].map(charKey)}</div>
        <div className="kb-row">{[...rows[1]].map(charKey)}</div>
        <div className="kb-row">
          {layer === "abc" ? (
            <button
              type="button"
              tabIndex={-1}
              className={`kb-key fn wide${shift !== "off" ? " active" : ""}${shift === "lock" ? " lock" : ""}`}
              data-k="shift"
              aria-label={shift === "lock" ? "Feststelltaste an" : "Großbuchstabe"}
              aria-pressed={shift !== "off"}
            >
              ⇧
            </button>
          ) : null}
          {[...rows[2]].map(charKey)}
          <button type="button" tabIndex={-1} className="kb-key fn wide" data-k="back" aria-label="Löschen">
            ⌫
          </button>
        </div>
        <div className="kb-row">
          <button type="button" tabIndex={-1} className="kb-key fn wide" data-k="layer" aria-label={layer === "abc" ? "Zahlen und Zeichen" : "Buchstaben"}>
            {layer === "abc" ? "123" : "ABC"}
          </button>
          {charKey(",")}
          <button type="button" tabIndex={-1} className="kb-key space" data-k="space" aria-label="Leerzeichen">
            Leerzeichen
          </button>
          {charKey(".")}
          <button type="button" tabIndex={-1} className="kb-key action" data-k="action" disabled={action.disabled}>
            {action.label}
          </button>
        </div>
      </div>
    </div>,
    document.body,
  );
}
