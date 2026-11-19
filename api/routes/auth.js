import { Router } from "express";
import bcrypt from "bcryptjs";
import User from "../models/User.js";
import { requireAuth } from "../middleware/auth.js";
import { normalizeEmail, validateEmail, validateImage, validateName, validatePassword } from "../utils/validation.js";

const router = Router();

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

function regenerateSession(req, userId) {
  return new Promise((resolve, reject) => {
    req.session.regenerate((error) => {
      if (error) {
        reject(error);
        return;
      }
      req.session.userId = userId;
      req.session.save((saveError) => saveError ? reject(saveError) : resolve());
    });
  });
}

router.post("/signup", async (req, res) => {
  const name = typeof req.body.name === "string" ? req.body.name.trim() : "";
  const email = normalizeEmail(req.body.email);
  const { password } = req.body;
  const image = req.body.image || "";

  if (!validateName(name) || !validateEmail(email) || !validatePassword(password) || !validateImage(image)) {
    res.status(400).json({ message: "Enter a name, valid email, password with at least 8 characters, and a valid profile image." });
    return;
  }

  const passwordHash = await bcrypt.hash(password, 12);
  const user = await User.create({ name, email, passwordHash, image, role: "Member", status: "Active" });
  await regenerateSession(req, user.id);
  res.status(201).json({ user: publicUser(user) });
});

router.post("/login", async (req, res) => {
  const email = normalizeEmail(req.body.email);
  const password = req.body.password;
  if (!validateEmail(email) || typeof password !== "string" || password.length === 0 || password.length > 128) {
    res.status(400).json({ message: "Enter a valid email address and password." });
    return;
  }

  const user = await User.findOne({ email }).select("+passwordHash");
  if (!user || user.status !== "Active" || !(await bcrypt.compare(password, user.passwordHash))) {
    res.status(401).json({ message: "Email or password is incorrect, or this account is inactive." });
    return;
  }

  await regenerateSession(req, user.id);
  res.json({ user: publicUser(user) });
});

router.get("/me", requireAuth, (req, res) => {
  res.json({ user: publicUser(req.user) });
});

router.patch("/profile", requireAuth, async (req, res) => {
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
  if (req.body.image !== undefined) {
    if (!validateImage(req.body.image)) {
      res.status(400).json({ message: "Profile image must be a supported image smaller than 550 KB." });
      return;
    }
    updates.image = req.body.image;
  }
  if (Object.keys(updates).length === 0) {
    res.status(400).json({ message: "Provide at least one profile field to update." });
    return;
  }

  Object.assign(req.user, updates);
  await req.user.save();
  res.json({ user: publicUser(req.user) });
});

router.post("/logout", (req, res, next) => {
  req.session.destroy((error) => {
    if (error) {
      next(error);
      return;
    }
    res.clearCookie("orbit.sid", {
      httpOnly: true,
      sameSite: "lax",
      secure: process.env.NODE_ENV === "production",
      path: "/",
    });
    res.json({ ok: true });
  });
});

export default router;
