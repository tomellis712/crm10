import "dotenv/config";
import express from "express";
import session from "express-session";
import MongoStore from "connect-mongo";
import cors from "cors";
import helmet from "helmet";
import rateLimit from "express-rate-limit";
import mongoose from "mongoose";
import authRoutes from "./routes/auth.js";
import userRoutes from "./routes/users.js";

const mongoUri = process.env.MONGODB_URI || process.env.MONGO_URI;

const clientOrigins = new Set(
  (process.env.CLIENT_ORIGIN || "http://localhost:5173")
    .split(",")
    .map((origin) => origin.trim())
    .filter(Boolean),
);
const isProduction = process.env.NODE_ENV === "production" || process.env.VERCEL === "1";

if (!mongoUri) throw new Error("MONGODB_URI (or MONGO_URI) must be set.");
if (isProduction && !process.env.SESSION_SECRET) throw new Error("SESSION_SECRET must be set in production.");


const app = express();
if (isProduction) app.set("trust proxy", 1);
app.use(helmet());
app.use(cors({
  origin(origin, callback) {
    callback(null, !origin || clientOrigins.has(origin));
  },
  credentials: true,
}));
app.use((req, res, next) => {
  const origin = req.get("origin");
  const requestOrigin = `${req.protocol}://${req.get("host")}`;
  if (["POST", "PUT", "PATCH", "DELETE"].includes(req.method)
    && origin
    && origin !== requestOrigin
    && !clientOrigins.has(origin)) {
    res.status(403).json({ message: "Request origin is not allowed." });
    return;
  }
  next();
});
app.use(express.json({ limit: "1mb" }));
app.use((req, res, next) => {
  req.body = req.body || {};
  next();
});
app.use(session({
  name: "orbit.sid",
  secret: process.env.SESSION_SECRET || "orbit-crm-development-only-session-secret",
  resave: false,
  saveUninitialized: false,
  store: MongoStore.create({
    mongoUrl: mongoUri,
    collectionName: "sessions",
    ttl: 7 * 24 * 60 * 60,
  }),
  cookie: {
    httpOnly: true,
    secure: isProduction,
    sameSite: "lax",
    maxAge: 7 * 24 * 60 * 60 * 1000,
    path: "/",
  },
}));

const authLimiter = rateLimit({
  windowMs: 15 * 60 * 1000,
  limit: 10,
  standardHeaders: "draft-8",
  legacyHeaders: false,
  message: { message: "Too many sign-in attempts. Try again in 15 minutes." },
});

console.log("OK!");

app.get("/api/health", (req, res) => res.json({ status: "ok", database: mongoose.connection.readyState === 1 ? "connected" : "disconnected" }));
app.use("/api/auth/login", authLimiter);
app.use("/api/auth/signup", authLimiter);
app.use("/api/auth", authRoutes);
app.use("/api/users", userRoutes);
app.use("/api", (req, res) => res.status(404).json({ message: "API endpoint not found." }));
app.use((error, req, res, next) => {
  if (res.headersSent) {
    next(error);
    return;
  }
  if (error.code === 11000) {
    res.status(409).json({ message: "An account with this email already exists." });
    return;
  }
  if (error.name === "ValidationError" || error.name === "CastError") {
    res.status(400).json({ message: "The submitted account data is invalid." });
    return;
  }
  console.error(error);
  res.status(500).json({ message: "The server could not complete the request." });
});

export default app;
