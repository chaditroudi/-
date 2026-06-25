import { spawn } from "node:child_process";
import http from "node:http";

const children = new Map();
let shuttingDown = false;

const apiPort = Number(process.env.PORT || 4000);
const frontendPort = Number(process.env.VITE_DEV_PORT || 8080);
const backendReadyTimeoutMs = Number(process.env.DEV_BACKEND_READY_TIMEOUT_MS || 120_000);
const healthUrl = `http://127.0.0.1:${apiPort}/health`;

const prefixStream = (stream, name, output) => {
  let buffer = "";

  stream.on("data", (chunk) => {
    buffer += chunk.toString();
    const lines = buffer.split(/\r?\n/);
    buffer = lines.pop() || "";

    lines.forEach((line) => {
      if (line.length > 0) {
        output.write(`[${name}] ${line}\n`);
      }
    });
  });

  stream.on("end", () => {
    if (buffer.length > 0) {
      output.write(`[${name}] ${buffer}\n`);
    }
  });
};

const start = (name, command, env = {}) => {
  const child = spawn(command, {
    shell: true,
    stdio: ["inherit", "pipe", "pipe"],
    env: { ...process.env, ...env },
  });

  children.set(name, child);
  prefixStream(child.stdout, name, process.stdout);
  prefixStream(child.stderr, name, process.stderr);

  child.on("exit", (code, signal) => {
    children.delete(name);

    if (shuttingDown) {
      return;
    }

    if (code && code !== 0) {
      console.error(`[${name}] exited with code ${code}`);
      stopAll(code);
      return;
    }

    if (signal) {
      console.error(`[${name}] exited with signal ${signal}`);
      stopAll(1);
    }
  });

  return child;
};

const stopChild = (child) => {
  if (child.killed || !child.pid) {
    return;
  }

  if (process.platform === "win32") {
    spawn("taskkill", ["/pid", String(child.pid), "/T", "/F"], {
      stdio: "ignore",
      windowsHide: true,
    });
    return;
  }

  child.kill("SIGTERM");
};

const stopAll = (exitCode = 0) => {
  if (shuttingDown) {
    return;
  }

  shuttingDown = true;
  children.forEach(stopChild);

  setTimeout(() => {
    process.exit(exitCode);
  }, 250).unref();
};

const waitForHealth = (url, timeoutMs = backendReadyTimeoutMs, intervalMs = 500) => {
  const startedAt = Date.now();

  return new Promise((resolve, reject) => {
    const check = () => {
      const req = http.get(url, (res) => {
        res.resume();

        if (res.statusCode && res.statusCode >= 200 && res.statusCode < 400) {
          resolve();
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
        reject(new Error(`Backend did not become ready at ${url} within ${timeoutMs / 1000}s.`));
        return;
      }

      setTimeout(check, intervalMs);
    };

    check();
  });
};

process.on("SIGINT", () => stopAll(130));
process.on("SIGTERM", () => stopAll(143));
process.on("exit", () => {
  shuttingDown = true;
  children.forEach(stopChild);
});

const bootstrap = async () => {
  console.log("Starting Royal Palm dev stack...");
  console.log(`Backend health: ${healthUrl}`);
  console.log(`Frontend: http://localhost:${frontendPort}`);

  start("api", "npm run server:dev");

  try {
    await waitForHealth(healthUrl);
  } catch (error) {
    console.error(`[dev] ${error instanceof Error ? error.message : String(error)}`);
    stopAll(1);
    return;
  }

  if (shuttingDown) {
    return;
  }

  console.log("[dev] Backend is ready. Starting frontend...");
  start("web", "npm run dev:client", {
    VITE_API_PROXY_TARGET: `http://127.0.0.1:${apiPort}`,
    VITE_DEV_PORT: String(frontendPort),
  });
};

bootstrap();
