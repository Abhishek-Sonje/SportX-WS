import { RawData, WebSocket, WebSocketServer } from "ws";
import { Server } from "http";
import { wsArcjet } from "../arcjet";
import { match } from "assert";

const matchSubscribers = new Map();

function subscribe(ws: WebSocket, matchId: string): void {
  if (!matchSubscribers.has(matchId)) {
    matchSubscribers.set(matchId, new Set());
  }

  matchSubscribers.get(matchId).add(ws);
}
function unSubscribe(ws: WebSocket, matchId: string): void {
  const subscribers = matchSubscribers.get(matchId);

  if (!subscribers) {
    return;
  }

  subscribers.delete(ws);

  if (subscribers.size == 0) {
    matchSubscribers.delete(matchId);
  }
}
function cleanUpSubscriptions(ws: WebSocket): void {
  for (const matchId of ws.subscriptions) {
    unSubscribe(ws, matchId);
  }
}

function broadcastToMatch(matchId: string, payload: unknown): void {
  if (!matchSubscribers.has(matchId)) {
    return;
  }
  const subscribers = matchSubscribers.get(matchId);

  if (!subscribers || subscribers.size === 0) {
    return;
  }

  const msg = JSON.stringify(payload);

  for (const client of subscribers) {
    if (client.readyState !== WebSocket.OPEN) {
      continue;
    }

    client.send(msg);
  }
}

function handleMessage(ws: WebSocket, data: RawData): void {
  let message;
  try {
    message = JSON.parse(data.toString());
  } catch (error) {
    sendJson(ws, { type: "error", error: "Invalid JSON" });
    return;
  }

  if (message.type === "subscribe" && Number.isInteger(message.matchId)) {
    subscribe(ws, message.matchId);
    ws.subscriptions.add(message.matchId);
    sendJson(ws, { type: "subscribed", matchId: message.matchId });
    return;
  }
  if (message.type === "unsubscribe" && Number.isInteger(message.matchId)) {
    unSubscribe(ws, message.matchId);
    ws.subscriptions.delete(message.matchId);
    sendJson(ws, { type: "unsubscribed", matchId: message.matchId });
    return;
  }
  sendJson(ws, {
    type: "error",
    error: "Unknown message type or invalid matchId",
  });
}
function sendJson(ws: WebSocket, payload: unknown): void {
  if (ws.readyState !== WebSocket.OPEN) {
    return;
  }
  ws.send(JSON.stringify(payload));
}

function broadcastToAll(ws: WebSocketServer, payload: unknown): void {
  for (const client of ws.clients) {
    if (client.readyState !== WebSocket.OPEN) {
      continue;
    }

    sendJson(client, payload);
  }
}

export function attatchWebSocketServer(server: Server): {
  broadcastMatchCreated: (match: unknown) => void;
  broadcastCommentary: (matchId: string, commentary: unknown) => void;
} {
  const wss = new WebSocketServer({
    noServer: true,
    maxPayload: 1024 * 1024,
  });

  server.on("upgrade", async (req, socket, head) => {
    if (req.url !== "/ws") {
      socket.destroy();
      return;
    }
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

    ws.subscriptions = new Set();
    ws.on("pong", () => {
      ws.isAlive = true;
    });

    sendJson(ws, {
      type: "welcome",
    });

    ws.on("message", (data) => {
      handleMessage(ws, data);
    });

    ws.on("error", (error) => {
      ws.terminate();
    });

    ws.on("close", () => {
      cleanUpSubscriptions(ws);
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
    broadcastToAll(wss, {
      type: "match_created",
      data: match,
    });
  }

  function broadcastCommentary(matchId: string, commentary: unknown) {
    broadcastToMatch(matchId, {
      type: "commentary_update",
      data: commentary,
    });
  }

  return { broadcastMatchCreated, broadcastCommentary };
}
