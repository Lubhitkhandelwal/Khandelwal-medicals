# Khandelwal Medicals — Backend API

Node.js + Express + PostgreSQL (Supabase) + Razorpay

---

## Local Setup (do this first)

### 1. Install dependencies
```bash
npm install
```

### 2. Set up Supabase (free PostgreSQL database)
1. Go to https://supabase.com → Sign up (free)
2. Click **New Project** → name it `khandelwal-medicals`
3. Choose region: **South Asia (Mumbai)** → Create project
4. Go to **Settings → Database → Connection string → URI**
5. Copy the connection string

### 3. Create your .env file
```bash
cp .env.example .env
```
Then open `.env` and paste your Supabase connection string as `DATABASE_URL`.

### 4. Create database tables
```bash
npx prisma db push
```
This reads `prisma/schema.prisma` and creates all 5 tables in your database.

### 5. Seed sample products
```bash
node prisma/seed.js
```
Adds 20 OTC medicines + store config to the database.

### 6. Set up Razorpay
1. Go to https://razorpay.com → Sign up
2. **Settings → API Keys → Generate Test Key**
3. Copy `Key ID` and `Key Secret` into `.env`
4. Use test mode until you're ready to go live

### 7. Run the server
```bash
npm run dev
```
Server starts at: http://localhost:4000

---

## Test the API

```bash
# Health check
curl http://localhost:4000/health

# Get all products
curl http://localhost:4000/api/products

# Get categories
curl http://localhost:4000/api/products/categories

# Search products
curl "http://localhost:4000/api/products?search=dolo"

# Filter by category
curl "http://localhost:4000/api/products?category=Pain+Relief"

# Place a COD order
curl -X POST http://localhost:4000/api/orders \
  -H "Content-Type: application/json" \
  -d '{
    "customer": { "name": "Test Customer", "phone": "9999999999" },
    "items": [{ "productId": "PASTE_PRODUCT_ID_HERE", "quantity": 2 }],
    "fulfillment": "delivery",
    "deliveryAddress": "123 Test Street, Kumher",
    "paymentMethod": "cod"
  }'

# Admin stats (use your ADMIN_PASSWORD from .env)
curl http://localhost:4000/admin/stats \
  -H "x-admin-password: khandelwal@admin123"
```

---

## Deploy to Railway (10 minutes)

1. **Install Railway CLI:**
   ```bash
   npm install -g @railway/cli
   ```

2. **Login and deploy:**
   ```bash
   railway login
   railway init
   railway up
   ```

3. **Set environment variables in Railway dashboard:**
   - Go to your project → Variables
   - Add all variables from your `.env` file

4. **Get your live URL:**
   Railway gives you a URL like `https://medplus-backend.up.railway.app`

5. **Update frontend:**
   In your `index.html`, replace `http://localhost:4000` with your Railway URL.

---

## Connect Frontend to Backend

In your `index.html`, find the `// TODO: fetch from API` comments and replace:

```js
// Replace the PRODUCTS array with:
const res = await fetch("http://localhost:4000/api/products");
const { products } = await res.json();

// Replace the hardcoded placeOrder() with:
const res = await fetch("http://localhost:4000/api/orders", {
  method: "POST",
  headers: { "Content-Type": "application/json" },
  body: JSON.stringify({
    customer: { name, phone },
    items: cart.map(item => ({ productId: item.id, quantity: item.qty })),
    fulfillment,
    deliveryAddress: address,
    paymentMethod,
  }),
});
const data = await res.json();
```

For Razorpay (UPI/card), if `data.razorpay` is returned, open the Razorpay checkout modal. I'll build that snippet for you when you're ready.

---

## API Reference

| Method | Route | Auth | Description |
|--------|-------|------|-------------|
| GET | `/health` | No | Server status |
| GET | `/api/products` | No | All active OTC products |
| GET | `/api/products/categories` | No | Unique category list |
| GET | `/api/products/:id` | No | Single product |
| POST | `/api/orders` | No | Place an order |
| POST | `/api/orders/verify-payment` | No | Verify Razorpay payment |
| GET | `/api/orders/:id` | No | Order details |
| GET | `/admin/orders` | Yes | All orders |
| PATCH | `/admin/orders/:id/status` | Yes | Update order status |
| GET | `/admin/products` | Yes | All products (incl. inactive) |
| POST | `/admin/products` | Yes | Add product |
| PATCH | `/admin/products/:id` | Yes | Update product |
| GET | `/admin/stats` | Yes | Dashboard stats |
| GET | `/admin/config` | Yes | Store config |
| PATCH | `/admin/config` | Yes | Update delivery charge etc |

Admin auth: add header `x-admin-password: YOUR_PASSWORD`
