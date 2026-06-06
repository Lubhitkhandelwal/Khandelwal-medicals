// src/routes/admin.js
// All routes here require the x-admin-password header

const express = require("express");
const { PrismaClient } = require("@prisma/client");
const adminAuth = require("../middleware/auth");

const router = express.Router();
const prisma = new PrismaClient();

// Apply auth to ALL admin routes
router.use(adminAuth);

// ─── ORDERS ───────────────────────────────────────────────────────────────────

// GET /admin/orders?status=placed&date=2024-06-02
router.get("/orders", async (req, res, next) => {
  try {
    const { status, date, take = 100 } = req.query;
    const where = {};

    if (status) where.status = status;
    if (date) {
      const start = new Date(date);
      const end = new Date(date);
      end.setDate(end.getDate() + 1);
      where.createdAt = { gte: start, lt: end };
    }

    const orders = await prisma.order.findMany({
      where,
      orderBy: { createdAt: "desc" },
      take: Number(take),
      include: {
        customer: { select: { name: true, phone: true } },
        items: { select: { productName: true, quantity: true, price: true } },
      },
    });

    res.json({ orders, count: orders.length });
  } catch (err) {
    next(err);
  }
});

// PATCH /admin/orders/:id/status
// Body: { status: "confirmed" | "ready" | "dispatched" | "delivered" | "picked_up" | "cancelled" }

// PATCH /admin/orders/:id  — update any order fields (rxItems, etc.)
router.patch("/orders/:id", async (req, res, next) => {
  try {
    const order = await prisma.order.update({
      where: { id: req.params.id },
      data:  req.body,
    });
    res.json({ order });
  } catch (err) {
    next(err);
  }
});

router.patch("/orders/:id/status", async (req, res, next) => {
  try {
    const { status } = req.body;
    const validStatuses = ["placed", "confirmed", "ready", "dispatched", "delivered", "picked_up", "cancelled"];

    if (!validStatuses.includes(status)) {
      return res.status(400).json({ error: `Invalid status. Use: ${validStatuses.join(", ")}` });
    }

    const order = await prisma.order.update({
      where: { id: req.params.id },
      data:  { status },
    });

    res.json({ order });
  } catch (err) {
    next(err);
  }
});

// ─── PRODUCTS ─────────────────────────────────────────────────────────────────

// GET /admin/products   (all products, including inactive)
router.get("/products", async (req, res, next) => {
  try {
    const products = await prisma.product.findMany({
      orderBy: [{ category: "asc" }, { name: "asc" }],
    });
    res.json({ products });
  } catch (err) {
    next(err);
  }
});

// POST /admin/products   — add a new product
router.post("/products", async (req, res, next) => {
  try {
    const { name, brand, category, description, mrp, price, stock, unit, imageUrl } = req.body;

    if (!name || !brand || !category || !mrp || !price) {
      return res.status(400).json({ error: "name, brand, category, mrp, and price are required" });
    }

    const product = await prisma.product.create({
      data: { name, brand, category, description, mrp, price, stock: stock || 0, unit: unit || "strip", imageUrl },
    });

    res.status(201).json({ product });
  } catch (err) {
    next(err);
  }
});

// POST /admin/products/:id/duplicate
router.post("/products/:id/duplicate", async (req, res, next) => {
  try {
    const original = await prisma.product.findUnique({
      where: { id: req.params.id },
    });

    if (!original) {
      return res.status(404).json({ error: "Product not found" });
    }

    const { id, createdAt, updatedAt, ...productData } = original;

    const duplicate = await prisma.product.create({
      data: {
        ...productData,
        name: productData.name + " (Copy)",
      },
    });

    res.status(201).json({ product: duplicate });
  } catch (err) {
    next(err);
  }
});

// PATCH /admin/products/:id   — update price, stock, active status
// router.patch("/products/:id", async (req, res, next) => {
//   try {
//     const { price, mrp, stock, isActive, description, imageUrl } = req.body;

//     const product = await prisma.product.update({
//       where: { id: req.params.id },
//       data: {
//         ...(price     !== undefined && { price }),
//         ...(mrp       !== undefined && { mrp }),
//         ...(stock     !== undefined && { stock }),
//         ...(isActive  !== undefined && { isActive }),
//         ...(description !== undefined && { description }),
//         ...(imageUrl  !== undefined && { imageUrl }),
//       },
//     });

//     res.json({ product });
//   } catch (err) {
//     next(err);
//   }
// });
router.patch("/products/:id", async (req, res, next) => {
  try {
    const { name, brand, category, price, mrp, stock, isActive, description, unit, imageUrl } = req.body;

    const product = await prisma.product.update({
      where: { id: req.params.id },
      data: {
        ...(name        !== undefined && { name }),
        ...(brand       !== undefined && { brand }),
        ...(category    !== undefined && { category }),
        ...(price       !== undefined && { price }),
        ...(mrp         !== undefined && { mrp }),
        ...(stock       !== undefined && { stock }),
        ...(isActive    !== undefined && { isActive }),
        ...(description !== undefined && { description }),
        ...(unit        !== undefined && { unit }),
        ...(imageUrl    !== undefined && { imageUrl }),
      },
    });

    res.json({ product });
  } catch (err) {
    next(err);
  }
});

// ─── DASHBOARD STATS ──────────────────────────────────────────────────────────

// GET /admin/stats
router.get("/stats", async (req, res, next) => {
  try {
    const today = new Date();
    today.setHours(0, 0, 0, 0);

    const [totalOrders, todayOrders, pendingOrders, totalRevenue, lowStock] = await Promise.all([
      prisma.order.count(),
      prisma.order.count({ where: { createdAt: { gte: today } } }),
      prisma.order.count({ where: { status: { in: ["placed", "confirmed", "ready"] } } }),
      prisma.order.aggregate({
        _sum: { total: true },
        where: { status: { not: "cancelled" } },
      }),
      prisma.product.findMany({
        where: { stock: { lte: 5 }, isActive: true },
        select: { name: true, brand: true, stock: true },
        orderBy: { stock: "asc" },
      }),
    ]);

    res.json({
      totalOrders,
      todayOrders,
      pendingOrders,
      totalRevenue: totalRevenue._sum.total || 0,
      lowStockAlerts: lowStock,
    });
  } catch (err) {
    next(err);
  }
});

// ─── STORE CONFIG ─────────────────────────────────────────────────────────────

// GET /admin/config
router.get("/config", async (req, res, next) => {
  try {
    const config = await prisma.storeConfig.findUnique({ where: { id: "store" } });
    res.json({ config });
  } catch (err) {
    next(err);
  }
});

// PATCH /admin/config
router.patch("/config", async (req, res, next) => {
  try {
    const { deliveryCharge, minOrderFree, isOpen } = req.body;
    const config = await prisma.storeConfig.update({
      where: { id: "store" },
      data: {
        ...(deliveryCharge !== undefined && { deliveryCharge }),
        ...(minOrderFree   !== undefined && { minOrderFree }),
        ...(isOpen         !== undefined && { isOpen }),
      },
    });
    res.json({ config });
  } catch (err) {
    next(err);
  }
});

// DELETE /admin/products/:id
router.delete("/products/:id", async (req, res, next) => {
  try {
    await prisma.product.delete({ where: { id: req.params.id } });
    res.json({ success: true });
  } catch (err) {
    next(err);
  }
});

module.exports = router;
