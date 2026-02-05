import { WebSocket, WebSocketServer } from "ws";
import { Server } from "http";
import { wsArcjet } from "../arcjet";

function sendJson(ws: WebSocket, payload: unknown): void {
  if (ws.readyState !== WebSocket.OPEN) {
    return;
  }
  ws.send(JSON.stringify(payload));
}

function broadcast(ws: WebSocketServer, payload: unknown): void {
  for (const client of ws.clients) {
    if (client.readyState !== WebSocket.OPEN) {
      continue;
    }

    sendJson(client, payload);
  }
}

export function attatchWebSocketServer(server: Server): {
  broadcastMatchCreated: (match: unknown) => void;
} {
  const wss = new WebSocketServer({
    server,
    path: "/ws",
    maxPayload: 1024 * 1024,
  });

  server.on("upgrade", async (req, socket, head) => {
    if (wsArcjet) {
      try {
        const decision = await wsArcjet.protect(req);

        if (decision.isDenied()) {
          const isRateLimit = decision.reason.isRateLimit();
          const statusCode = isRateLimit ? 429 : 403;
          const statusText = isRateLimit
            ? "Too Many Requests"
            : "Access Denied";

          socket.write(
            `HTTP/1.1 ${statusCode} ${statusText}\r\n` +
              "Connection: close\r\n" +
              "Content-Type: text/plain\r\n" +
              `Content-Length: ${Buffer.byteLength(statusText)}\r\n` +
              "\r\n" +
              statusText,
          );
          socket.destroy();
          return;
        }
      } catch (error) {
        console.error("Arcjet WebSocket protection error:", error);
        socket.write(
          "HTTP/1.1 503 Service Unavailable\r\n" +
            "Connection: close\r\n" +
            "Content-Type: text/plain\r\n" +
            "Content-Length: 21\r\n" +
            "\r\n" +
            "Service Unavailable",
        );
        socket.destroy();
        return;
      }
    }

    wss.handleUpgrade(req, socket, head, (ws) => {
      wss.emit("connection", ws, req);
    });
  });

  wss.on("connection", async (ws, req) => {
    ws.isAlive = true;

    ws.on("pong", () => {
      ws.isAlive = true;
    });

    sendJson(ws, {
      type: "welcome",
    });

    ws.on("error", (error) => {
      console.error("WebSocket error:", error);
    });

    setInterval(() => {
      wss.clients.forEach((client) => {
        if (client.isAlive === false) {
          return client.terminate();
        }
        client.isAlive = false;
        client.ping();
      });
    }, 30000);
  });

  function broadcastMatchCreated(match: unknown) {
    broadcast(wss, {
      type: "match_created",
      data: match,
    });
  }

  return { broadcastMatchCreated };
}
