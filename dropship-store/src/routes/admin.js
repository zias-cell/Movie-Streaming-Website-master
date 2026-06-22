'use strict';

const express = require('express');
const bcrypt = require('bcryptjs');
const router = express.Router();
const { db, getAllSettings, setSetting } = require('../db');
const { requireAdmin } = require('../middleware/auth');
const { slugify } = require('../lib/helpers');
const { dollarsToCents } = require('../lib/money');

const ORDER_STATUSES = ['paid', 'fulfilled', 'shipped', 'delivered', 'cancelled', 'refunded'];
const COUNTED = "status NOT IN ('cancelled','refunded')";

// ---------------------------------------------------------------------------
// Authentication
// ---------------------------------------------------------------------------
router.get('/login', (req, res) => {
  if (req.session.adminId) return res.redirect('/admin');
  res.render('admin/login', { title: 'Admin Login', error: null, layout: false });
});

router.post('/login', (req, res) => {
  const email = String(req.body.email || '').trim().toLowerCase();
  const password = String(req.body.password || '');
  const admin = db.prepare('SELECT * FROM admins WHERE email = ?').get(email);
  if (!admin || !bcrypt.compareSync(password, admin.password_hash)) {
    return res.status(401).render('admin/login', {
      title: 'Admin Login',
      error: 'Invalid email or password.',
      layout: false,
    });
  }
  req.session.adminId = admin.id;
  req.session.adminEmail = admin.email;
  const dest = req.session.returnTo || '/admin';
  delete req.session.returnTo;
  res.redirect(dest);
});

router.post('/logout', (req, res) => {
  delete req.session.adminId;
  delete req.session.adminEmail;
  res.redirect('/admin/login');
});

// Everything below requires authentication.
router.use(requireAdmin);

// ---------------------------------------------------------------------------
// Dashboard
// ---------------------------------------------------------------------------
router.get('/', (req, res) => {
  const revenue =
    db.prepare(`SELECT COALESCE(SUM(total_cents),0) AS v FROM orders WHERE ${COUNTED}`).get().v;
  const supplierSpend =
    db.prepare(`SELECT COALESCE(SUM(supplier_cost_cents),0) AS v FROM orders WHERE ${COUNTED}`).get().v;
  const itemProfit = db
    .prepare(
      `SELECT COALESCE(SUM((oi.price_cents - oi.supplier_cost_cents) * oi.quantity),0) AS v
       FROM order_items oi JOIN orders o ON o.id = oi.order_id WHERE o.${COUNTED}`
    )
    .get().v;
  const orderCount = db.prepare(`SELECT COUNT(*) AS n FROM orders WHERE ${COUNTED}`).get().n;
  const awaiting = db.prepare("SELECT COUNT(*) AS n FROM orders WHERE status = 'paid'").get().n;
  const productCount = db.prepare('SELECT COUNT(*) AS n FROM products').get().n;
  const lowStock = db
    .prepare('SELECT * FROM products WHERE active = 1 AND stock < 5 ORDER BY stock ASC LIMIT 8')
    .all();
  const recentOrders = db
    .prepare('SELECT * FROM orders ORDER BY created_at DESC LIMIT 8')
    .all();
  const topProducts = db
    .prepare(
      `SELECT oi.title, SUM(oi.quantity) AS units,
              SUM((oi.price_cents - oi.supplier_cost_cents) * oi.quantity) AS profit
       FROM order_items oi JOIN orders o ON o.id = oi.order_id WHERE o.${COUNTED}
       GROUP BY oi.title ORDER BY units DESC LIMIT 5`
    )
    .all();

  const margin = revenue > 0 ? Math.round((itemProfit / revenue) * 100) : 0;

  res.render('admin/dashboard', {
    title: 'Dashboard',
    metrics: { revenue, supplierSpend, itemProfit, orderCount, awaiting, productCount, margin },
    lowStock,
    recentOrders,
    topProducts,
  });
});

// ---------------------------------------------------------------------------
// Products
// ---------------------------------------------------------------------------
router.get('/products', (req, res) => {
  const products = db.prepare('SELECT * FROM products ORDER BY created_at DESC').all();
  res.render('admin/products', { title: 'Products', products });
});

router.get('/products/new', (req, res) => {
  res.render('admin/product-form', {
    title: 'New Product',
    product: { active: 1, rating: 4.7, image_color: '4f46e5', stock: 100 },
    isNew: true,
  });
});

function uniqueSlug(base, excludeId = null) {
  let slug = slugify(base);
  let candidate = slug;
  let i = 1;
  for (;;) {
    const row = db.prepare('SELECT id FROM products WHERE slug = ?').get(candidate);
    if (!row || row.id === excludeId) return candidate;
    candidate = `${slug}-${++i}`;
  }
}

function productFromBody(f) {
  return {
    title: String(f.title || '').trim() || 'Untitled product',
    description: String(f.description || '').trim(),
    category: String(f.category || 'General').trim() || 'General',
    price_cents: dollarsToCents(f.price),
    compare_at_cents: dollarsToCents(f.compare_at),
    supplier_cost_cents: dollarsToCents(f.supplier_cost),
    supplier_name: String(f.supplier_name || '').trim(),
    supplier_url: String(f.supplier_url || '').trim(),
    sku: String(f.sku || '').trim(),
    stock: Math.max(0, parseInt(f.stock, 10) || 0),
    rating: Math.min(5, Math.max(0, parseFloat(f.rating) || 4.7)),
    image_color: String(f.image_color || '4f46e5').replace(/[^0-9a-fA-F]/g, '').slice(0, 6) || '4f46e5',
    active: f.active ? 1 : 0,
  };
}

router.post('/products', (req, res) => {
  const p = productFromBody(req.body);
  const slug = uniqueSlug(p.title);
  db.prepare(
    `INSERT INTO products
       (title, slug, description, category, price_cents, compare_at_cents,
        supplier_cost_cents, supplier_name, supplier_url, sku, stock, rating, image_color, active)
     VALUES (?,?,?,?,?,?,?,?,?,?,?,?,?,?)`
  ).run(
    p.title, slug, p.description, p.category, p.price_cents, p.compare_at_cents,
    p.supplier_cost_cents, p.supplier_name, p.supplier_url, p.sku, p.stock, p.rating,
    p.image_color, p.active
  );
  res.redirect('/admin/products');
});

router.get('/products/:id/edit', (req, res, next) => {
  const product = db.prepare('SELECT * FROM products WHERE id = ?').get(Number(req.params.id));
  if (!product) return next();
  res.render('admin/product-form', { title: `Edit ${product.title}`, product, isNew: false });
});

router.post('/products/:id', (req, res, next) => {
  const id = Number(req.params.id);
  const existing = db.prepare('SELECT id FROM products WHERE id = ?').get(id);
  if (!existing) return next();
  const p = productFromBody(req.body);
  const slug = uniqueSlug(p.title, id);
  db.prepare(
    `UPDATE products SET
       title=?, slug=?, description=?, category=?, price_cents=?, compare_at_cents=?,
       supplier_cost_cents=?, supplier_name=?, supplier_url=?, sku=?, stock=?, rating=?,
       image_color=?, active=?
     WHERE id=?`
  ).run(
    p.title, slug, p.description, p.category, p.price_cents, p.compare_at_cents,
    p.supplier_cost_cents, p.supplier_name, p.supplier_url, p.sku, p.stock, p.rating,
    p.image_color, p.active, id
  );
  res.redirect('/admin/products');
});

router.post('/products/:id/delete', (req, res) => {
  db.prepare('DELETE FROM products WHERE id = ?').run(Number(req.params.id));
  res.redirect('/admin/products');
});

// ---------------------------------------------------------------------------
// Orders
// ---------------------------------------------------------------------------
router.get('/orders', (req, res) => {
  const status = (req.query.status || '').trim();
  let orders;
  if (status && ORDER_STATUSES.includes(status)) {
    orders = db.prepare('SELECT * FROM orders WHERE status = ? ORDER BY created_at DESC').all(status);
  } else {
    orders = db.prepare('SELECT * FROM orders ORDER BY created_at DESC').all();
  }
  res.render('admin/orders', { title: 'Orders', orders, statuses: ORDER_STATUSES, activeStatus: status });
});

router.get('/orders/:id', (req, res, next) => {
  const order = db.prepare('SELECT * FROM orders WHERE id = ?').get(Number(req.params.id));
  if (!order) return next();
  const items = db.prepare('SELECT * FROM order_items WHERE order_id = ?').all(order.id);
  res.render('admin/order-detail', { title: `Order ${order.order_number}`, order, items, statuses: ORDER_STATUSES });
});

router.post('/orders/:id', (req, res, next) => {
  const id = Number(req.params.id);
  const order = db.prepare('SELECT id FROM orders WHERE id = ?').get(id);
  if (!order) return next();
  const status = ORDER_STATUSES.includes(req.body.status) ? req.body.status : 'paid';
  db.prepare(
    'UPDATE orders SET status=?, tracking_number=?, supplier_order_ref=?, notes=? WHERE id=?'
  ).run(
    status,
    String(req.body.tracking_number || '').trim(),
    String(req.body.supplier_order_ref || '').trim(),
    String(req.body.notes || '').trim(),
    id
  );
  res.redirect(`/admin/orders/${id}`);
});

// ---------------------------------------------------------------------------
// Settings
// ---------------------------------------------------------------------------
router.get('/settings', (req, res) => {
  res.render('admin/settings', { title: 'Store Settings', settings: getAllSettings(), saved: req.query.saved });
});

router.post('/settings', (req, res) => {
  setSetting('store_name', String(req.body.store_name || 'NovaNest').trim());
  setSetting('store_tagline', String(req.body.store_tagline || '').trim());
  setSetting('support_email', String(req.body.support_email || '').trim());
  setSetting('announcement', String(req.body.announcement || '').trim());
  setSetting('shipping_flat_cents', String(dollarsToCents(req.body.shipping_flat)));
  setSetting('free_shipping_threshold_cents', String(dollarsToCents(req.body.free_shipping_threshold)));
  // Tax rate entered as a percentage (e.g. 7.25) -> basis points.
  const taxPct = parseFloat(req.body.tax_rate_pct) || 0;
  setSetting('tax_rate_bps', String(Math.round(taxPct * 100)));
  res.redirect('/admin/settings?saved=1');
});

module.exports = router;
