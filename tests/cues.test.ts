import { describe, expect, it } from "vitest";
import { makeCatalog } from "../src/content/catalog";
import { cueFor } from "../src/engine/tasks";

const catalog = makeCatalog([]);

describe("cues", () => {
  it("show the full help the first time and only the meaning or name on reviews", () => {
    const termin = catalog.get("n.termin")!;
    expect(cueFor(termin, 0).label).toBe(termin.de);
    for (const stage of [1, 2, 3, 5]) {
      const c = cueFor(termin, stage);
      expect(c.label).toBe(termin.en);
      expect(`${c.label} ${c.sub ?? ""}`).not.toContain("Termin");
      expect(c.reveal).toContain("Termin");
    }
    const obwohl = catalog.get("g.obwohl")!;
    expect(cueFor(obwohl, 0).sub).toBeTruthy();
    const review = cueFor(obwohl, 1);
    expect(review.label).toBe("obwohl");
    expect(review.sub).toBeUndefined();
    expect(review.reveal).toContain("Verb ans Ende");
  });
});
