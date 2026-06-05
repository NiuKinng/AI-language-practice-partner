import { spawn } from "node:child_process";
import { loadLocalEnv } from "./load-local-env.mjs";

loadLocalEnv();

const isWindows = process.platform === "win32";

function start(name, command, args) {
  const child = spawn(command, args, {
    stdio: "inherit",
    shell: isWindows,
    env: process.env,
  });

  child.on("exit", (code) => {
    if (code && code !== 0) {
      console.error(`${name} exited with code ${code}`);
      process.exitCode = code;
    }
  });

  return child;
}

function stop(child) {
  if (!child.pid) return;

  if (isWindows) {
    spawn("taskkill", ["/PID", String(child.pid), "/T", "/F"], {
      stdio: "ignore",
      shell: true,
    });
    return;
  }

  child.kill("SIGTERM");
}

const next = start("next", "node", [
  "node_modules/next/dist/bin/next",
  "dev",
]);
const proxy = start("realtime-proxy", "node", ["scripts/realtime-proxy.mjs"]);

for (const signal of ["SIGINT", "SIGTERM"]) {
  process.on(signal, () => {
    stop(next);
    stop(proxy);
    process.exit();
  });
}
