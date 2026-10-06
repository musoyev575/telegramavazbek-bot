/**
 * Mahsulotlar (telefonlar) modeli: CRUD, qidiruv, filtrlash, ombor, rasmlar.
 * Barcha so'rovlar parametrlangan — SQL injection mumkin emas.
 */
import { getDb } from '../database/db.js';
import { insertRow, updateRow, bool } from './helpers.js';
import { escapeLike } from '../utils/validate.js';
import { SORT } from '../config/constants.js';

const SELECT_BASE = `
  SELECT p.*,
         c.name AS category_name,
         (SELECT COUNT(*) FROM order_items oi WHERE oi.product_id = p.id) AS sold_count
  FROM products p
  LEFT JOIN categories c ON c.id = p.category_id`;

const SORT_SQL = {
  [SORT.NEW]: 'p.created_at DESC, p.id DESC',
  [SORT.PRICE_ASC]: 'p.price ASC, p.id DESC',
  [SORT.PRICE_DESC]: 'p.price DESC, p.id DESC',
  [SORT.POPULAR]: 'sold_count DESC, p.is_featured DESC, p.created_at DESC',
};

/** Filtr obyektidan WHERE shartlari va parametrlarni quradi */
function buildFilters(filters = {}) {
  const where = [];
  const params = {};

  if (!filters.includeInactive) where.push('p.is_active = 1');
  if (filters.stockOnly) where.push('p.stock > 0');

  if (filters.query) {
    where.push(
      "(LOWER(p.brand || ' ' || p.model) LIKE LOWER(@q) ESCAPE '\\' OR LOWER(COALESCE(p.description, '')) LIKE LOWER(@q) ESCAPE '\\')",
    );
    params.q = `%${escapeLike(filters.query)}%`;
  }
  if (filters.brand) {
    where.push('LOWER(p.brand) = LOWER(@brand)');
    params.brand = filters.brand;
  }
  if (filters.categoryId) {
    where.push('p.category_id = @categoryId');
    params.categoryId = filters.categoryId;
  }
  if (Number.isFinite(filters.minPrice)) {
    where.push('p.price >= @minPrice');
    params.minPrice = filters.minPrice;
  }
  if (Number.isFinite(filters.maxPrice)) {
    where.push('p.price <= @maxPrice');
    params.maxPrice = filters.maxPrice;
  }
  if (filters.ram) {
    where.push('p.ram = @ram');
    params.ram = filters.ram;
  }
  if (filters.storage) {
    where.push('p.storage = @storage');
    params.storage = filters.storage;
  }
  if (filters.color) {
    where.push('LOWER(p.color) LIKE LOWER(@color)');
    params.color = `%${escapeLike(filters.color)}%`;
  }
  if (filters.onSale) where.push('p.old_price IS NOT NULL AND p.old_price > p.price');
  if (filters.featured) where.push('p.is_featured = 1');

  return { clause: where.length ? `WHERE ${where.join(' AND ')}` : '', params };
}

/** Qidiruv + filtr + sahifalash. Qaytadi: { items, total, page, perPage, totalPages } */
export function search(filters = {}) {
  const db = getDb();
  const { clause, params } = buildFilters(filters);
  const perPage = Math.max(1, filters.perPage ?? 10);
  const page = Math.max(1, filters.page ?? 1);
  const offset = (page - 1) * perPage;
  const orderBy = SORT_SQL[filters.sort] ?? SORT_SQL[SORT.NEW];

  const items = db
    .prepare(`${SELECT_BASE} ${clause} ORDER BY ${orderBy} LIMIT @limit OFFSET @offset`)
    .all({ ...params, limit: perPage, offset });
  const { total } = db.prepare(`SELECT COUNT(*) AS total FROM products p ${clause}`).get(params);

  return {
    items: attachImages(items),
    total,
    page,
    perPage,
    totalPages: Math.max(1, Math.ceil(total / perPage)),
    hasPrev: page > 1,
    hasNext: page * perPage < total,
  };
}

export function findById(id, { includeInactive = false } = {}) {
  const row = getDb()
    .prepare(`${SELECT_BASE} WHERE p.id = ? ${includeInactive ? '' : 'AND p.is_active = 1'}`)
    .get(id);
  return row ? attachImages([row])[0] : null;
}

export function listByIds(ids = []) {
  if (ids.length === 0) return [];
  const placeholders = ids.map(() => '?').join(', ');
  const rows = getDb().prepare(`${SELECT_BASE} WHERE p.id IN (${placeholders})`).all(...ids);
  return attachImages(rows);
}

export function create(data) {
  const { id } = insertRow('products', {
    category_id: data.categoryId ?? null,
    brand: data.brand,
    model: data.model,
    price: data.price,
    old_price: data.oldPrice ?? null,
    ram: data.ram ?? null,
    storage: data.storage ?? null,
    screen: data.screen ?? null,
    camera: data.camera ?? null,
    battery: data.battery ?? null,
    processor: data.processor ?? null,
    os: data.os ?? null,
    color: data.color ?? null,
    warranty: data.warranty ?? null,
    stock: data.stock ?? 0,
    description: data.description ?? null,
    is_active: data.isActive === undefined ? 1 : bool(data.isActive),
    is_featured: bool(data.isFeatured),
    sort_order: data.sortOrder ?? 0,
  });
  if (Array.isArray(data.images)) {
    data.images.filter(Boolean).forEach((url, index) => addImage(id, url, index));
  }
  return findById(id, { includeInactive: true });
}

export function update(id, data) {
  const fields = {
    ...(data.categoryId !== undefined ? { category_id: data.categoryId } : {}),
    ...(data.brand !== undefined ? { brand: data.brand } : {}),
    ...(data.model !== undefined ? { model: data.model } : {}),
    ...(data.price !== undefined ? { price: data.price } : {}),
    ...(data.oldPrice !== undefined ? { old_price: data.oldPrice } : {}),
    ...(data.ram !== undefined ? { ram: data.ram } : {}),
    ...(data.storage !== undefined ? { storage: data.storage } : {}),
    ...(data.screen !== undefined ? { screen: data.screen } : {}),
    ...(data.camera !== undefined ? { camera: data.camera } : {}),
    ...(data.battery !== undefined ? { battery: data.battery } : {}),
    ...(data.processor !== undefined ? { processor: data.processor } : {}),
    ...(data.os !== undefined ? { os: data.os } : {}),
    ...(data.color !== undefined ? { color: data.color } : {}),
    ...(data.warranty !== undefined ? { warranty: data.warranty } : {}),
    ...(data.stock !== undefined ? { stock: data.stock } : {}),
    ...(data.description !== undefined ? { description: data.description } : {}),
    ...(data.isActive !== undefined ? { is_active: bool(data.isActive) } : {}),
    ...(data.isFeatured !== undefined ? { is_featured: bool(data.isFeatured) } : {}),
    ...(data.sortOrder !== undefined ? { sort_order: data.sortOrder } : {}),
  };
  updateRow('products', id, fields);
  return findById(id, { includeInactive: true });
}

/** Mahsulotni bazadan butunlay o'chiradi (buyurtma tarixi snapshot sifatida saqlanib qoladi) */
export function remove(id) {
  return getDb().prepare('DELETE FROM products WHERE id = ?').run(id).changes;
}

/** Ombor qoldig'ini delta'ga o'zgartirish (manfiy natija CHECK bilan bloklanadi) */
export function adjustStock(id, delta) {
  return getDb().prepare('UPDATE products SET stock = stock + @delta WHERE id = @id').run({ id, delta }).changes;
}

export function setStock(id, stock) {
  return updateRow('products', id, { stock });
}

export function lowStock(threshold = 3, limit = 20) {
  const rows = getDb()
    .prepare(
      `${SELECT_BASE} WHERE p.is_active = 1 AND p.stock <= @threshold ORDER BY p.stock ASC, p.model ASC LIMIT @limit`,
    )
    .all({ threshold, limit });
  return attachImages(rows);
}

export function featured(limit = 5) {
  return attachImages(
    getDb()
      .prepare(`${SELECT_BASE} WHERE p.is_active = 1 AND p.is_featured = 1 ORDER BY p.created_at DESC LIMIT ?`)
      .all(limit),
  );
}

export function newArrivals(limit = 5) {
  return attachImages(
    getDb().prepare(`${SELECT_BASE} WHERE p.is_active = 1 ORDER BY p.created_at DESC, p.id DESC LIMIT ?`).all(limit),
  );
}

/** Aksiyadagi telefonlar (eski narx kiritilgan va u joriy narxdan katta) */
export function onSale(limit = 5) {
  return attachImages(
    getDb()
      .prepare(
        `${SELECT_BASE} WHERE p.is_active = 1 AND p.old_price IS NOT NULL AND p.old_price > p.price
         ORDER BY (p.old_price - p.price) DESC LIMIT ?`,
      )
      .all(limit),
  );
}

/** Brendlar ro'yxati va ular bo'yicha mahsulot soni */
export function brands() {
  return getDb()
    .prepare(
      `SELECT p.brand AS brand, COUNT(*) AS total
       FROM products p WHERE p.is_active = 1
       GROUP BY LOWER(p.brand) ORDER BY total DESC, p.brand ASC`,
    )
    .all();
}

/** Filtr menyulari uchun mavjud qiymatlar */
export function filterValues() {
  const db = getDb();
  const distinct = (column) =>
    db
      .prepare(`SELECT DISTINCT ${column} AS value FROM products WHERE is_active = 1 AND ${column} IS NOT NULL ORDER BY ${column} ASC`)
      .all()
      .map((row) => row.value);
  const range = db.prepare('SELECT MIN(price) AS min, MAX(price) AS max FROM products WHERE is_active = 1').get();
  return {
    brands: brands().map((row) => row.brand),
    rams: distinct('ram'),
    storages: distinct('storage'),
    colors: distinct('color'),
    priceMin: range?.min ?? 0,
    priceMax: range?.max ?? 0,
  };
}

export function countAll({ activeOnly = false } = {}) {
  const row = getDb()
    .prepare(`SELECT COUNT(*) AS total FROM products ${activeOnly ? 'WHERE is_active = 1' : ''}`)
    .get();
  return row?.total ?? 0;
}

// ---------------------------------------------------------------------------
//  Rasmlar
// ---------------------------------------------------------------------------
export function imagesFor(productId) {
  return getDb()
    .prepare('SELECT * FROM product_images WHERE product_id = ? ORDER BY sort_order ASC, id ASC')
    .all(productId);
}

export function addImage(productId, url, sortOrder = 999) {
  const { id } = insertRow('product_images', { product_id: productId, url, sort_order: sortOrder });
  return getDb().prepare('SELECT * FROM product_images WHERE id = ?').get(id);
}

export function removeImage(imageId) {
  return getDb().prepare('DELETE FROM product_images WHERE id = ?').run(imageId).changes;
}

/** Mahsulot(lar)ga `images` massivi va asosiy `image` maydonini qo'shadi */
export function attachImages(products) {
  if (products.length === 0) return products;
  const ids = products.map((product) => product.id);
  const placeholders = ids.map(() => '?').join(', ');
  const images = getDb()
    .prepare(
      `SELECT * FROM product_images WHERE product_id IN (${placeholders}) ORDER BY sort_order ASC, id ASC`,
    )
    .all(...ids);

  const grouped = new Map();
  for (const image of images) {
    if (!grouped.has(image.product_id)) grouped.set(image.product_id, []);
    grouped.get(image.product_id).push(image);
  }

  return products.map((product) => {
    const list = grouped.get(product.id) ?? [];
    return { ...product, images: list, image: list[0]?.url ?? null };
  });
}

export default {
  search,
  findById,
  listByIds,
  create,
  update,
  remove,
  adjustStock,
  setStock,
  lowStock,
  featured,
  newArrivals,
  onSale,
  brands,
  filterValues,
  countAll,
  imagesFor,
  addImage,
  removeImage,
  attachImages,
};
