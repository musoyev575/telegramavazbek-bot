/**
 * Katalog servisi: mahsulot qidiruvi, filtrlash va ko'rsatish uchun tayyorlash.
 * Bu qatlam bot ham, admin panel ham foydalanadigan yagona biznes-logika.
 */
import productModel from '../models/productModel.js';
import categoryModel from '../models/categoryModel.js';
import settingsModel from '../models/settingsModel.js';
import { SORT, PAGE_SIZE } from '../config/constants.js';

/** Katalog qidiruvi (sahifalash bilan) */
export function catalog({
  query = '',
  brand = null,
  categoryId = null,
  minPrice = null,
  maxPrice = null,
  ram = null,
  storage = null,
  color = null,
  inStock = false,
  onSale = false,
  sort = SORT.NEW,
  page = 1,
  perPage = PAGE_SIZE.CATALOG,
} = {}) {
  return productModel.search({
    query,
    brand,
    categoryId,
    minPrice: Number.isFinite(minPrice) ? minPrice : undefined,
    maxPrice: Number.isFinite(maxPrice) ? maxPrice : undefined,
    ram,
    storage,
    color,
    stockOnly: inStock,
    onSale,
    sort,
    page,
    perPage,
  });
}

export function getProduct(id, options) {
  return productModel.findById(id, options);
}

export function getRawProduct(id) {
  return productModel.findById(id, { includeInactive: true });
}

export function brands() {
  return categoryModel.list({ activeOnly: true }).filter((category) => category.products_count > 0);
}

export function filterOptions() {
  return productModel.filterValues();
}

export function featured(limit = 5) {
  const rows = productModel.featured(limit);
  return rows.length ? rows : productModel.newArrivals(limit);
}

export function newArrivals(limit = 5) {
  return productModel.newArrivals(limit);
}

export function onSale(limit = 5) {
  return productModel.onSale(limit);
}

/** Ombordagi holat uchun qisqa matn (botda va admin panelda ishlatiladi) */
export function stockState(product) {
  const stock = Number(product?.stock ?? 0);
  if (stock <= 0) return { code: 'out', text: '❌ Hozirda mavjud emas' };
  if (stock <= 3) return { code: 'low', text: `🔥 Oxirgi ${stock} dona` };
  return { code: 'in', text: `✅ Omborda: ${stock} dona` };
}

export function deliveryInfo() {
  const fee = settingsModel.getInt('delivery_fee', 30000);
  const freeFrom = settingsModel.getInt('free_delivery_threshold', 2000000);
  return { fee, freeFrom };
}

export function shopInfo() {
  return {
    name: settingsModel.get('shop_name'),
    phone: settingsModel.get('shop_phone'),
    address: settingsModel.get('shop_address'),
    hours: settingsModel.get('shop_hours'),
    mapUrl: settingsModel.get('shop_map_url'),
    support: settingsModel.get('support_text'),
  };
}

export default {
  catalog,
  getProduct,
  getRawProduct,
  brands,
  filterOptions,
  featured,
  newArrivals,
  onSale,
  stockState,
  deliveryInfo,
  shopInfo,
};
