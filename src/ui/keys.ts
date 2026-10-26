/*
 * Text editing for the in-app keyboard. Pure functions, so typing can be tested without
 * a browser: each takes the text and the selection and returns the new text and caret.
 */

export interface Edit {
  value: string;
  caret: number;
}

const clamp = (n: number, max: number) => Math.max(0, Math.min(max, n));

/** Replaces the selection (or inserts at the caret). */
export function insertText(value: string, start: number, end: number, text: string): Edit {
  const a = clamp(Math.min(start, end), value.length);
  const b = clamp(Math.max(start, end), value.length);
  return { value: value.slice(0, a) + text + value.slice(b), caret: a + text.length };
}

/** Deletes the selection, or the character before the caret (a whole emoji, not half of one). */
export function deleteBack(value: string, start: number, end: number): Edit {
  const a = clamp(Math.min(start, end), value.length);
  const b = clamp(Math.max(start, end), value.length);
  if (b > a) return { value: value.slice(0, a) + value.slice(b), caret: a };
  if (a === 0) return { value, caret: 0 };
  const pair = a >= 2 && /[\uDC00-\uDFFF]/.test(value[a - 1]) && /[\uD800-\uDBFF]/.test(value[a - 2]);
  const n = pair ? 2 : 1;
  return { value: value.slice(0, a - n) + value.slice(a), caret: a - n };
}

/** The caret is where a sentence begins: nothing typed yet, or a full stop, ? or ! and a space before it. */
export function sentenceStart(value: string, caret: number): boolean {
  const before = value.slice(0, clamp(caret, value.length));
  return /^\s*$/.test(before) || /[.!?…]["“”»«')]*\s+$/.test(before) || /\n\s*$/.test(before);
}

/** Upper case for the shift key; ß stays ß, as on German keyboards. */
export const upper = (ch: string) => (ch === "ß" ? ch : ch.toUpperCase());
