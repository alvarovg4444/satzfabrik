import { useState } from "react";
import type { Catalog } from "../content/catalog";
import { HALLS, type HallId, type Item } from "../content/types";
import { dueInDays, isDue, rustOf, stageOf, type CardState } from "../engine/srs";
import { shortName } from "../engine/tasks";
import { chestReady, claimChest, hallUnlocked } from "../game/actions";
import { factoryRate, fmt, levelOf, machineRate, storageHours } from "../game/economy";
import { orderText } from "../game/orders";
import type { GameState } from "../game/state";
import { store, useCatalog, useGame } from "../store/store";
import { Gear, Icon, Pips, toast } from "./common";
import { confetti, sfx } from "./fx";
import { ItemSheet } from "./ItemSheet";

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
          Tageskiste: <b>ein Gratis-Bauplan</b> im Laden
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
  onShop: () => void;
  onPractice: (id: string) => void;
}) {
  const s = useGame();
  const catalog = useCatalog();
  const [open, setOpen] = useState<Item | null>(null);
  const now = Date.now();
  const cards = Object.values(s.cards);
  const built = cards.filter((c) => stageOf(c) > 0).length;
  const rusty = cards.filter((c) => isDue(c, now)).length;
  const blueprints = cards.length - built;
  const rate = factoryRate(s, catalog, now);
  const lvl = levelOf(s.xp);

  return (
    <>
      <section className="hero">
        <div className="stack" style={{ gap: 4 }}>
          <span className="eyebrow" style={{ color: "inherit", opacity: 0.7 }}>
            Produktion
          </span>
          <div className="big">{fmt(rate)} Taler/h</div>
          <p className="muted small">
            Läuft auch, wenn die App zu ist: bis zu {storageHours(s)} Stunden, dann ist das Lager voll.
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
          <button type="button" className="btn" onClick={onShop} style={{ background: "transparent", color: "inherit" }}>
            <Icon name="shop" size={18} /> Laden
          </button>
        </div>
      </section>

      <Orders />

      {HALL_ORDER.map((hall) => {
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
                Noch keine Maschinen. Hol dir im Laden einen Bauplan.{" "}
                <button type="button" className="btn small" onClick={onShop}>
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
      })}
      {open ? <ItemSheet it={open} onClose={() => setOpen(null)} onPractice={onPractice} /> : null}
    </>
  );
}
