// src/middleware/auth.js
// Simple password-based admin protection
// In production you'd upgrade this to JWT, but this works perfectly for a single-owner shop

module.exports = function adminAuth(req, res, next) {
  const password = req.headers["x-admin-password"];

  if (!password || password !== process.env.ADMIN_PASSWORD) {
    return res.status(401).json({ error: "Unauthorized — wrong or missing admin password" });
  }

  next();
};
