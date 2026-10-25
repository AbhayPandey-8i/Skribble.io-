import express from "express";
import http from "http";
import cors from "cors";
import dotenv from "dotenv";
import { Server } from "socket.io";
import connectDB from "./config/db.js";
import roomRoutes from "./routes/roomRoutes.js";
import roomSocket from "./socket/roomSocket.js";
import gameSocket from "./socket/gameSocket.js";
import path from "path";

dotenv.config();

const _dirname = path.resolve();

const app = express();
const server = http.createServer(app);

app.use(
  cors({
    origin: process.env.CLIENT_URL,
    credentials: true,
  }),
);

app.use(express.json());

app.use("/api/rooms", roomRoutes);

const io = new Server(server, {
  cors: {
    origin: process.env.CLIENT_URL,
    methods: ["GET", "POST"],
    credentials: true,
  },
});

roomSocket(io);
gameSocket(io);

// app.get("/", (req, res) => {
//   res.status(200).json({
//     message: "Skribble Clone API is running",
//   });
// });

const PORT = process.env.PORT || 5000;

app.use(express.static(path.join(_dirname, "/frontend/dist")));
app.get("/*splat", (_, res) => {
  res.sendFile(path.resolve(_dirname, "frontend", "dist", "index.html"));
});

const startServer = async () => {
  await connectDB();

  server.listen(PORT, () => {
    console.log(`Server running on port ${PORT}`);
  });
};

startServer();
