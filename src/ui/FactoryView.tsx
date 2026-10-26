import { useState } from "react";
import type { Catalog } from "../content/catalog";
import { HALLS, type HallId, type Item } from "../content/types";
import { dueInDays, isDue, rustOf, stageOf, type CardState } from "../engine/srs";
import { levelLabel, overall } from "../engine/level";
import { shortName } from "../engine/tasks";
import { dayKey } from "../engine/text";
import { chestReady, claimChest, hallUnlocked } from "../game/actions";
import { factoryRate, fmt, levelOf, machineRate, perSentence, storageHours } from "../game/economy";
import { orderText } from "../game/orders";
import type { GameState } from "../game/state";
import { store, useCatalog, useGame } from "../store/store";
import { Gear, Icon, Pips, Sheet, toast } from "./common";
import { FactoryMap } from "./FactoryMap";
import { confetti, sfx } from "./fx";
import { ItemSheet } from "./ItemSheet";
import { CoachNote } from "./ShiftView";

const HALL_ORDER: HallId[] = ["satzbau", "woerter", "verben", "faelle", "redemittel"];

function Machine({ it, card, s, onOpen }: { it: Item; card: CardState; s: GameState; onOpen: () => void }) {
  const now = Date.now();
  const stage = stageOf(card);
  const rust = rustOf(card, now);
  const rate = machineRate(s, it, card, now);
  const cls = stage === 0 ? "blueprint" : stage === 5 ? "gold" : rust > 0 ? "rusty" : "";
  const status =
    stage === 0
      ? "Bauplan"
      : rust > 0
        ? `Rost ${Math.round(rust * 100)} %`
        : `${Math.max(1, Math.round(dueInDays(card, now)))} T.`;
  return (
    <button type="button" className={`machine ${cls}`} onClick={onOpen} aria-label={`${shortName(it)}, ${status}`}>
      {rust > 0 ? <span className="rustfill" style={{ height: `${Math.round(rust * 100)}%` }} /> : null}
      <Gear speed={stage === 0 ? 0 : (stage + 1) * (1 - rust * 0.8)} />
      <span style={{ minWidth: 0 }}>
        <span className="name" style={{ display: "block" }}>
          {shortName(it)}
        </span>
        <Pips stage={stage} />
      </span>
      <span className="meta">
        <span>{status}</span>
        <span>{stage === 0 ? "—" : `+${fmt(rate)}/h`}</span>
      </span>
    </button>
  );
}

function Orders() {
  const s = useGame();
  const ready = chestReady(s);
  if (!s.orders.list.length) return null;
  const open = () => {
    const prize = store.update((d, c) => claimChest(d, c, Date.now()));
    if (!prize) return;
    sfx.levelUp();
    confetti(["#f2b705", "#2c6a78", "#b0432b"]);
    toast(
      prize.kind === "taler" ? (
        <span>
          Tageskiste: <b>+{fmt(prize.amount)} Taler</b>
        </span>
      ) : prize.kind === "freeze" ? (
        <span>
          Tageskiste: <b>Streak-Schutz</b> (ein verpasster Tag zählt nicht)
        </span>
      ) : (
        <span>
          Tageskiste: <b>ein neuer Arbeiter</b> für deine Fabrik
        </span>
      ),
      5000,
    );
  };
  return (
    <section className="card stack" aria-label="Aufträge von heute">
      <div className="spread">
        <h3>Aufträge von heute</h3>
        {ready ? (
          <button type="button" className="btn primary small" onClick={open}>
            <Icon name="chest" size={18} /> Kiste öffnen
          </button>
        ) : s.orders.chestClaimed ? (
          <span className="small muted">Kiste geöffnet</span>
        ) : (
          <span className="small muted">Alle drei erledigen → Tageskiste</span>
        )}
      </div>
      <div>
        {s.orders.list.map((o) => {
          const t = orderText(o);
          return (
            <div key={o.id} className={`order ${o.done ? "done" : ""}`}>
              <div style={{ minWidth: 0 }}>
                <div style={{ fontWeight: 700 }}>{t.de}</div>
                <div className="en">
                  {o.from} · {t.en}
                </div>
              </div>
              <div className="num small" style={{ textAlign: "right" }}>
                {o.done ? <Icon name="check" size={18} /> : `${o.progress}/${o.goal}`}
                <div className="muted">+{fmt(o.reward)}</div>
              </div>
              <div className="bar">
                <i style={{ width: `${(o.progress / o.goal) * 100}%` }} />
              </div>
            </div>
          );
        })}
      </div>
    </section>
  );
}

type View = "map" | "list";
const VIEW_KEY = "satzfabrik.view";

function readView(): View {
  try {
    return localStorage.getItem(VIEW_KEY) === "list" ? "list" : "map";
  } catch {
    return "map";
  }
}

function saveView(v: View): void {
  try {
    localStorage.setItem(VIEW_KEY, v);
  } catch {
    // private mode: the choice just isn't remembered
  }
}

/** The items behind one spot on the map: a rack of words, or a machine that stands for several. */
function RackSheet({ items, onClose, onOpen }: { items: Item[]; onClose: () => void; onOpen: (it: Item) => void }) {
  const s = useGame();
  const due = items.filter((it) => s.cards[it.id] && isDue(s.cards[it.id], Date.now())).length;
  const hall = items[0] ? HALLS[items[0].hall].de : "";
  const rack = items[0]?.hall === "woerter";
  return (
    <Sheet onClose={onClose} label={rack ? "Regal im Wortlager" : `Maschinengruppe in der ${hall}`}>
      <div className="spread">
        <span className="eyebrow">{rack ? "Wortlager · Regal" : `${hall} · Maschinengruppe`}</span>
        <button type="button" className="btn ghost small" onClick={onClose}>
          Schließen
        </button>
      </div>
      <h2>
        {items.length} {rack ? (items.length === 1 ? "Wort" : "Wörter") : "Maschinen"}
        {due ? `, ${due} rosten` : ""}
      </h2>
      <div className="machines">
        {items.map((it) =>
          s.cards[it.id] ? <Machine key={it.id} it={it} card={s.cards[it.id]} s={s} onOpen={() => onOpen(it)} /> : null,
        )}
      </div>
    </Sheet>
  );
}

function hallItems(s: GameState, catalog: Catalog, hall: HallId) {
  return catalog
    .inHall(hall)
    .filter((it) => s.cards[it.id])
    .sort((a, b) => {
      const ca = s.cards[a.id];
      const cb = s.cards[b.id];
      return rustOf(cb, Date.now()) - rustOf(ca, Date.now()) || stageOf(ca) - stageOf(cb) || a.de.localeCompare(b.de, "de");
    });
}

export function FactoryView({
  onStartShift,
  onShop,
  onPractice,
}: {
  onStartShift: () => void;
  onShop: (tab?: "upgrades" | "plans") => void;
  onPractice: (id: string) => void;
}) {
  const s = useGame();
  const catalog = useCatalog();
  const [open, setOpen] = useState<Item | null>(null);
  const [rackItems, setRackItems] = useState<Item[] | null>(null);
  const [view, setView] = useState<View>(readView);
  const pick = (v: View) => {
    setView(v);
    saveView(v);
  };
  const now = Date.now();
  const cards = Object.values(s.cards);
  const built = cards.filter((c) => stageOf(c) > 0).length;
  const rusty = cards.filter((c) => isDue(c, now)).length;
  const blueprints = cards.length - built;
  const rate = factoryRate(s, catalog, now);
  const lvl = levelOf(s.xp);
  const delivery = s.delivery?.day === dayKey(now) ? s.delivery : null;

  return (
    <>
      <section className="hero">
        <div className="stack" style={{ gap: 4 }}>
          <span className="eyebrow" style={{ color: "inherit", opacity: 0.7 }}>
            Pro Satz
          </span>
          <div className="big">+{fmt(perSentence(s))} Taler</div>
          <p className="muted small">
            Dazu {fmt(rate)} Taler pro Stunde aus Maschinen und Personal, auch wenn die App zu ist (bis zu {storageHours(s)} Stunden).
          </p>
          <p className="small">
            Dein Niveau: <b>{levelLabel(overall(s.level).theta).code}</b>
            {delivery ? ` · heute geliefert: ${delivery.ids.length} neue Baupläne` : ""}
          </p>
        </div>
        <div className="stat-grid">
          <div className="stat">
            <span className="v">{built}</span>
            <span className="l">Maschinen laufen</span>
          </div>
          <div className="stat">
            <span className="v" style={rusty ? { color: "var(--rust)" } : undefined}>
              {rusty}
            </span>
            <span className="l">rosten</span>
          </div>
          <div className="stat">
            <span className="v">{blueprints}</span>
            <span className="l">Baupläne</span>
          </div>
        </div>
        <div className="row">
          <button type="button" className="btn primary" onClick={onStartShift}>
            <Icon name="play" size={18} />
            {rusty ? `Wartungsschicht (${rusty} rosten)` : blueprints ? "Schicht: neue Maschinen bauen" : "Schicht starten"}
          </button>
          <button type="button" className="btn" onClick={() => onShop()} style={{ background: "transparent", color: "inherit" }}>
            <Icon name="shop" size={18} /> Laden
          </button>
        </div>
      </section>

      {s.coach?.focus.length ? (
        <section className="card">
          <CoachNote compact onPractice={onPractice} />
        </section>
      ) : null}

      {view === "list" ? <Orders /> : null}

      <div className="spread">
        <h2>Deine Fabrik</h2>
        <div className="seg" role="group" aria-label="Ansicht">
          <button type="button" aria-pressed={view === "map"} onClick={() => pick("map")}>
            Karte
          </button>
          <button type="button" aria-pressed={view === "list"} onClick={() => pick("list")}>
            Liste
          </button>
        </div>
      </div>

      {view === "map" ? (
        <>
          <FactoryMap onOpen={setOpen} onOpenRack={setRackItems} onShop={onShop} />
          <Orders />
        </>
      ) : (
        HALL_ORDER.map((hall) => {
          const h = HALLS[hall];
          const items = hallItems(s, catalog, hall);
          const unlocked = hallUnlocked(s, hall);
          return (
            <section key={hall} className="hall" aria-label={h.de}>
              <div className="hall-head">
                <h2>{h.de}</h2>
                <span className="small muted">{h.blurb}</span>
              </div>
              {!unlocked ? (
                <div className="locked">
                  Ab Level {h.unlockLevel} (du bist Level {lvl}). Schreib Sätze, um Erfahrung zu sammeln.
                </div>
              ) : items.length === 0 ? (
                <div className="locked">
                  Noch keine Maschinen. Die tägliche Lieferung bringt welche, oder du suchst sie im Lernplan aus.{" "}
                  <button type="button" className="btn small" onClick={() => onShop("plans")}>
                    Zum Laden
                  </button>
                </div>
              ) : (
                <div className="machines">
                  {items.map((it) => (
                    <Machine key={it.id} it={it} card={s.cards[it.id]} s={s} onOpen={() => setOpen(it)} />
                  ))}
                </div>
              )}
            </section>
          );
        })
      )}
      {rackItems ? (
        <RackSheet
          items={rackItems}
          onClose={() => setRackItems(null)}
          onOpen={(it) => {
            setRackItems(null);
            setOpen(it);
          }}
        />
      ) : null}
      {open ? <ItemSheet it={open} onClose={() => setOpen(null)} onPractice={onPractice} /> : null}
    </>
  );
}
