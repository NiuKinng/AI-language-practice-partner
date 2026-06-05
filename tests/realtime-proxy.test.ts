import { spawn, type ChildProcessWithoutNullStreams } from "node:child_process";
import { once } from "node:events";
import net from "node:net";
import { afterEach, describe, expect, it } from "vitest";
import { WebSocket, WebSocketServer } from "ws";

const proxyProcesses: ChildProcessWithoutNullStreams[] = [];
const servers: WebSocketServer[] = [];

afterEach(async () => {
  for (const child of proxyProcesses.splice(0)) {
    if (process.platform === "win32") {
      spawn("taskkill", ["/PID", String(child.pid), "/T", "/F"], {
        stdio: "ignore",
        shell: true,
      });
    } else {
      child.kill();
    }
  }
  for (const server of servers.splice(0)) {
    await new Promise<void>((resolve) => server.close(() => resolve()));
  }
});

function waitForMessage(socket: WebSocket) {
  return new Promise<string>((resolve) => {
    socket.once("message", (data) => resolve(data.toString()));
  });
}

function getFreePort() {
  return new Promise<number>((resolve) => {
    const server = net.createServer();
    server.listen(0, () => {
      const address = server.address();
      const port = typeof address === "object" && address ? address.port : 0;
      server.close(() => resolve(port));
    });
  });
}

async function startMockAliyunServer(port: number) {
  const server = new WebSocketServer({ port, path: "/api-ws/v1/realtime" });
  servers.push(server);
  await once(server, "listening");
  return server;
}

async function startProxy(port: number, upstreamPort: number) {
  const child = spawn("node", ["scripts/realtime-proxy.mjs"], {
    cwd: process.cwd(),
    env: {
      ...process.env,
      REALTIME_PROXY_PORT: String(port),
      ALIYUN_REALTIME_WS_URL: `ws://localhost:${upstreamPort}/api-ws/v1/realtime`,
      DASHSCOPE_API_KEY: "dashscope-test-secret",
    },
    shell: false,
  });
  proxyProcesses.push(child);

  await new Promise<void>((resolve, reject) => {
    const timeout = setTimeout(() => reject(new Error("proxy startup timed out")), 10_000);
    child.stdout.on("data", (data) => {
      if (data.toString().includes("Realtime proxy listening")) {
        clearTimeout(timeout);
        resolve();
      }
    });
    child.stderr.on("data", (data) => {
      const text = data.toString();
      if (text.includes("EADDRINUSE")) {
        clearTimeout(timeout);
        reject(new Error(text));
      }
    });
  });

  return child;
}

describe("realtime proxy", () => {
  it("forwards browser events to Aliyun without leaking the DashScope key", async () => {
    const upstreamPort = await getFreePort();
    const proxyPort = await getFreePort();
    const upstream = await startMockAliyunServer(upstreamPort);
    const upstreamConnection = new Promise<WebSocket>((resolve) => {
      upstream.once("connection", (socket, request) => {
        expect(request.headers.authorization).toBe("Bearer dashscope-test-secret");
        expect(request.url).toContain("model=qwen-test");
        resolve(socket);
      });
    });

    await startProxy(proxyPort, upstreamPort);

    const browserSocket = new WebSocket(
      `ws://localhost:${proxyPort}/aliyun/realtime?model=qwen-test`,
    );
    await once(browserSocket, "open");
    const upstreamSocket = await upstreamConnection;

    browserSocket.send(JSON.stringify({ type: "input_audio_buffer.append", audio: "abc" }));
    expect(await waitForMessage(upstreamSocket)).toContain("input_audio_buffer.append");

    upstreamSocket.send(JSON.stringify({ type: "response.text.done", text: "hello" }));
    const browserMessage = await waitForMessage(browserSocket);
    expect(browserMessage).toContain("hello");
    expect(browserMessage).not.toContain("dashscope-test-secret");

    browserSocket.close();
  });
});
