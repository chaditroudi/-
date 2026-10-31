import { createRoot } from "react-dom/client";
import App from "./App.tsx";
import "./index.css";
import "./i18n";
import { toast } from "sonner";
import { applyUpdateWhenSafe } from "./lib/appUpdate";
import { deleteLegacyApiCache } from "./lib/sessionData";

// ── Service worker lifecycle ──────────────────────────────────────────────────
//
// Dev: immediately unregister any SW left over from a previous production build.
//      Without this, the old SW intercepts every fetch and serves stale cached
//      files, so normal refresh shows old UI while hard-refresh (which bypasses
//      the SW entirely) shows new UI.
//
// Production: vite-plugin-pwa registers the SW via autoUpdate. We additionally
//      listen for the `controllerchange` event and reload the page so users
//      always see the latest build without needing a manual hard-refresh. The
//      reload waits for any work on screen.

if ('serviceWorker' in navigator) {
  if (import.meta.env.DEV) {
    navigator.serviceWorker.getRegistrations().then(regs => {
      regs.forEach(reg => reg.unregister());
    });
  } else {
    void deleteLegacyApiCache();
    // When the active SW is replaced by a new one, reload. The first install also
    // fires this event, and nothing is stale on that visit.
    const hadController = Boolean(navigator.serviceWorker.controller);
    navigator.serviceWorker.addEventListener('controllerchange', () => {
      if (!hadController) return;
      applyUpdateWhenSafe({
        onWaiting: (reloadNow) => toast('Nouvelle version prête', {
          duration: Infinity,
          action: { label: 'Recharger', onClick: reloadNow },
        }),
      });
    });
  }
}

createRoot(document.getElementById("root")!).render(<App />);
