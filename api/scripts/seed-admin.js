import "dotenv/config";
import bcrypt from "bcryptjs";
import mongoose from "mongoose";
import User from "../models/User.js";
import { normalizeEmail, validateEmail, validateName, validatePassword } from "../utils/validation.js";

async function seedAdmin() {
  const name = process.env.ADMIN_NAME || "Workspace Admin";
  const email = normalizeEmail(process.env.ADMIN_EMAIL);
  const password = process.env.ADMIN_PASSWORD;

  const mongoUri = process.env.MONGODB_URI || process.env.MONGO_URI;
  if (!mongoUri) throw new Error("MONGODB_URI (or MONGO_URI) must be set.");
  if (!validateName(name) || !validateEmail(email) || !validatePassword(password)) {
    throw new Error("Set ADMIN_NAME, ADMIN_EMAIL, and an ADMIN_PASSWORD with at least 8 characters in .env.");
  }

  await mongoose.connect(mongoUri);
  const existing = await User.findOne({ email });
  if (existing) {
    console.log(`An account already exists for ${email}; no account was changed.`);
    return;
  }

  const passwordHash = await bcrypt.hash(password, 12);
  await User.create({ name, email, passwordHash, role: "Admin", status: "Active" });
  console.log(`Created the Admin account for ${email}.`);
}

try {
  await seedAdmin();
} catch (error) {
  console.error("Could not create the Admin account:", error.message);
  process.exitCode = 1;
} finally {
  await mongoose.disconnect();
}
