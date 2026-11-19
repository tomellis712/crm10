import User from "../models/User.js";

export async function requireAuth(req, res, next) {
  if (!req.session.userId) {
    res.status(401).json({ message: "Sign in to continue." });
    return;
  }

  const user = await User.findById(req.session.userId);
  if (!user || user.status !== "Active") {
    req.session.destroy((error) => {
      if (error) {
        next(error);
        return;
      }
      res.status(401).json({ message: "Your session is no longer active. Sign in again." });
    });
    return;
  }

  req.user = user;
  next();
}

export function requireRole(...roles) {
  return (req, res, next) => {
    if (!req.user || !roles.includes(req.user.role)) {
      res.status(403).json({ message: "You do not have permission to perform this action." });
      return;
    }
    next();
  };
}
