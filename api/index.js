import "dotenv/config";
import mongoose from "mongoose";
import app from "./app.js";

const mongoUri = process.env.MONGODB_URI || process.env.MONGO_URI;

if (!mongoUri) {
  throw new Error("MONGODB_URI (or MONGO_URI) must be set.");
}

let connectionPromise;

function connectDatabase() {
  if (mongoose.connection.readyState === 1) return Promise.resolve(mongoose.connection);
  if (!connectionPromise) {
    connectionPromise = mongoose.connect(mongoUri).catch((error) => {
      connectionPromise = undefined;
      throw error;
    });
  }
  return connectionPromise;
}

// Vercel invokes this function for every request. The connection is cached
// between warm invocations so MongoDB is not reconnected unnecessarily.
export default async function handler(req, res) {
  try {
    await connectDatabase();
    return app(req, res);
  } catch (error) {
    console.error("MongoDB connection error:", error);
    return res.status(500).json({ message: "Database connection failed." });
  }
}
