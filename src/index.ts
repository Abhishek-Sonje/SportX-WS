import express from "express";
import matchRouter from "./routes/matches";
import http from "http";
import { attatchWebSocketServer } from "./ws/server";
import { securityMiddleware } from "./arcjet";
import commentaryRouter from "./routes/commentary";

const app = express();
const server = http.createServer(app);

app.use(express.json());

const PORT = parseInt(process.env.PORT || "3000");
const HOST = process.env.HOST || "localhost";

app.get("/", (req, res) => {
  res.send("Hello, World!");
});

app.use(securityMiddleware());

app.use("/matches", matchRouter);
app.use("/matches/:id/commentary", commentaryRouter);

const { broadcastMatchCreated, broadcastCommentary } = attatchWebSocketServer(server);
app.locals.broadcastMatchCreated = broadcastMatchCreated;
app.locals.broadcastCommentary = broadcastCommentary;

server.listen(PORT, HOST, () => {
  const baseUrl =
    HOST === "0.0.0.0" ? `http://localhost:${PORT}` : `http://${HOST}:${PORT}`;
  console.log(`Server is running on ${baseUrl}`);
  console.log(`ws server is running on ${baseUrl.replace(/^http/, "ws")}/ws`);
});
