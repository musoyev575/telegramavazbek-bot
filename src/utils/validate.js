/**
 * Kirish ma'lumotlarini tekshirish (input validation).
 * Har qanday foydalanuvchi kiritmasi shu funksiyalardan o'tadi — SQL injection va
 * buzilgan ma'lumotlardan himoya qatlami.
 */

/** Bosh-oyoq bo'shliqlarni olib tashlash va uzunlikni cheklash */
export function clean(value, maxLength = 500) {
  if (value === null || value === undefined) return '';
  return String(value).replace(/\s+/g, ' ').trim().slice(0, maxLength);
}

const UZ_PHONE = /^(998)?(\d{2})(\d{3})(\d{2})(\d{2})$/;

/** Telefon raqamni +998XXXXXXXXX ko'rinishiga keltiradi, noto'g'ri bo'lsa null */
export function normalizePhone(raw) {
  const digits = String(raw || '').replace(/\D/g, '');
  const match = UZ_PHONE.exec(digits);
  if (!match) return null;
  return `+998${match[2]}${match[3]}${match[4]}${match[5]}`;
}

export function isValidPhone(raw) {
  return normalizePhone(raw) !== null;
}

export function isValidName(raw) {
  const value = clean(raw, 80);
  return value.length >= 2 && /^[A-Za-zА-Яа-яЁёЎўҒғҚқҲҳ'\-\s.]+$/u.test(value);
}

export function isValidAddress(raw) {
  const value = clean(raw, 200);
  return value.length >= 8;
}

export function isValidUsername(raw) {
  return /^[a-zA-Z0-9._-]{3,32}$/.test(String(raw || '').trim());
}

/** Admin panel parol siyosati: kamida 8 belgi, harf va raqam */
export function isStrongPassword(raw) {
  const value = String(raw || '');
  return value.length >= 8 && /[A-Za-z]/.test(value) && /\d/.test(value);
}

export function isPositiveInt(value, { min = 0, max = Number.MAX_SAFE_INTEGER } = {}) {
  const parsed = Number(value);
  return Number.isInteger(parsed) && parsed >= min && parsed <= max;
}

export function toIntOrNull(value) {
  if (value === '' || value === null || value === undefined) return null;
  const parsed = Number.parseInt(value, 10);
  return Number.isFinite(parsed) ? parsed : null;
}

const IMAGE_EXT = /\.(jpe?g|png|webp|gif|avif)$/i;
const HTTP_URL = /^https?:\/\/[^\s]+$/i;

/** Mahsulot rasmi: http(s) havola yoki /uploads/... ichki yo'l */
export function isAllowedImageUrl(raw) {
  const value = clean(raw, 500);
  if (!value) return false;
  if (HTTP_URL.test(value)) return true;
  return value.startsWith('/uploads/') && IMAGE_EXT.test(value);
}

/** LIKE qidiruvida % va _ belgilarini neytrallashtirish */
export function escapeLike(raw) {
  return String(raw || '').replace(/[\\%_]/g, (char) => `\\${char}`);
}

/**
 * URL'ni xavfsiz qilish: faqat http(s) sxemalari qoladi (javascript: va data: bloklanadi).
 */
export function sanitizeUrl(raw) {
  const value = clean(raw, 500);
  if (!value) return '';
  try {
    const url = new URL(value);
    if (!['http:', 'https:'].includes(url.protocol)) return '';
    return url.toString();
  } catch {
    return '';
  }
}

export default {
  clean,
  normalizePhone,
  isValidPhone,
  isValidName,
  isValidAddress,
  isValidUsername,
  isStrongPassword,
  isPositiveInt,
  toIntOrNull,
  isAllowedImageUrl,
  escapeLike,
  sanitizeUrl,
};
