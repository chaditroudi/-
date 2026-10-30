import { spawn } from "node:child_process";

/** Windows STATUS_CONTROL_C_EXIT — benign when user stops dev server. */
const WIN_CTRL_C = 3221225786;

let shuttingDown = false;
const children = new Map();

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

const killTree = (child) => {
  if (!child?.pid || child.killed) {
    return;
  }

  if (process.platform === "win32") {
    spawn("taskkill", ["/pid", String(child.pid), "/T", "/F"], {
      stdio: "ignore",
      windowsHide: true,
      shell: false,
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
  children.forEach(killTree);

  setTimeout(() => {
    process.exit(exitCode);
  }, 250).unref();
};

const isBenignExit = (code) => code === 0 || code === 130 || code === 143 || code === WIN_CTRL_C;

const start = (name, command, { stopOnExit = true } = {}) => {
  const child = spawn(command, {
    shell: true,
    stdio: ["ignore", "pipe", "pipe"],
    env: process.env,
    windowsHide: true,
  });

  children.set(name, child);
  prefixStream(child.stdout, name, process.stdout);
  prefixStream(child.stderr, name, process.stderr);

  child.on("exit", (code, signal) => {
    children.delete(name);

    if (shuttingDown || !stopOnExit) {
      return;
    }

    if (isBenignExit(code) || signal === "SIGINT" || signal === "SIGTERM") {
      stopAll(code || 0);
      return;
    }

    if (code && code !== 0) {
      console.error(`[${name}] exited with code ${code}`);
      stopAll(code);
    }
  });

  return child;
};

process.on("SIGINT", () => stopAll(130));
process.on("SIGTERM", () => stopAll(143));
process.on("exit", () => {
  shuttingDown = true;
  children.forEach(killTree);
});

const bootstrap = async () => {
  const build = start("build", "npx tsc -p server/tsconfig.json", { stopOnExit: false });

  await new Promise((resolve, reject) => {
    build.on("exit", (code) => {
      if (shuttingDown) {
        resolve();
        return;
      }
      if (code && code !== 0) {
        reject(new Error(`Initial TypeScript build failed (exit ${code}).`));
        return;
      }
      resolve();
    });
  });

  if (shuttingDown) {
    return;
  }

  // Avoid `concurrently` on Windows — nested shells trap Ctrl+C with "Terminer O/N ?".
  start("tsc", "npx tsc -p server/tsconfig.json --watch --preserveWatchOutput");
  start("api", "node --watch server-dist/index.js");
};

bootstrap().catch((error) => {
  console.error(`[server-watch] ${error instanceof Error ? error.message : String(error)}`);
  stopAll(1);
});
