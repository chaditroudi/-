import { spawn } from "node:child_process";

const children = [];

const start = (command) => {
  const child = spawn(command, {
    shell: true,
    stdio: "inherit",
    env: process.env,
  });
  children.push(child);
  return child;
};

const stopAll = () => {
  children.forEach((child) => {
    if (!child.killed) {
      child.kill();
    }
  });
};

process.on("SIGINT", stopAll);
process.on("SIGTERM", stopAll);
process.on("exit", stopAll);

const bootstrap = async () => {
  const build = start("npx tsc -p server/tsconfig.json");

  build.on("exit", (code) => {
    if (code && code !== 0) {
      process.exit(code);
      return;
    }

    start('npx concurrently -k -n "tsc,api" "npx tsc -p server/tsconfig.json --watch --preserveWatchOutput" "node --watch server-dist/index.js"');
  });
};

bootstrap();
