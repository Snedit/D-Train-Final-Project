import express from "express";
import cors from "cors";
import dotenv from "dotenv";
import mongoose from "mongoose";
import http from "http";
import { Server } from "socket.io";

import UserRouter from "./routes/UserRoutes.js";
import WorkerRouter from "./routes/WorkerRoutes.js";
import JobRouter from "./routes/JobRoutes.js";
import PaymentRouter from "./routes/PaymentRoutes.js";
import morgan from "morgan";

dotenv.config();

const app = express();
const port = process.env.PORT || 5000;

/* ---------- middleware ---------- */
app.use(cors({
  origin: "*", // In production, specify your frontend URL
  credentials: true
}));
app.use(express.json({ limit: "50mb" }));
app.use(express.urlencoded({ extended: true, limit: "50mb" }));

app.use(morgan("dev"));

/* ---------- http server ---------- */
const server = http.createServer(app);

/* ---------- socket.io ---------- */
const io = new Server(server, {
  cors: {
    origin: "*",
    methods: ["GET", "POST"],
    credentials: true
  },
  pingTimeout: 60000,
  pingInterval: 25000
});

/* 🔑 Make io available in routes */
app.set("io", io);

/* ---------- socket events ---------- */
io.on("connection", (socket) => {
  console.log("🟢 Socket connected:", socket.id);

  // ✅ Support both old and new room naming conventions
  socket.on("join_job", ({ job_id, jobId }) => {
    const id = job_id || jobId;
    socket.join(`job:${id}`);
    socket.join(`job_${id}`); // Legacy support
    console.log(`✅ Socket ${socket.id} joined job:${id}`);
  });

  socket.on("leave_job", ({ job_id, jobId }) => {
    const id = job_id || jobId;
    socket.leave(`job:${id}`);
    socket.leave(`job_${id}`);
    console.log(`👋 Socket ${socket.id} left job:${id}`);
  });

  socket.on("disconnect", (reason) => {
    console.log("🔴 Socket disconnected:", socket.id, "Reason:", reason);
  });

  socket.on("error", (error) => {
    console.error("❌ Socket error:", error);
  });
});

// ✅ Global socket event emitter helper
export const emitJobUpdate = (io, jobId, eventType, data) => {
  console.log(`📡 Emitting ${eventType} for job ${jobId}`);

  // Emit to specific job room
  io.to(`job:${jobId}`).emit(eventType, data);

  // Also emit globally for dashboards
  io.emit(eventType, data);
};

// Make emitter available to routes
app.set("emitJobUpdate", emitJobUpdate);

/* ---------- db ---------- */
mongoose
  .connect(`${process.env.MONGO_URI}/dtrain`)
  .then(() => console.log("✅ MongoDB connected"))
  .catch((err) => {
    console.error("❌ MongoDB connection error:", err);
    process.exit(1);
  });

/* ---------- routes ---------- */
app.use("/api/user", UserRouter);
app.use("/api/worker", WorkerRouter);
app.use("/api/jobs", JobRouter);
app.use("/api/payment", PaymentRouter);

/* ---------- health check ---------- */
app.get("/", (req, res) => {
  res.json({
    status: "running",
    message: "ML Distributed Compute Backend",
    socketConnections: io.engine.clientsCount,
    timestamp: new Date().toISOString()
  });
});

/* ---------- 404 handler ---------- */
app.use((req, res) => {
  res.status(404).json({
    message: "Route not found",
    path: req.path
  });
});

/* ---------- error handler ---------- */
app.use((err, req, res, next) => {
  console.error("❌ Server error:", err);
  res.status(500).json({
    message: "Internal server error",
    error: process.env.NODE_ENV === 'development' ? err.message : undefined
  });
});

/* ---------- start ---------- */
server.listen(port, () => {
  console.log(`🚀 Backend + Socket.IO running on port ${port}`);
  console.log(`📡 Socket.IO ready for connections`);
  console.log(`🌐 CORS enabled for all origins`);
});

/* ---------- graceful shutdown ---------- */
process.on('SIGTERM', () => {
  console.log('👋 SIGTERM received, shutting down gracefully');
  server.close(() => {
    console.log('✅ Server closed');
    mongoose.connection.close(false, () => {
      console.log('✅ MongoDB connection closed');
      process.exit(0);
    });
  });
});

process.on('SIGINT', () => {
  console.log('👋 SIGINT received, shutting down gracefully');
  server.close(() => {
    console.log('✅ Server closed');
    mongoose.connection.close(false, () => {
      console.log('✅ MongoDB connection closed');
      process.exit(0);
    });
  });
});