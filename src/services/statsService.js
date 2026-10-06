/**
 * Statistika servisi — admin panel dashboard'i va botdagi /statistika uchun (faqat o'qish).
 * Daromad hisobiga bekor qilinmagan buyurtmalar kiradi.
 */
import { getDb } from '../database/db.js';
import productModel from '../models/productModel.js';
import userModel from '../models/userModel.js';
import settingsModel from '../models/settingsModel.js';

const REVENUE_STATUSES = "('paid', 'preparing', 'delivering', 'delivered')";

export function totals() {
  const db = getDb();
  const revenue = db
    .prepare(`SELECT COALESCE(SUM(total), 0) AS total, COUNT(*) AS count FROM orders WHERE status IN ${REVENUE_STATUSES}`)
    .get();
  const todayRevenue = db
    .prepare(
      `SELECT COALESCE(SUM(total), 0) AS total, COUNT(*) AS count FROM orders
       WHERE status IN ${REVENUE_STATUSES} AND date(created_at) = date('now')`,
    )
    .get();
  const pending = db
    .prepare("SELECT COUNT(*) AS total FROM orders WHERE status IN ('new', 'accepted', 'awaiting_payment', 'paid', 'preparing')")
    .get();
  const allOrders = db.prepare('SELECT COUNT(*) AS total FROM orders').get();

  return {
    revenue: revenue.total,
    paidOrders: revenue.count,
    todayRevenue: todayRevenue.total,
    todayPaidOrders: todayRevenue.count,
    averageOrder: revenue.count ? Math.round(revenue.total / revenue.count) : 0,
    pendingOrders: pending.total,
    allOrders: allOrders.total,
    users: userModel.countAll(),
    newUsersToday: userModel.countNewToday(),
    products: productModel.countAll(),
    activeProducts: productModel.countAll({ activeOnly: true }),
  };
}

export function ordersByStatus() {
  return getDb().prepare('SELECT status, COUNT(*) AS total FROM orders GROUP BY status ORDER BY total DESC').all();
}

export function topProducts(limit = 5) {
  return getDb()
    .prepare(
      `SELECT oi.product_name AS name,
              SUM(oi.quantity) AS sold,
              SUM(oi.total)    AS revenue
       FROM order_items oi
       JOIN orders o ON o.id = oi.order_id
       WHERE o.status IN ${REVENUE_STATUSES}
       GROUP BY oi.product_name
       ORDER BY sold DESC, revenue DESC
       LIMIT ?`,
    )
    .all(limit);
}

/** Oxirgi N kun uchun kunlik savdo grafigi */
export function revenueSeries(days = 7) {
  const rows = getDb()
    .prepare(
      `SELECT date(created_at) AS day,
              COALESCE(SUM(total), 0) AS revenue,
              COUNT(*) AS orders
       FROM orders
       WHERE status IN ${REVENUE_STATUSES} AND created_at >= date('now', @from)
       GROUP BY day ORDER BY day ASC`,
    )
    .all({ from: `-${Math.max(1, days - 1)} days` });

  // Bo'sh kunlarni ham to'ldiramiz (grafik uzluksiz bo'lishi uchun)
  const map = new Map(rows.map((row) => [row.day, row]));
  const series = [];
  for (let index = days - 1; index >= 0; index -= 1) {
    const date = new Date();
    date.setUTCDate(date.getUTCDate() - index);
    const day = date.toISOString().slice(0, 10);
    const row = map.get(day);
    series.push({ day, revenue: row?.revenue ?? 0, orders: row?.orders ?? 0 });
  }
  return series;
}

/** Buyurtmalar statuslar kesimida (admin panel diagrammasi uchun) */
export function statusBreakdown() {
  const rows = ordersByStatus();
  return Object.fromEntries(rows.map((row) => [row.status, row.total]));
}

export function lowStock(limit = 10) {
  const threshold = settingsModel.getInt('low_stock_threshold', 3);
  return productModel.lowStock(threshold, limit);
}

export function dashboard() {
  return {
    ...totals(),
    byStatus: statusBreakdown(),
    topProducts: topProducts(5),
    revenueSeries: revenueSeries(7),
    lowStock: lowStock(5),
  };
}

export default { totals, ordersByStatus, statusBreakdown, topProducts, revenueSeries, lowStock, dashboard };
