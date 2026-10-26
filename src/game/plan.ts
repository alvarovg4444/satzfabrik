import type { Catalog } from "../content/catalog";
import { refreshCount, refreshers } from "../engine/level";
import { isDue } from "../engine/srs";
import { buildShift, type Task } from "../engine/tasks";
import { dayKey } from "../engine/text";
import { hallUnlocked, newLeftToday, weakRules } from "./actions";
import { focusForShift } from "./coach";
import type { GameState } from "./state";

/**
 * The shift the learner would get now: new blueprints, due machines, weak spots, the
 * coach's focus and A1 refreshers. Used to start a shift, and to ask the AI for the
 * next shift's situations ahead of time.
 */
export function planShift(st: GameState, catalog: Catalog, now: number, extra: boolean): Task[] {
  const dueCount = Object.values(st.cards).filter((c) => isDue(c, now)).length;
  const size = st.settings.shiftSize;
  const newLeft = newLeftToday(st, now);
  return buildShift({
    cards: st.cards,
    catalog,
    now,
    weakRules: weakRules(st),
    focus: focusForShift(st),
    size,
    extra,
    maxNew: Math.min(newLeft, Math.max(3, Math.min(6, size - dueCount))),
    refresh: st.settings.refresh
      ? refreshers(
          { catalog, cards: st.cards, level: st.level, hallOpen: (h) => hallUnlocked(st, h), seed: `${dayKey(now)}|${st.stats.shifts}` },
          refreshCount(st.level, size),
        )
      : [],
    // a new game, or the next shift, picks other built-in situations
    salt: `${st.createdAt}|${st.stats.shifts}`,
  });
}
