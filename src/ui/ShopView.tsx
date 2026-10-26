import { useMemo, useState } from "react";
import { GRAMMAR } from "../content/catalog";
import { HALLS, TOPICS, type ErrorType, type HallId, type Item, type Level, type TopicId } from "../content/types";
import { shortName } from "../engine/tasks";
import { fold } from "../engine/text";
import { buyUpgrade, canUnlock, hallUnlocked, unlock } from "../game/actions";
import { fmt, unlockCost } from "../game/economy";
import { UPGRADES, upgradeCost } from "../game/upgrades";
import { store, useCatalog, useGame } from "../store/store";
import { Icon, toast } from "./common";
import { sfx } from "./fx";
import { ItemSheet } from "./ItemSheet";

const KIND_DE: Record<Item["kind"], string> = {
  noun: "Nomen",
  verb: "Verb",
  adj: "Adjektiv",
  adv: "Adverb",
  word: "Wort",
  expr: "Ausdruck",
  gram: "Grammatik",
};

const LEVEL_ORDER: Record<Level, number> = { A1: 0, A2: 1, B1: 2, B2: 3 };

function BlueprintRow({ it, onInfo }: { it: Item; onInfo: () => void }) {
  const s = useGame();
  const err = canUnlock(s, it);
  const free = s.freeBlueprints > 0;
  const cost = unlockCost(s, it);
  const buy = () => {
    const res = store.update((d) => unlock(d, it, Date.now()));
    if (res) {
      toast(res === "too_expensive" ? "Nicht genug Taler. Schreib ein paar Sätze!" : res === "locked_hall" ? "Diese Halle ist noch gesperrt." : "Schon gekauft.");
      return;
    }
    sfx.coin();
    toast(
      <span>
        Bauplan <b>{shortName(it)}</b> gekauft. Er kommt in deiner nächsten Schicht dran.
      </span>,
    );
  };
  return (
    <div className="list-item">
      <button type="button" onClick={onInfo} style={{ all: "unset", cursor: "pointer", minWidth: 0 }}>
        <div className="t">{it.kind === "gram" ? it.name : it.de}</div>
        <div className="small muted">
          {it.en} · <span className="level-tag">{it.level}</span> {KIND_DE[it.kind]}
        </div>
      </button>
      <button type="button" className={`btn small ${err ? "" : "primary"}`} disabled={!!err && err !== "too_expensive"} onClick={buy}>
        {free ? "Gratis" : <span className="price">{fmt(cost)}</span>}
      </button>
    </div>
  );
}

function recommendations(s: ReturnType<typeof store.get>, items: Item[]): Item[] {
  const errs = Object.entries(s.stats.errors).sort((a, b) => (b[1] ?? 0) - (a[1] ?? 0)) as [ErrorType, number][];
  const out: Item[] = [];
  const seen = new Set<string>();
  const add = (it: Item | undefined) => {
    if (it && !s.cards[it.id] && hallUnlocked(s, it.hall) && !seen.has(it.id)) {
      seen.add(it.id);
      out.push(it);
    }
  };
  // Structures that explain your most frequent mistakes come first.
  for (const [type] of errs.slice(0, 3)) {
    for (const g of GRAMMAR.filter((g) => g.errors.includes(type)).sort((a, b) => LEVEL_ORDER[a.level] - LEVEL_ORDER[b.level]).slice(0, 2)) add(g);
  }
  for (const id of Object.keys(s.stats.ruleHeat)) add(items.find((i) => i.id === id));
  // Then the next easiest pieces from the topics you already work with.
  const topics = new Set(Object.keys(s.cards).map((id) => items.find((i) => i.id === id)?.topic).filter(Boolean));
  const rest = items
    .filter((i) => !s.cards[i.id] && hallUnlocked(s, i.hall))
    .sort((a, b) => LEVEL_ORDER[a.level] - LEVEL_ORDER[b.level] || Number(!topics.has(a.topic)) - Number(!topics.has(b.topic)));
  for (const it of rest) {
    if (out.length >= 6) break;
    add(it);
  }
  return out.slice(0, 6);
}

export function ShopView() {
  const s = useGame();
  const catalog = useCatalog();
  const [tab, setTab] = useState<"plans" | "upgrades">("plans");
  const [hall, setHall] = useState<HallId | "all" | "custom">("all");
  const [topic, setTopic] = useState<TopicId | "all">("all");
  const [level, setLevel] = useState<Level | "all">("all");
  const [q, setQ] = useState("");
  const [limit, setLimit] = useState(40);
  const [info, setInfo] = useState<Item | null>(null);

  const recs = useMemo(() => recommendations(s, catalog.items), [s, catalog]);
  const list = useMemo(() => {
    const needle = fold(q);
    return catalog.items
      .filter((it) => !s.cards[it.id])
      .filter((it) => hall === "all" || (hall === "custom" ? it.id.startsWith("c.") : it.hall === hall))
      .filter((it) => topic === "all" || it.topic === topic)
      .filter((it) => level === "all" || it.level === level)
      .filter((it) => !needle || fold(`${it.de} ${it.en} ${it.kind === "gram" ? it.name : ""}`).includes(needle))
      .sort((a, b) => Number(!hallUnlocked(s, a.hall)) - Number(!hallUnlocked(s, b.hall)) || LEVEL_ORDER[a.level] - LEVEL_ORDER[b.level] || a.de.localeCompare(b.de, "de"));
  }, [catalog, s, hall, topic, level, q]);

  return (
    <>
      <div className="spread">
        <h1>Laden</h1>
        <div className="seg" role="group" aria-label="Bereich">
          <button type="button" aria-pressed={tab === "plans"} onClick={() => setTab("plans")}>
            Baupläne
          </button>
          <button type="button" aria-pressed={tab === "upgrades"} onClick={() => setTab("upgrades")}>
            Ausbau
          </button>
        </div>
      </div>
      {s.freeBlueprints > 0 ? (
        <p className="pill" style={{ alignSelf: "flex-start", borderColor: "var(--signal)" }}>
          {s.freeBlueprints} Gratis-Bauplan{s.freeBlueprints > 1 ? "e" : ""} verfügbar
        </p>
      ) : null}

      {tab === "plans" ? (
        <>
          {recs.length ? (
            <section className="card stack">
              <h3>Empfohlen für dich</h3>
              <p className="small muted">Passend zu deinen häufigsten Fehlern und deinem Niveau.</p>
              <div className="list">
                {recs.map((it) => (
                  <BlueprintRow key={it.id} it={it} onInfo={() => setInfo(it)} />
                ))}
              </div>
            </section>
          ) : null}
          <section className="card stack">
            <div className="row">
              <button type="button" className={`chip ${hall === "all" ? "on" : ""}`} onClick={() => setHall("all")}>
                Alle
              </button>
              {(Object.keys(HALLS) as HallId[]).map((h) => (
                <button key={h} type="button" className={`chip ${hall === h ? "on" : ""}`} onClick={() => setHall(h)}>
                  {HALLS[h].de}
                  {!hallUnlocked(s, h) ? ` (ab Lvl ${HALLS[h].unlockLevel})` : ""}
                </button>
              ))}
              {s.custom.length ? (
                <button type="button" className={`chip ${hall === "custom" ? "on" : ""}`} onClick={() => setHall("custom")}>
                  Importiert ({s.custom.length})
                </button>
              ) : null}
            </div>
            <div className="row">
              <select id="shop-topic" className="input" style={{ flex: "1 1 160px" }} value={topic} onChange={(e) => setTopic(e.target.value as TopicId | "all")}>
                <option value="all">Alle Themen</option>
                {(Object.keys(TOPICS) as TopicId[]).map((t) => (
                  <option key={t} value={t}>
                    {TOPICS[t].de}
                  </option>
                ))}
              </select>
              <select id="shop-level" className="input" style={{ flex: "0 1 120px" }} value={level} onChange={(e) => setLevel(e.target.value as Level | "all")}>
                <option value="all">Alle Niveaus</option>
                {(["A1", "A2", "B1", "B2"] as Level[]).map((l) => (
                  <option key={l} value={l}>
                    {l}
                  </option>
                ))}
              </select>
              <input id="shop-search" className="input" style={{ flex: "1 1 160px" }} placeholder="Suchen (deutsch oder englisch)" value={q} onChange={(e) => setQ(e.target.value)} />
            </div>
            <p className="small muted">
              {list.length} Baupläne. Der Preis steigt mit jeder Maschine, die du besitzt. Gratis-Baupläne gibt es bei jedem Level-Aufstieg.
            </p>
            <div className="list">
              {list.slice(0, limit).map((it) => (
                <BlueprintRow key={it.id} it={it} onInfo={() => setInfo(it)} />
              ))}
            </div>
            {list.length > limit ? (
              <button type="button" className="btn ghost" onClick={() => setLimit(limit + 60)}>
                Mehr anzeigen
              </button>
            ) : null}
          </section>
        </>
      ) : (
        <section className="card stack">
          <p className="small muted">Ausbau macht deine Fabrik dauerhaft produktiver.</p>
          <div className="list">
            {UPGRADES.map((u) => {
              const lvl = s.upgrades[u.id] ?? 0;
              const maxed = lvl >= u.max;
              const cost = upgradeCost(u, lvl);
              const hallLocked = u.id.startsWith("halle_") && !hallUnlocked(s, u.id.slice(6) as HallId);
              return (
                <div key={u.id} className="list-item">
                  <div style={{ minWidth: 0 }}>
                    <div className="t">
                      {u.de} <span className="level-tag">Stufe {lvl}/{u.max}</span>
                    </div>
                    <div className="small muted">
                      {u.effect} · {u.en}
                    </div>
                  </div>
                  <button
                    type="button"
                    className={`btn small ${s.taler >= cost && !maxed && !hallLocked ? "primary" : ""}`}
                    disabled={maxed || hallLocked || s.taler < cost}
                    onClick={() => {
                      if (store.update((d) => buyUpgrade(d, u.id))) {
                        sfx.levelUp();
                        toast(
                          <span>
                            <b>{u.de}</b> ausgebaut!
                          </span>,
                        );
                      }
                    }}
                  >
                    {maxed ? "Max" : <span className="price">{fmt(cost)}</span>}
                  </button>
                </div>
              );
            })}
          </div>
        </section>
      )}
      {info ? <ItemSheet it={info} onClose={() => setInfo(null)} /> : null}
      <p className="small muted" style={{ textAlign: "center" }}>
        <Icon name="spark" size={14} /> Tipp: Kauf lieber wenige Baupläne und halte deine Maschinen rostfrei.
      </p>
    </>
  );
}
