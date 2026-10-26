import { describe, expect, it } from "vitest";
import { deleteBack, insertText, sentenceStart, upper } from "../src/ui/keys";

describe("in-app keyboard editing", () => {
  it("types at the caret and moves it along", () => {
    expect(insertText("Ich habe Hunger", 4, 4, "nicht ")).toEqual({ value: "Ich nicht habe Hunger", caret: 10 });
    expect(insertText("", 0, 0, "W")).toEqual({ value: "W", caret: 1 });
  });

  it("replaces a selection, whichever way it was dragged", () => {
    expect(insertText("mit den Kollege", 4, 7, "dem")).toEqual({ value: "mit dem Kollege", caret: 7 });
    expect(insertText("mit den Kollege", 7, 4, "dem")).toEqual({ value: "mit dem Kollege", caret: 7 });
  });

  it("deletes one character, a selection, or a whole emoji", () => {
    expect(deleteBack("Hallo", 5, 5)).toEqual({ value: "Hall", caret: 4 });
    expect(deleteBack("Hallo", 0, 0)).toEqual({ value: "Hallo", caret: 0 });
    expect(deleteBack("mit den Kollege", 4, 8)).toEqual({ value: "mit Kollege", caret: 4 });
    expect(deleteBack("gut 👍", 6, 6)).toEqual({ value: "gut ", caret: 4 });
  });

  it("knows where a sentence starts, for the automatic capital", () => {
    expect(sentenceStart("", 0)).toBe(true);
    expect(sentenceStart("Ich komme. ", 11)).toBe(true);
    expect(sentenceStart("Wirklich? ", 10)).toBe(true);
    expect(sentenceStart("Er sagt: „Ja.“ ", 15)).toBe(true);
    expect(sentenceStart("Ich komme", 9)).toBe(false);
    expect(sentenceStart("Ich komme, ", 11)).toBe(false);
    expect(sentenceStart("Ich komme.", 10)).toBe(false);
  });

  it("shifts umlauts but keeps ß", () => {
    expect(["ä", "ö", "ü", "ß", "a"].map(upper)).toEqual(["Ä", "Ö", "Ü", "ß", "A"]);
  });
});
