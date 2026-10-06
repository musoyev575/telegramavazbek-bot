/**
 * Utilitalar: narx/sana formatlash, telefon validatsiyasi, HTML escape, sahifalash.
 */
import assert from 'node:assert/strict';
import { test } from 'node:test';
import {
  discountPercent,
  formatDateTime,
  formatPhone,
  formatPrice,
  parseDbDate,
} from '../src/utils/format.js';
import {
  clean,
  escapeLike,
  isAllowedImageUrl,
  isStrongPassword,
  normalizePhone,
  sanitizeUrl,
  toIntOrNull,
} from '../src/utils/validate.js';
import { escapeHtml, truncate } from '../src/utils/html.js';
import { paginate } from '../src/utils/paginate.js';

test('formatPrice: mingliklar bo‘sh joy bilan ajratiladi', () => {
  assert.equal(formatPrice(4500000), "4 500 000 so'm");
  assert.equal(formatPrice(4500000, { withCurrency: false }), '4 500 000');
  assert.equal(formatPrice(0), "0 so'm");
});

test('discountPercent: chegirma foizi to‘g‘ri hisoblanadi', () => {
  assert.equal(discountPercent(900000, 1000000), 10);
  assert.equal(discountPercent(1000000, 1000000), null, 'chegirma yo‘q');
  assert.equal(discountPercent(1000000, 900000), null, 'narx eski narxdan qimmat');
  assert.equal(discountPercent(500, null), null);
});

test('parseDbDate/formatDateTime: SQLite UTC vaqtini o‘qiydi', () => {
  const date = parseDbDate('2026-10-05 09:30:00');
  assert.ok(date instanceof Date);
  assert.equal(date.toISOString(), '2026-10-05T09:30:00.000Z');
  assert.match(formatDateTime('2026-10-05 09:30:00'), /^\d{2}\.\d{2}\.\d{4} \d{2}:\d{2}$/);
  assert.equal(formatDateTime(null), '—');
});

test('normalizePhone/formatPhone: +998 formatiga keltiradi', () => {
  assert.equal(normalizePhone('90 123 45 67'), '+998901234567');
  assert.equal(normalizePhone('+998 (90) 123-45-67'), '+998901234567');
  assert.equal(normalizePhone('12345'), null);
  assert.equal(formatPhone('+998901234567'), '+998 90 123 45 67');
});

test('validate: uzunlik va tip cheklovlari', () => {
  assert.equal(clean('  Ali   Valiyev  '), 'Ali Valiyev');
  assert.equal(clean('a'.repeat(600), 10).length, 10);
  assert.equal(toIntOrNull('42'), 42);
  assert.equal(toIntOrNull(''), null);
  assert.equal(toIntOrNull('abc'), null);
  assert.ok(isStrongPassword('Parol12345'));
  assert.ok(!isStrongPassword('parol'), 'qisqa parol rad etiladi');
  assert.ok(!isStrongPassword('parolparol'), 'raqamsiz parol rad etiladi');
});

test('escapeLike: LIKE belgilari neytrallashtiriladi', () => {
  assert.equal(escapeLike('100%_test'), '100\\%\\_test');
});

test('sanitizeUrl: faqat http(s) sxemalari qabul qilinadi', () => {
  assert.equal(sanitizeUrl('https://example.com/a.png'), 'https://example.com/a.png');
  assert.equal(sanitizeUrl('javascript:alert(1)'), '');
  assert.equal(sanitizeUrl('data:text/html;base64,AAAA'), '');
});

test('isAllowedImageUrl: ichki yo‘l va tashqi havola', () => {
  assert.ok(isAllowedImageUrl('https://example.com/photo.jpg'));
  assert.ok(isAllowedImageUrl('/uploads/p-123.png'));
  assert.ok(!isAllowedImageUrl('/etc/passwd'));
  assert.ok(!isAllowedImageUrl('/uploads/../../secret.txt'));
});

test('escapeHtml: HTML injection oldini oladi', () => {
  assert.equal(escapeHtml('<script>alert(1)</script>'), '&lt;script&gt;alert(1)&lt;/script&gt;');
  assert.equal(escapeHtml('Ali & Valiyev'), 'Ali &amp; Valiyev');
  assert.equal(truncate('abcdefghij', 5), 'abcd…');
});

test('paginate: sahifalash chegaralari', () => {
  const items = Array.from({ length: 23 }, (_, index) => index + 1);
  const first = paginate(items, 1, 10);
  assert.equal(first.items.length, 10);
  assert.equal(first.totalPages, 3);
  assert.equal(first.hasNext, true);
  assert.equal(first.hasPrev, false);

  const last = paginate(items, 99, 10);
  assert.equal(last.page, 3, 'sahifa chegaradan oshsa oxirgi sahifaga tushadi');
  assert.equal(last.items.length, 3);
  assert.equal(last.hasNext, false);
});
