import { factoryRate, fmt, fmtRate, levelOf, xpForLevel } from "../game/economy";
import { emptyDay } from "../game/state";
import { dayKey } from "../engine/text";
import { useCatalog, useGame } from "../store/store";
import { Icon, LiveCoins } from "./common";

export function TopBar({ onSettings }: { onSettings: () => void }) {
  const s = useGame();
  const catalog = useCatalog();
  const now = Date.now();
  const rate = factoryRate(s, catalog, now);
  const lvl = levelOf(s.xp);
  const from = xpForLevel(lvl);
  const to = xpForLevel(lvl + 1);
  const pct = Math.min(100, ((s.xp - from) / Math.max(1, to - from)) * 100);
  const day = s.stats.days[dayKey(now)] ?? emptyDay();
  const goalDone = day.tasks >= s.settings.dailyGoal;
  return (
    <header className="topbar">
      <div className="wrap">
        <div className="brand" aria-label="Satzfabrik">
          Satz<b>fabrik</b>
        </div>
        <div className="wallet" title="Taler und was die Fabrik ohne dich produziert">
          <span className="coin-dot" aria-hidden="true" />
          <LiveCoins value={s.taler} perSecond={rate / 3600} format={fmt} />
          <span className="rate">{fmtRate(rate, true)}</span>
        </div>
        <button type="button" className="iconbtn" aria-label="Einstellungen" onClick={onSettings}>
          <Icon name="gear" />
        </button>
      </div>
      <div className="wrap" style={{ paddingBlock: "0 8px" }}>
        <div className="chips-row" style={{ width: "100%" }}>
          <span className="pill" title="Fabrik-Level">
            Lvl {lvl}
          </span>
          <span className={`pill ${s.streak.current > 0 ? "flame" : ""}`} title="Tage in Folge mit erfülltem Tagesziel">
            <Icon name="flame" size={14} /> {s.streak.current}
          </span>
          <span className="pill" title="Heutiges Ziel: Sätze" style={goalDone ? { borderColor: "var(--ok)", color: "var(--ok)" } : undefined}>
            {goalDone ? <Icon name="check" size={14} /> : null}
            {Math.min(day.tasks, s.settings.dailyGoal)}/{s.settings.dailyGoal} heute
          </span>
          {s.combo > 1 ? <span className="pill combo">Kombo ×{s.combo.toFixed(1)}</span> : null}
        </div>
      </div>
      <div className="xpbar" aria-hidden="true">
        <i style={{ width: `${pct}%` }} />
      </div>
    </header>
  );
}
