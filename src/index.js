import express from "express";
import { matchRouter } from "./routes/matches.js";
import http from "http";
import { attachWebSocketServer } from "./ws/server.js";
import { securityMiddleware } from "./config/arcjet.js";
import { commentaryRouter } from "./routes/commentary.js";

const PORT = Number(process.env.PORT || 8000);
const HOST = process.env.HOST || "0.0.0.0";

const app = express();
const server = http.createServer(app);

/*
why not attach wss to app? 
why create another http server and attach app to it 
and then pass the server to createWebSocketServer so that wss can attach itself to it

actually, app = express() doesn't actually have the low-level code to manage TCP streams and protocol switching on its own.

Node.js http Module: This is the low-level engine. It knows how to open ports and talk TCP.

Express (app): This is a "plugin" for the Node engine. It handles high-level stuff like res.json() and req.body.

WS (wss): This is another "plugin" for the Node engine. It handles the Upgrade header and persistent frames.


When you do app.listen(3000), Express actually calls http.createServer(app) secretly under the hood.

However, when you want to use WebSockets, you need direct access to that underlying HTTP server so you can tell the WebSocketServer to watch it. If you let Express hide the server inside app.listen(), you can't "point" your WebSocket server at it.
*/

// JSON middleware
app.use(express.json());

// Root GET route
app.get("/", (req, res) => {
  res.json({ message: "Welcome to the server!" });
});

app.use(securityMiddleware());

app.use("/matches", matchRouter);
app.use("/matches/:id/commentary", commentaryRouter);

const { broadcastMatchCreated, broadcastCommentary } = attachWebSocketServer(server);

app.locals.broadcastMatchCreated = broadcastMatchCreated;
app.locals.broadcastCommentary = broadcastCommentary;

// Start server
server.listen(PORT, HOST, () => {
  const baseUrl =
    HOST === "0.0.0.0" ? `http://localhost:${PORT}` : `http://${HOST}:${PORT}`;
  console.log(`Server is running at ${baseUrl}`);
  console.log(
    `WebSocket Server is running on ${baseUrl.replace("http", "ws")}/ws`,
  );
});
