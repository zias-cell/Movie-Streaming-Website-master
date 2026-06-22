'use strict';

const path = require('node:path');
const express = require('express');
const session = require('express-session');

const { db, getAllSettings, getSettingInt } = require('./src/db');
const SqliteSessionStore = require('./src/lib/session-store');
const { getCartCount } = require('./src/lib/cart');
const { formatCents, centsToDollars } = require('./src/lib/money');
const { seedOnBoot } = require('./src/seed');

const _navCategories = db.prepare(
  "SELECT DISTINCT category FROM products WHERE active = 1 ORDER BY category"
);

const app = express();
const PORT = process.env.PORT || 3000;
const IS_PROD = process.env.NODE_ENV === 'production';

// Seed admin + demo catalog on first boot (idempotent).
const boot = seedOnBoot();

// View engine
app.set('view engine', 'ejs');
app.set('views', path.join(__dirname, 'views'));

// Behind a reverse proxy (nginx, Render, Fly, etc.) trust the first hop so
// secure cookies and req.ip work correctly.
if (IS_PROD) app.set('trust proxy', 1);

// Body parsing + static assets
app.use(express.urlencoded({ extended: true }));
app.use(express.static(path.join(__dirname, 'public'), { maxAge: IS_PROD ? '7d' : 0 }));

// Sessions (persisted in SQLite)
app.use(
  session({
    name: 'rewind.sid',
    secret: process.env.SESSION_SECRET || 'dev-insecure-secret-change-me',
    resave: false,
    saveUninitialized: false,
    store: new SqliteSessionStore(db),
    cookie: {
      httpOnly: true,
      sameSite: 'lax',
      secure: IS_PROD,
      maxAge: 14 * 24 * 60 * 60 * 1000,
    },
  })
);

// Shared template locals
app.use((req, res, next) => {
  const settings = getAllSettings();
  res.locals.store = settings;
  res.locals.storeName = settings.store_name;
  res.locals.announcement = settings.announcement;
  res.locals.freeShipThreshold = getSettingInt('free_shipping_threshold_cents', 5000);
  res.locals.cartCount = getCartCount(req);
  res.locals.navCategories = _navCategories.all().map((r) => r.category);
  res.locals.currentPath = req.path;
  res.locals.adminEmail = req.session.adminEmail || null;
  res.locals.money = formatCents;
  res.locals.toDollars = centsToDollars;
  res.locals.year = new Date().getFullYear();
  next();
});

// Routes
app.use('/', require('./src/routes/shop'));
app.use('/cart', require('./src/routes/cart'));
app.use('/', require('./src/routes/checkout'));
app.use('/admin', require('./src/routes/admin'));

// Health check (useful for hosting platforms)
app.get('/healthz', (req, res) => res.json({ ok: true }));

// 404
app.use((req, res) => {
  res.status(404).render('shop/404', { title: 'Not Found' });
});

// Error handler
app.use((err, req, res, next) => {
  console.error(err);
  res.status(500).render('shop/404', { title: 'Something went wrong', serverError: true });
});

app.listen(PORT, () => {
  console.log('');
  console.log(`  ${boot && boot.admin ? '🛍️  ' : ''}${getAllSettings().store_name} is running`);
  console.log(`  → Storefront:  http://localhost:${PORT}`);
  console.log(`  → Admin panel: http://localhost:${PORT}/admin`);
  if (boot.admin && boot.admin.created) {
    console.log('');
    console.log(`  First-run admin account created:`);
    console.log(`    email:    ${boot.admin.email}`);
    console.log(`    password: ${boot.admin.password}`);
    console.log(`    (change this in Admin → Settings or via env vars)`);
  }
  console.log('');
});
