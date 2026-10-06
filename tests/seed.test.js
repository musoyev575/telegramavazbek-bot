/**
 * Seed: idempotentlik, standart sozlamalar, administrator va migratsiya holati.
 */
import assert from 'node:assert/strict';
import { after, before, test } from 'node:test';
import { countRows, freshDatabase, teardownDatabase } from './helpers/db.js';
import { seed, seedSettings, seedCategories, seedProducts, seedAdmin } from '../src/database/seed.js';
import settingsModel from '../src/models/settingsModel.js';
import adminModel from '../src/models/adminModel.js';
import { DEFAULT_SETTINGS } from '../src/config/constants.js';
import { runMigrations } from '../src/database/migrate.js';

let db;

before(() => {
  db = freshDatabase();
});

after(() => teardownDatabase());

test('seed: standart sozlamalar yozilgan', () => {
  const settings = settingsModel.all();
  assert.equal(settings.shop_phone, DEFAULT_SETTINGS.shop_phone);
  assert.equal(Number(settings.delivery_fee), 30000);
  assert.ok(settingsModel.getInt('free_delivery_threshold') > 0);
});

test('seed: brendlar (kategoriyalar) yuklangan', () => {
  assert.ok(countRows(db, 'categories') >= 9);
  const names = db.prepare('SELECT name FROM categories ORDER BY sort_order').all().map((row) => row.name);
  assert.ok(names.includes('Apple'));
  assert.ok(names.includes('Samsung'));
});

test('seed: demo mahsulotlarda mahsulotlar va rasmlar bor', () => {
  assert.ok(countRows(db, 'products') >= 10);
  assert.ok(countRows(db, 'product_images') >= 20, 'har bir mahsulotda kamida 2 rasm');
  const withDiscount = db.prepare('SELECT COUNT(*) AS total FROM products WHERE old_price > price').get().total;
  assert.ok(withDiscount >= 3, 'aksiyadagi mahsulotlar mavjud');
});

test('seed: demo rasm havolalari Telegram yuklay oladigan formatda', () => {
  const urls = db.prepare('SELECT url FROM product_images').all().map((row) => row.url);
  assert.ok(urls.length > 0);
  for (const url of urls) {
    assert.ok(!/\.png\//.test(url), `buzilgan URL (404 beradi): ${url}`);
    assert.ok(/^https:\/\/placehold\.co\/\d+x\d+\/[0-9a-f]{6}\/[0-9a-f]{6}\.png\?text=/.test(url), `kutilgan format: ${url}`);
  }
});

test('migratsiya: buzilgan demo rasm havolalari tuzatiladi (v2)', () => {
  db.prepare('UPDATE product_images SET url = ? WHERE id = (SELECT MIN(id) FROM product_images)').run(
    'https://placehold.co/600x800.png/1e293b/e2e8f0?text=iPhone%2015',
  );
  db.prepare('DELETE FROM schema_migrations WHERE version = 2').run();
  runMigrations(db);

  const fixed = db.prepare('SELECT url FROM product_images WHERE id = (SELECT MIN(id) FROM product_images)').get().url;
  assert.equal(fixed, 'https://placehold.co/600x800/1e293b/e2e8f0.png?text=iPhone%2015');
});

test('seed: administrator yaratilgan va parol xeshlangan', () => {
  assert.equal(countRows(db, 'admins'), 1);
  const admin = adminModel.findByUsername('admin');
  assert.ok(admin, 'standart administrator topiladi');
  assert.match(admin.password_hash, /^\$2[aby]\$/, 'parol bcrypt bilan xeshlangan');
  assert.equal(admin.role, 'superadmin');
});

test('seed: qayta chaqirilsa takrorlanmaydi (idempotent)', () => {
  const before = {
    settings: countRows(db, 'settings'),
    categories: countRows(db, 'categories'),
    products: countRows(db, 'products'),
    admins: countRows(db, 'admins'),
  };

  seed({ db });

  assert.equal(countRows(db, 'settings'), before.settings);
  assert.equal(countRows(db, 'categories'), before.categories);
  assert.equal(countRows(db, 'products'), before.products);
  assert.equal(countRows(db, 'admins'), before.admins);
});

test('seed: mavjud mahsulotlar ustidan yozilmaydi', () => {
  const created = seedProducts({ db });
  assert.equal(created, 0, 'mahsulotlar mavjud bo‘lsa yangi qo‘shilmaydi');
  const createdSettings = seedSettings(db);
  assert.equal(createdSettings, 0);
  const createdCategories = seedCategories(db);
  assert.equal(createdCategories, 0);
  const admin = seedAdmin({ db });
  assert.equal(admin.created, false);
});

test('migratsiya: schema_migrations yozuvi mavjud', () => {
  const rows = db.prepare('SELECT version, name FROM schema_migrations ORDER BY version').all();
  // Har bir migratsiya bir marta qayd etiladi (v1 — sxema, v2 — demo rasm URL tuzatishi)
  assert.deepEqual(
    rows.map((row) => row.version),
    [1, 2],
  );
  assert.equal(rows[0].name, 'boshlangich-sxema');
});

test('baza: barcha kerakli jadvallar yaratilgan', () => {
  const required = [
    'users',
    'products',
    'categories',
    'product_images',
    'carts',
    'cart_items',
    'orders',
    'order_items',
    'order_status_history',
    'payments',
    'favorites',
    'admins',
    'admin_sessions',
    'settings',
    'promocodes',
    'audit_logs',
  ];
  const tables = db
    .prepare("SELECT name FROM sqlite_master WHERE type = 'table'")
    .all()
    .map((row) => row.name);

  for (const table of required) {
    assert.ok(tables.includes(table), `${table} jadvali mavjud emas`);
  }
});
