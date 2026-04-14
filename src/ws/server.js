import { WebSocket, WebSocketServer } from "ws";
import { wsArcjet } from "../config/arcjet.js";

function sendJson(socket, payload) {
  if (socket.readyState !== WebSocket.OPEN) return;
  socket.send(JSON.stringify(payload));
}

function broadcast(wss, payload) {
  // wss is the websocket server
  for (const client of wss.clients) {
    if (client.readyState !== WebSocket.OPEN) continue;
    client.send(JSON.stringify(payload));
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

    sendJson(socket, { type: "welcome" });

    socket.on("error", console.error);
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
    broadcast(wss, { type: "match_created", data: match });
  }

  return { broadcastMatchCreated };
}
