import { Router } from "express";
import mongoose from "mongoose";
import bcrypt from "bcryptjs";
import User from "../models/User.js";
import { requireAuth, requireRole } from "../middleware/auth.js";
import { normalizeEmail, validateEmail, validateImage, validateName, validatePassword } from "../utils/validation.js";

const router = Router();
router.use(requireAuth, requireRole("Admin"));

function publicUser(user) {
  return {
    id: user.id,
    name: user.name,
    email: user.email,
    image: user.image,
    role: user.role,
    status: user.status,
  };
}

router.get("/", async (req, res) => {
  const users = await User.find().sort({ name: 1 });
  res.json({ users: users.map(publicUser) });
});

router.get("/:id", async (req, res) => {
  if (!mongoose.isValidObjectId(req.params.id)) {
    res.status(400).json({ message: "The user id is invalid." });
    return;
  }
  const user = await User.findById(req.params.id);
  if (!user) {
    res.status(404).json({ message: "User not found." });
    return;
  }
  res.json({ user: publicUser(user) });
});

router.post("/", async (req, res) => {
  const name = typeof req.body.name === "string" ? req.body.name.trim() : "";
  const email = normalizeEmail(req.body.email);
  const { password, role = "Member" } = req.body;
  const image = req.body.image || "";
  const status = req.body.status === undefined ? "Active" : req.body.status;

  if (!validateName(name) || !validateEmail(email) || !validatePassword(password) || !["Admin", "Manager", "Member"].includes(role) || !["Active", "Inactive"].includes(status) || !validateImage(image)) {
    res.status(400).json({ message: "Enter valid account details, a password with at least 8 characters, and a supported profile image." });
    return;
  }

  const passwordHash = await bcrypt.hash(password, 12);
  const user = await User.create({ name, email, passwordHash, role, image, status });
  res.status(201).json({ user: publicUser(user) });
});

router.patch("/:id", async (req, res) => {
  if (!mongoose.isValidObjectId(req.params.id)) {
    res.status(400).json({ message: "The user id is invalid." });
    return;
  }
  const user = await User.findById(req.params.id);
  if (!user) {
    res.status(404).json({ message: "User not found." });
    return;
  }

  const updates = {};
  if (req.body.name !== undefined) {
    const name = typeof req.body.name === "string" ? req.body.name.trim() : "";
    if (!validateName(name)) {
      res.status(400).json({ message: "Name must be between 2 and 80 characters." });
      return;
    }
    updates.name = name;
  }
  if (req.body.email !== undefined) {
    const email = normalizeEmail(req.body.email);
    if (!validateEmail(email)) {
      res.status(400).json({ message: "Enter a valid email address." });
      return;
    }
    updates.email = email;
  }
  if (req.body.role !== undefined) {
    if (!["Admin", "Manager", "Member"].includes(req.body.role)) {
      res.status(400).json({ message: "Role must be Admin, Manager, or Member." });
      return;
    }
    updates.role = req.body.role;
  }
  if (req.body.status !== undefined) {
    if (!["Active", "Inactive"].includes(req.body.status)) {
      res.status(400).json({ message: "Status must be Active or Inactive." });
      return;
    }
    updates.status = req.body.status;
  }
  if (req.body.image !== undefined) {
    if (!validateImage(req.body.image)) {
      res.status(400).json({ message: "Profile image must be a supported image smaller than 550 KB." });
      return;
    }
    updates.image = req.body.image;
  }
  if (req.body.password !== undefined && req.body.password !== "") {
    if (!validatePassword(req.body.password)) {
      res.status(400).json({ message: "Password must be between 8 and 128 characters." });
      return;
    }
    updates.passwordHash = await bcrypt.hash(req.body.password, 12);
  }
  if (user.id === req.user.id && ((updates.role && updates.role !== "Admin") || updates.status === "Inactive")) {
    res.status(400).json({ message: "You cannot remove your own Admin access or deactivate your account." });
    return;
  }
  if (Object.keys(updates).length === 0) {
    res.status(400).json({ message: "Provide at least one user field to update." });
    return;
  }

  const removesAdminAccess = user.role === "Admin" && user.status === "Active"
    && ((updates.role !== undefined && updates.role !== "Admin") || updates.status === "Inactive");
  if (removesAdminAccess) {
    const activeAdminCount = await User.countDocuments({ role: "Admin", status: "Active" });
    if (activeAdminCount <= 1) {
      res.status(400).json({ message: "At least one active Admin account must remain." });
      return;
    }
  }

  Object.assign(user, updates);
  await user.save();
  res.json({ user: publicUser(user) });
});

router.delete("/:id", async (req, res) => {
  if (req.params.id === req.user.id) {
    res.status(400).json({ message: "You cannot delete your own account." });
    return;
  }
  if (!mongoose.isValidObjectId(req.params.id)) {
    res.status(400).json({ message: "The user id is invalid." });
    return;
  }
  const existing = await User.findById(req.params.id);
  if (!existing) {
    res.status(404).json({ message: "User not found." });
    return;
  }
  if (existing.role === "Admin" && existing.status === "Active") {
    const activeAdminCount = await User.countDocuments({ role: "Admin", status: "Active" });
    if (activeAdminCount <= 1) {
      res.status(400).json({ message: "At least one active Admin account must remain." });
      return;
    }
  }
  const user = await User.findByIdAndDelete(req.params.id);
  if (!user) {
    res.status(404).json({ message: "User not found." });
    return;
  }
  res.json({ ok: true });
});

export default router;
