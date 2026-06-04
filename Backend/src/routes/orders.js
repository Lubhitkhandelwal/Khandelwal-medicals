// src/routes/orders.js
const express = require("express");
const { PrismaClient } = require("@prisma/client");
const Razorpay = require("razorpay");
const crypto = require("crypto");

const router = express.Router();
const prisma = new PrismaClient();

// Razorpay instance — keys come from .env
let razorpay = null;
function getRazorpay() {
  if (!razorpay) {
    razorpay = new Razorpay({
      key_id:     process.env.RAZORPAY_KEY_ID,
      key_secret: process.env.RAZORPAY_KEY_SECRET,
    });
  }
  return razorpay;
}


// Helper: generate readable order number e.g. KM-20240602-0042
async function generateOrderNumber() {
  const today = new Date().toISOString().slice(0, 10).replace(/-/g, "");
  const count = await prisma.order.count();
  return `KM-${today}-${String(count + 1).padStart(4, "0")}`;
}

// ─── POST /api/orders ─────────────────────────────────────────────────────────
// Body: { customer, items, rxItems, fulfillment, deliveryAddress, paymentMethod }
router.post("/", async (req, res, next) => {
  try {
    const { customer, items, rxItems, fulfillment, deliveryAddress, paymentMethod } = req.body;

    // 1. Validate required fields
    if (!customer?.name || !customer?.phone) {
      return res.status(400).json({ error: "Customer name and phone are required" });
    }
    if (!items?.length && !rxItems?.length) {
      return res.status(400).json({ error: "Cart is empty" });
    }
    if (fulfillment === "delivery" && !deliveryAddress) {
      return res.status(400).json({ error: "Delivery address is required" });
    }

    // 2. Load products from DB and validate stock (skip if only rx order)
    let subtotal = 0;
    let productMap = {};

    if (items?.length) {
      const productIds = items.map((i) => i.productId);
      const dbProducts = await prisma.product.findMany({
        where: { id: { in: productIds }, isActive: true, requiresRx: false },
      });

      if (dbProducts.length !== productIds.length) {
        return res.status(400).json({ error: "One or more products are unavailable" });
      }

      productMap = Object.fromEntries(dbProducts.map((p) => [p.id, p]));

      for (const item of items) {
        const p = productMap[item.productId];
        if (p.stock < item.quantity) {
          return res.status(400).json({
            error: `Insufficient stock for ${p.name} (available: ${p.stock})`,
          });
        }
      }

      subtotal = items.reduce((sum, item) => {
        return sum + productMap[item.productId].price * item.quantity;
      }, 0);
    }

    // 3. Calculate totals
    const storeConfig = await prisma.storeConfig.findUnique({ where: { id: "store" } });


    const deliveryCharge =
      fulfillment === "delivery" && subtotal < storeConfig.minOrderFree
        ? storeConfig.deliveryCharge
        : 0;

    const total = subtotal + deliveryCharge;

    // 4. Upsert customer (by phone)
    const dbCustomer = await prisma.customer.upsert({
      where:  { phone: customer.phone },
      update: { name: customer.name },
      create: { name: customer.name, phone: customer.phone },
    });

    // 5. Create order in DB
    const orderNumber = await generateOrderNumber();

    const order = await prisma.order.create({
      data: {
        orderNumber,
        customerId:      dbCustomer.id,
        fulfillment,
        deliveryAddress: fulfillment === "delivery" ? deliveryAddress : null,
        paymentMethod,
        subtotal,
        deliveryCharge,
        total,
        latitude:  req.body.latitude  || null,
        longitude: req.body.longitude || null,
        rxItems:   rxItems || [],
        items: {
          create: (items || []).map((item) => {
            const p = productMap[item.productId];
            return {
              productId:    p.id,
              productName:  p.name,
              productBrand: p.brand,
              mrp:          p.mrp,
              price:        p.price,
              quantity:     item.quantity,
            };
          }),
        },
      },
      include: { items: true },
    });

    // 6. Deduct stock
    for (const item of (items || [])) {
      await prisma.product.update({
        where: { id: item.productId },
        data:  { stock: { decrement: item.quantity } },
      });
    }

    // 7. If online payment (UPI / card) → create Razorpay order
    if (paymentMethod !== "cod") {
      const rzpOrder = await getRazorpay().orders.create({
        amount:   Math.round(total * 100), // paise
        currency: "INR",
        receipt:  order.orderNumber,
        notes: {
          orderNumber: order.orderNumber,
          customerPhone: customer.phone,
        },
      });

      await prisma.order.update({
        where: { id: order.id },
        data:  { razorpayOrderId: rzpOrder.id },
      });

      return res.status(201).json({
        order: { id: order.id, orderNumber: order.orderNumber, total },
        razorpay: {
          orderId: rzpOrder.id,
          amount:  rzpOrder.amount,
          currency: "INR",
          keyId:   process.env.RAZORPAY_KEY_ID,
        },
      });
    }

    // 8. COD — just return order confirmation
    res.status(201).json({
      order: {
        id:          order.id,
        orderNumber: order.orderNumber,
        total,
        fulfillment,
        paymentMethod,
      },
    });
  } catch (err) {
    next(err);
  }
});

// ─── POST /api/orders/verify-payment ─────────────────────────────────────────
router.post("/verify-payment", async (req, res, next) => {
  try {
    const { razorpay_order_id, razorpay_payment_id, razorpay_signature, orderId } = req.body;

    const body = razorpay_order_id + "|" + razorpay_payment_id;
    const expectedSignature = crypto
      .createHmac("sha256", process.env.RAZORPAY_KEY_SECRET)
      .update(body)
      .digest("hex");

    if (expectedSignature !== razorpay_signature) {
      return res.status(400).json({ error: "Payment verification failed" });
    }

    await prisma.order.update({
      where: { id: orderId },
      data: {
        razorpayPaymentId: razorpay_payment_id,
        paymentStatus:     "paid",
        status:            "confirmed",
      },
    });

    res.json({ success: true });
  } catch (err) {
    next(err);
  }
});

// ─── GET /api/orders/:id ──────────────────────────────────────────────────────
router.get("/:id", async (req, res, next) => {
  try {
    const order = await prisma.order.findUnique({
      where: { id: req.params.id },
      include: {
        items:    true,
        customer: { select: { name: true, phone: true } },
      },
    });
    if (!order) return res.status(404).json({ error: "Order not found" });
    res.json({ order });
  } catch (err) {
    next(err);
  }
});

// GET /api/orders/track/:phone
router.get("/track/:phone", async (req, res, next) => {
  try {
    const orders = await prisma.order.findMany({
      where: { customer: { phone: req.params.phone } },
      orderBy: { createdAt: "desc" },
      include: { items: true },
    });
    res.json({ orders });
  } catch (err) {
    next(err);
  }
});

module.exports = router;
