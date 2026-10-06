/**
 * Telefon sahifasi klaviaturasi.
 */
import { Markup } from 'telegraf';
import { cb } from './common.js';
import config from '../../config/index.js';

/**
 * @param {object} params
 * @param {object} params.product
 * @param {boolean} params.inStock
 * @param {boolean} params.isFavorite
 * @param {string} params.backAction - qaytish uchun callback_data
 */
export function productKeyboard({ product, inStock, isFavorite, backAction = 'nav:menu' }) {
  const rows = [];

  if (inStock) {
    rows.push([cb('🛒 Savatchaga qo‘shish', `product:add:${product.id}`)]);
    rows.push([cb('⚡️ Hozir sotib olish', `product:buy:${product.id}`)]);
  } else {
    rows.push([cb('❌ Hozirda mavjud emas', 'nav:noop')]);
  }

  const favoriteRow = [cb(isFavorite ? '💔 Sevimlilardan olib tashlash' : '❤️ Sevimlilarga qo‘shish', `product:fav:${product.id}`)];
  rows.push(favoriteRow);

  if (config.features.compare) {
    rows.push([cb('📊 Solishtirish', `product:compare:${product.id}`)]);
  }

  rows.push([cb('🔙 Orqaga', backAction), cb('🏠 Asosiy menyu', 'nav:menu')]);
  return Markup.inlineKeyboard(rows);
}

/** Savatga qo'shilgandan keyingi klaviatura */
export function addedToCartKeyboard(productId) {
  return Markup.inlineKeyboard([
    [cb('🛒 Savatchaga o‘tish', 'cart:open')],
    [cb('⬅️ Orqaga', `product:open:${productId}`)],
  ]);
}

export default { productKeyboard, addedToCartKeyboard };
