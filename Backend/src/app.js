// src/app.js
require("dotenv").config();
const express = require("express");
const cors = require("cors");
const rateLimit = require("express-rate-limit");

const productRoutes = require("./routes/products");
const orderRoutes  = require("./routes/orders");
const adminRoutes  = require("./routes/admin");

const app = express();

// ─── Middleware ───────────────────────────────────────────────────────────────
// app.use(cors({
//   origin: process.env.FRONTEND_URL || "*",  // lock this down in production
// }));
app.use(cors({
  origin: "*",
  methods: ["GET", "POST", "PATCH", "DELETE", "OPTIONS"],
  allowedHeaders: ["Content-Type", "x-admin-password"],
}));
app.use(express.json());

const limiter = rateLimit({
  windowMs: 15 * 60 * 1000,
  max: 50,
  message: { error: 'Too many requests, please try again later.' }
});
app.use('/api/', limiter);

// ─── Health check ─────────────────────────────────────────────────────────────
app.get("/health", (req, res) => {
  res.json({ status: "ok", store: "Khandelwal Medicals" });
});

// ─── Routes ───────────────────────────────────────────────────────────────────
app.use("/api/products", productRoutes);
app.use("/api/orders",   orderRoutes);
app.use("/admin",        adminRoutes);

// ─── Error handler ────────────────────────────────────────────────────────────
app.use((err, req, res, next) => {
  console.error(err.stack);
  res.status(err.status || 500).json({
    error: err.message || "Something went wrong",
  });
});

// ─── Start ────────────────────────────────────────────────────────────────────
const PORT = process.env.PORT || 4000;
app.listen(PORT, () => {
  console.log(`✅ Khandelwal Medicals API running on http://localhost:${PORT}`);
});
