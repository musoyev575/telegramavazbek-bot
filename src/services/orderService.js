/**
 * Buyurtma servisi: buyurtma yaratish, status o'tishlari, omborni boshqarish.
 *
 * MUHIM (butunlik kafolati):
 *  - Buyurtma yaratish, omborni kamaytirish, tarix yozish va savatchani tozalash —
 *    hammasi BITTA tranzaksiya ichida. Xatolik bo'lsa hech narsa o'zgargan hisoblanadi.
 *  - Ombor qoldig'i manfiy bo'lib qolmaydi: `products.stock` CHECK cheklovi + oldindan tekshiruv.
 *  - Buyurtma bekor qilinsa, mahsulotlar omborga qaytariladi.
 */
import { inTransaction, getDb } from '../database/db.js';
import orderModel from '../models/orderModel.js';
import productModel from '../models/productModel.js';
import userModel from '../models/userModel.js';
import cartModel from '../models/cartModel.js';
import settingsModel from '../models/settingsModel.js';
import promotionModel from '../models/promotionModel.js';
import cartService from './cartService.js';
import config from '../config/index.js';
import logger from '../utils/logger.js';
import { DELIVERY_METHOD, PAYMENT_METHOD, ORDER_STATUS, ORDER_STATUS_FLOW, ORDER_STATUS_LABEL } from '../config/constants.js';

const log = logger.with('orderService');

/** TS-20261005-0007 ko'rinishidagi buyurtma raqami */
function buildOrderNumber() {
  const prefix = settingsModel.get('order_prefix', 'TS');
  const now = new Date();
  const stamp = `${now.getUTCFullYear()}${String(now.getUTCMonth() + 1).padStart(2, '0')}${String(
    now.getUTCDate(),
  ).padStart(2, '0')}`;
  const sequence = orderModel.countToday() + 1;
  return `${prefix}-${stamp}-${String(sequence).padStart(4, '0')}`;
}

export function canTransition(from, to) {
  const allowed = ORDER_STATUS_FLOW[from] ?? [];
  return allowed.includes(to);
}

export function statusLabel(status) {
  return ORDER_STATUS_LABEL[status] ?? status;
}

/** Buyurtma yaratish natijasi: { ok, order?, reason?, issues? } */
export function createFromCart({
  userId,
  customerName,
  customerPhone,
  address = null,
  deliveryMethod = DELIVERY_METHOD.DELIVERY,
  paymentMethod = PAYMENT_METHOD.CASH,
  comment = null,
  promoCode = null,
}) {
  const precheck = cartService.validateForCheckout(userId);
  if (!precheck.ok) {
    return { ok: false, reason: precheck.issues[0]?.reason ?? 'invalid_cart', issues: precheck.issues };
  }

  // Yetkazib berish manzili faqat kuryer tanlanganda majburiy
  if (deliveryMethod === DELIVERY_METHOD.DELIVERY && !address) {
    return { ok: false, reason: 'address_required' };
  }

  const { items, totals } = cartService.getCart(userId, { deliveryMethod });

  let promo = null;
  let promoDiscount = 0;
  if (promoCode && config.features.promocodes) {
    const result = promotionModel.apply(promoCode, totals.subtotal);
    if (!result.ok) return { ok: false, reason: 'promo_invalid', message: result.reason };
    promo = result.promo;
    promoDiscount = result.discount;
  }

  const total = Math.max(0, totals.subtotal + totals.deliveryFee - promoDiscount);

  try {
    const orderId = inTransaction(() => {
      // 1) Qoldiqni qayta tekshirish va band qilish (tranzaksiya ichida — race condition yo'q)
      for (const item of items) {
        const fresh = getDb()
          .prepare('SELECT id, stock, is_active FROM products WHERE id = ?')
          .get(item.product_id);
        if (!fresh || fresh.is_active !== 1) {
          throw new OrderError('inactive', `${item.brand} ${item.model} hozirda sotuvda yo'q`);
        }
        if (fresh.stock < item.quantity) {
          throw new OrderError('stock', `${item.brand} ${item.model}: omborda ${fresh.stock} dona qoldi`);
        }
        productModel.adjustStock(item.product_id, -item.quantity);
      }

      // 2) Buyurtma va elementlari
      const id = orderModel.insert({
        orderNumber: buildOrderNumber(),
        userId,
        status: ORDER_STATUS.NEW,
        subtotal: totals.subtotal,
        discountTotal: totals.discountTotal,
        deliveryFee: totals.deliveryFee,
        promoDiscount,
        total,
        promoCode: promo?.code ?? null,
        deliveryMethod,
        paymentMethod,
        paymentStatus: 'pending',
        customerName,
        customerPhone,
        customerAddress: deliveryMethod === DELIVERY_METHOD.PICKUP ? null : address,
        comment,
      });

      for (const item of items) {
        orderModel.insertItem(id, {
          productId: item.product_id,
          productName: `${item.brand} ${item.model}`,
          brand: item.brand,
          model: item.model,
          color: item.color,
          warranty: item.warranty,
          unitPrice: item.price,
          oldPrice: item.old_price,
          quantity: item.quantity,
          total: item.price * item.quantity,
        });
      }

      orderModel.addHistory(id, {
        status: ORDER_STATUS.NEW,
        comment: 'Buyurtma bot orqali yaratildi',
        changedBy: `user:${userId}`,
      });

      if (promo?.code) promotionModel.markUsed(promo.code);
      cartModel.clear(cartService.getCart(userId).cart.id);
      return id;
    });

    const order = orderModel.findById(orderId);
    userModel.update(userId, { phone: customerPhone });
    log.info(`Yangi buyurtma: ${order.order_number} (${order.total} so'm)`, { userId });
    return { ok: true, order };
  } catch (error) {
    if (error instanceof OrderError) {
      return { ok: false, reason: error.code, message: error.message };
    }
    log.error('Buyurtma yaratishda kutilmagan xatolik', error);
    throw error;
  }
}

class OrderError extends Error {
  constructor(code, message) {
    super(message);
    this.name = 'OrderError';
    this.code = code;
  }
}

/**
 * Buyurtma statusini o'zgartiradi (state machine orqali).
 * `adminId` — web panel administratori ID'si (bo'lmasa bot orqali admin).
 */
export function changeStatus(orderId, nextStatus, { adminId = null, changedBy = 'admin', comment = null } = {}) {
  const order = orderModel.findById(orderId);
  if (!order) return { ok: false, reason: 'not_found' };
  if (order.status === nextStatus) return { ok: true, order, unchanged: true };
  if (!canTransition(order.status, nextStatus)) {
    return { ok: false, reason: 'invalid_transition', from: order.status, to: nextStatus };
  }

  const updated = inTransaction(() => {
    // Bekor qilindi => mahsulotlar omborga qaytariladi
    if (nextStatus === ORDER_STATUS.CANCELLED) {
      for (const item of order.items) {
        if (item.product_id) productModel.adjustStock(item.product_id, item.quantity);
      }
    }

    const result = orderModel.applyStatus(orderId, nextStatus, { handledBy: adminId });
    orderModel.addHistory(orderId, {
      status: nextStatus,
      comment,
      changedBy: changedBy ?? (adminId ? `admin:${adminId}` : 'system'),
    });

    // Yetkazilganda mijoz statistikasi yangilanadi
    if (nextStatus === ORDER_STATUS.DELIVERED) {
      userModel.addOrderTotals(order.user_id, order.total);
    }

    // Onlayn to'lovda "to'landi" belgisi
    if (nextStatus === ORDER_STATUS.PAID) {
      orderModel.setPaymentStatus(orderId, 'paid');
    }

    return result;
  });

  log.info(`Buyurtma holati: ${order.order_number} ${order.status} -> ${nextStatus}`, { adminId });
  return { ok: true, order: updated, previousStatus: order.status };
}

export function setPaymentStatus(orderId, paymentStatus, { externalId = null, provider = null } = {}) {
  const order = orderModel.findById(orderId);
  if (!order) return { ok: false, reason: 'not_found' };

  inTransaction(() => {
    orderModel.setPaymentStatus(orderId, paymentStatus);
    getDb()
      .prepare(
        `INSERT INTO payments (order_id, provider, amount, status, external_id, paid_at)
         VALUES (@orderId, @provider, @amount, @status, @externalId, @paidAt)`,
      )
      .run({
        orderId,
        provider: provider ?? order.payment_method,
        amount: order.total,
        status: paymentStatus,
        externalId,
        paidAt: paymentStatus === 'paid' ? new Date().toISOString() : null,
      });
  });

  return { ok: true, order: orderModel.findById(orderId) };
}

export function getUserOrders(userId, { page = 1, perPage = 5 } = {}) {
  return orderModel.listByUser(userId, { limit: perPage, offset: (page - 1) * perPage });
}

export function getOrder(orderId) {
  return orderModel.findById(orderId);
}

export function getOrderByNumber(orderNumber) {
  return orderModel.findByNumber(orderNumber);
}

export function listOrders({ status = null, query = '', page = 1, perPage = 20 } = {}) {
  return orderModel.list({ status, query, limit: perPage, offset: (page - 1) * perPage });
}

export default {
  createFromCart,
  changeStatus,
  setPaymentStatus,
  canTransition,
  statusLabel,
  getUserOrders,
  getOrder,
  getOrderByNumber,
  listOrders,
};
