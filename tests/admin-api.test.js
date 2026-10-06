/**
 * Admin panel API'si — haqiqiy HTTP orqali uchdan-uchiga (end-to-end) tekshiruv:
 * autentifikatsiya, CSRF himoyasi, mahsulot CRUD, narx/ombor, buyurtma statusi,
 * foydalanuvchilar va hisobotlar.
 */
import assert from 'node:assert/strict';
import { after, before, test } from 'node:test';
import { freshDatabase, teardownDatabase } from './helpers/db.js';
import { createAdminServer } from '../src/admin/server.js';
import cartService from '../src/services/cartService.js';
import orderService from '../src/services/orderService.js';
import userModel from '../src/models/userModel.js';
import productModel from '../src/models/productModel.js';
import { DELIVERY_METHOD } from '../src/config/constants.js';

const ADMIN = { username: 'admin', password: 'Admin12345!' };
const JSON_HEADERS = { 'Content-Type': 'application/json', 'X-Requested-With': 'fetch' };

let server;
let base;
let cookie = '';
let adminId = null;
let orderId = null;

async function call(path, { method = 'GET', body, headers = {}, auth = true } = {}) {
  const response = await fetch(`${base}/api/admin${path}`, {
    method,
    headers: {
      ...JSON_HEADERS,
      ...(auth && cookie ? { Cookie: cookie } : {}),
      ...headers,
    },
    ...(body === undefined ? {} : { body: JSON.stringify(body) }),
  });
  const payload = await response.json().catch(() => null);
  return { status: response.status, payload, response };
}

before(async () => {
  freshDatabase();
  const app = createAdminServer();
  server = app.listen(0, '127.0.0.1');
  await new Promise((resolve) => server.once('listening', resolve));
  base = `http://127.0.0.1:${server.address().port}`;

  // Buyurtma yaratib qo'yamiz (status o'tishini tekshirish uchun)
  const user = userModel.upsertFromTelegram({ id: 777001, first_name: 'Test', last_name: 'Mijoz' });
  const product = productModel.search({ perPage: 1 }).items[0];
  cartService.addItem(user.id, product.id, 1);
  const created = orderService.createFromCart({
    userId: user.id,
    customerName: 'Test Mijoz',
    customerPhone: '+998901112233',
    address: 'Toshkent, Yunusobod 5-uy',
    deliveryMethod: DELIVERY_METHOD.DELIVERY,
  });
  orderId = created.order.id;
});

after(async () => {
  await new Promise((resolve) => server.close(resolve));
  teardownDatabase();
});

test('himoya: tizimga kirmasdan API javob bermaydi (401)', async () => {
  const { status } = await call('/products', { auth: false });
  assert.equal(status, 401);
});

test('kirish: noto‘g‘ri parol rad etiladi', async () => {
  const { status, payload } = await call('/auth/login', {
    method: 'POST',
    body: { username: ADMIN.username, password: 'notogri-parol' },
    auth: false,
  });
  assert.equal(status, 401);
  assert.equal(payload.ok, false);
});

test('kirish: to‘g‘ri parol bilan sessiya cookie o‘rnatiladi', async () => {
  const { status, payload, response } = await call('/auth/login', {
    method: 'POST',
    body: ADMIN,
    auth: false,
  });
  assert.equal(status, 200);
  assert.equal(payload.ok, true);

  const setCookie = response.headers.getSetCookie?.() ?? [response.headers.get('set-cookie')];
  const raw = setCookie.filter(Boolean)[0];
  assert.ok(raw, 'Set-Cookie sarlavhasi bo‘lishi kerak');
  assert.match(raw, /HttpOnly/i, 'cookie HttpOnly bo‘lishi shart');
  assert.match(raw, /SameSite=Strict/i, 'cookie SameSite=Strict bo‘lishi shart');

  cookie = raw.split(';')[0];
  adminId = payload.data.admin.id;
  assert.ok(adminId);
});

test('CSRF: sarlavhasiz o‘zgartiruvchi so‘rov bloklanadi (403)', async () => {
  const { status } = await call('/products', {
    method: 'POST',
    body: { brand: 'Test', model: 'X', price: 1000 },
    headers: { 'X-Requested-With': '' },
  });
  assert.equal(status, 403);
});

test('mahsulotlar: ro‘yxat va meta ma’lumotlar', async () => {
  const list = await call('/products?perPage=5');
  assert.equal(list.status, 200);
  assert.ok(list.payload.data.items.length > 0);

  const meta = await call('/products/meta');
  assert.equal(meta.status, 200);
  assert.ok(meta.payload.data.categories.length > 0);
});

test('mahsulotlar: yangi mahsulot qo‘shish va validatsiya', async () => {
  const invalid = await call('/products', { method: 'POST', body: { brand: 'Nokia' } });
  assert.equal(invalid.status, 400, 'model va narx majburiy');

  const created = await call('/products', {
    method: 'POST',
    body: {
      brand: 'Nokia',
      model: 'Nokia 3310 (2026)',
      price: 990000,
      oldPrice: 1200000,
      ram: 1,
      storage: 8,
      stock: 3,
      color: 'Ko‘k',
      description: 'Afsonaviy model qaytdi',
      images: ['https://example.com/nokia.jpg'],
    },
  });
  assert.equal(created.status, 201);
  assert.equal(created.payload.data.brand, 'Nokia');
  assert.equal(created.payload.data.stock, 3);
  assert.equal(created.payload.data.images.length, 1);
});

test('mahsulotlar: narxni o‘zgartirish va chegirma validatsiyasi', async () => {
  const list = await call('/products?q=Nokia');
  const product = list.payload.data.items[0];

  const bad = await call(`/products/${product.id}/price`, {
    method: 'PATCH',
    body: { price: 1000000, oldPrice: 900000 },
  });
  assert.equal(bad.status, 400, 'eski narx joriy narxdan katta bo‘lishi kerak');

  const ok = await call(`/products/${product.id}/price`, {
    method: 'PATCH',
    body: { price: 890000, oldPrice: 990000 },
  });
  assert.equal(ok.status, 200);
  assert.equal(ok.payload.data.price, 890000);
  assert.equal(ok.payload.data.old_price, 990000);
});

test('mahsulotlar: omborni o‘zgartirish (manfiy qiymat rad etiladi)', async () => {
  const list = await call('/products?q=Nokia');
  const product = list.payload.data.items[0];

  const negative = await call(`/products/${product.id}/stock`, { method: 'PATCH', body: { stock: -5 } });
  assert.equal(negative.status, 400);

  const ok = await call(`/products/${product.id}/stock`, { method: 'PATCH', body: { stock: 7 } });
  assert.equal(ok.status, 200);
  assert.equal(ok.payload.data.stock, 7);
});

test('mahsulotlar: o‘chirish', async () => {
  const list = await call('/products?q=Nokia');
  const product = list.payload.data.items[0];
  const removed = await call(`/products/${product.id}`, { method: 'DELETE' });
  assert.equal(removed.status, 200);
  assert.equal(removed.payload.data.deleted, true);

  const after = await call(`/products?q=Nokia`);
  assert.equal(after.payload.data.items.length, 0);
});

test('buyurtmalar: ro‘yxat, batafsil va statusni o‘zgartirish', async () => {
  const list = await call('/orders');
  assert.equal(list.status, 200);
  assert.ok(list.payload.data.items.length > 0);
  assert.ok(list.payload.data.statuses.length >= 8, 'barcha statuslar qaytariladi');

  const detail = await call(`/orders/${orderId}`);
  assert.equal(detail.status, 200);
  assert.deepEqual(detail.payload.data.allowedTransitions, ['accepted', 'cancelled']);

  const invalid = await call(`/orders/${orderId}/status`, { method: 'PATCH', body: { status: 'delivered' } });
  assert.equal(invalid.status, 400, 'new -> delivered ruxsat etilmagan');

  const accepted = await call(`/orders/${orderId}/status`, {
    method: 'PATCH',
    body: { status: 'accepted', comment: 'Test orqali qabul qilindi' },
  });
  assert.equal(accepted.status, 200);
  assert.equal(accepted.payload.data.status, 'accepted');

  const history = await call(`/orders/${orderId}`);
  assert.ok(history.payload.data.history.some((entry) => entry.status === 'accepted'));
});

test('statistika: dashboard va savdo grafigi', async () => {
  const dashboard = await call('/stats/dashboard');
  assert.equal(dashboard.status, 200);
  assert.ok(dashboard.payload.data.users >= 1);
  assert.ok(dashboard.payload.data.allOrders >= 1);
  assert.equal(dashboard.payload.data.revenueSeries.length, 7);

  const revenue = await call('/stats/revenue?days=14');
  assert.equal(revenue.payload.data.series.length, 14);
});

test('foydalanuvchilar: ro‘yxat, batafsil va bloklash', async () => {
  const list = await call('/users?q=Test');
  assert.equal(list.status, 200);
  const user = list.payload.data.items[0];
  assert.ok(user);

  const detail = await call(`/users/${user.id}`);
  assert.ok(detail.payload.data.orders.length >= 1);

  const blocked = await call(`/users/${user.id}/block`, { method: 'PATCH', body: { blocked: true } });
  assert.equal(blocked.status, 200);
  assert.equal(blocked.payload.data.is_blocked, 1);

  await call(`/users/${user.id}/block`, { method: 'PATCH', body: { blocked: false } });
});

test('aksiyalar: chegirma qo‘llash va olib tashlash', async () => {
  const products = await call('/products?perPage=3');
  const product = products.payload.data.items[0];

  const applied = await call(`/promotions/${product.id}/discount`, {
    method: 'POST',
    body: { oldPrice: product.price + 500000 },
  });
  assert.equal(applied.status, 200);
  assert.equal(applied.payload.data.old_price, product.price + 500000);

  const sale = await call('/promotions/sale');
  assert.ok(sale.payload.data.items.some((item) => item.id === product.id));

  const removed = await call(`/promotions/${product.id}/discount`, { method: 'DELETE' });
  assert.equal(removed.payload.data.old_price, null);
});

test('sozlamalar: yangilash va validatsiya', async () => {
  const settings = await call('/settings');
  assert.equal(settings.status, 200);

  const invalid = await call('/settings', { method: 'PUT', body: { delivery_fee: -100 } });
  assert.equal(invalid.status, 400);

  const updated = await call('/settings', {
    method: 'PUT',
    body: { delivery_fee: 35000, shop_phone: '+998 71 111 22 33' },
  });
  assert.equal(updated.status, 200);
  assert.equal(Number(updated.payload.data.delivery_fee), 35000);
  assert.equal(updated.payload.data.shop_phone, '+998 71 111 22 33');
});

test('audit: o‘zgartirishlar jurnalga yozilgan', async () => {
  const audit = await call('/audit?limit=50');
  assert.equal(audit.status, 200);
  const actions = audit.payload.data.map((entry) => entry.action);
  assert.ok(actions.includes('login'), 'kirish yozilgan');
  assert.ok(actions.includes('product_created'), 'mahsulot qo‘shilishi yozilgan');
  assert.ok(actions.includes('order_status_changed'), 'buyurtma statusi yozilgan');
  assert.ok(actions.includes('settings_updated'), 'sozlamalar yozilgan');
});

test('chiqish: sessiya bekor qilinadi (401)', async () => {
  const logout = await call('/auth/logout', { method: 'POST' });
  assert.equal(logout.status, 200);

  const afterLogout = await call('/products');
  assert.equal(afterLogout.status, 401, 'chiqqandan keyin API yopiq');
});
