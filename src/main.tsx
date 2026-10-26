import { StrictMode } from "react";
import { createRoot } from "react-dom/client";
import { boot, startTicker, store } from "./store/store";
import { App } from "./ui/App";
import { setSound } from "./ui/fx";
import { setUpApp } from "./ui/install";
import { loadVoice, neuralState, unlockOnFirstTap } from "./ui/neural";
import { neuralId } from "./ui/piper";
import "./styles.css";

interface Hot {
  ready?: (start: (data: { game?: unknown }) => void) => void;
  data?: { game?: unknown };
  snapshot?: (fn: () => unknown) => void;
}

function start(data: { game?: unknown } = {}) {
  void boot(data);
  setSound(store.get().settings.sound);
  store.subscribe(() => setSound(store.get().settings.sound));
  startTicker();
  setUpApp();
  // A neural voice loads from the device in the background, so the first tap speaks quickly.
  let warmed = "";
  const warm = () => {
    const id = neuralId(store.get().settings.voice);
    if (!id || id === warmed) return;
    if (!warmed) unlockOnFirstTap();
    warmed = id;
    // (unless the learner is downloading another voice right now)
    setTimeout(() => neuralState().status !== "loading" && void loadVoice(id), 1200);
  };
  store.subscribe(warm);
  warm();
  // On claude.ai a republished version reloads open pages; hand the live state over.
  const hot = (window as unknown as { claude?: { hot?: Hot } }).claude?.hot;
  hot?.snapshot?.(() => ({ game: store.get() }));
  createRoot(document.getElementById("root")!).render(
    <StrictMode>
      <App />
    </StrictMode>,
  );
}

const hot = (window as unknown as { claude?: { hot?: Hot } }).claude?.hot;
if (hot?.ready) hot.ready(start);
else start(hot?.data ?? {});
