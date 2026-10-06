/**
 * Savatcha servisi.
 *
 * Qoidalar:
 *  - Miqdor hech qachon ombordagi qoldiqdan oshmaydi.
 *  - Narx har doim mahsulotning joriy narxi (admin narxni o'zgartirsa — yangilanadi).
 *  - Yetkazib berish narxi: do'kondan olib ketishda 0, aks holda sozlamalardagi summa;
 *    `free_delivery_threshold` dan yuqori buyurtmalarda bepul.
 */
import cartModel from '../models/cartModel.js';
import settingsModel from '../models/settingsModel.js';
import productModel from '../models/productModel.js';
import { DELIVERY_METHOD } from '../config/constants.js';

const MAX_QUANTITY_PER_ITEM = 10;

function emptyTotals() {
  return {
    itemsCount: 0,
    subtotal: 0,
    discountTotal: 0,
    deliveryFee: 0,
    freeDelivery: false,
    total: 0,
  };
}

/** Savatchani hisob-kitob bilan qaytaradi */
export function getCart(userId, { deliveryMethod = DELIVERY_METHOD.DELIVERY } = {}) {
  const cart = cartModel.getOrCreate(userId);
  const rawItems = cartModel.itemsWithProducts(cart.id);

  let subtotal = 0;
  let discountTotal = 0;
  let itemsCount = 0;

  const items = rawItems.map((item) => {
    const lineTotal = item.price * item.quantity;
    const savedPerItem = Math.max(0, (item.old_price ?? item.price) - item.price);
    subtotal += lineTotal;
    discountTotal += savedPerItem * item.quantity;
    itemsCount += item.quantity;
    return {
      ...item,
      lineTotal,
      savedTotal: savedPerItem * item.quantity,
      isAvailable: item.is_active === 1 && item.stock >= item.quantity,
      stockIssue: item.is_active !== 1 ? 'inactive' : item.stock < item.quantity ? 'stock' : null,
    };
  });

  if (itemsCount === 0) {
    return { cart, items, totals: emptyTotals() };
  }

  const fee = settingsModel.getInt('delivery_fee', 30000);
  const freeFrom = settingsModel.getInt('free_delivery_threshold', 2000000);
  const isPickup = deliveryMethod === DELIVERY_METHOD.PICKUP;
  const freeDelivery = isPickup || (freeFrom > 0 && subtotal >= freeFrom);
  const deliveryFee = freeDelivery ? 0 : fee;

  return {
    cart,
    items,
    totals: {
      itemsCount,
      subtotal,
      discountTotal,
      deliveryFee,
      freeDelivery,
      total: subtotal + deliveryFee,
    },
  };
}

export function count(userId) {
  return cartModel.countItems(userId);
}

/**
 * Savatchaga mahsulot qo'shadi.
 * Qaytadi: { ok, reason?, quantity?, product? }
 */
export function addItem(userId, productId, quantity = 1) {
  const product = productModel.findById(productId);
  if (!product) return { ok: false, reason: 'not_found' };
  if (product.stock <= 0) return { ok: false, reason: 'out_of_stock', product };

  const cart = cartModel.getOrCreate(userId);
  const existing = cartModel.findItem(cart.id, productId);
  const current = existing?.quantity ?? 0;
  const desired = Math.min(current + quantity, MAX_QUANTITY_PER_ITEM);

  if (desired > product.stock) {
    if (current >= product.stock) return { ok: false, reason: 'not_enough_stock', product, available: product.stock };
    cartModel.setItemQuantity(cart.id, productId, Math.min(product.stock, desired), product.price);
    return { ok: true, product, quantity: Math.min(product.stock, desired), limited: true };
  }

  cartModel.setItemQuantity(cart.id, productId, desired, product.price);
  return { ok: true, product, quantity: desired };
}

/** Miqdorni aniq qiymatga o'rnatadi (0 => o'chiriladi) */
export function setQuantity(userId, productId, quantity) {
  const product = productModel.findById(productId);
  if (!product) return { ok: false, reason: 'not_found' };

  const cart = cartModel.getOrCreate(userId);
  const value = Math.trunc(Number(quantity));

  if (!Number.isFinite(value) || value <= 0) {
    cartModel.removeItem(cart.id, productId);
    return { ok: true, removed: true };
  }
  const capped = Math.min(value, MAX_QUANTITY_PER_ITEM);
  if (capped > product.stock) return { ok: false, reason: 'not_enough_stock', available: product.stock };

  cartModel.setItemQuantity(cart.id, productId, capped, product.price);
  return { ok: true, quantity: capped };
}

export function removeItem(userId, productId) {
  const cart = cartModel.getOrCreate(userId);
  return cartModel.removeItem(cart.id, productId);
}

export function clear(userId) {
  const cart = cartModel.getOrCreate(userId);
  return cartModel.clear(cart.id);
}

/**
 * Buyurtma berishdan oldingi tekshiruv: barcha mahsulotlar faol va omborda yetarli mi?
 * Qaytadi: { ok, issues: [{ productId, name, reason }] }
 */
export function validateForCheckout(userId) {
  const { items } = getCart(userId);
  const issues = [];

  for (const item of items) {
    if (item.is_active !== 1) {
      issues.push({ productId: item.product_id, name: `${item.brand} ${item.model}`, reason: 'inactive' });
    } else if (item.stock < item.quantity) {
      issues.push({
        productId: item.product_id,
        name: `${item.brand} ${item.model}`,
        reason: 'stock',
        available: item.stock,
      });
    }
  }

  if (items.length === 0) issues.push({ productId: null, name: null, reason: 'empty' });
  return { ok: issues.length === 0, issues };
}

export default { getCart, count, addItem, setQuantity, removeItem, clear, validateForCheckout, emptyTotals };
