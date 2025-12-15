import express from "express";
import cors from "cors";
import dotenv from "dotenv";
import mongoose from "mongoose";
import http from "http";
import { Server } from "socket.io";

import UserRouter from "./routes/UserRoutes.js";
import WorkerRouter from "./routes/WorkerRoutes.js";
import JobRouter from "./routes/JobRoutes.js";

dotenv.config();

const app = express();
const port = process.env.PORT || 5000;

/* ---------- middleware ---------- */
app.use(cors());
app.use(express.json({ limit: "50mb" }));
app.use(express.urlencoded({ extended: true, limit: "50mb" }));

/* ---------- routes ---------- */
app.use("/api/user", UserRouter);
app.use("/api/worker", WorkerRouter);
app.use("/api/jobs", JobRouter);

/* ---------- http server ---------- */
const server = http.createServer(app);

/* ---------- socket.io ---------- */
const io = new Server(server, {
  cors: {
    origin: "*",
    methods: ["GET", "POST"]
  }
});

/* 🔑 Make io available in routes */
app.set("io", io);

/* ---------- socket events ---------- */
io.on("connection", (socket) => {
  console.log("🟢 Socket connected:", socket.id);

  socket.on("join_job", ({ job_id }) => {
    socket.join(`job_${job_id}`);
    console.log(`Socket joined job_${job_id}`);
  });

  socket.on("disconnect", () => {
    console.log("🔴 Socket disconnected:", socket.id);
  });
});

/* ---------- db ---------- */
mongoose
  .connect(`${process.env.MONGO_URI}/dtrain`)
  .then(() => console.log("MongoDB connected"))
  .catch(console.error);

/* ---------- root ---------- */
app.get("/", (req, res) => {
  res.send("ML Distributed Compute Backend Running");
});

/* ---------- start ---------- */
server.listen(port, () => {
  console.log(`🚀 Backend + Socket.IO running on port ${port}`);
});
