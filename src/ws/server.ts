import { WebSocket, WebSocketServer } from "ws";
import { Server } from "http";

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

  wss.on("connection", (ws) => {
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
