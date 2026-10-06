/**
 * Savatcha: qo'shish/o'chirish, miqdor chegaralari, yetkazish narxi hisob-kitobi.
 */
import assert from 'node:assert/strict';
import { after, before, test } from 'node:test';
import { freshDatabase, teardownDatabase } from './helpers/db.js';
import cartService from '../src/services/cartService.js';
import productModel from '../src/models/productModel.js';
import userModel from '../src/models/userModel.js';
import settingsModel from '../src/models/settingsModel.js';
import { DELIVERY_METHOD } from '../src/config/constants.js';

let user;
let products;

before(() => {
  freshDatabase();
  user = userModel.upsertFromTelegram({ id: 555001, first_name: 'Ali', last_name: 'Valiyev' });
  products = productModel.search({ perPage: 5 }).items;
});

after(() => teardownDatabase());

test('savatcha: mahsulot qo‘shish', () => {
  const result = cartService.addItem(user.id, products[0].id, 1);
  assert.equal(result.ok, true);
  assert.equal(result.quantity, 1);

  const cart = cartService.getCart(user.id);
  assert.equal(cart.items.length, 1);
  assert.equal(cart.totals.itemsCount, 1);
  assert.equal(cart.totals.subtotal, products[0].price);
});

test('savatcha: bir xil mahsulot qayta qo‘shilsa miqdor oshadi', () => {
  cartService.addItem(user.id, products[0].id, 1);
  const cart = cartService.getCart(user.id);
  const item = cart.items.find((entry) => entry.product_id === products[0].id);
  assert.equal(item.quantity, 2);
});

test('savatcha: miqdor ombordagi qoldiqdan oshmaydi', () => {
  const scarce = products[1];
  productModel.setStock(scarce.id, 2);

  const result = cartService.addItem(user.id, scarce.id, 5);
  assert.equal(result.ok, true);
  assert.ok(result.quantity <= 2, `miqdor 2 dan oshmasligi kerak, olindi ${result.quantity}`);

  const cart = cartService.getCart(user.id);
  const item = cart.items.find((entry) => entry.product_id === scarce.id);
  assert.ok(item.quantity <= 2);

  productModel.setStock(scarce.id, 10);
});

test('savatcha: omborda yo‘q mahsulot qo‘shilmaydi', () => {
  const out = products[2];
  productModel.setStock(out.id, 0);
  const result = cartService.addItem(user.id, out.id, 1);
  assert.equal(result.ok, false);
  assert.equal(result.reason, 'out_of_stock');
  productModel.setStock(out.id, 8);
});

test('savatcha: chegirma summasi hisoblanadi', () => {
  const discounted = productModel.search({ onSale: true, perPage: 1 }).items[0];
  const fresh = userModel.upsertFromTelegram({ id: 555002, first_name: 'Dilnoza' });

  cartService.addItem(fresh.id, discounted.id, 1);
  const cart = cartService.getCart(fresh.id);
  assert.equal(cart.totals.discountTotal, discounted.old_price - discounted.price);
});

test('savatcha: yetkazish narxi va bepul yetkazish chegarasi', () => {
  const fee = settingsModel.getInt('delivery_fee', 30000);
  const cheap = userModel.upsertFromTelegram({ id: 555003, first_name: 'Sardor' });

  // Bepul yetkazish chegarasini juda yuqori qilib qo'yamiz: yetkazish narxi qo'shilishi kerak
  const originalThreshold = settingsModel.get('free_delivery_threshold');
  settingsModel.set('free_delivery_threshold', '999999999');

  const cheapProduct = productModel.search({ sort: 'price_asc', perPage: 1 }).items[0];
  cartService.addItem(cheap.id, cheapProduct.id, 1);
  const withFee = cartService.getCart(cheap.id);
  assert.equal(withFee.totals.deliveryFee, fee);
  assert.equal(withFee.totals.total, withFee.totals.subtotal + fee);

  // Do'kondan olib ketish: yetkazish bepul
  const pickup = cartService.getCart(cheap.id, { deliveryMethod: DELIVERY_METHOD.PICKUP });
  assert.equal(pickup.totals.deliveryFee, 0);
  assert.equal(pickup.totals.total, pickup.totals.subtotal);

  settingsModel.set('free_delivery_threshold', originalThreshold);
});

test('savatcha: qimmat buyurtmada yetkazish bepul', () => {
  const threshold = settingsModel.getInt('free_delivery_threshold', 2000000);
  const big = userModel.upsertFromTelegram({ id: 555004, first_name: 'Kamola' });
  const expensive = productModel.search({ minPrice: threshold, perPage: 1 }).items[0];

  assert.ok(expensive, `narxi ${threshold} dan yuqori demo mahsulot bo‘lishi kerak`);
  cartService.addItem(big.id, expensive.id, 1);
  const cart = cartService.getCart(big.id);
  assert.equal(cart.totals.freeDelivery, true);
  assert.equal(cart.totals.deliveryFee, 0);
});

test('savatcha: miqdorni o‘zgartirish va 0 da o‘chirish', () => {
  cartService.setQuantity(user.id, products[0].id, 3);
  let cart = cartService.getCart(user.id);
  assert.equal(cart.items.find((item) => item.product_id === products[0].id).quantity, 3);

  cartService.setQuantity(user.id, products[0].id, 0);
  cart = cartService.getCart(user.id);
  assert.ok(!cart.items.some((item) => item.product_id === products[0].id), 'miqdor 0 bo‘lsa o‘chiriladi');
});

test('savatcha: tozalash', () => {
  cartService.addItem(user.id, products[0].id, 1);
  assert.ok(cartService.count(user.id) > 0);
  cartService.clear(user.id);
  assert.equal(cartService.count(user.id), 0);
});

test('savatcha: checkout tekshiruvi bo‘sh savatchani ushlaydi', () => {
  const empty = userModel.upsertFromTelegram({ id: 555005, first_name: 'Bo‘sh' });
  const validation = cartService.validateForCheckout(empty.id);
  assert.equal(validation.ok, false);
  assert.equal(validation.issues[0].reason, 'empty');
});
