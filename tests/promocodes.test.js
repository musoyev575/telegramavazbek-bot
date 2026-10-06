/**
 * Promokodlar (FEATURE_PROMOCODES yoqilgan holatda).
 *
 * Diqqat: bu fayl ataylab dinamik import ishlatadi — feature-flag o'qilishi uchun
 * `process.env` modullar yuklanishidan OLDIN o'rnatilishi kerak.
 */
import assert from 'node:assert/strict';
import { after, before, test } from 'node:test';

process.env.FEATURE_PROMOCODES = '1';

let db;
let promotionModel;
let orderService;
let cartService;
let productModel;
let userModel;
let teardown;

before(async () => {
  const helper = await import('./helpers/db.js');
  db = helper.freshDatabase();
  teardown = helper.teardownDatabase;
  promotionModel = (await import('../src/models/promotionModel.js')).default;
  orderService = (await import('../src/services/orderService.js')).default;
  cartService = (await import('../src/services/cartService.js')).default;
  productModel = (await import('../src/models/productModel.js')).default;
  userModel = (await import('../src/models/userModel.js')).default;
  const config = (await import('../src/config/index.js')).config;
  assert.equal(config.features.promocodes, true, 'feature-flag yoqilgan bo‘lishi kerak');
});

after(() => teardown?.());

test('promokod: foizli chegirma hisoblanadi', () => {
  const promo = promotionModel.create({ code: 'SALE10', discountType: 'percent', discountValue: 10 });

  const result = promotionModel.apply('sale10', 1000000);
  assert.equal(result.ok, true, result.reason);
  assert.equal(result.discount, 100000);
  assert.equal(result.promo.code, 'SALE10');
  void promo;
});

test('promokod: minimal summadan past buyurtmaga qo‘llanmaydi', () => {
  promotionModel.create({ code: 'BIG', discountType: 'fixed', discountValue: 100000, minAmount: 5000000 });
  const result = promotionModel.apply('BIG', 1000000);
  assert.equal(result.ok, false);
  assert.match(result.reason, /dan yuqori/);
});

test('promokod: muddati o‘tgan kod rad etiladi', () => {
  promotionModel.create({ code: 'OLD', discountType: 'percent', discountValue: 5, expiresAt: '2020-01-01' });
  const result = promotionModel.apply('OLD', 1000000);
  assert.equal(result.ok, false);
  assert.match(result.reason, /muddati tugagan/);
});

test('promokod: o‘chirilgan kod ishlamaydi', () => {
  const promo = promotionModel.create({ code: 'OFF', discountType: 'percent', discountValue: 5 });
  promotionModel.update(promo.id, { isActive: false });
  assert.equal(promotionModel.apply('OFF', 1000000).ok, false);
});

test('buyurtma: promokod qo‘llanadi va ishlatilish soni oshadi', () => {
  const user = userModel.upsertFromTelegram({ id: 888001, first_name: 'Promo' });
  const product = productModel.search({ perPage: 1 }).items[0];
  cartService.addItem(user.id, product.id, 2);
  promotionModel.create({ code: 'NEWYEAR', discountType: 'percent', discountValue: 10 });

  const result = orderService.createFromCart({
    userId: user.id,
    customerName: 'Promo Mijoz',
    customerPhone: '+998901234567',
    address: 'Toshkent, Mirzo Ulug‘bek 1-uy',
    promoCode: 'NEWYEAR',
  });

  assert.equal(result.ok, true, result.message);

  const order = result.order;
  const expectedDiscount = Math.round(order.subtotal * 0.1);
  assert.equal(order.promo_discount, expectedDiscount);
  assert.equal(order.promo_code, 'NEWYEAR');
  assert.equal(order.total, order.subtotal + order.delivery_fee - expectedDiscount);

  const promo = promotionModel.findByCode('NEWYEAR');
  assert.equal(promo.used_count, 1, 'ishlatilish soni oshadi');
});

test('buyurtma: yaroqsiz promokodda buyurtma yaratilmaydi', () => {
  const user = userModel.upsertFromTelegram({ id: 888002, first_name: 'Xato' });
  const product = productModel.search({ perPage: 1 }).items[0];
  cartService.addItem(user.id, product.id, 1);

  const result = orderService.createFromCart({
    userId: user.id,
    customerName: 'Xato Mijoz',
    customerPhone: '+998901234567',
    address: 'Toshkent',
    promoCode: 'YOQ-KOD',
  });

  assert.equal(result.ok, false);
  assert.equal(result.reason, 'promo_invalid');
});
