import { StrictMode } from "react";
import { createRoot } from "react-dom/client";
import { boot, startTicker, store } from "./store/store";
import { App } from "./ui/App";
import { setSound } from "./ui/fx";
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
