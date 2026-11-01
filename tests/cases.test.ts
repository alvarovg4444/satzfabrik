import { describe, expect, it } from "vitest";
import { BUILTIN_ITEMS } from "../src/content/catalog";
import { buildDrillRound, CASE_KINDS } from "../src/engine/drills";

const CONTRACT: Record<string, string> = { zum: "dem", zur: "der", beim: "dem", vom: "dem", im: "dem", ins: "das", am: "dem", ans: "das" };

describe("Akkord case help", () => {
  it("every case question explains its case and marks the right form in the table", () => {
    let n = 0;
    for (let seed = 1; seed <= 40; seed++) {
      for (const q of buildDrillRound(BUILTIN_ITEMS, BUILTIN_ITEMS, seed, 20, CASE_KINDS)) {
        n++;
        const h = q.caseHelp!;
        expect(h, q.id).toBeDefined();
        expect(h.why.length).toBeGreaterThan(10);
        expect(h.whyNot.length).toBeGreaterThan(10);
        const cell = h.table.rows[h.table.hl[0]].cells[h.table.hl[1]];
        expect(cell, q.id).toBeDefined();
        if (q.kind === "prep_case" || q.kind === "wechsel") {
          const art = q.answer.split(" ").pop()!;
          expect(cell, q.id).toBe(CONTRACT[q.answer] ?? art);
        } else if (q.kind === "adj_ending") {
          expect(cell.endsWith(` ${q.answer}`), `${q.id}: ${cell}`).toBe(true);
        } else {
          expect(cell, q.id).toBe(q.answer);
        }
      }
    }
    expect(n).toBeGreaterThan(300);
  });

  it("a cases-only round asks only case questions", () => {
    const qs = buildDrillRound(BUILTIN_ITEMS, BUILTIN_ITEMS, 7, 30, CASE_KINDS);
    expect(qs.every((q) => CASE_KINDS.includes(q.kind))).toBe(true);
  });
});
