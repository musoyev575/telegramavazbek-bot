/**
 * Administrator klaviaturalari: buyurtma statusini tez o'zgartirish va asosiy admin menyusi.
 */
import { Markup } from 'telegraf';
import { cb, statusButtons } from './common.js';
import { ORDER_STATUS_FLOW } from '../../config/constants.js';

/** Buyurtma xabariga biriktiriladigan status tugmalari */
export function orderStatusKeyboard(order, { panelUrl = null } = {}) {
  const allowed = ORDER_STATUS_FLOW[order.status] ?? [];
  const rows = [];

  const buttons = statusButtons(order, allowed);
  for (let index = 0; index < buttons.length; index += 2) {
    rows.push(buttons.slice(index, index + 2));
  }

  if (panelUrl) {
    rows.push([Markup.button.url('🖥 Panelda ochish', panelUrl)]);
  }
  if (rows.length === 0) rows.push([cb('Holat yakuniy', 'nav:noop')]);
  return Markup.inlineKeyboard(rows);
}

/** Admin asosiy menyusi */
export function adminMenuKeyboard({ panelUrl = null } = {}) {
  const rows = [[cb('📊 Statistika', 'admin:stats')], [cb('📦 Oxirgi buyurtmalar', 'admin:orders')]];
  if (panelUrl) rows.push([Markup.button.url('🖥 Web panel', panelUrl)]);
  rows.push([cb('🏠 Asosiy menyu', 'nav:menu')]);
  return Markup.inlineKeyboard(rows);
}

/** Telegram ID'ni administrator profiliga ulash */
export function linkTelegramKeyboard() {
  return Markup.inlineKeyboard([[cb('🔗 Shu akkauntni ulash', 'admin:link')], [cb('🏠 Asosiy menyu', 'nav:menu')]]);
}

export default { orderStatusKeyboard, adminMenuKeyboard, linkTelegramKeyboard };
