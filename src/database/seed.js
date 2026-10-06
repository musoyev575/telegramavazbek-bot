/**
 * Seed: standart sozlamalar, brendlar, demo mahsulotlar va boshlang'ich administrator.
 *
 * Xavfsizlik: parol hech qachon ochiq saqlanmaydi — bcrypt xesh bilan yoziladi.
 * Idempotent: mavjud ma'lumotlar ustidan yozilmaydi (faqat bo'sh joylar to'ldiriladi).
 */
import { hashSync } from 'bcryptjs';
import { getDb } from './db.js';
import { initDatabase } from './migrate.js';
import config from '../config/index.js';
import logger from '../utils/logger.js';
import { DEFAULT_SETTINGS } from '../config/constants.js';

const BRANDS = [
  { name: 'Apple', slug: 'apple', sort: 1 },
  { name: 'Samsung', slug: 'samsung', sort: 2 },
  { name: 'Xiaomi', slug: 'xiaomi', sort: 3 },
  { name: 'Honor', slug: 'honor', sort: 4 },
  { name: 'Oppo', slug: 'oppo', sort: 5 },
  { name: 'Vivo', slug: 'vivo', sort: 6 },
  { name: 'Realme', slug: 'realme', sort: 7 },
  { name: 'Huawei', slug: 'huawei', sort: 8 },
  { name: 'Google', slug: 'google', sort: 9 },
];

/** Demo katalog — real texnik ma'lumotlarga yaqin namunali telefonlar */
const DEMO_PRODUCTS = [
  {
    brand: 'Apple',
    model: 'iPhone 15 Pro 256GB',
    price: 15900000,
    oldPrice: 17400000,
    ram: 8,
    storage: 256,
    screen: '6.1" Super Retina XDR, 120 Hz',
    camera: '48 MP + 12 MP + 12 MP',
    battery: '3270 mAh',
    processor: 'Apple A17 Pro',
    os: 'iOS 17',
    color: 'Natural Titanium',
    warranty: '1 yil rasmiy',
    stock: 6,
    featured: 1,
    description:
      "Titanium korpus, A17 Pro protsessori va USB-C. ProMotion 120 Hz ekran. Rasmiy kafolat bilan.",
  },
  {
    brand: 'Apple',
    model: 'iPhone 14 128GB',
    price: 10200000,
    oldPrice: 11200000,
    ram: 6,
    storage: 128,
    screen: '6.1" Super Retina XDR',
    camera: '12 MP + 12 MP',
    battery: '3279 mAh',
    processor: 'Apple A15 Bionic',
    os: 'iOS 16',
    color: 'Midnight',
    warranty: '1 yil rasmiy',
    stock: 9,
    featured: 1,
    description: 'Ishonchli flagman: yaxshi kamera, kun bo‘yi ishlaydigan batareya va rasmiy kafolat.',
  },
  {
    brand: 'Samsung',
    model: 'Galaxy S24 Ultra 12/512',
    price: 17490000,
    oldPrice: 19490000,
    ram: 12,
    storage: 512,
    screen: '6.8" Dynamic AMOLED 2X, 120 Hz',
    camera: '200 MP + 50 MP + 12 MP + 10 MP',
    battery: '5000 mAh',
    processor: 'Snapdragon 8 Gen 3',
    os: 'Android 14, One UI 6.1',
    color: 'Titanium Gray',
    warranty: '1 yil rasmiy',
    stock: 4,
    featured: 1,
    description: 'S Pen bilan, 200 MP kamera va 7 yillik yangilanish siyosati. Biznes-klass flagman.',
  },
  {
    brand: 'Samsung',
    model: 'Galaxy A55 8/256',
    price: 4790000,
    oldPrice: 5290000,
    ram: 8,
    storage: 256,
    screen: '6.6" Super AMOLED, 120 Hz',
    camera: '50 MP + 12 MP + 5 MP',
    battery: '5000 mAh',
    processor: 'Exynos 1480',
    os: 'Android 14, One UI 6.1',
    color: 'Awesome Navy',
    warranty: '1 yil rasmiy',
    stock: 12,
    description: 'O‘rta segmentning eng barqarori: 120 Hz AMOLED va 5000 mAh batareya.',
  },
  {
    brand: 'Xiaomi',
    model: 'Redmi Note 13 Pro 8/256',
    price: 3390000,
    oldPrice: 3890000,
    ram: 8,
    storage: 256,
    screen: '6.67" AMOLED, 120 Hz',
    camera: '200 MP + 8 MP + 2 MP',
    battery: '5100 mAh, 67W tez quvvat',
    processor: 'Snapdragon 7s Gen 2',
    os: 'Android 13, MIUI 14',
    color: 'Midnight Black',
    warranty: '1 yil rasmiy',
    stock: 15,
    featured: 1,
    description: 'Narxiga nisbatan eng kuchli taklif: 200 MP kamera va 67W tez quvvatlash.',
  },
  {
    brand: 'Xiaomi',
    model: 'Xiaomi 14 12/256',
    price: 9490000,
    ram: 12,
    storage: 256,
    screen: '6.36" AMOLED LTPO, 120 Hz',
    camera: '50 MP Leica + 50 MP + 50 MP',
    battery: '4610 mAh, 90W',
    processor: 'Snapdragon 8 Gen 3',
    os: 'Android 14, HyperOS',
    color: 'Black',
    warranty: '1 yil rasmiy',
    stock: 5,
    description: 'Leica optikasi va ixcham korpus: kompakt flagman izlovchilar uchun.',
  },
  {
    brand: 'Honor',
    model: 'Honor 90 12/256',
    price: 4290000,
    ram: 12,
    storage: 256,
    screen: '6.7" AMOLED, 120 Hz',
    camera: '200 MP + 12 MP + 2 MP',
    battery: '5000 mAh, 66W',
    processor: 'Snapdragon 7 Gen 1 Accelerated',
    os: 'Android 13, MagicOS 7.1',
    color: 'Emerald Green',
    warranty: '1 yil rasmiy',
    stock: 8,
    description: 'Yupqa korpus, yorqin AMOLED ekran va tez quvvatlash.',
  },
  {
    brand: 'Oppo',
    model: 'Reno 11 8/256',
    price: 4590000,
    oldPrice: 4990000,
    ram: 8,
    storage: 256,
    screen: '6.7" AMOLED, 120 Hz',
    camera: '50 MP + 8 MP + 2 MP',
    battery: '5000 mAh, 67W SuperVOOC',
    processor: 'MediaTek Dimensity 7050',
    os: 'Android 14, ColorOS 14',
    color: 'Pearl White',
    warranty: '1 yil rasmiy',
    stock: 7,
    description: 'Dizayn va portret suratga olishga yo‘naltirilgan o‘rta segment smartfoni.',
  },
  {
    brand: 'Vivo',
    model: 'V30 Lite 8/256',
    price: 3990000,
    ram: 8,
    storage: 256,
    screen: '6.78" AMOLED, 120 Hz',
    camera: '50 MP + 8 MP',
    battery: '5000 mAh, 80W FlashCharge',
    processor: 'Snapdragon 685',
    os: 'Android 14, Funtouch OS 14',
    color: 'Leather Black',
    warranty: '1 yil rasmiy',
    stock: 6,
    description: '80W quvvatlash va yupqa korpus — kundalik foydalanish uchun qulay.',
  },
  {
    brand: 'Realme',
    model: 'Realme 12 Pro+ 8/256',
    price: 4390000,
    oldPrice: 4690000,
    ram: 8,
    storage: 256,
    screen: '6.7" AMOLED, 120 Hz',
    camera: '64 MP periskop + 50 MP + 8 MP',
    battery: '5000 mAh, 67W',
    processor: 'Snapdragon 7s Gen 2',
    os: 'Android 14, Realme UI 5.0',
    color: 'Submarine Blue',
    warranty: '1 yil rasmiy',
    stock: 5,
    description: 'Periskop zoom bilan arzon flagman — uzoqdan suratga olish uchun ideal.',
  },
  {
    brand: 'Google',
    model: 'Pixel 8 8/128',
    price: 8990000,
    ram: 8,
    storage: 128,
    screen: '6.2" Actua OLED, 120 Hz',
    camera: '50 MP + 12 MP',
    battery: '4575 mAh',
    processor: 'Google Tensor G3',
    os: 'Android 14',
    color: 'Obsidian',
    warranty: '1 yil',
    stock: 3,
    description: 'Eng yaxshi hisoblash fotografiyasi va toza Android tajribasi.',
  },
  {
    brand: 'Huawei',
    model: 'nova 12i 8/128',
    price: 2590000,
    ram: 8,
    storage: 128,
    screen: '6.7" IPS, 90 Hz',
    camera: '108 MP + 2 MP',
    battery: '5000 mAh, 40W',
    processor: 'Snapdragon 680',
    os: 'Android 13, EMUI 13',
    color: 'Starry Blue',
    warranty: '1 yil rasmiy',
    stock: 10,
    description: 'Katta ekran va batareya: byudjetga qulay kundalik telefon.',
  },
];

function slugify(value) {
  return String(value)
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-|-$/g, '');
}

/**
 * Demo rasm havolasi (admin panel orqali haqiqiy rasmlar bilan almashtiriladi).
 *
 * DIQQAT: placehold.co formati `WxH/fon/matn.png` (`.png` oxirida, `?text=` dan oldin).
 * `.png` ni o'lchamdan keyin yozish 404 qaytaradi va Telegram rasmni yuklay olmaydi.
 */
function demoImage(brand, model, variant = 1) {
  const label = encodeURIComponent(`${brand} ${model}`.slice(0, 24));
  const shade = variant === 1 ? '1e293b' : '334155';
  return `https://placehold.co/600x800/${shade}/e2e8f0.png?text=${label}`;
}

export function seedSettings(db = getDb()) {
  const insert = db.prepare(
    `INSERT INTO settings (key, value) VALUES (?, ?) ON CONFLICT (key) DO NOTHING`,
  );
  let created = 0;
  db.transaction(() => {
    for (const [key, value] of Object.entries(DEFAULT_SETTINGS)) {
      created += insert.run(key, value).changes;
    }
  })();
  return created;
}

export function seedCategories(db = getDb()) {
  const insert = db.prepare(
    `INSERT INTO categories (name, slug, sort_order) VALUES (@name, @slug, @sort)
     ON CONFLICT (name) DO NOTHING`,
  );
  let created = 0;
  db.transaction(() => {
    for (const brand of BRANDS) {
      created += insert.run({ name: brand.name, slug: brand.slug, sort: brand.sort }).changes;
    }
  })();
  return created;
}

export function seedProducts({ db = getDb(), force = false } = {}) {
  const existing = db.prepare('SELECT COUNT(*) AS total FROM products').get().total;
  if (existing > 0 && !force) return 0;

  const categoryIds = new Map(
    db.prepare('SELECT id, name FROM categories').all().map((row) => [row.name, row.id]),
  );
  const insertProduct = db.prepare(
    `INSERT INTO products (category_id, brand, model, price, old_price, ram, storage, screen, camera, battery,
                           processor, os, color, warranty, stock, description, is_active, is_featured, sort_order)
     VALUES (@categoryId, @brand, @model, @price, @oldPrice, @ram, @storage, @screen, @camera, @battery,
             @processor, @os, @color, @warranty, @stock, @description, 1, @featured, 0)`,
  );
  const insertImage = db.prepare(
    'INSERT INTO product_images (product_id, url, sort_order) VALUES (?, ?, ?)',
  );

  let created = 0;
  db.transaction(() => {
    DEMO_PRODUCTS.forEach((product, index) => {
      const info = insertProduct.run({
        categoryId: categoryIds.get(product.brand) ?? null,
        brand: product.brand,
        model: product.model,
        price: product.price,
        oldPrice: product.oldPrice ?? null,
        ram: product.ram ?? null,
        storage: product.storage ?? null,
        screen: product.screen ?? null,
        camera: product.camera ?? null,
        battery: product.battery ?? null,
        processor: product.processor ?? null,
        os: product.os ?? null,
        color: product.color ?? null,
        warranty: product.warranty ?? null,
        stock: product.stock ?? 0,
        description: product.description ?? null,
        featured: product.featured ?? 0,
      });
      const productId = Number(info.lastInsertRowid);
      insertImage.run(productId, demoImage(product.brand, product.model, 1), 0);
      insertImage.run(productId, demoImage(product.brand, product.model, 2), 1);
      created += 1;
      void index;
    });
  })();

  return created;
}

export function seedAdmin({ db = getDb() } = {}) {
  const existing = db.prepare('SELECT COUNT(*) AS total FROM admins').get().total;
  if (existing > 0) return { created: false };

  if (!config.seed.adminPassword || config.seed.adminPassword.length < 8) {
    logger.warn('SEED_ADMIN_PASSWORD juda qisqa — administrator yaratilmadi');
    return { created: false };
  }

  db.prepare(
    `INSERT INTO admins (username, password_hash, full_name, role, telegram_id)
     VALUES (@username, @passwordHash, 'Bosh administrator', 'superadmin', @telegramId)`,
  ).run({
    username: config.seed.adminUsername,
    passwordHash: hashSync(config.seed.adminPassword, 12),
    telegramId: config.seed.adminTelegramId,
  });

  return { created: true, username: config.seed.adminUsername };
}

/** Barcha seed'larni ketma-ket bajaradi */
export function seed({ db = getDb(), force = false } = {}) {
  const settings = seedSettings(db);
  const categories = seedCategories(db);
  const products = seedProducts({ db, force });
  const admin = seedAdmin({ db });
  return { settings, categories, products, admin };
}

/** Faqat bo'sh joylarni to'ldiradi (ilova ishga tushishida chaqiriladi) */
export function seedIfEmpty() {
  const db = getDb();
  initDatabase({ db });
  const result = seed({ db });

  if (result.admin.created) {
    logger.warn(
      `Boshlang'ich administrator yaratildi: "${result.admin.username}". ` +
        "Parolni .env dagi SEED_ADMIN_PASSWORD orqali boshqaring va birinchi kirishdan keyin o'zgartiring.",
    );
  }
  if (result.products > 0) {
    logger.info(`Demo katalog yuklandi: ${result.products} ta telefon`);
  }
  return result;
}

// To'g'ridan-to'g'ri ishga tushirilganda: node src/database/seed.js [--force]
const isDirectRun = process.argv[1] && process.argv[1].replace(/\\/g, '/').endsWith('src/database/seed.js');
if (isDirectRun) {
  const force = process.argv.includes('--force');
  const result = seedIfEmpty();
  if (force) seed({ force: true });
  logger.info('Seed yakunlandi', result);
  process.exit(0);
}

export default { seed, seedIfEmpty, seedSettings, seedCategories, seedProducts, seedAdmin };
