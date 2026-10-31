import { defineConfig, loadEnv, type Plugin } from "vite";
import react from "@vitejs/plugin-react-swc";
import { VitePWA } from "vite-plugin-pwa";
import http from "node:http";
import path from "path";
import { refuseBuildTarget, refuseDevProxy, resolveBuildTarget } from "./src/lib/apiTarget";

// In dev mode, serve a self-destructing SW at /sw.js so the browser's
// automatic SW update check (which always bypasses the cache and the
// existing SW) kills any stale production-build SW on the very next
// normal refresh — no hard-refresh required.
const devSwKillSwitch = (): Plugin => ({
  name: "dev-sw-kill-switch",
  apply: "serve",
  configureServer(server) {
    server.middlewares.use("/sw.js", (_req, res) => {
      res.setHeader("Content-Type", "application/javascript; charset=utf-8");
      res.setHeader("Cache-Control", "no-store");
      res.end(
        [
          "// kill-switch: unregisters any stale production SW in dev mode",
          "self.addEventListener('install', () => self.skipWaiting());",
          "self.addEventListener('activate', async () => {",
          "  await self.clients.claim();",
          "  await self.registration.unregister();",
          "  const clients = await self.clients.matchAll({ type: 'window' });",
          "  clients.forEach(c => c.navigate(c.url));",
          "});",
        ].join("\n"),
      );
    });
  },
});

const waitForHttpOk = (url: string, timeoutMs: number, intervalMs = 300) => {
  const startedAt = Date.now();

  return new Promise<boolean>((resolve) => {
    const check = () => {
      const req = http.get(url, (res) => {
        res.resume();

        if (res.statusCode && res.statusCode >= 200 && res.statusCode < 400) {
          resolve(true);
          return;
        }

        retry();
      });

      req.setTimeout(2_000, () => {
        req.destroy();
      });

      req.on("error", retry);
    };

    const retry = () => {
      if (Date.now() - startedAt >= timeoutMs) {
        resolve(false);
        return;
      }

      setTimeout(check, intervalMs);
    };

    check();
  });
};

const apiReadinessGate = (apiProxyTarget: string) => {
  const healthUrl = new URL("/health", apiProxyTarget).toString();
  const timeoutMs = Number(process.env.VITE_API_READY_TIMEOUT_MS || 120_000);

  return {
    name: "api-readiness-gate",
    configureServer(server) {
      server.middlewares.use(async (req, res, next) => {
        if (!req.url?.startsWith("/api")) {
          next();
          return;
        }

        const ready = await waitForHttpOk(healthUrl, timeoutMs);

        if (ready) {
          next();
          return;
        }

        res.statusCode = 503;
        res.setHeader("Content-Type", "application/json");
        res.end(JSON.stringify({ error: "Backend is still starting. Please retry shortly." }));
      });
    },
  };
};

/** Reads the final port, so `--port` on the command line is checked too. */
const devProxyGuard = (): Plugin => ({
  name: "dev-proxy-guard",
  apply: "serve",
  configResolved(config) {
    const port = config.isProduction ? config.preview.port : config.server.port;
    const refusal = refuseDevProxy(Number(port), process.env.VITE_API_PROXY_TARGET);
    if (refusal) throw new Error(`Server refused: ${refusal}`);
  },
});

/** A build states where it talks. There is no default host, so a missing value stops here. */
const assertBuildApiTarget = (mode: string) => {
  const env = { ...loadEnv(mode, process.cwd(), "VITE_"), ...process.env };
  const target = resolveBuildTarget(env.VITE_BUILD_TARGET, mode);
  if (!target) throw new Error(`Unknown VITE_BUILD_TARGET "${env.VITE_BUILD_TARGET}": use test, staging or production.`);
  const refusal = refuseBuildTarget(env.VITE_API_URL, target);
  if (refusal) throw new Error(`Build refused: ${refusal}`);
};

// https://vitejs.dev/config/
export default defineConfig(async ({ command, mode }) => {
  if (command === "build") assertBuildApiTarget(mode);

  const apiProxyTarget = process.env.VITE_API_PROXY_TARGET || "http://127.0.0.1:4000";
  const devPort = Number(process.env.VITE_DEV_PORT || 8080);
  const enableLovableTagger = mode === "development" && process.env.ENABLE_LOVABLE_TAGGER === "true";
  const lovableTagger = enableLovableTagger
    ? (await import("lovable-tagger")).componentTagger()
    : null;

  const isProd = mode === "production";

  return {
  base: isProd ? "./" : "/",
  // A test server in another worktree must not rewrite the running dev server's cache.
  cacheDir: process.env.VITE_CACHE_DIR || "node_modules/.vite-date-harvest-hub",
  server: {
    host: "::",
    port: devPort,
    watch: process.env.VITE_USE_POLLING === "true"
      ? {
          usePolling: true,
          interval: Number(process.env.VITE_POLLING_INTERVAL || 500),
        }
      : undefined,
    hmr: {
      overlay: false,
      clientPort: process.env.VITE_HMR_CLIENT_PORT
        ? Number(process.env.VITE_HMR_CLIENT_PORT)
        : undefined,
    },
    proxy: {
      "/api": {
        target: apiProxyTarget,
        changeOrigin: true,
        // Silence ECONNRESET — expected when the API server hot-restarts.
        // We intercept proxy.on so Vite's OWN built-in error logger is also
        // suppressed for these codes (adding a second listener isn't enough).
        configure: (proxy) => {
          const _on = proxy.on.bind(proxy);
          (proxy as any).on = (event: string, listener: (...args: any[]) => void) => {
            if (event !== "error") return _on(event, listener);
            return _on(event, (...args: any[]) => {
              const err = args[0] as NodeJS.ErrnoException;
              if (err?.code === "ECONNRESET" || err?.code === "ECONNREFUSED") return;
              listener(...args);
            });
          };
        },
      },
    },
  },
  // preview server (vite preview) also needs the proxy so the API works
  preview: {
    host: "::",          // listen on all interfaces → reachable from phone
    port: devPort,
    proxy: {
      "/api": {
        target: apiProxyTarget,
        changeOrigin: true,
        configure: (proxy) => {
          const _on = proxy.on.bind(proxy);
          (proxy as any).on = (event: string, listener: (...args: any[]) => void) => {
            if (event !== "error") return _on(event, listener);
            return _on(event, (...args: any[]) => {
              const err = args[0] as NodeJS.ErrnoException;
              if (err?.code === "ECONNRESET" || err?.code === "ECONNREFUSED") return;
              listener(...args);
            });
          };
        },
      },
    },
  },
  plugins: [
      devProxyGuard(),
      apiReadinessGate(apiProxyTarget),
      devSwKillSwitch(),
      react(),
      lovableTagger,
      VitePWA({
        registerType: "autoUpdate",
        includeAssets: ["favicon.ico", "favicon-32x32.png", "favicon-16x16.png", "apple-touch-icon.png", "robots.txt"],
        manifest: {
          name: "Royal Palm — Réception",
          short_name: "Royal Palm",
          description: "Gestion des réceptions de dattes Royal Palm",
          theme_color: "#107754",
          background_color: "#f8fafc",
          display: "standalone",
          orientation: "any",
          scope: "./",
          start_url: "./index.html",
          icons: [
            { src: "pwa-192x192.png", sizes: "192x192", type: "image/png" },
            { src: "pwa-512x512.png", sizes: "512x512", type: "image/png" },
            { src: "pwa-512x512.png", sizes: "512x512", type: "image/png", purpose: "maskable" },
          ],
          categories: ["productivity", "business"],
          screenshots: [],
        },
        workbox: {
          skipWaiting: true,
          clientsClaim: true,
          navigateFallback: "index.html",
          navigateFallbackDenylist: [/^\/api\//],
          // Cache JS/CSS/HTML bundles for offline use
          globPatterns: ["**/*.{js,css,html,ico,png,svg,woff2}"],
          maximumFileSizeToCacheInBytes: 3 * 1024 * 1024,
          // No API route: a tablet is shared, and answers belong to whoever asked for them.
        },
        devOptions: {
          // Enable SW in dev so you can test it without a production build
          enabled: false,
        },
      }),
    ].filter(Boolean),
  resolve: {
    alias: {
      "@": path.resolve(__dirname, "./src"),
    },
    dedupe: [
      "react",
      "react-dom",
      "react/jsx-runtime",
      "@tanstack/react-query",
    ],
  },
  };
});
