/**
 * Aksiyalar (chegirmalar) va promokodlar API'si.
 * Chegirma oddiy model: `old_price` kiritiladi — bot avtomatik foizni hisoblaydi.
 * Promokodlar feature-flag (`FEATURE_PROMOCODES`) ostida ishlaydi.
 */
import { Router } from 'express';
import productModel from '../../models/productModel.js';
import promotionModel from '../../models/promotionModel.js';
import auditService from '../../services/auditService.js';
import config from '../../config/index.js';
import { clean, isPositiveInt, toIntOrNull } from '../../utils/validate.js';

const router = Router();

// --- Aksiyadagi mahsulotlar ---
router.get('/sale', (_req, res) => {
  const items = productModel.search({ onSale: true, includeInactive: true, perPage: 200 }).items;
  res.json({ ok: true, data: { items, total: items.length } });
});

/** Chegirma qo'llash: eski narxni kiritish */
router.post('/:productId/discount', (req, res) => {
  const productId = Number(req.params.productId);
  const product = productModel.findById(productId, { includeInactive: true });
  if (!product) {
    res.status(404).json({ ok: false, error: { code: 'not_found', message: 'Mahsulot topilmadi' } });
    return;
  }

  const oldPrice = toIntOrNull(req.body?.oldPrice);
  const price = toIntOrNull(req.body?.price);

  if (oldPrice === null || oldPrice <= 0) {
    res.status(400).json({ ok: false, error: { code: 'validation', message: 'Eski narx kiritilishi shart' } });
    return;
  }
  if (oldPrice <= (price ?? product.price)) {
    res.status(400).json({
      ok: false,
      error: { code: 'validation', message: 'Eski narx joriy narxdan katta bo‘lishi kerak' },
    });
    return;
  }

  const updated = productModel.update(productId, {
    oldPrice,
    ...(price !== null && price > 0 ? { price } : {}),
  });

  auditService.log({
    actor: req.admin.username,
    action: 'discount_applied',
    entity: 'product',
    entityId: productId,
    details: { oldPrice, price: updated.price },
    ip: req.ip,
  });

  res.json({ ok: true, data: updated });
});

/** Chegirmani olib tashlash */
router.delete('/:productId/discount', (req, res) => {
  const productId = Number(req.params.productId);
  const product = productModel.findById(productId, { includeInactive: true });
  if (!product) {
    res.status(404).json({ ok: false, error: { code: 'not_found', message: 'Mahsulot topilmadi' } });
    return;
  }

  const updated = productModel.update(productId, { oldPrice: null });
  auditService.log({
    actor: req.admin.username,
    action: 'discount_removed',
    entity: 'product',
    entityId: productId,
    ip: req.ip,
  });
  res.json({ ok: true, data: updated });
});

/** Mashhur (⭐) belgisini yoqish/o'chirish */
router.patch('/:productId/featured', (req, res) => {
  const productId = Number(req.params.productId);
  const product = productModel.findById(productId, { includeInactive: true });
  if (!product) {
    res.status(404).json({ ok: false, error: { code: 'not_found', message: 'Mahsulot topilmadi' } });
    return;
  }

  const featured = Boolean(req.body?.featured);
  const updated = productModel.update(productId, { isFeatured: featured });
  auditService.log({
    actor: req.admin.username,
    action: featured ? 'featured_on' : 'featured_off',
    entity: 'product',
    entityId: productId,
    ip: req.ip,
  });
  res.json({ ok: true, data: updated });
});

// ---------------------------------------------------------------------------
//  Promokodlar (feature-flag: FEATURE_PROMOCODES)
// ---------------------------------------------------------------------------
router.get('/promocodes', (_req, res) => {
  res.json({ ok: true, data: { enabled: config.features.promocodes, items: promotionModel.list() } });
});

router.post('/promocodes', (req, res) => {
  const code = clean(req.body?.code, 32).toUpperCase();
  const discountType = clean(req.body?.discountType, 16) || 'percent';
  const discountValue = toIntOrNull(req.body?.discountValue);

  if (!config.features.promocodes) {
    res.status(400).json({
      ok: false,
      error: { code: 'disabled', message: 'Promokodlar hozircha o‘chirilgan (FEATURE_PROMOCODES=1 qilib yoqing)' },
    });
    return;
  }
  if (!/^[A-Z0-9-]{3,32}$/.test(code)) {
    res.status(400).json({ ok: false, error: { code: 'validation', message: 'Promokod kodi noto‘g‘ri' } });
    return;
  }
  if (!['percent', 'fixed'].includes(discountType) || !isPositiveInt(discountValue, { min: 1 })) {
    res.status(400).json({ ok: false, error: { code: 'validation', message: 'Chegirma qiymati noto‘g‘ri' } });
    return;
  }
  if (promotionModel.findByCode(code)) {
    res.status(409).json({ ok: false, error: { code: 'duplicate', message: 'Bu kod allaqachon mavjud' } });
    return;
  }

  const promo = promotionModel.create({
    code,
    discountType,
    discountValue,
    minAmount: toIntOrNull(req.body?.minAmount) ?? 0,
    usageLimit: toIntOrNull(req.body?.usageLimit),
    expiresAt: clean(req.body?.expiresAt, 20) || null,
  });

  auditService.log({
    actor: req.admin.username,
    action: 'promocode_created',
    entity: 'promocode',
    entityId: promo.id,
    details: { code, discountType, discountValue },
    ip: req.ip,
  });

  res.status(201).json({ ok: true, data: promo });
});

router.patch('/promocodes/:id', (req, res) => {
  const id = Number(req.params.id);
  const promo = promotionModel.list().find((item) => item.id === id);
  if (!promo) {
    res.status(404).json({ ok: false, error: { code: 'not_found', message: 'Promokod topilmadi' } });
    return;
  }

  const updated = promotionModel.update(id, {
    ...(req.body?.discountValue !== undefined ? { discountValue: toIntOrNull(req.body.discountValue) } : {}),
    ...(req.body?.isActive !== undefined ? { isActive: Boolean(req.body.isActive) } : {}),
    ...(req.body?.usageLimit !== undefined ? { usageLimit: toIntOrNull(req.body.usageLimit) } : {}),
  });

  auditService.log({ actor: req.admin.username, action: 'promocode_updated', entity: 'promocode', entityId: id, ip: req.ip });
  res.json({ ok: true, data: updated });
});

router.delete('/promocodes/:id', (req, res) => {
  const id = Number(req.params.id);
  const removed = promotionModel.remove(id);
  auditService.log({ actor: req.admin.username, action: 'promocode_deleted', entity: 'promocode', entityId: id, ip: req.ip });
  res.json({ ok: true, data: { removed: Boolean(removed) } });
});

export default router;
