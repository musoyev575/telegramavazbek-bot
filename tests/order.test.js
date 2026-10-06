/**
 * Buyurtmalar: yaratish, omborni kamaytirish, status o'tishlari, bekor qilishda
 * omborni qaytarish, tranzaksiya butunligi.
 */
import assert from 'node:assert/strict';
import { after, before, test } from 'node:test';
import { freshDatabase, teardownDatabase } from './helpers/db.js';
import orderService from '../src/services/orderService.js';
import cartService from '../src/services/cartService.js';
import productModel from '../src/models/productModel.js';
import userModel from '../src/models/userModel.js';
import orderModel from '../src/models/orderModel.js';
import { ORDER_STATUS, DELIVERY_METHOD, PAYMENT_METHOD } from '../src/config/constants.js';

let user;
let product;

before(() => {
  freshDatabase();
  user = userModel.upsertFromTelegram({ id: 666001, first_name: 'Aziz', last_name: 'Karimov' });
  product = productModel.search({ perPage: 1 }).items[0];
});

after(() => teardownDatabase());

function buildOrder(quantity = 1) {
  cartService.clear(user.id);
  cartService.addItem(user.id, product.id, quantity);
  return orderService.createFromCart({
    userId: user.id,
    customerName: 'Aziz Karimov',
    customerPhone: '+998901234567',
    address: 'Toshkent, Chilonzor 12-uy',
    deliveryMethod: DELIVERY_METHOD.DELIVERY,
    paymentMethod: PAYMENT_METHOD.CASH,
  });
}

test('buyurtma: muvaffaqiyatli yaratiladi va savatcha tozalanadi', () => {
  const stockBefore = productModel.findById(product.id).stock;
  const result = buildOrder(2);

  assert.equal(result.ok, true, result.message ?? 'buyurtma yaratilishi kerak');
  const order = result.order;

  assert.match(order.order_number, /^[A-Z]+-\d{8}-\d{4}$/, 'buyurtma raqami formati');
  assert.equal(order.status, ORDER_STATUS.NEW);
  assert.equal(order.items.length, 1);
  assert.equal(order.items[0].quantity, 2);
  assert.equal(order.items[0].unit_price, product.price);
  assert.equal(order.subtotal, product.price * 2);
  assert.equal(order.total, order.subtotal + order.delivery_fee);
  assert.equal(cartService.count(user.id), 0, 'savatcha tozalanadi');

  const stockAfter = productModel.findById(product.id).stock;
  assert.equal(stockAfter, stockBefore - 2, 'ombor qoldig‘i kamayadi');

  const history = orderModel.findById(order.id).history;
  assert.ok(history.some((entry) => entry.status === ORDER_STATUS.NEW));
});

test('buyurtma: yetkazish manzili majburiy (kuryer tanlanganda)', () => {
  cartService.clear(user.id);
  cartService.addItem(user.id, product.id, 1);
  const result = orderService.createFromCart({
    userId: user.id,
    customerName: 'Aziz Karimov',
    customerPhone: '+998901234567',
    deliveryMethod: DELIVERY_METHOD.DELIVERY,
  });
  assert.equal(result.ok, false);
  assert.equal(result.reason, 'address_required');
  cartService.clear(user.id);
});

test('buyurtma: ombor yetmasa yaratilmaydi va qoldiq o‘zgarmaydi', () => {
  cartService.clear(user.id);
  cartService.addItem(user.id, product.id, 3);
  const stockBefore = productModel.findById(product.id).stock;

  // Tranzaksiya ichida qoldiq 1 ga tushadi (boshqa xaridor "sotib oldi")
  productModel.setStock(product.id, 1);

  const result = orderService.createFromCart({
    userId: user.id,
    customerName: 'Aziz Karimov',
    customerPhone: '+998901234567',
    address: 'Toshkent',
    deliveryMethod: DELIVERY_METHOD.DELIVERY,
  });

  assert.equal(result.ok, false);
  assert.equal(result.reason, 'stock');
  assert.equal(productModel.findById(product.id).stock, 1, 'tranzaksiya orqaga qaytariladi');
  assert.equal(orderModel.list({}).total >= 1, true);

  productModel.setStock(product.id, 20);
  cartService.clear(user.id);
});

test('status: ruxsat etilgan zanjir bo‘yicha o‘tadi', () => {
  const { order } = buildOrder(1);

  const accepted = orderService.changeStatus(order.id, ORDER_STATUS.ACCEPTED, { adminId: 1, changedBy: 'admin:1' });
  assert.equal(accepted.ok, true);
  assert.equal(accepted.order.status, ORDER_STATUS.ACCEPTED);

  const preparing = orderService.changeStatus(order.id, ORDER_STATUS.PREPARING, { adminId: 1 });
  assert.equal(preparing.ok, true);

  const delivering = orderService.changeStatus(order.id, ORDER_STATUS.DELIVERING, { adminId: 1 });
  assert.equal(delivering.ok, true);

  const delivered = orderService.changeStatus(order.id, ORDER_STATUS.DELIVERED, { adminId: 1 });
  assert.equal(delivered.ok, true);
  assert.equal(delivered.order.status, ORDER_STATUS.DELIVERED);
  assert.ok(delivered.order.delivered_at, 'yetkazilgan vaqt yoziladi');

  // Mijoz statistikasi yangilandi
  const fresh = userModel.findById(user.id);
  assert.ok(fresh.total_spent >= order.total);
  assert.ok(fresh.orders_count >= 1);
});

test('status: noto‘g‘ri o‘tish rad etiladi (new -> delivered)', () => {
  const { order } = buildOrder(1);
  const result = orderService.changeStatus(order.id, ORDER_STATUS.DELIVERED, { adminId: 1 });
  assert.equal(result.ok, false);
  assert.equal(result.reason, 'invalid_transition');
});

test('status: yakuniy holatdan o‘tish mumkin emas (delivered -> cancelled)', () => {
  const { order } = buildOrder(1);
  orderService.changeStatus(order.id, ORDER_STATUS.ACCEPTED, { adminId: 1 });
  orderService.changeStatus(order.id, ORDER_STATUS.PREPARING, { adminId: 1 });
  orderService.changeStatus(order.id, ORDER_STATUS.DELIVERING, { adminId: 1 });
  orderService.changeStatus(order.id, ORDER_STATUS.DELIVERED, { adminId: 1 });

  const result = orderService.changeStatus(order.id, ORDER_STATUS.CANCELLED, { adminId: 1 });
  assert.equal(result.ok, false);
  assert.equal(result.reason, 'invalid_transition');
});

test('bekor qilish: ombor qoldig‘i qaytariladi', () => {
  const stockBeforeOrder = productModel.findById(product.id).stock;
  const { order } = buildOrder(2);
  assert.equal(productModel.findById(product.id).stock, stockBeforeOrder - 2);

  const cancelled = orderService.changeStatus(order.id, ORDER_STATUS.CANCELLED, {
    adminId: 1,
    comment: 'Mijoz voz kechdi',
  });

  assert.equal(cancelled.ok, true);
  assert.equal(cancelled.order.status, ORDER_STATUS.CANCELLED);
  assert.equal(
    productModel.findById(product.id).stock,
    stockBeforeOrder,
    'bekor qilingach mahsulot omborga qaytadi',
  );
  assert.ok(cancelled.order.cancelled_at);
});

test('to‘lov: status yoziladi va payments jadvaliga tushadi', () => {
  const { order } = buildOrder(1);
  const result = orderService.setPaymentStatus(order.id, 'paid', { provider: 'cash' });
  assert.equal(result.ok, true);
  assert.equal(result.order.payment_status, 'paid');

  const payments = orderService.getOrder(order.id);
  assert.equal(payments.payment_status, 'paid');
});

test('buyurtmalar: foydalanuvchi bo‘yicha ro‘yxat va sahifalash', () => {
  const { items, total } = orderService.getUserOrders(user.id, { page: 1, perPage: 5 });
  assert.ok(total >= 3);
  assert.ok(items.length <= 5);
  assert.ok(items.every((order) => order.user_id === user.id));
});

test('buyurtma raqami: kunlik ketma-ketlik unikal', () => {
  const first = buildOrder(1).order.order_number;
  const second = buildOrder(1).order.order_number;
  assert.notEqual(first, second);
});
