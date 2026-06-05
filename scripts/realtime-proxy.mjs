import { WebSocketServer, WebSocket } from "ws";
import { loadLocalEnv } from "./load-local-env.mjs";

loadLocalEnv();

const port = Number(process.env.REALTIME_PROXY_PORT ?? 3101);
const aliyunUrl =
  process.env.ALIYUN_REALTIME_WS_URL ??
  "wss://dashscope.aliyuncs.com/api-ws/v1/realtime";
const apiKey = process.env.DASHSCOPE_API_KEY;

function buildUpstreamUrl(model) {
  const url = new URL(aliyunUrl);
  if (model) {
    url.searchParams.set("model", model);
  }
  return url.toString();
}

function sendJson(socket, payload) {
  if (socket.readyState === WebSocket.OPEN) {
    socket.send(JSON.stringify(payload));
  }
}

const server = new WebSocketServer({
  port,
  path: "/aliyun/realtime",
});

server.on("connection", (client, request) => {
  const requestUrl = new URL(request.url ?? "", `http://${request.headers.host}`);
  const model = requestUrl.searchParams.get("model");

  if (!apiKey) {
    sendJson(client, {
      type: "error",
      error: {
        message: "DASHSCOPE_API_KEY is not configured.",
      },
    });
    client.close(1011, "Missing DASHSCOPE_API_KEY");
    return;
  }

  const upstream = new WebSocket(buildUpstreamUrl(model), {
    headers: {
      Authorization: `Bearer ${apiKey}`,
    },
  });

  upstream.on("open", () => {
    sendJson(client, {
      type: "proxy.ready",
      provider: "aliyun-qwen-omni",
    });
  });

  upstream.on("message", (data, isBinary) => {
    if (client.readyState === WebSocket.OPEN) {
      client.send(data, { binary: isBinary });
    }
  });

  upstream.on("error", (error) => {
    sendJson(client, {
      type: "error",
      error: {
        message: error instanceof Error ? error.message : "Aliyun upstream error.",
      },
    });
  });

  upstream.on("close", (code, reason) => {
    if (client.readyState === WebSocket.OPEN) {
      client.close(code, reason.toString());
    }
  });

  client.on("message", (data, isBinary) => {
    if (upstream.readyState === WebSocket.OPEN) {
      upstream.send(data, { binary: isBinary });
      return;
    }

    if (upstream.readyState === WebSocket.CONNECTING) {
      upstream.once("open", () => upstream.send(data, { binary: isBinary }));
    }
  });

  client.on("close", () => {
    if (
      upstream.readyState === WebSocket.OPEN ||
      upstream.readyState === WebSocket.CONNECTING
    ) {
      upstream.close();
    }
  });
});

server.on("listening", () => {
  console.log(`Realtime proxy listening on ws://localhost:${port}/aliyun/realtime`);
});

server.on("error", (error) => {
  console.error(error);
  process.exitCode = 1;
});
