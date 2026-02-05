import express from "express";
import matchRouter from "./routes/matches";
import http from "http";
import { attatchWebSocketServer } from "./ws/server";

const app = express();
const server = http.createServer(app);

app.use(express.json());

const PORT = process.env.PORT || 3000;
const HOST = process.env.HOST || "localhost";

app.get("/", (req, res) => {
  res.send("Hello, World!");
});

app.use("/matches", matchRouter);

const { broadcastMatchCreated } = attatchWebSocketServer(server);
app.locals.broadcastMatchCreated = broadcastMatchCreated;

server.listen(PORT, () => {
  const baseUrl =
    HOST === "0.0.0.0" ? `http://localhost:${PORT}` : `http://${HOST}:${PORT}`;
  console.log(`Server is running on ${baseUrl}`);
  console.log(`ws server is running on ${baseUrl.replace(/^http/, "ws")}/ws`);
});
