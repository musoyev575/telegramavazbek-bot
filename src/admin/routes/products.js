/**
 * Mahsulotlar API: ro'yxat, qo'shish, tahrirlash, o'chirish, narx va ombor, rasm yuklash.
 * Barcha kirish ma'lumotlari validatsiyadan o'tadi; o'zgartirishlar audit jurnaliga yoziladi.
 */
import crypto from 'node:crypto';
import path from 'node:path';
import fs from 'node:fs';
import { Router } from 'express';
import multer from 'multer';
import config from '../../config/index.js';
import productModel from '../../models/productModel.js';
import categoryModel from '../../models/categoryModel.js';
import auditService from '../../services/auditService.js';
import { requireRole } from '../auth.js';
import { PAGE_SIZE } from '../../config/constants.js';
import { clean, isAllowedImageUrl, isPositiveInt, toIntOrNull } from '../../utils/validate.js';

const router = Router();

// --- Rasm yuklash sozlamalari ---
const ALLOWED_MIME = new Map([
  ['image/jpeg', '.jpg'],
  ['image/png', '.png'],
  ['image/webp', '.webp'],
  ['image/gif', '.gif'],
]);

const upload = multer({
  storage: multer.diskStorage({
    destination: (_req, _file, done) => {
      fs.mkdirSync(config.paths.uploads, { recursive: true });
      done(null, config.paths.uploads);
    },
    filename: (_req, file, done) => {
      const extension = ALLOWED_MIME.get(file.mimetype) ?? '.bin';
      done(null, `p-${Date.now()}-${crypto.randomBytes(6).toString('hex')}${extension}`);
    },
  }),
  limits: { fileSize: 5 * 1024 * 1024, files: 1 },
  fileFilter: (_req, file, done) => {
    if (!ALLOWED_MIME.has(file.mimetype)) {
      const error = new Error('Faqat JPG, PNG, WEBP yoki GIF rasmlar yuklanadi');
      error.statusCode = 400;
      error.code = 'invalid_file';
      done(error);
      return;
    }
    done(null, true);
  },
});

/** Mahsulot maydonlarini tekshirish va tozalash */
function parseProductPayload(body = {}, { partial = false } = {}) {
  const errors = [];
  const data = {};
  const readString = (key, max = 120) => (body[key] === undefined ? undefined : clean(body[key], max));

  if (!partial || body.brand !== undefined) {
    const brand = readString('brand', 60);
    if (!brand) errors.push('Brend majburiy');
    else data.brand = brand;
  }
  if (!partial || body.model !== undefined) {
    const model = readString('model', 120);
    if (!model) errors.push('Model majburiy');
    else data.model = model;
  }
  if (!partial || body.price !== undefined) {
    const price = toIntOrNull(body.price);
    if (price === null || price < 0) errors.push('Narx musbat son bo‘lishi kerak');
    else data.price = price;
  }
  if (body.oldPrice !== undefined) {
    const oldPrice = toIntOrNull(body.oldPrice);
    if (oldPrice !== null && oldPrice < 0) errors.push('Eski narx musbat son bo‘lishi kerak');
    else data.oldPrice = oldPrice;
  }
  if (body.stock !== undefined) {
    const stock = toIntOrNull(body.stock) ?? 0;
    if (stock < 0) errors.push('Ombor qoldig‘i manfiy bo‘lishi mumkin emas');
    else data.stock = stock;
  }
  for (const [key, max] of [
    ['screen', 120],
    ['camera', 120],
    ['battery', 80],
    ['processor', 120],
    ['os', 80],
    ['color', 60],
    ['warranty', 80],
    ['description', 1200],
  ]) {
    if (body[key] !== undefined) data[key] = readString(key, max) || null;
  }
  for (const key of ['ram', 'storage']) {
    if (body[key] !== undefined) {
      const value = toIntOrNull(body[key]);
      if (value !== null && !isPositiveInt(value, { min: 1, max: 4096 })) errors.push(`${key.toUpperCase()} qiymati noto‘g‘ri`);
      else data[key] = value;
    }
  }
  if (body.categoryId !== undefined) {
    const categoryId = toIntOrNull(body.categoryId);
    data.categoryId = categoryId;
  }
  if (body.isActive !== undefined) data.isActive = Boolean(body.isActive);
  if (body.isFeatured !== undefined) data.isFeatured = Boolean(body.isFeatured);

  if (data.oldPrice !== undefined && data.oldPrice !== null && data.price !== undefined && data.oldPrice <= data.price) {
    errors.push('Eski narx joriy narxdan katta bo‘lishi kerak (chegirma ko‘rinishi uchun)');
  }

  return { errors, data };
}

// --- Ro'yxat ---
router.get('/', (req, res) => {
  const page = Math.max(1, Number(req.query.page) || 1);
  const perPage = Math.min(100, Number(req.query.perPage) || PAGE_SIZE.ADMIN);
  const result = productModel.search({
    query: clean(req.query.q, 60),
    brand: req.query.brand ? clean(req.query.brand, 60) : null,
    stockOnly: req.query.inStock === '1',
    onSale: req.query.onSale === '1',
    includeInactive: true,
    page,
    perPage,
    sort: req.query.sort || 'new',
  });

  res.json({ ok: true, data: result });
});

// --- Filtr variantlari ---
router.get('/meta', (_req, res) => {
  res.json({
    ok: true,
    data: {
      categories: categoryModel.list({ activeOnly: false }),
      filterValues: productModel.filterValues(),
    },
  });
});

router.get('/:id', (req, res) => {
  const product = productModel.findById(Number(req.params.id), { includeInactive: true });
  if (!product) {
    res.status(404).json({ ok: false, error: { code: 'not_found', message: 'Mahsulot topilmadi' } });
    return;
  }
  res.json({ ok: true, data: product });
});

// --- Yaratish ---
router.post('/', (req, res) => {
  const { errors, data } = parseProductPayload(req.body);
  if (errors.length) {
    res.status(400).json({ ok: false, error: { code: 'validation', message: errors.join('. ') } });
    return;
  }

  const images = Array.isArray(req.body.images) ? req.body.images.filter(isAllowedImageUrl).slice(0, 8) : [];
  const product = productModel.create({ ...data, images });

  auditService.log({
    actor: req.admin.username,
    action: 'product_created',
    entity: 'product',
    entityId: product.id,
    details: { brand: product.brand, model: product.model, price: product.price },
    ip: req.ip,
  });

  res.status(201).json({ ok: true, data: product });
});

// --- Tahrirlash ---
router.put('/:id', (req, res) => {
  const id = Number(req.params.id);
  const existing = productModel.findById(id, { includeInactive: true });
  if (!existing) {
    res.status(404).json({ ok: false, error: { code: 'not_found', message: 'Mahsulot topilmadi' } });
    return;
  }

  const { errors, data } = parseProductPayload(req.body, { partial: true });
  if (errors.length) {
    res.status(400).json({ ok: false, error: { code: 'validation', message: errors.join('. ') } });
    return;
  }

  const product = productModel.update(id, data);
  auditService.log({
    actor: req.admin.username,
    action: 'product_updated',
    entity: 'product',
    entityId: id,
    details: data,
    ip: req.ip,
  });

  res.json({ ok: true, data: product });
});

// --- O'chirish (faqat superadmin/admin) ---
router.delete('/:id', requireRole('superadmin', 'admin'), (req, res) => {
  const id = Number(req.params.id);
  const existing = productModel.findById(id, { includeInactive: true });
  if (!existing) {
    res.status(404).json({ ok: false, error: { code: 'not_found', message: 'Mahsulot topilmadi' } });
    return;
  }

  productModel.remove(id);
  auditService.log({
    actor: req.admin.username,
    action: 'product_deleted',
    entity: 'product',
    entityId: id,
    details: { brand: existing.brand, model: existing.model },
    ip: req.ip,
  });

  res.json({ ok: true, data: { deleted: true } });
});

// --- Narxni tez o'zgartirish ---
router.patch('/:id/price', (req, res) => {
  const id = Number(req.params.id);
  const product = productModel.findById(id, { includeInactive: true });
  if (!product) {
    res.status(404).json({ ok: false, error: { code: 'not_found', message: 'Mahsulot topilmadi' } });
    return;
  }

  const price = toIntOrNull(req.body?.price);
  const oldPrice = toIntOrNull(req.body?.oldPrice);

  if (price === null || price < 0) {
    res.status(400).json({ ok: false, error: { code: 'validation', message: 'Narx noto‘g‘ri' } });
    return;
  }
  if (oldPrice !== null && oldPrice <= price) {
    res.status(400).json({
      ok: false,
      error: { code: 'validation', message: 'Eski narx joriy narxdan katta bo‘lishi kerak' },
    });
    return;
  }

  const updated = productModel.update(id, { price, oldPrice: oldPrice ?? null });
  auditService.log({
    actor: req.admin.username,
    action: 'price_changed',
    entity: 'product',
    entityId: id,
    details: { from: product.price, to: price, oldPrice },
    ip: req.ip,
  });

  res.json({ ok: true, data: updated });
});

// --- Omborni tez o'zgartirish ---
router.patch('/:id/stock', (req, res) => {
  const id = Number(req.params.id);
  const product = productModel.findById(id, { includeInactive: true });
  if (!product) {
    res.status(404).json({ ok: false, error: { code: 'not_found', message: 'Mahsulot topilmadi' } });
    return;
  }

  const stock = toIntOrNull(req.body?.stock);
  if (stock === null || stock < 0) {
    res.status(400).json({ ok: false, error: { code: 'validation', message: 'Ombor qoldig‘i noto‘g‘ri' } });
    return;
  }

  const updated = productModel.update(id, { stock });
  auditService.log({
    actor: req.admin.username,
    action: 'stock_changed',
    entity: 'product',
    entityId: id,
    details: { from: product.stock, to: stock },
    ip: req.ip,
  });

  res.json({ ok: true, data: updated });
});

// --- Rasm yuklash ---
router.post('/upload/image', upload.single('image'), (req, res) => {
  if (!req.file) {
    res.status(400).json({ ok: false, error: { code: 'invalid_file', message: 'Rasm yuklanmadi' } });
    return;
  }
  const url = `/uploads/${path.basename(req.file.filename)}`;
  auditService.log({ actor: req.admin.username, action: 'image_uploaded', entity: 'file', entityId: url, ip: req.ip });
  res.status(201).json({ ok: true, data: { url } });
});

// --- Mahsulotga rasm qo'shish / o'chirish ---
router.post('/:id/images', (req, res) => {
  const id = Number(req.params.id);
  const product = productModel.findById(id, { includeInactive: true });
  const url = clean(req.body?.url, 500);

  if (!product) {
    res.status(404).json({ ok: false, error: { code: 'not_found', message: 'Mahsulot topilmadi' } });
    return;
  }
  if (!isAllowedImageUrl(url)) {
    res.status(400).json({ ok: false, error: { code: 'validation', message: 'Rasm manzili noto‘g‘ri' } });
    return;
  }

  const image = productModel.addImage(id, url, Number(req.body?.sortOrder) || 999);
  auditService.log({ actor: req.admin.username, action: 'image_added', entity: 'product', entityId: id, details: { url }, ip: req.ip });
  res.status(201).json({ ok: true, data: image });
});

router.delete('/:id/images/:imageId', (req, res) => {
  const removed = productModel.removeImage(Number(req.params.imageId));
  auditService.log({
    actor: req.admin.username,
    action: 'image_removed',
    entity: 'product',
    entityId: req.params.id,
    details: { imageId: req.params.imageId },
    ip: req.ip,
  });
  res.json({ ok: true, data: { removed: Boolean(removed) } });
});

export default router;
