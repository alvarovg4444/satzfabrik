import { useMemo, useState } from "react";
import { HALLS, TOPICS, type HallId, type Item, type Level, type TopicId } from "../content/types";
import { shortName } from "../engine/tasks";
import { fold } from "../engine/text";
import { B2_UNLOCK, LEVEL_NUM, levelLabel, overall } from "../engine/level";
import { buyUpgrade, canUnlock, hallUnlocked, recommendFor, unlock } from "../game/actions";
import { factoryRate, fmt, perSentence, storageHours } from "../game/economy";
import type { GameState } from "../game/state";
import { GROUPS, UPGRADES, upgradeCost, type UpgradeDef, type UpgradeGroup } from "../game/upgrades";
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

function BlueprintRow({ it, onInfo }: { it: Item; onInfo: () => void }) {
  const s = useGame();
  const err = canUnlock(s, it);
  const add = () => {
    const res = store.update((d) => unlock(d, it, Date.now()));
    if (res) {
      toast(res === "locked_hall" ? "Diese Halle ist noch gesperrt." : res === "locked_level" ? `B2 öffnet sich ab Niveau ${levelLabel(B2_UNLOCK).code}.` : "Schon auf dem Plan.");
      return;
    }
    sfx.coin();
    toast(
      <span>
        <b>{shortName(it)}</b> steht auf deinem Plan und kommt bald in einer Schicht dran.
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
      <button type="button" className={`btn small ${err ? "" : "primary"}`} disabled={!!err} onClick={add}>
        {err === "locked_level" ? "ab B1+" : err === "locked_hall" ? "gesperrt" : "Lernen"}
      </button>
    </div>
  );
}

/** The current value an upgrade improves, so the shop shows what you get. */
function currentValue(s: GameState, u: UpgradeDef, rate: number): string | null {
  switch (u.id) {
    case "werkzeug":
    case "meisterbrief":
    case "kantine":
    case "ausbildung":
    case "teststrecke":
      return `jetzt ${fmt(perSentence(s))} Taler pro Satz`;
    case "arbeiter":
      return `${s.upgrades.arbeiter ?? 0} Arbeiter`;
    case "gabelstapler":
      return `${s.upgrades.gabelstapler ?? 0} Stapler`;
    case "lkw":
      return `${s.upgrades.lkw ?? 0} Lastwagen`;
    case "fliessband":
    case "parkhaus":
    case "solarpark":
    case "bahn":
      return `jetzt ${fmt(rate)} Taler/h`;
    case "lagerhalle":
    case "wasserturm":
      return `jetzt ${storageHours(s)} h Lager`;
    default:
      return null;
  }
}

function UpgradeRow({ u, rate }: { u: UpgradeDef; rate: number }) {
  const s = useGame();
  const lvl = s.upgrades[u.id] ?? 0;
  const maxed = lvl >= u.max;
  const cost = upgradeCost(u, lvl);
  const hallLocked = u.id.startsWith("halle_") && !hallUnlocked(s, u.id.slice(6) as HallId);
  const now = currentValue(s, u, rate);
  const building = u.group === "gebaeude";
  return (
    <div className={`list-item upgrade ${maxed ? "done" : ""}`}>
      <div style={{ minWidth: 0 }}>
        <div className="t">
          {u.de}{" "}
          <span className="level-tag">{building ? (maxed ? "gebaut" : "Bauplatz") : u.max > 1 ? `Stufe ${lvl}/${u.max}` : ""}</span>
        </div>
        <div className="small">{u.effect}</div>
        <div className="small muted">
          {now ? `${now}` : ""}
          {now && u.visual ? " · " : ""}
          {u.visual ? `Karte: ${u.visual}` : ""}
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
                <b>{u.de}</b> {building ? "gebaut! Schau auf die Karte." : "ausgebaut!"}
              </span>,
            );
          }
        }}
      >
        {maxed ? (building ? "Steht" : "Max") : hallLocked ? "gesperrt" : <span className="price">{fmt(cost)}</span>}
      </button>
    </div>
  );
}

function UpgradeShop() {
  const s = useGame();
  const catalog = useCatalog();
  const rate = factoryRate(s, catalog, Date.now());
  return (
    <>
      <section className="card stack">
        <div className="stat-grid">
          <div className="stat">
            <span className="v">{fmt(perSentence(s))}</span>
            <span className="l">Taler pro Satz</span>
          </div>
          <div className="stat">
            <span className="v">{fmt(rate)}</span>
            <span className="l">Taler pro Stunde</span>
          </div>
          <div className="stat">
            <span className="v">{storageHours(s)} h</span>
            <span className="l">Offline-Lager</span>
          </div>
        </div>
        <p className="small muted">
          Mit Talern baust du die Fabrik aus: mehr Taler für jeden Satz, Personal, das weiterarbeitet, wenn die App zu ist, und große
          Gebäude auf dem Gelände. Wörter und Grammatik kosten nie etwas: die liefert die Fabrik jeden Tag passend zu deinem Niveau.
        </p>
      </section>
      {(Object.keys(GROUPS) as UpgradeGroup[]).map((g) => (
        <section key={g} className="card stack" aria-label={GROUPS[g].de}>
          <div>
            <h3>{GROUPS[g].de}</h3>
            <p className="small muted">{GROUPS[g].blurb}</p>
          </div>
          <div className="list">
            {UPGRADES.filter((u) => u.group === g).map((u) => (
              <UpgradeRow key={u.id} u={u} rate={rate} />
            ))}
          </div>
        </section>
      ))}
    </>
  );
}

export function ShopView() {
  const s = useGame();
  const catalog = useCatalog();
  const [tab, setTab] = useState<"plans" | "upgrades">("upgrades");
  const [hall, setHall] = useState<HallId | "all" | "custom">("all");
  const [topic, setTopic] = useState<TopicId | "all">("all");
  const [level, setLevel] = useState<Level | "all">("all");
  const [q, setQ] = useState("");
  const [limit, setLimit] = useState(40);
  const [info, setInfo] = useState<Item | null>(null);

  const recs = useMemo(() => recommendFor(s, catalog, Date.now(), 6), [s, catalog]);
  const theta = overall(s.level).theta;
  const list = useMemo(() => {
    const needle = fold(q);
    return catalog.items
      .filter((it) => !s.cards[it.id])
      .filter((it) => hall === "all" || (hall === "custom" ? it.id.startsWith("c.") : it.hall === hall))
      .filter((it) => topic === "all" || it.topic === topic)
      .filter((it) => level === "all" || it.level === level)
      .filter((it) => !needle || fold(`${it.de} ${it.en} ${it.kind === "gram" ? it.name : ""}`).includes(needle))
      .sort(
        (a, b) =>
          Number(!hallUnlocked(s, a.hall)) - Number(!hallUnlocked(s, b.hall)) ||
          // closest to the learner's level first, so A1 basics don't bury the useful pieces
          Math.abs(LEVEL_NUM[a.level] - theta - 0.35) - Math.abs(LEVEL_NUM[b.level] - theta - 0.35) ||
          a.de.localeCompare(b.de, "de"),
      );
  }, [catalog, s, hall, topic, level, q, theta]);

  return (
    <>
      <div className="spread">
        <h1>Laden</h1>
        <div className="seg" role="group" aria-label="Bereich">
          <button type="button" aria-pressed={tab === "upgrades"} onClick={() => setTab("upgrades")}>
            Ausbau
          </button>
          <button type="button" aria-pressed={tab === "plans"} onClick={() => setTab("plans")}>
            Lernplan
          </button>
        </div>
      </div>

      {tab === "plans" ? (
        <>
          {recs.length ? (
            <section className="card stack">
              <h3>Empfohlen für dich</h3>
              <p className="small muted">
                Passend zu deinem Niveau ({levelLabel(theta).code}) und deinen häufigsten Fehlern. Kostenlos:
                {s.settings.autoDeliver
                  ? ` jeden Tag liefert die Fabrik dir solche Baupläne bis zu deinem Tageslimit (${s.settings.newPerDay}). Hier kannst du dir zusätzlich welche aussuchen.`
                  : " die automatische Lieferung ist aus (Einstellungen), also such dir hier aus, was du lernen willst."}
              </p>
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
              {list.length} Baupläne, alle kostenlos. Was du hier auswählst, kommt zusätzlich zur täglichen Lieferung in deine Schichten.
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
        <UpgradeShop />
      )}
      {info ? <ItemSheet it={info} onClose={() => setInfo(null)} /> : null}
      <p className="small muted" style={{ textAlign: "center" }}>
        <Icon name="spark" size={14} /> Tipp: Am meisten bringt der Werkzeugkasten am Anfang: jede Stufe gibt +1 Taler pro Satz.
      </p>
    </>
  );
}
