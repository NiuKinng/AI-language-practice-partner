import { spawn } from "node:child_process";

const isWindows = process.platform === "win32";
const nextBin = isWindows
  ? "node_modules/next/dist/bin/next"
  : "node_modules/next/dist/bin/next";
const url = "http://127.0.0.1:3000";

function wait(ms) {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

async function waitForServer() {
  const deadline = Date.now() + 120_000;

  while (Date.now() < deadline) {
    try {
      const response = await fetch(url);
      if (response.ok) return;
    } catch {
      await wait(500);
    }
  }

  throw new Error(`Timed out waiting for ${url}`);
}

function run(command, args, options = {}) {
  return new Promise((resolve) => {
    const child = spawn(command, args, {
      stdio: "inherit",
      shell: isWindows,
      ...options,
    });

    child.on("exit", (code) => resolve(code ?? 1));
  });
}

const server = spawn(
  "node",
  [nextBin, "dev", "-H", "127.0.0.1", "-p", "3000"],
  {
    stdio: "inherit",
    shell: isWindows,
  },
);

try {
  await waitForServer();
  const code = await run(
    "npx",
    ["playwright", "test"],
    {
      env: {
        ...process.env,
        PLAYWRIGHT_SKIP_WEBSERVER: "1",
      },
    },
  );
  process.exitCode = Number(code);
} finally {
  server.kill();
}
