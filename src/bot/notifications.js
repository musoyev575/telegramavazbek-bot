/**
 * Administratorlarga xabarnomalar (yangi buyurtma, status o'zgarishi) va
 * foydalanuvchiga status haqida xabar yuborish.
 *
 * Xabarlar `admins.telegram_id` ulangan barcha faol adminlarga yuboriladi.
 * Xabar yuborilmasa (bloklangan/ochirilgan) — log yoziladi va bot ishlashda davom etadi.
 */
import adminModel from '../models/adminModel.js';
import config from '../config/index.js';
import logger from '../utils/logger.js';
import { HTML, notifyAdmin } from './ui.js';
import { orderStatusKeyboard } from './keyboards/adminKeyboard.js';
import { newOrderNotification, statusChangedForUser, statusChangedNotification } from './texts.js';

const log = logger.with('notifications');

/**
 * Bot ishga tushganda `bot.telegram` shu yerga yoziladi. Shu tufayli admin panel
 * ham (alohida qatlam) mijozlarga xabar yubora oladi.
 * Bot ishlamayotgan bo'lsa (masalan --admin-only rejim) xabarlar o'tkazib yuboriladi.
 */
let telegramRef = null;

export function setTelegram(telegram) {
  telegramRef = telegram;
}

export function getTelegram() {
  return telegramRef;
}

/** Admin panelda buyurtmani ochish uchun havola */
export function orderPanelUrl(order) {
  const base = config.admin.publicUrl;
  return `${base}/#/orders?focus=${order.id}`;
}

export async function notifyNewOrder(telegram = null, order) {
  const client = telegram ?? telegramRef;
  if (!client) return 0;
  const admins = adminModel.withTelegram();
  if (admins.length === 0) {
    log.warn('Yangi buyurtma bor, lekin hech bir admin Telegram ID ulanmagan');
    return 0;
  }

  const text = newOrderNotification(order);
  const keyboard = orderStatusKeyboard(order, { panelUrl: orderPanelUrl(order) });

  const results = await Promise.all(
    admins.map((admin) => notifyAdmin(client, admin.telegram_id, text, keyboard)),
  );
  return results.filter(Boolean).length;
}

export async function notifyStatusChange(telegram = null, order, { previousStatus = null } = {}) {
  const client = telegram ?? telegramRef;
  if (!client) return 0;
  const admins = adminModel.withTelegram();
  if (admins.length === 0) return 0;

  const lines = [
    statusChangedNotification(order, order.status),
    previousStatus ? `Oldingi holat: ${previousStatus}` : null,
    '',
    `Mijoz: <b>${order.customer_name}</b> · ${order.customer_phone}`,
    `Summa: <b>${order.total.toLocaleString('ru-RU')} so'm</b>`,
  ].filter(Boolean);

  const keyboard = orderStatusKeyboard(order, { panelUrl: orderPanelUrl(order) });
  const results = await Promise.all(
    admins.map((admin) => notifyAdmin(client, admin.telegram_id, lines.join('\n'), keyboard)),
  );
  return results.filter(Boolean).length;
}

/** Foydalanuvchiga buyurtma holati haqida xabar (bot ishlamasa jim o'tadi) */
export async function notifyUser(telegram = null, order, status) {
  const client = telegram ?? telegramRef;
  const telegramId = order.customer?.telegram_id;
  if (!client || !telegramId) return false;

  try {
    await client.sendMessage(telegramId, statusChangedForUser(order, status), HTML);
    return true;
  } catch (error) {
    log.warn('Foydalanuvchiga xabar yuborilmadi', error?.response?.description ?? error);
    return false;
  }
}

export default { notifyNewOrder, notifyStatusChange, notifyUser, orderPanelUrl, setTelegram, getTelegram };
