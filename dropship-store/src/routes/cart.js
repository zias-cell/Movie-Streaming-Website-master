'use strict';

const express = require('express');
const router = express.Router();
const { db } = require('../db');
const { rawCart, getCartItems, getCartCount, computeTotals } = require('../lib/cart');

const _product = db.prepare('SELECT * FROM products WHERE id = ? AND active = 1');

// View cart
router.get('/', (req, res) => {
  const items = getCartItems(req);
  res.render('shop/cart', { title: 'Your Cart', items, totals: computeTotals(items) });
});

// Add to cart
router.post('/add', (req, res) => {
  const id = Number(req.body.product_id);
  const qty = Math.max(1, Math.min(99, Number(req.body.quantity) || 1));
  const product = _product.get(id);
  if (product) {
    const cart = rawCart(req);
    cart[id] = Math.min(99, (Number(cart[id]) || 0) + qty);
  }
  if (req.body.ajax === '1') {
    return res.json({ ok: !!product, count: getCartCount(req) });
  }
  if (req.body.redirect === 'cart') return res.redirect('/cart');
  res.redirect('back');
});

// Update quantities (cart page)
router.post('/update', (req, res) => {
  const cart = rawCart(req);
  for (const key of Object.keys(req.body)) {
    const m = key.match(/^qty_(\d+)$/);
    if (!m) continue;
    const id = m[1];
    const qty = Number(req.body[key]);
    if (!qty || qty <= 0) delete cart[id];
    else cart[id] = Math.min(99, qty);
  }
  res.redirect('/cart');
});

// Remove a single line
router.post('/remove', (req, res) => {
  const cart = rawCart(req);
  delete cart[String(Number(req.body.product_id))];
  res.redirect('/cart');
});

module.exports = router;
