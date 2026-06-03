// src/routes/products.js
const express = require("express");
const { PrismaClient } = require("@prisma/client");

const router = express.Router();
const prisma = new PrismaClient();

// GET /api/products
// Query params: ?category=Pain+Relief  ?search=dolo  ?inStock=true
router.get("/", async (req, res, next) => {
  try {
    const { category, search, inStock } = req.query;

    const where = {
      isActive: true,
      requiresRx: false,   // never expose prescription drugs online
    };

    if (category) where.category = category;
    if (inStock === "true") where.stock = { gt: 0 };
    if (search) {
      where.OR = [
        { name:  { contains: search, mode: "insensitive" } },
        { brand: { contains: search, mode: "insensitive" } },
        { category: { contains: search, mode: "insensitive" } },
      ];
    }

    const products = await prisma.product.findMany({
      where,
      orderBy: { name: "asc" },
      select: {
        id: true, name: true, brand: true, category: true,
        description: true, mrp: true, price: true,
        stock: true, unit: true, imageUrl: true,
      },
    });

    res.json({ products });
  } catch (err) {
    next(err);
  }
});

// GET /api/products/categories   — list of all unique categories
router.get("/categories", async (req, res, next) => {
  try {
    const result = await prisma.product.findMany({
      where: { isActive: true },
      select: { category: true },
      distinct: ["category"],
      orderBy: { category: "asc" },
    });
    res.json({ categories: result.map((r) => r.category) });
  } catch (err) {
    next(err);
  }
});

// GET /api/products/:id
router.get("/:id", async (req, res, next) => {
  try {
    const product = await prisma.product.findUnique({
      where: { id: req.params.id },
    });
    if (!product || !product.isActive) {
      return res.status(404).json({ error: "Product not found" });
    }
    res.json({ product });
  } catch (err) {
    next(err);
  }
});

// Public categories endpoint
// router.get('/categories', async (req, res) => {
//   const categories = await prisma.category.findMany({
//     where: { isActive: true },
//     orderBy: { sortOrder: 'asc' }
//   });
//   res.json(categories);
// });

module.exports = router;
