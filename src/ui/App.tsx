import { useEffect, useState } from "react";
import { isDue } from "../engine/srs";
import { fmt } from "../game/economy";
import { prefetchNextShift } from "../store/prefetch";
import { store, useGame, useMeta } from "../store/store";
import { Icon, Sheet, Toasts } from "./common";
import { DrillView } from "./DrillView";
import { FactoryView } from "./FactoryView";
import { sfx } from "./fx";
import { Onboarding } from "./Onboarding";
import { SettingsView } from "./SettingsView";
import { ShiftView, type StartRequest } from "./ShiftView";
import { ShopView } from "./ShopView";
import { StatsView } from "./StatsView";
import { TopBar } from "./TopBar";

type Tab = "fabrik" | "laden" | "schicht" | "akkord" | "statistik" | "settings";

const TABS: { id: Exclude<Tab, "settings">; label: string; icon: Parameters<typeof Icon>[0]["name"] }[] = [
  { id: "fabrik", label: "Fabrik", icon: "factory" },
  { id: "laden", label: "Laden", icon: "shop" },
  { id: "schicht", label: "Schicht", icon: "play" },
  { id: "akkord", label: "Akkord", icon: "bolt" },
  { id: "statistik", label: "Statistik", icon: "chart" },
];

function initialTab(): Tab {
  const h = typeof location !== "undefined" ? location.hash.replace("#", "") : "";
  return (["fabrik", "laden", "schicht", "akkord", "statistik"] as string[]).includes(h) ? (h as Tab) : "fabrik";
}

function WelcomeBack() {
  const meta = useMeta();
  const w = meta.welcome;
  if (!w) return null;
  return (
    <Sheet onClose={() => store.dismissWelcome()} label="Willkommen zurück">
      <span className="eyebrow">Willkommen zurück</span>
      <h2>Deine Fabrik hat weitergearbeitet</h2>
      <p>
        In {w.hours >= 1 ? `${w.hours.toFixed(1).replace(".", ",")} Stunden` : "deiner Abwesenheit"} hat sie{" "}
        <b className="num">{fmt(w.amount)} Taler</b> produziert.
      </p>
      {w.capped ? <p className="small muted">Das Lager war voll. Mit einer größeren Lagerhalle (Laden → Ausbau) produziert sie länger.</p> : null}
      <RustNote />
      <button
        type="button"
        className="btn primary block"
        onClick={() => {
          sfx.coin();
          store.dismissWelcome();
        }}
      >
        Einsammeln
      </button>
    </Sheet>
  );
}

function RustNote() {
  const s = useGame();
  const n = Object.values(s.cards).filter((c) => isDue(c, Date.now())).length;
  if (!n) return null;
  return (
    <p className="small" style={{ color: "var(--rust)" }}>
      {n} Maschine{n > 1 ? "n rosten" : " rostet"}: Du würdest diese Wörter bald vergessen. Eine Wartungsschicht bringt sie zurück.
    </p>
  );
}

export function App() {
  const s = useGame();
  const [tab, setTab] = useState<Tab>(initialTab);
  const [returnTab, setReturnTab] = useState<Tab>("fabrik");
  const [startReq, setStartReq] = useState<StartRequest>({ n: 0 });
  const [shopTab, setShopTab] = useState<"upgrades" | "plans">("upgrades");

  useEffect(() => {
    document.documentElement.lang = "de";
  }, []);

  // Once the corrector is connected, the AI writes the next shift's situations in the background.
  const meta = useMeta();
  useEffect(() => {
    if (!meta.providerReady || meta.provider.id === "offline" || !s.onboarded) return;
    const timer = window.setTimeout(() => void prefetchNextShift(), 1200);
    return () => window.clearTimeout(timer);
  }, [meta.providerReady, meta.provider.id, s.onboarded]);

  const go = (t: Tab, shop: "upgrades" | "plans" = "upgrades") => {
    if (t === "settings") setReturnTab(tab === "settings" ? "fabrik" : tab);
    if (t === "laden") setShopTab(shop);
    setTab(t);
    window.scrollTo({ top: 0 });
  };

  const startShift = (focus?: string[]) => {
    setStartReq((r) => ({ n: r.n + 1, focus }));
    go("schicht");
  };

  if (!s.onboarded) {
    return (
      <div className="app">
        <Onboarding onDone={() => startShift()} />
        <Toasts />
      </div>
    );
  }

  const due = Object.values(s.cards).filter((c) => isDue(c, Date.now())).length;

  return (
    <div className="app">
      <TopBar onSettings={() => go(tab === "settings" ? returnTab : "settings")} />
      <main className="wrap">
        {tab === "fabrik" ? <FactoryView onStartShift={() => startShift()} onShop={(t) => go("laden", t)} onPractice={(id) => startShift([id])} /> : null}
        {tab === "laden" ? <ShopView initial={shopTab} /> : null}
        {/* The shift stays mounted so switching tabs never loses a half-written sentence. */}
        <div hidden={tab !== "schicht"} className="stack">
          <ShiftView startReq={startReq} goFactory={() => go("fabrik")} goDrill={() => go("akkord")} />
        </div>
        {tab === "akkord" ? <DrillView /> : null}
        {tab === "statistik" ? <StatsView onPractice={(id) => startShift([id])} /> : null}
        {tab === "settings" ? <SettingsView onClose={() => go(returnTab)} /> : null}
      </main>
      <nav className="nav" aria-label="Hauptnavigation">
        <div className="wrap">
          {TABS.map((t) => (
            <button
              key={t.id}
              type="button"
              className={t.id === "schicht" ? "shift-btn" : ""}
              aria-current={tab === t.id ? "page" : undefined}
              onClick={() => go(t.id)}
            >
              {t.id === "schicht" ? (
                <span className="disc">
                  <Icon name="play" size={26} />
                </span>
              ) : (
                <Icon name={t.icon} />
              )}
              <span>{t.label}</span>
              {t.id === "fabrik" && due > 0 ? <span className="badge">{due}</span> : null}
            </button>
          ))}
        </div>
      </nav>
      <WelcomeBack />
      <Toasts />
    </div>
  );
}
