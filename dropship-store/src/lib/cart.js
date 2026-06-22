'use strict';

const { db, getSettingInt } = require('../db');

const _getProduct = db.prepare(
  'SELECT * FROM products WHERE id = ? AND active = 1'
);

/** Read the raw cart map from the session: { productId: quantity }. */
function rawCart(req) {
  if (!req.session.cart || typeof req.session.cart !== 'object') {
    req.session.cart = {};
  }
  return req.session.cart;
}

/** Resolve cart entries into line items joined with live product data. */
function getCartItems(req) {
  const cart = rawCart(req);
  const items = [];
  let dirty = false;
  for (const [id, qty] of Object.entries(cart)) {
    const product = _getProduct.get(Number(id));
    if (!product) {
      delete cart[id]; // product was removed or deactivated
      dirty = true;
      continue;
    }
    const quantity = Math.max(1, Math.min(99, Number(qty) || 1));
    items.push({
      product,
      quantity,
      lineTotalCents: product.price_cents * quantity,
      lineCostCents: product.supplier_cost_cents * quantity,
    });
  }
  if (dirty) req.session.touched = true;
  return items;
}

/** Total number of units in the cart (for the header badge). */
function getCartCount(req) {
  return Object.values(rawCart(req)).reduce((n, q) => n + (Number(q) || 0), 0);
}

/**
 * Compute order totals from cart line items, applying the configured
 * flat-rate / free-shipping rules and US sales tax.
 */
function computeTotals(items) {
  const subtotalCents = items.reduce((s, i) => s + i.lineTotalCents, 0);
  const supplierCostCents = items.reduce((s, i) => s + i.lineCostCents, 0);

  const flat = getSettingInt('shipping_flat_cents', 599);
  const freeThreshold = getSettingInt('free_shipping_threshold_cents', 5000);
  const taxBps = getSettingInt('tax_rate_bps', 0);

  let shippingCents = 0;
  if (subtotalCents > 0 && (freeThreshold <= 0 || subtotalCents < freeThreshold)) {
    shippingCents = flat;
  }
  const taxCents = Math.round((subtotalCents * taxBps) / 10000);
  const totalCents = subtotalCents + shippingCents + taxCents;

  return { subtotalCents, shippingCents, taxCents, totalCents, supplierCostCents };
}

module.exports = { rawCart, getCartItems, getCartCount, computeTotals };
