import "dotenv/config";
import mongoose from "mongoose";
import app from "./app.js";

const port = Number(process.env.PORT) || 5000;
const mongoUri = process.env.MONGODB_URI || process.env.MONGO_URI;

try {
  await mongoose.connect(mongoUri);
  app.listen(port, () => {
    console.log(`Orbit CRM API listening on http://localhost:${port}`);
  });
} catch (error) {
  console.error("Could not start the CRM API:", error.message);
  process.exitCode = 1;
}
