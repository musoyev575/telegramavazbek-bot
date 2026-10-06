/**
 * Ko'rsatish (display) formatlash yordamchilari: narx, sana, telefon raqam, chegirma.
 */
import config from '../config/index.js';

/** 4500000 -> "4 500 000 so'm" */
export function formatPrice(amount, { withCurrency = true } = {}) {
  const value = Number(amount) || 0;
  const grouped = Math.round(value)
    .toString()
    .replace(/\B(?=(\d{3})+(?!\d))/g, ' ');
  return withCurrency ? `${grouped} ${config.currency}` : grouped;
}

/** 20 -> "20%", null -> null (chegirma foizi old_price asosida) */
export function discountPercent(price, oldPrice) {
  const base = Number(oldPrice) || 0;
  const current = Number(price) || 0;
  if (base <= 0 || current < 0 || current >= base) return null;
  return Math.round(((base - current) / base) * 100);
}

/** Chegirma bo'lsa: eski narx + foiz ko'rinishidagi matn */
export function formatDiscountText(price, oldPrice) {
  const percent = discountPercent(price, oldPrice);
  if (!percent) return null;
  return `${formatPrice(oldPrice)} → chegirma ${percent}%`;
}

/** SQLite'dagi UTC vaqtni ("YYYY-MM-DD HH:MM:SS") JS Date'ga o'giradi */
export function parseDbDate(value) {
  if (!value) return null;
  if (value instanceof Date) return value;
  const normalized = String(value).includes('T') ? String(value) : `${String(value).replace(' ', 'T')}Z`;
  const date = new Date(normalized);
  return Number.isNaN(date.getTime()) ? null : date;
}

/** "05.10.2026 14:30" */
export function formatDateTime(value, { withTime = true } = {}) {
  const date = parseDbDate(value);
  if (!date) return '—';
  const pad = (n) => String(n).padStart(2, '0');
  const d = `${pad(date.getDate())}.${pad(date.getMonth() + 1)}.${date.getFullYear()}`;
  if (!withTime) return d;
  return `${d} ${pad(date.getHours())}:${pad(date.getMinutes())}`;
}

/** "+998901234567" -> "+998 90 123 45 67" */
export function formatPhone(phone) {
  const digits = String(phone || '').replace(/\D/g, '');
  if (digits.length !== 12 || !digits.startsWith('998')) return String(phone || '—');
  return `+998 ${digits.slice(3, 5)} ${digits.slice(5, 8)} ${digits.slice(8, 10)} ${digits.slice(10)}`;
}

/** 12 -> "12 GB", null -> "—" */
export function formatGb(value, unit = 'GB') {
  return value ? `${value} ${unit}` : '—';
}

/** 128 -> "128 GB" */
export function formatStorage(value) {
  return value ? `${value} GB` : '—';
}

/** Buyurtma holati uchun qisqa matn */
export function shortId(value) {
  return String(value || '').slice(0, 8);
}

export default {
  formatPrice,
  discountPercent,
  formatDiscountText,
  formatDateTime,
  formatPhone,
  formatGb,
  formatStorage,
  parseDbDate,
  shortId,
};
