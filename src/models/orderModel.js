/**
 * Buyurtmalar modeli: yozish va o'qish amallari.
 * Biznes-logika (ombor, status o'tishlari) `services/orderService.js` da — bu yerda
 * faqat ma'lumotlarga kirish.
 */
import { getDb } from '../database/db.js';
import { insertRow, updateRow } from './helpers.js';
import { escapeLike } from '../utils/validate.js';

export function insert(data) {
  const { id } = insertRow('orders', {
    order_number: data.orderNumber,
    user_id: data.userId,
    status: data.status ?? 'new',
    subtotal: data.subtotal ?? 0,
    discount_total: data.discountTotal ?? 0,
    delivery_fee: data.deliveryFee ?? 0,
    promo_discount: data.promoDiscount ?? 0,
    total: data.total ?? 0,
    promo_code: data.promoCode ?? null,
    delivery_method: data.deliveryMethod,
    payment_method: data.paymentMethod,
    payment_status: data.paymentStatus ?? 'pending',
    customer_name: data.customerName,
    customer_phone: data.customerPhone,
    customer_address: data.customerAddress ?? null,
    comment: data.comment ?? null,
  });
  return id;
}

export function insertItem(orderId, item) {
  return insertRow('order_items', {
    order_id: orderId,
    product_id: item.productId ?? null,
    product_name: item.productName,
    brand: item.brand ?? null,
    model: item.model ?? null,
    color: item.color ?? null,
    warranty: item.warranty ?? null,
    unit_price: item.unitPrice,
    old_price: item.oldPrice ?? null,
    quantity: item.quantity,
    total: item.total,
  });
}

export function addHistory(orderId, { status, comment = null, changedBy = 'system' }) {
  return insertRow('order_status_history', {
    order_id: orderId,
    status,
    comment,
    changed_by: changedBy,
  });
}

export function findById(id) {
  const db = getDb();
  const order = db.prepare('SELECT * FROM orders WHERE id = ?').get(id);
  if (!order) return null;
  return decorate(order, db);
}

export function findByNumber(orderNumber) {
  const db = getDb();
  const order = db.prepare('SELECT * FROM orders WHERE order_number = ?').get(orderNumber);
  if (!order) return null;
  return decorate(order, db);
}

function decorate(order, db = getDb()) {
  return {
    ...order,
    items: db.prepare('SELECT * FROM order_items WHERE order_id = ? ORDER BY id ASC').all(order.id),
    history: db
      .prepare('SELECT * FROM order_status_history WHERE order_id = ? ORDER BY id DESC')
      .all(order.id),
    customer: db.prepare('SELECT * FROM users WHERE id = ?').get(order.user_id) ?? null,
  };
}

export function listByUser(userId, { limit = 10, offset = 0 } = {}) {
  const db = getDb();
  const items = db
    .prepare('SELECT * FROM orders WHERE user_id = ? ORDER BY created_at DESC, id DESC LIMIT ? OFFSET ?')
    .all(userId, limit, offset);
  const { total } = db.prepare('SELECT COUNT(*) AS total FROM orders WHERE user_id = ?').get(userId);
  return { items, total };
}

export function list({ status = null, query = '', limit = 20, offset = 0 } = {}) {
  const db = getDb();
  const where = [];
  const params = {};
  if (status) {
    where.push('o.status = @status');
    params.status = status;
  }
  if (query) {
    where.push(
      "(LOWER(o.order_number) LIKE LOWER(@q) ESCAPE '\\' OR LOWER(o.customer_name) LIKE LOWER(@q) ESCAPE '\\' OR o.customer_phone LIKE @q OR CAST(o.id AS TEXT) = @exact)",
    );
    params.q = `%${escapeLike(query)}%`;
    params.exact = query;
  }
  const clause = where.length ? `WHERE ${where.join(' AND ')}` : '';

  const items = db
    .prepare(
      `SELECT o.*, u.telegram_id AS user_telegram_id, u.username AS user_username,
              (SELECT COUNT(*) FROM order_items oi WHERE oi.order_id = o.id) AS items_count,
              (SELECT COALESCE(SUM(oi.quantity), 0) FROM order_items oi WHERE oi.order_id = o.id) AS units_count
       FROM orders o
       LEFT JOIN users u ON u.id = o.user_id
       ${clause}
       ORDER BY o.created_at DESC, o.id DESC
       LIMIT @limit OFFSET @offset`,
    )
    .all({ ...params, limit, offset });

  const { total } = db.prepare(`SELECT COUNT(*) AS total FROM orders o ${clause}`).get(params);
  return { items, total };
}

/** Status bilan birga vaqt belgilarini yozish (accepted_at / delivered_at / cancelled_at) */
export function applyStatus(id, status, { handledBy = null } = {}) {
  const db = getDb();
  const setters = ['status = @status', "updated_at = datetime('now')"];
  const params = { id, status };
  if (status === 'accepted') setters.push("accepted_at = COALESCE(accepted_at, datetime('now'))");
  if (status === 'delivered') setters.push("delivered_at = datetime('now')");
  if (status === 'cancelled') setters.push("cancelled_at = datetime('now')");
  if (handledBy) {
    setters.push('handled_by = @handledBy');
    params.handledBy = handledBy;
  }
  db.prepare(`UPDATE orders SET ${setters.join(', ')} WHERE id = @id`).run(params);
  return findById(id);
}

export function setPaymentStatus(id, paymentStatus) {
  return updateRow('orders', id, { payment_status: paymentStatus });
}

/** Bugungi buyurtmalar soni (buyurtma raqamini generatsiya qilish uchun) */
export function countToday() {
  return getDb().prepare("SELECT COUNT(*) AS total FROM orders WHERE date(created_at) = date('now')").get()?.total ?? 0;
}

export function countByStatus() {
  return getDb().prepare('SELECT status, COUNT(*) AS total FROM orders GROUP BY status').all();
}

export default {
  insert,
  insertItem,
  addHistory,
  findById,
  findByNumber,
  listByUser,
  list,
  applyStatus,
  setPaymentStatus,
  countToday,
  countByStatus,
};
