# 🛍️ REWIND — Self-Hosted Y2K Streetwear Store

A complete, self-hosted dropshipping storefront **and** admin panel for a **men's
Y2K clothing** brand, built for the **US market**. No SaaS lock-in, no monthly
fees — clone it, run it, own it.

It ships with a polished customer storefront (catalog, cart, USD checkout with US
states + sales tax + shipping rules) and a full admin back office for managing
products, suppliers, profit margins, and order fulfillment.

> Built with Node.js + Express + the built-in `node:sqlite` database (no native
> compilation, no external DB server). Pure-JS dependencies only.

---

## ✨ Features

### Storefront (customer-facing)
- Modern, responsive homepage with hero, categories, best-sellers & new arrivals
- Product catalog with search, category filters, and sorting
- Product detail pages with pricing, ratings, stock, and "compare-at" discounts
- Session-based shopping cart with live quantity updates
- **USD checkout** targeted at the US: full state dropdown, ZIP validation,
  flat-rate / free-shipping rules, and configurable sales tax
- Built-in **demo payment gateway** (no real charges) — drop in Stripe to go live
- Order confirmation pages with a unique, hard-to-guess order number
- Self-hosted product images (auto-generated SVGs — zero external asset dependencies)

### Admin panel (`/admin`)
- Secure login (bcrypt-hashed passwords, persistent sessions)
- **Dashboard**: revenue, gross profit, margin %, supplier spend, orders awaiting
  fulfillment, top sellers, and low-stock alerts
- **Products**: full CRUD with **dropshipping fields** — supplier name, supplier
  product URL, and per-unit cost, with live **margin** calculation
- **Orders**: filter by status, view full order detail, and a **dropship
  fulfillment workflow** (supplier order #, carrier tracking #, status, notes)
- **Settings**: store name, tagline, announcement bar, support email, shipping
  rates, free-shipping threshold, and sales-tax rate — all editable in the UI

---

## 🚀 Quick start

```bash
cd dropship-store
npm install
npm start
```

Then open:

- **Storefront** → http://localhost:3000
- **Admin panel** → http://localhost:3000/admin

On first run the app auto-creates the admin account and seeds a demo catalog of
trending men's Y2K streetwear. The default admin credentials are printed to
the console:

```
email:    admin@rewind.shop
password: changeme123
```

> ⚠️ **Change these immediately.** Set `ADMIN_EMAIL` / `ADMIN_PASSWORD` in a
> `.env` file *before* the first run, or update them later. Also set a strong
> `SESSION_SECRET` before deploying.

### Configuration

Copy `.env.example` to `.env` and adjust as needed:

```bash
cp .env.example .env
```

| Variable          | Default                | Purpose                                   |
| ----------------- | ---------------------- | ----------------------------------------- |
| `PORT`            | `3000`                 | HTTP port                                 |
| `SESSION_SECRET`  | (insecure dev default) | Signs session cookies — **set this**      |
| `ADMIN_EMAIL`     | `admin@rewind.shop`    | First-run admin login                     |
| `ADMIN_PASSWORD`  | `changeme123`          | First-run admin password                  |
| `NODE_ENV`        | `development`          | `production` enables secure cookies       |
| `DB_PATH`         | `data/store.db`        | SQLite database file location             |

### Useful scripts

```bash
npm start        # run the server
npm run dev      # run with --watch (auto-restart on changes)
npm run seed     # (re)seed admin + demo products (idempotent)
npm run reset    # wipe products & orders, then reseed
```

---

## 🛒 Placing a test order

1. Add products to the cart from the storefront.
2. Go to **Checkout**, fill in a US shipping address.
3. Use the demo test card: `4242 4242 4242 4242`, any future expiry, any CVC.
4. The order appears instantly in **Admin → Orders**, with profit calculated
   from each product's supplier cost.

---

## 💳 Going live with real payments (Stripe)

The store ships with a **demo gateway** so you can run it end-to-end with zero
setup. To accept real cards:

1. Create a [Stripe](https://stripe.com) account and grab your API keys.
2. Add them to `.env`:
   ```env
   STRIPE_PUBLISHABLE_KEY=pk_live_xxx
   STRIPE_SECRET_KEY=sk_live_xxx
   ```
3. In `src/routes/checkout.js`, replace the demo card check in the `POST
   /checkout` handler with a Stripe PaymentIntent / Checkout Session. The order
   is already created atomically — you only need to gate it on a successful
   charge and store the real `payment_ref`. (Search for the `// Demo payment
   gateway` comment.)

The data model already stores `payment_method` and `payment_ref`, so no schema
changes are required.

---

## 📦 Fulfilling orders (the dropshipping workflow)

Each product stores the **supplier** and your **per-unit cost**. When an order
comes in:

1. Open **Admin → Orders → (the order)**.
2. Place the matching order with your supplier (AliExpress, CJ Dropshipping, etc.).
3. Record the **supplier order #** and set the status to **fulfilled**.
4. Add the **carrier tracking #** and set the status to **shipped**.
5. Email the customer their tracking link.

The dashboard rolls all of this up into live **revenue, profit, and margin**
figures.

---

## 🐳 Deploying (self-hosted)

This is a standard Node app and runs anywhere Node 22+ is available.

### Docker

```bash
docker build -t rewind .
docker run -p 3000:3000 \
  -e SESSION_SECRET="$(openssl rand -hex 32)" \
  -e NODE_ENV=production \
  -v "$(pwd)/data:/app/data" \
  rewind
```

The `-v` volume keeps your SQLite database (products, orders, sessions) outside
the container so it survives restarts and redeploys.

### VPS / bare metal

```bash
npm ci --omit=dev
NODE_ENV=production SESSION_SECRET=... node server.js
```

Put it behind nginx/Caddy for TLS (the app sets `trust proxy` in production so
secure cookies work behind a reverse proxy). Use a process manager such as
`pm2`, `systemd`, or Docker to keep it running.

### Platforms (Render, Railway, Fly.io, etc.)

- Build command: `npm install`
- Start command: `npm start`
- Health check path: `/healthz`
- Persist the `data/` directory (attach a volume) so your database survives
  deploys.

---

## 🗂️ Project structure

```
dropship-store/
├── server.js                 # App entry: Express setup, sessions, routes
├── src/
│   ├── db.js                 # node:sqlite schema + settings store
│   ├── seed.js               # Admin + demo product seeding (idempotent)
│   ├── lib/                  # money, US states, cart, helpers, session store
│   ├── middleware/auth.js    # Admin auth guard
│   └── routes/               # shop, cart, checkout, admin
├── views/                    # EJS templates (shop/ + admin/ + partials/)
├── public/                   # CSS + JS assets
└── data/                     # SQLite database (gitignored)
```

---

## 🔒 Production checklist

- [ ] Set a strong, random `SESSION_SECRET`
- [ ] Change the admin email + password from the defaults
- [ ] Set `NODE_ENV=production` and serve over HTTPS
- [ ] Configure your real shipping rates and sales-tax rate in **Settings**
- [ ] Wire up Stripe (or another gateway) for live payments
- [ ] Back up the `data/store.db` file regularly

---

Built to be **owned, not rented**. Happy selling! 🚀
