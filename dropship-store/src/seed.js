'use strict';

const bcrypt = require('bcryptjs');
const { db, DEFAULT_SETTINGS, setSetting } = require('./db');
const { slugify } = require('./lib/helpers');

// Men's Y2K streetwear catalog. Prices/costs in integer cents.
// supplier_cost = what you pay the supplier; (price - cost) is your margin.
const PRODUCTS = [
  {
    title: 'Baggy Graphic Skater Tee',
    category: 'Tops', price: 3299, compare: 4999, cost: 750, stock: 220, rating: 4.7,
    color: 'ff2d95', supplier: 'AliExpress · ThrowbackThreads',
    desc: 'Boxy, drop-shoulder cotton tee with a faded 2000s graphic print. The relaxed skater fit you keep seeing all over the For You page — layer it or wear it oversized solo.',
  },
  {
    title: 'Vintage Racing Jersey',
    category: 'Tops', price: 3899, compare: 5999, cost: 980, stock: 140, rating: 4.6,
    color: 'f59e0b', supplier: 'CJ Dropshipping · MotoClub',
    desc: 'Mesh-back moto/racing jersey with bold sponsor-style graphics. Breathable, lightweight, and built for that early-00s grunge-meets-streetwear look.',
  },
  {
    title: 'Striped Y2K Bowling Shirt',
    category: 'Tops', price: 4299, compare: 6499, cost: 1120, stock: 120, rating: 4.5,
    color: '06b6d4', supplier: 'AliExpress · RetroRack',
    desc: 'Camp-collar button-up with retro color-block stripes. Equal parts bowling alley and house party — throw it open over a white tank for instant millennium energy.',
  },
  {
    title: 'Baggy Wide-Leg Jeans',
    category: 'Bottoms', price: 5499, compare: 8499, cost: 1600, stock: 160, rating: 4.7,
    color: '3b82f6', supplier: 'CJ Dropshipping · DenimLab',
    desc: 'Heavyweight wide-leg denim with a puddle hem and faded wash. The true Y2K silhouette — sits low, stacks at the ankle, and goes with literally everything.',
  },
  {
    title: 'Cargo Parachute Pants',
    category: 'Bottoms', price: 4999, compare: 7499, cost: 1450, stock: 150, rating: 4.6,
    color: 'a3e635', supplier: 'AliExpress · UtilityWear',
    desc: 'Nylon parachute cargos with cinch toggles and oversized side pockets. Techwear meets throwback — adjustable hem so you can balloon them out or taper down.',
  },
  {
    title: 'Tearaway Track Pants',
    category: 'Bottoms', price: 4499, compare: 6999, cost: 1200, stock: 175, rating: 4.5,
    color: 'ec4899', supplier: 'CJ Dropshipping · CourtSide',
    desc: 'Snap-button tearaway track pants with contrast side stripes. Pure 2003 energy — glossy finish, relaxed leg, and that satisfying snap down the seam.',
  },
  {
    title: 'Distressed Denim Trucker Jacket',
    category: 'Outerwear', price: 6999, compare: 9999, cost: 2200, stock: 90, rating: 4.7,
    color: '64748b', supplier: 'AliExpress · DenimLab',
    desc: 'Boxy trucker jacket with heavy distressing, raw hems, and a washed-out blue finish. The throw-over-anything layer that anchors every Y2K fit.',
  },
  {
    title: 'Glossy Puffer Vest',
    category: 'Outerwear', price: 5999, compare: 8999, cost: 1850, stock: 110, rating: 4.6,
    color: 'f43f5e', supplier: 'CJ Dropshipping · StreetForm',
    desc: 'High-shine quilted puffer vest with a stand collar. Layers over a hoodie for that bulky, sporty 2000s mall-core look. Lightweight fill, water-repellent shell.',
  },
  {
    title: 'Colorblock Shell Windbreaker',
    category: 'Outerwear', price: 5299, compare: 7999, cost: 1500, stock: 130, rating: 4.5,
    color: '14b8a6', supplier: 'AliExpress · TrackHaus',
    desc: 'Half-zip nylon windbreaker with bold colorblock panels and a packable hood. Crinkly, lightweight, and unmistakably Y2K athletic.',
  },
  {
    title: 'Oversized Zip-Up Hoodie',
    category: 'Hoodies', price: 4899, compare: 7299, cost: 1350, stock: 200, rating: 4.8,
    color: '8b5cf6', supplier: 'CJ Dropshipping · HeavyKnit',
    desc: 'Heavyweight oversized zip hoodie with dropped shoulders and a boxy fit. Brushed-fleece inside, built to be worn baggy. A wardrobe anchor that never misses.',
  },
  {
    title: 'Striped Knit Polo Sweater',
    category: 'Hoodies', price: 4499, compare: 6699, cost: 1280, stock: 120, rating: 4.5,
    color: '7c3aed', supplier: 'AliExpress · KnitClub',
    desc: 'Short-sleeve knit polo with horizontal stripes and a ribbed collar. That preppy-grunge 2000s vibe — wear it over a long-sleeve tee for extra points.',
  },
  {
    title: 'Oval Tinted Sunglasses',
    category: 'Accessories', price: 1899, compare: 2999, cost: 280, stock: 320, rating: 4.6,
    color: '22d3ee', supplier: 'CJ Dropshipping · ShadeCo',
    desc: 'Slim oval frames with gradient-tinted lenses — the Matrix-coded shades that finish any Y2K fit. UV400 protection, featherlight metal frame.',
  },
  {
    title: 'Trucker Mesh Cap',
    category: 'Accessories', price: 2299, compare: 3499, cost: 420, stock: 260, rating: 4.5,
    color: 'ff2d95', supplier: 'AliExpress · CapClub',
    desc: 'Foam-front mesh-back trucker with a curved bill and snapback closure. Throwback graphics, breathable fit — the easiest way to top off the look.',
  },
  {
    title: 'Cuban Link Chain Necklace',
    category: 'Accessories', price: 2699, compare: 4499, cost: 550, stock: 180, rating: 4.7,
    color: 'f59e0b', supplier: 'CJ Dropshipping · IcedOut',
    desc: 'Chunky stainless Cuban link chain with a polished, tarnish-resistant finish. The statement piece that pulls a baggy-tee-and-jeans fit straight into 2002.',
  },
  {
    title: 'Studded Canvas Belt',
    category: 'Accessories', price: 1999, compare: 3299, cost: 360, stock: 210, rating: 4.4,
    color: 'a3e635', supplier: 'AliExpress · BuckleUp',
    desc: 'Double-row pyramid-studded web belt with a roller buckle. Mall-goth meets skater — loop it through your baggiest jeans and let the tail hang.',
  },
  {
    title: 'Chunky Platform Sneakers',
    category: 'Footwear', price: 7499, compare: 10999, cost: 2400, stock: 100, rating: 4.6,
    color: '3b82f6', supplier: 'CJ Dropshipping · SoleHaus',
    desc: 'Exaggerated chunky-sole sneakers with layered panels and a retro silhouette. The platform dad-shoe energy that defines the era — surprisingly comfy all day.',
  },
];

function ensureAdmin() {
  const email = (process.env.ADMIN_EMAIL || 'admin@rewind.shop').toLowerCase();
  const password = process.env.ADMIN_PASSWORD || 'changeme123';
  const existing = db.prepare('SELECT id FROM admins WHERE email = ?').get(email);
  if (existing) return { created: false, email };
  const hash = bcrypt.hashSync(password, 10);
  db.prepare('INSERT INTO admins (email, password_hash) VALUES (?, ?)').run(email, hash);
  return { created: true, email, password };
}

function ensureProducts() {
  const count = db.prepare('SELECT COUNT(*) AS n FROM products').get().n;
  if (count > 0) return { inserted: 0 };
  const insert = db.prepare(
    `INSERT INTO products
       (title, slug, description, category, price_cents, compare_at_cents,
        supplier_cost_cents, supplier_name, supplier_url, sku, stock, rating, image_color, active)
     VALUES (?,?,?,?,?,?,?,?,?,?,?,?,?,1)`
  );
  let i = 0;
  for (const p of PRODUCTS) {
    i++;
    insert.run(
      p.title, slugify(p.title), p.desc, p.category, p.price, p.compare,
      p.cost, p.supplier, '', `RW-${String(1000 + i)}`, p.stock, p.rating, p.color
    );
  }
  return { inserted: PRODUCTS.length };
}

/** Force the storefront branding settings back to the packaged defaults. */
function applyBranding() {
  for (const [k, v] of Object.entries(DEFAULT_SETTINGS)) {
    setSetting(k, String(v));
  }
}

function resetAll() {
  db.exec('DELETE FROM order_items; DELETE FROM orders; DELETE FROM products;');
}

// Idempotent boot seeding used by server.js.
function seedOnBoot() {
  const admin = ensureAdmin();
  const products = ensureProducts();
  return { admin, products };
}

module.exports = { seedOnBoot, ensureAdmin, ensureProducts, applyBranding, resetAll, PRODUCTS };

// CLI: `npm run seed` (idempotent) or `npm run reset` (wipe products/orders,
// re-apply branding, and reseed the catalog).
if (require.main === module) {
  if (process.argv.includes('--reset')) {
    resetAll();
    applyBranding();
    console.log('• Cleared products/orders and re-applied branding.');
  }
  const admin = ensureAdmin();
  const products = ensureProducts();
  if (admin.created) {
    console.log(`✓ Admin created: ${admin.email} / ${admin.password}`);
  } else {
    console.log(`• Admin already exists: ${admin.email}`);
  }
  console.log(`✓ Seeded ${products.inserted} products.`);
  console.log('Done.');
}
