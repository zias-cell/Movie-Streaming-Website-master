'use strict';

const express = require('express');
const router = express.Router();
const { db } = require('../db');
const { getCartItems, computeTotals } = require('../lib/cart');
const { US_STATES, isValidZip, isValidState } = require('../lib/us');
const { generateOrderNumber, luhnValid, isValidEmail } = require('../lib/helpers');

const _insertOrder = db.prepare(`
  INSERT INTO orders (
    order_number, email, customer_name, phone, address1, address2, city, state, zip,
    subtotal_cents, shipping_cents, tax_cents, total_cents, supplier_cost_cents,
    status, payment_method, payment_ref
  ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
`);
const _insertItem = db.prepare(`
  INSERT INTO order_items (order_id, product_id, title, sku, price_cents, supplier_cost_cents, quantity)
  VALUES (?, ?, ?, ?, ?, ?, ?)
`);
const _decStock = db.prepare(
  'UPDATE products SET stock = MAX(0, stock - ?) WHERE id = ?'
);
const _orderByNumber = db.prepare('SELECT * FROM orders WHERE order_number = ?');
const _itemsByOrder = db.prepare('SELECT * FROM order_items WHERE order_id = ?');

// --- Checkout form --------------------------------------------------------
router.get('/checkout', (req, res) => {
  const items = getCartItems(req);
  if (items.length === 0) return res.redirect('/cart');
  res.render('shop/checkout', {
    title: 'Checkout',
    items,
    totals: computeTotals(items),
    states: US_STATES,
    errors: [],
    form: {},
  });
});

// --- Place order ----------------------------------------------------------
router.post('/checkout', (req, res) => {
  const items = getCartItems(req);
  if (items.length === 0) return res.redirect('/cart');

  const f = req.body;
  const errors = [];

  if (!f.customer_name || f.customer_name.trim().length < 2)
    errors.push('Please enter your full name.');
  if (!isValidEmail(f.email)) errors.push('Please enter a valid email address.');
  if (!f.address1 || f.address1.trim().length < 3)
    errors.push('Please enter your street address.');
  if (!f.city || f.city.trim().length < 2) errors.push('Please enter your city.');
  if (!isValidState(f.state)) errors.push('Please select a valid US state.');
  if (!isValidZip(f.zip)) errors.push('Please enter a valid US ZIP code.');

  // Demo payment gateway: format-check the card only (no real charge).
  const cardNumber = String(f.card_number || '').replace(/\s+/g, '');
  if (!luhnValid(cardNumber))
    errors.push('Please enter a valid card number (demo gateway — use 4242 4242 4242 4242).');

  const totals = computeTotals(items);

  if (errors.length) {
    return res.status(400).render('shop/checkout', {
      title: 'Checkout',
      items,
      totals,
      states: US_STATES,
      errors,
      form: f,
    });
  }

  const orderNumber = generateOrderNumber();
  const paymentRef = 'demo_' + Date.now().toString(36);
  const last4 = cardNumber.slice(-4);

  // Persist order + items atomically.
  db.exec('BEGIN');
  try {
    const result = _insertOrder.run(
      orderNumber,
      f.email.trim(),
      f.customer_name.trim(),
      (f.phone || '').trim(),
      f.address1.trim(),
      (f.address2 || '').trim(),
      f.city.trim(),
      f.state.toUpperCase(),
      f.zip.trim(),
      totals.subtotalCents,
      totals.shippingCents,
      totals.taxCents,
      totals.totalCents,
      totals.supplierCostCents,
      'paid',
      `card •••• ${last4}`,
      paymentRef
    );
    const orderId = Number(result.lastInsertRowid);
    for (const it of items) {
      _insertItem.run(
        orderId,
        it.product.id,
        it.product.title,
        it.product.sku,
        it.product.price_cents,
        it.product.supplier_cost_cents,
        it.quantity
      );
      _decStock.run(it.quantity, it.product.id);
    }
    db.exec('COMMIT');
  } catch (err) {
    db.exec('ROLLBACK');
    console.error('Order creation failed:', err);
    return res.status(500).render('shop/checkout', {
      title: 'Checkout',
      items,
      totals,
      states: US_STATES,
      errors: ['Something went wrong placing your order. Please try again.'],
      form: f,
    });
  }

  req.session.cart = {};
  req.session.lastOrder = orderNumber;
  res.redirect(`/order/${orderNumber}`);
});

// --- Order confirmation / lookup -----------------------------------------
router.get('/order/:number', (req, res, next) => {
  const order = _orderByNumber.get(req.params.number);
  if (!order) return next();
  const items = _itemsByOrder.all(order.id);
  res.render('shop/confirmation', { title: `Order ${order.order_number}`, order, items });
});

module.exports = router;
