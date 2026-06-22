'use strict';

const bcrypt = require('bcryptjs');
const { db } = require('./db');
const { slugify } = require('./lib/helpers');

// Trending US-market dropshipping catalog. Prices/costs in integer cents.
// supplier_cost = what you pay the supplier; (price - cost) is your margin.
const PRODUCTS = [
  {
    title: 'Posture Corrector Back Brace',
    category: 'Wellness', price: 2999, compare: 4999, cost: 650, stock: 180, rating: 4.6,
    color: '4f46e5', supplier: 'AliExpress · FitLife Store',
    desc: 'Adjustable, breathable back brace that gently trains your shoulders and spine into healthy alignment. One-size-fits-most, discreet under clothing. A perennial US best-seller for desk workers.',
  },
  {
    title: 'LED Strip Lights 50ft RGB',
    category: 'Home', price: 2499, compare: 3999, cost: 420, stock: 260, rating: 4.8,
    color: '7c3aed', supplier: 'CJ Dropshipping · GlowHome',
    desc: 'App + remote controlled color-changing LED strips with music sync. Peel-and-stick install for bedrooms, gaming setups, and TV backlighting. 16M colors and dozens of scene modes.',
  },
  {
    title: 'Portable USB-C Blender',
    category: 'Tech', price: 3499, compare: 5999, cost: 980, stock: 140, rating: 4.5,
    color: '0d9488', supplier: 'AliExpress · KitchenGo',
    desc: 'Rechargeable 380ml personal blender that crushes ice and frozen fruit in seconds. Doubles as a travel bottle — blend your smoothie and take it with you. USB-C fast charging.',
  },
  {
    title: 'MagSafe Car Phone Mount',
    category: 'Tech', price: 2299, compare: 3499, cost: 510, stock: 220, rating: 4.7,
    color: '2563eb', supplier: 'CJ Dropshipping · DriveTech',
    desc: 'Strong N52 magnet vent mount with a secure one-hand grip. Compatible with MagSafe iPhones and included metal plate for any phone. 360° rotation for portrait or landscape.',
  },
  {
    title: 'Wireless Earbuds Pro',
    category: 'Tech', price: 3999, compare: 7999, cost: 1200, stock: 300, rating: 4.6,
    color: '475569', supplier: 'AliExpress · SoundWave',
    desc: 'True-wireless earbuds with active noise cancellation, touch controls, and a USB-C charging case delivering 30+ hours of total playtime. IPX5 sweat resistance for workouts.',
  },
  {
    title: 'Sunset Projection Lamp',
    category: 'Home', price: 1999, compare: 3299, cost: 390, stock: 240, rating: 4.8,
    color: 'ea580c', supplier: 'CJ Dropshipping · AuraDecor',
    desc: 'Viral TikTok sunset lamp that bathes any room in a warm golden glow. Adjustable head and 180° rotation — perfect for cozy photos, streaming backdrops, and mood lighting.',
  },
  {
    title: 'Acupressure Mat & Pillow Set',
    category: 'Wellness', price: 3299, compare: 5499, cost: 840, stock: 110, rating: 4.7,
    color: 'e11d48', supplier: 'AliExpress · ZenLiving',
    desc: 'Thousands of stimulation points relieve back and neck tension, boost circulation, and aid relaxation. Includes a matching pillow and a carry bag for travel.',
  },
  {
    title: 'Resistance Bands Set (11pc)',
    category: 'Fitness', price: 1899, compare: 2999, cost: 320, stock: 200, rating: 4.6,
    color: '059669', supplier: 'CJ Dropshipping · FlexFit',
    desc: 'Stackable up to 150 lbs of resistance with handles, ankle straps, and a door anchor. A full home gym in a bag — great for strength training, mobility, and physical therapy.',
  },
  {
    title: 'Cordless Handheld Vacuum',
    category: 'Home', price: 4499, compare: 6999, cost: 1450, stock: 90, rating: 4.5,
    color: '0891b2', supplier: 'AliExpress · CleanMax',
    desc: 'Powerful 8000Pa cordless vacuum for cars, desks, and pet hair. Washable HEPA filter and USB-C charging. Lightweight enough to keep in the glovebox.',
  },
  {
    title: 'Electric Scalp Massager',
    category: 'Wellness', price: 2199, compare: 3499, cost: 460, stock: 160, rating: 4.7,
    color: 'c026d3', supplier: 'CJ Dropshipping · SootheCo',
    desc: 'Waterproof handheld massager with rotating silicone nodes for the scalp, neck, and body. Use it dry for relaxation or in the shower to deep-clean and stimulate the scalp.',
  },
  {
    title: 'Cloud Slides (Pillow Slippers)',
    category: 'Lifestyle', price: 2499, compare: 3999, cost: 550, stock: 280, rating: 4.8,
    color: 'd97706', supplier: 'AliExpress · ComfyStep',
    desc: 'Ultra-thick, pillowy EVA slides that feel like walking on clouds. Non-slip sole and quick-dry design for home, shower, or beach. The comfort shoe that blew up on social.',
  },
  {
    title: 'Smart LED Water Bottle 32oz',
    category: 'Fitness', price: 2799, compare: 4299, cost: 680, stock: 150, rating: 4.5,
    color: '65a30d', supplier: 'CJ Dropshipping · HydroGlow',
    desc: 'Insulated stainless bottle with an LED lid that glows to remind you to drink. Tracks your hydration goals and keeps drinks cold for 24 hours. Leakproof flip-top straw.',
  },
  {
    title: 'Blue Light Blocking Glasses',
    category: 'Lifestyle', price: 1699, compare: 2799, cost: 280, stock: 320, rating: 4.4,
    color: '0284c7', supplier: 'AliExpress · ClearView',
    desc: 'Reduce eye strain and sleep better with lightweight blue-light filtering lenses. Classic unisex frames that look great on camera — ideal for remote workers and gamers.',
  },
  {
    title: 'Mini Portable Projector 1080p',
    category: 'Tech', price: 7999, compare: 12999, cost: 2800, stock: 70, rating: 4.6,
    color: 'db2777', supplier: 'CJ Dropshipping · CineGo',
    desc: 'Pocket-size projector with native 1080p support, WiFi screen mirroring, and built-in speaker. Turn any wall into a 120" screen for movie nights and presentations.',
  },
];

function ensureAdmin() {
  const email = (process.env.ADMIN_EMAIL || 'admin@novanest.shop').toLowerCase();
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
      p.cost, p.supplier, '', `NN-${String(1000 + i)}`, p.stock, p.rating, p.color
    );
  }
  return { inserted: PRODUCTS.length };
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

module.exports = { seedOnBoot, ensureAdmin, ensureProducts, resetAll, PRODUCTS };

// CLI: `npm run seed` (idempotent) or `npm run reset` (wipe products/orders + reseed)
if (require.main === module) {
  if (process.argv.includes('--reset')) {
    resetAll();
    console.log('• Cleared products and orders.');
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
