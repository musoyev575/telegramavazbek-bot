/**
 * Asosiy menyu — doimiy (reply) klaviatura. Emoji faqat bo'lim belgisi sifatida (dizayn talabi).
 */
import { Markup } from 'telegraf';
import { MENU } from '../../config/constants.js';

export function mainMenuKeyboard() {
  return Markup.keyboard([
    [MENU.PHONES, MENU.SEARCH],
    [MENU.PROMOS, MENU.NEW],
    [MENU.POPULAR, MENU.CART],
    [MENU.ORDERS, MENU.FAVORITES],
    [MENU.CONTACT, MENU.ADDRESS],
    [MENU.HELP],
  ])
    .resize()
    .placeholder('Bo‘limni tanlang');
}

/** Menyu tugmalari matnlarini tez tekshirish uchun */
export const MENU_TEXTS = Object.values(MENU);

export default { mainMenuKeyboard, MENU_TEXTS };
