import { WebSocket, WebSocketServer } from "ws";

function sendJson(socket, payload) {
  if (socket.readyState !== WebSocket.OPEN) return;
  socket.send(JSON.stringify(payload));
}

function broadcast(wss, payload) {
  // wss is the websocket server
  for (const client of wss.clients) {
    if (client.readyState !== WebSocket.OPEN) return;
    client.send(JSON.stringify(payload));
  }
}

export function attachWebSocketServer(server) {
  const wss = new WebSocketServer({
    server, // this is the http server which listens for and handles normal REST requests
    // wss attaches itself to this server to listen for upgrade requests
    // same port for both services
    path: "/ws", // requests made to this path are eligible for websocket upgrades
    maxPayload: 1024 * 1024, // (1mb)
  });

  wss.on("connection", (socket, request) => {
    // socket represents the active connection, the actual duplex pipe connecting the server and the browser tab that requested an upgrade
    // it is unique for each connection

    // can add userinfo to the socket object like socket.userId or socket.isAdFree like we did for req.user so that we dont have to look up into the db for each request
    sendJson(socket, { type: "welcome" });

    socket.on("error", console.error);
  });

  function broadcastMatchCreated(match) {
    broadcast(wss, { type: "match_created", data: match });
  }

  return { broadcastMatchCreated };
}
