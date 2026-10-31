import { createRoot } from "react-dom/client";
import App from "./App.tsx";
import "./index.css";
import "./i18n";

// ── Service worker lifecycle ──────────────────────────────────────────────────
//
// Dev: immediately unregister any SW left over from a previous production build.
//      Without this, the old SW intercepts every fetch and serves stale cached
//      files, so normal refresh shows old UI while hard-refresh (which bypasses
//      the SW entirely) shows new UI.
//
// Production: vite-plugin-pwa registers the SW via autoUpdate. We additionally
//      listen for the `controllerchange` event and reload the page so users
//      always see the latest build without needing a manual hard-refresh.

if ('serviceWorker' in navigator) {
  if (import.meta.env.DEV) {
    navigator.serviceWorker.getRegistrations().then(regs => {
      regs.forEach(reg => reg.unregister());
    });
  } else {
    // When the active SW is replaced by a new one, reload immediately. The first
    // install also fires this event, and nothing is stale on that visit.
    const hadController = Boolean(navigator.serviceWorker.controller);
    navigator.serviceWorker.addEventListener('controllerchange', () => {
      if (hadController) window.location.reload();
    });
  }
}

createRoot(document.getElementById("root")!).render(<App />);
