/**
 * Katalog: qidiruv, filtrlar, saralash, ombor cheklovlari, SQL injection himoyasi.
 */
import assert from 'node:assert/strict';
import { after, before, test } from 'node:test';
import { freshDatabase, teardownDatabase } from './helpers/db.js';
import productModel from '../src/models/productModel.js';
import productService from '../src/services/productService.js';
import { SORT } from '../src/config/constants.js';

let db;

before(() => {
  db = freshDatabase();
});

after(() => teardownDatabase());

test('katalog: demo mahsulotlar yuklangan', () => {
  const result = productModel.search({ perPage: 50 });
  assert.ok(result.total >= 10, `kutilgan kamida 10 mahsulot, olindi ${result.total}`);
  assert.ok(result.items[0].image, 'har bir mahsulotda rasm bo‘lishi kerak');
});

test('katalog: sahifalash ishlaydi', () => {
  const first = productModel.search({ page: 1, perPage: 4 });
  assert.equal(first.items.length, 4);
  assert.equal(first.hasPrev, false);
  assert.equal(first.hasNext, true);

  const second = productModel.search({ page: 2, perPage: 4 });
  assert.notEqual(first.items[0].id, second.items[0].id, 'ikkinchi sahifa boshqa mahsulotlarni beradi');
});

test('katalog: brend bo‘yicha filtr (katta-kichik harfga sezgir emas)', () => {
  const result = productModel.search({ brand: 'apple', perPage: 50 });
  assert.ok(result.total >= 2);
  assert.ok(result.items.every((item) => item.brand.toLowerCase() === 'apple'));
});

test('katalog: narx oralig‘i filtri', () => {
  const result = productModel.search({ minPrice: 3000000, maxPrice: 5000000, perPage: 50 });
  assert.ok(result.total > 0);
  assert.ok(result.items.every((item) => item.price >= 3000000 && item.price <= 5000000));
});

test('katalog: xotira va faqat omborda bor filtri', () => {
  const with256 = productModel.search({ storage: 256, perPage: 50 });
  assert.ok(with256.items.every((item) => item.storage === 256));

  // Ombordagi qoldiqni nolga tushiramiz — natijadan chiqib ketishi kerak
  const target = productModel.search({ perPage: 1 }).items[0];
  productModel.setStock(target.id, 0);

  const inStock = productModel.search({ stockOnly: true, perPage: 50 });
  assert.ok(!inStock.items.some((item) => item.id === target.id), 'qoldig‘i 0 bo‘lgan mahsulot chiqmasligi kerak');

  productModel.setStock(target.id, 5);
});

test('katalog: saralash (arzon -> qimmat)', () => {
  const result = productModel.search({ sort: SORT.PRICE_ASC, perPage: 50 });
  const prices = result.items.map((item) => item.price);
  assert.deepEqual(prices, [...prices].sort((a, b) => a - b));
});

test('katalog: aksiyadagi mahsulotlar (eski narx > joriy narx)', () => {
  const onSale = productModel.onSale(20);
  assert.ok(onSale.length > 0);
  assert.ok(onSale.every((item) => item.old_price > item.price));
});

test('qidiruv: model nomi bo‘yicha topadi', () => {
  const result = productService.catalog({ query: 'iPhone 15', perPage: 20 });
  assert.ok(result.total >= 1);
  assert.ok(result.items.some((item) => `${item.brand} ${item.model}`.includes('iPhone 15')));
});

test('xavfsizlik: SQL injection urinishi natija bermaydi va xatolik chiqarmaydi', () => {
  const malicious = "iPhone'; DROP TABLE products; --";
  const result = productModel.search({ query: malicious, perPage: 20 });
  assert.equal(result.total, 0, 'injection so‘rovi hech narsa qaytarmasligi kerak');

  // Jadval joyidami?
  const stillThere = productModel.search({ perPage: 5 });
  assert.ok(stillThere.total > 0, 'products jadvali buzilmagan');

  const wildcard = productModel.search({ query: '%', perPage: 50 });
  assert.equal(wildcard.total, 0, 'LIKE belgisi qidiruvni buzmaydi');
});

test('qidiruv: LIKE belgilarini neytrallashtirish', () => {
  const result = productModel.search({ query: '____', perPage: 20 });
  assert.equal(result.total, 0);
});

test('filtr variantlari va brendlar ro‘yxati', () => {
  const options = productService.filterOptions();
  assert.ok(options.brands.length >= 5);
  assert.ok(options.storages.length > 0);
  assert.ok(options.priceMin > 0);
  assert.ok(options.priceMax >= options.priceMin);

  const brands = productService.brands();
  assert.ok(brands.every((category) => category.products_count > 0), 'bo‘sh brendlar ko‘rinmaydi');
});

test('ombor: manfiy qoldiq bazaning o‘zida bloklanadi (CHECK)', () => {
  const product = productModel.search({ perPage: 1 }).items[0];
  assert.throws(() => productModel.adjustStock(product.id, -100000), /CHECK|constraint/i);
});

test('ombor holati matni: mavjud emas / oxirgi dona / yetarli', () => {
  const product = { stock: 0 };
  assert.match(productService.stockState(product).text, /mavjud emas/);
  assert.match(productService.stockState({ stock: 2 }).text, /Oxirgi 2 dona/);
  assert.match(productService.stockState({ stock: 10 }).text, /10 dona/);
});
