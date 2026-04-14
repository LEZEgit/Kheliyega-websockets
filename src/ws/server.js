import { WebSocket, WebSocketServer } from "ws";
import { wsArcjet } from "../config/arcjet.js";

const matchSubscribers = new Map();
const MAX_SUBSCRIPTIONS_PER_SOCKET = 100;
const MAX_MATCH_ID = 1000000; // Sensible upper bound for match IDs

function subscribe(matchId, socket) {
  // Validate matchId: must be positive integer and within bounds
  if (!Number.isInteger(matchId) || matchId <= 0 || matchId > MAX_MATCH_ID) {
    return { success: false, error: "Invalid match ID" };
  }

  // Initialize socket.subscriptions if not already done
  if (!socket.subscriptions) {
    socket.subscriptions = new Set();
  }

  // Guard against duplicate subscriptions
  if (socket.subscriptions.has(matchId)) {
    return { success: false, error: "Already subscribed to this match" };
  }

  // Enforce per-socket subscription cap
  if (socket.subscriptions.size >= MAX_SUBSCRIPTIONS_PER_SOCKET) {
    return { success: false, error: "Subscription limit reached" };
  }

  // Add to matchSubscribers only if this is a new subscription
  if (!matchSubscribers.has(matchId)) {
    matchSubscribers.set(matchId, new Set());
  }

  matchSubscribers.get(matchId).add(socket);
  socket.subscriptions.add(matchId);

  return { success: true };
}

function unsubscribe(matchId, socket) {
  if (!matchSubscribers.has(matchId)) return; // matchId hasn't been subscribed ever

  const subscribers = matchSubscribers.get(matchId);

  // In JavaScript, when you call mp.get(matchId), you are retrieving a reference to the object stored in the Map, not a copy of it.

  subscribers.delete(socket);

  if (subscribers.size === 0) {
    matchSubscribers.delete(matchId);
  }
}

function cleanupSubscriptions(socket) {
  for (const matchId of socket.subscriptions) {
    unsubscribe(matchId, socket);
  }
}

function sendJson(socket, payload) {
  if (socket.readyState !== WebSocket.OPEN) return;
  socket.send(JSON.stringify(payload));
}

function broadcastToAll(wss, payload) {
  // wss is the websocket server
  for (const client of wss.clients) {
    if (client.readyState !== WebSocket.OPEN) continue;
    client.send(JSON.stringify(payload));
  }
}

function broadcastToMatch(matchId, payload) {
  const subscribers = matchSubscribers.get(matchId);

  if (!subscribers || subscribers.size === 0) return;

  const message = JSON.stringify(payload);

  for (const client of subscribers) {
    if (client.readyState === WebSocket.OPEN) {
      client.send(message);
    }
  }
}

function handleMessage(socket, data) {
  let message;

  try {
    message = JSON.parse(data.toString());
  } catch {
    sendJson(socket, { type: "error", message: "Invalid JSON" });
    return;
  }

  if (message?.type === "subscribe") {
    const result = subscribe(message.matchId, socket);
    if (result.success) {
      sendJson(socket, { type: "subscribed", matchId: message.matchId });
    } else {
      sendJson(socket, {
        type: "error",
        message: result.error,
        matchId: message.matchId,
      });
    }
  }

  if (message?.type === "unsubscribe" && Number.isInteger(message.matchId)) {
    unsubscribe(message.matchId, socket);
    socket.subscriptions.delete(message.matchId);
    sendJson(socket, { type: "unsubscribed", matchId: message.matchId });
  }
}

export function attachWebSocketServer(server) {
  const wss = new WebSocketServer({
    noServer: true,
    path: "/ws",
    maxPayload: 1024 * 1024, // (1mb)
  });

  // Handle HTTP upgrade requests before socket allocation
  server.on("upgrade", async (req, socket, head) => {
    // Only handle WebSocket upgrade requests to /ws path
    if (req.url !== "/ws") {
      socket.destroy();
      return;
    }

    // Apply Arcjet protection before accepting the connection
    if (wsArcjet) {
      try {
        const decision = await wsArcjet.protect(req);

        if (decision.isDenied()) {
          const statusCode = decision.reason.isRateLimit() ? 429 : 403;
          const message = decision.reason.isRateLimit()
            ? "Rate limit exceeded"
            : "Access Denied";

          socket.write(`HTTP/1.1 ${statusCode} ${message}\r\n`);
          socket.write("Content-Type: application/json\r\n");
          socket.write("Content-Length: 0\r\n");
          socket.write("\r\n");
          socket.destroy();
          return;
        }
      } catch (e) {
        console.error("WS upgrade protection error", e);
        socket.write("HTTP/1.1 503 Service Unavailable\r\n");
        socket.write("Content-Length: 0\r\n");
        socket.write("\r\n");
        socket.destroy();
        return;
      }
    }

    // Validation passed, proceed with WebSocket upgrade
    wss.handleUpgrade(req, socket, head, (ws) => {
      wss.emit("connection", ws, req);
    });
  });

  wss.on("connection", (socket, req) => {
    // socket represents the active connection, the actual duplex pipe connecting the server and the browser tab that requested an upgrade
    // it is unique for each connection

    // can add userinfo to the socket object like socket.userId or socket.isAdFree like we did for req.user so that we dont have to look up into the db for each request

    socket.isAlive = true;
    socket.on("pong", () => {
      socket.isAlive = true;
    });

    socket.subscriptions = new Set();

    sendJson(socket, { type: "welcome" });

    socket.on("message", (data) => {
      handleMessage(socket, data);
    });

    socket.on("error", (error) => {
      console.error("WebSocket error", error);
      socket.terminate();
    });
    socket.on("error", () => {
      console.error;
      socket.terminate();
    });

    socket.on("close", () => {
      cleanupSubscriptions(socket);
    });
  });

  const interval = setInterval(() => {
    wss.clients.forEach((ws) => {
      if (ws.isAlive === false) return ws.terminate();

      ws.isAlive = false;
      ws.ping();
    });
  }, 30000);

  wss.on("close", () => clearInterval(interval));

  function broadcastMatchCreated(match) {
    broadcastToAll(wss, { type: "match_created", data: match });
  }

  function broadcastCommentary(matchId, comment) {
    broadcastToMatch(matchId, { type: "commentary", data: comment });
  }

  return { broadcastCommentary, broadcastMatchCreated };
}
