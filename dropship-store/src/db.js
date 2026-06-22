'use strict';

const path = require('node:path');
const fs = require('node:fs');
const { DatabaseSync } = require('node:sqlite');

const DATA_DIR = path.join(__dirname, '..', 'data');
fs.mkdirSync(DATA_DIR, { recursive: true });

const DB_PATH = process.env.DB_PATH || path.join(DATA_DIR, 'store.db');
const db = new DatabaseSync(DB_PATH);

db.exec('PRAGMA journal_mode = WAL;');
db.exec('PRAGMA foreign_keys = ON;');

// ---------------------------------------------------------------------------
// Schema
// ---------------------------------------------------------------------------
db.exec(`
  CREATE TABLE IF NOT EXISTS admins (
    id            INTEGER PRIMARY KEY AUTOINCREMENT,
    email         TEXT UNIQUE NOT NULL,
    password_hash TEXT NOT NULL,
    created_at    TEXT NOT NULL DEFAULT (datetime('now'))
  );

  CREATE TABLE IF NOT EXISTS products (
    id                  INTEGER PRIMARY KEY AUTOINCREMENT,
    title               TEXT NOT NULL,
    slug                TEXT UNIQUE NOT NULL,
    description         TEXT NOT NULL DEFAULT '',
    category            TEXT NOT NULL DEFAULT 'General',
    price_cents         INTEGER NOT NULL DEFAULT 0,
    compare_at_cents    INTEGER NOT NULL DEFAULT 0,
    -- Dropshipping fields: what you pay the supplier, and where to fulfill from
    supplier_cost_cents INTEGER NOT NULL DEFAULT 0,
    supplier_name       TEXT NOT NULL DEFAULT '',
    supplier_url        TEXT NOT NULL DEFAULT '',
    sku                 TEXT NOT NULL DEFAULT '',
    stock               INTEGER NOT NULL DEFAULT 0,
    rating              REAL NOT NULL DEFAULT 4.7,
    image_color         TEXT NOT NULL DEFAULT '4f46e5',
    active              INTEGER NOT NULL DEFAULT 1,
    created_at          TEXT NOT NULL DEFAULT (datetime('now'))
  );

  CREATE TABLE IF NOT EXISTS orders (
    id                  INTEGER PRIMARY KEY AUTOINCREMENT,
    order_number        TEXT UNIQUE NOT NULL,
    email               TEXT NOT NULL,
    customer_name       TEXT NOT NULL,
    phone               TEXT NOT NULL DEFAULT '',
    address1            TEXT NOT NULL,
    address2            TEXT NOT NULL DEFAULT '',
    city                TEXT NOT NULL,
    state               TEXT NOT NULL,
    zip                 TEXT NOT NULL,
    country             TEXT NOT NULL DEFAULT 'US',
    subtotal_cents      INTEGER NOT NULL DEFAULT 0,
    shipping_cents      INTEGER NOT NULL DEFAULT 0,
    tax_cents           INTEGER NOT NULL DEFAULT 0,
    total_cents         INTEGER NOT NULL DEFAULT 0,
    supplier_cost_cents INTEGER NOT NULL DEFAULT 0,
    status              TEXT NOT NULL DEFAULT 'paid',
    payment_method      TEXT NOT NULL DEFAULT 'demo',
    payment_ref         TEXT NOT NULL DEFAULT '',
    tracking_number     TEXT NOT NULL DEFAULT '',
    supplier_order_ref  TEXT NOT NULL DEFAULT '',
    notes               TEXT NOT NULL DEFAULT '',
    created_at          TEXT NOT NULL DEFAULT (datetime('now'))
  );

  CREATE TABLE IF NOT EXISTS order_items (
    id                  INTEGER PRIMARY KEY AUTOINCREMENT,
    order_id            INTEGER NOT NULL REFERENCES orders(id) ON DELETE CASCADE,
    product_id          INTEGER,
    title               TEXT NOT NULL,
    sku                 TEXT NOT NULL DEFAULT '',
    price_cents         INTEGER NOT NULL,
    supplier_cost_cents INTEGER NOT NULL DEFAULT 0,
    quantity            INTEGER NOT NULL DEFAULT 1
  );

  CREATE TABLE IF NOT EXISTS settings (
    key   TEXT PRIMARY KEY,
    value TEXT NOT NULL
  );

  CREATE INDEX IF NOT EXISTS idx_products_active ON products(active);
  CREATE INDEX IF NOT EXISTS idx_orders_created ON orders(created_at);
  CREATE INDEX IF NOT EXISTS idx_items_order ON order_items(order_id);
`);

// ---------------------------------------------------------------------------
// Settings helpers (simple key/value store with typed defaults)
// ---------------------------------------------------------------------------
const DEFAULT_SETTINGS = {
  store_name: 'NovaNest',
  store_tagline: 'Trending home, tech & wellness essentials — fast US shipping.',
  support_email: process.env.ADMIN_EMAIL || 'support@novanest.shop',
  shipping_flat_cents: '599',
  free_shipping_threshold_cents: '5000',
  tax_rate_bps: '725', // 7.25% default sales tax (basis points)
  announcement: 'Free shipping on US orders over $50 · Ships in 1–2 business days',
};

function seedDefaultSettings() {
  const insert = db.prepare(
    'INSERT INTO settings (key, value) VALUES (?, ?) ON CONFLICT(key) DO NOTHING'
  );
  for (const [k, v] of Object.entries(DEFAULT_SETTINGS)) {
    insert.run(k, String(v));
  }
}
seedDefaultSettings();

const _getSetting = db.prepare('SELECT value FROM settings WHERE key = ?');
const _setSetting = db.prepare(
  'INSERT INTO settings (key, value) VALUES (?, ?) ON CONFLICT(key) DO UPDATE SET value = excluded.value'
);

function getSetting(key, fallback = '') {
  const row = _getSetting.get(key);
  return row ? row.value : (DEFAULT_SETTINGS[key] ?? fallback);
}

function getSettingInt(key, fallback = 0) {
  const v = parseInt(getSetting(key, String(fallback)), 10);
  return Number.isNaN(v) ? fallback : v;
}

function setSetting(key, value) {
  _setSetting.run(key, String(value));
}

function getAllSettings() {
  const out = { ...DEFAULT_SETTINGS };
  for (const row of db.prepare('SELECT key, value FROM settings').all()) {
    out[row.key] = row.value;
  }
  return out;
}

module.exports = {
  db,
  DB_PATH,
  getSetting,
  getSettingInt,
  setSetting,
  getAllSettings,
};
