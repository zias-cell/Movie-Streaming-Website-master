'use strict';

const express = require('express');
const router = express.Router();
const { db } = require('../db');

const _activeProducts = db.prepare(
  'SELECT * FROM products WHERE active = 1 ORDER BY created_at DESC'
);
const _productBySlug = db.prepare(
  'SELECT * FROM products WHERE slug = ? AND active = 1'
);
const _categories = db.prepare(
  "SELECT category, COUNT(*) AS n FROM products WHERE active = 1 GROUP BY category ORDER BY category"
);

// --- Home -----------------------------------------------------------------
router.get('/', (req, res) => {
  const all = _activeProducts.all();
  const featured = all.filter((p) => p.compare_at_cents > p.price_cents).slice(0, 4);
  res.render('shop/home', {
    title: 'Home',
    featured: featured.length ? featured : all.slice(0, 4),
    newArrivals: all.slice(0, 8),
    categories: _categories.all(),
  });
});

// --- Catalog --------------------------------------------------------------
router.get('/shop', (req, res) => {
  const category = (req.query.category || '').trim();
  const q = (req.query.q || '').trim().toLowerCase();
  let products = _activeProducts.all();

  if (category) {
    products = products.filter((p) => p.category === category);
  }
  if (q) {
    products = products.filter(
      (p) =>
        p.title.toLowerCase().includes(q) ||
        p.description.toLowerCase().includes(q) ||
        p.category.toLowerCase().includes(q)
    );
  }

  const sort = req.query.sort || 'new';
  if (sort === 'price-asc') products.sort((a, b) => a.price_cents - b.price_cents);
  else if (sort === 'price-desc') products.sort((a, b) => b.price_cents - a.price_cents);

  res.render('shop/catalog', {
    title: category || (q ? `Search: ${q}` : 'Shop All'),
    products,
    categories: _categories.all(),
    activeCategory: category,
    query: q,
    sort,
  });
});

// --- Product detail -------------------------------------------------------
router.get('/product/:slug', (req, res, next) => {
  const product = _productBySlug.get(req.params.slug);
  if (!product) return next();
  const related = _activeProducts
    .all()
    .filter((p) => p.category === product.category && p.id !== product.id)
    .slice(0, 4);
  res.render('shop/product', { title: product.title, product, related });
});

// --- Self-hosted product image (gradient SVG, no external assets) ---------
router.get('/img/product/:slug.svg', (req, res) => {
  const product = _productBySlug.get(req.params.slug) ||
    db.prepare('SELECT * FROM products WHERE slug = ?').get(req.params.slug);
  const color = (product && product.image_color) || '4f46e5';
  const label = product ? product.title : 'Product';
  const initials = label
    .split(/\s+/)
    .slice(0, 2)
    .map((w) => w[0])
    .join('')
    .toUpperCase();

  const safeLabel = label.replace(/[<>&]/g, '');
  const svg = `<?xml version="1.0" encoding="UTF-8"?>
<svg xmlns="http://www.w3.org/2000/svg" width="600" height="600" viewBox="0 0 600 600">
  <defs>
    <linearGradient id="g" x1="0" y1="0" x2="1" y2="1">
      <stop offset="0%" stop-color="#${color}"/>
      <stop offset="100%" stop-color="#0f172a"/>
    </linearGradient>
  </defs>
  <rect width="600" height="600" fill="url(#g)"/>
  <circle cx="300" cy="250" r="120" fill="rgba(255,255,255,0.10)"/>
  <text x="300" y="290" font-family="Arial, sans-serif" font-size="150" font-weight="700"
        fill="rgba(255,255,255,0.92)" text-anchor="middle">${initials}</text>
  <text x="300" y="470" font-family="Arial, sans-serif" font-size="34" font-weight="600"
        fill="rgba(255,255,255,0.85)" text-anchor="middle">${safeLabel.slice(0, 28)}</text>
</svg>`;
  res.type('image/svg+xml');
  res.set('Cache-Control', 'public, max-age=86400');
  res.send(svg);
});

module.exports = router;
