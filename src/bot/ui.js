/**
 * Telegram interfeysi bilan ishlash yordamchilari:
 *  - barcha xabarlar HTML rejimida va havola ko'rinishisiz yuboriladi;
 *  - "message is not modified" kabi zararsiz Telegram xatolari yutiladi;
 *  - rasm yuborilmasa, xabar matn ko'rinishida yuboriladi (bot hech qachon "jim" qolmaydi).
 */
import { resolveImageSource } from '../utils/images.js';
import logger from '../utils/logger.js';

export const HTML = Object.freeze({ parse_mode: 'HTML', link_preview_options: { is_disabled: true } });

const isIgnorable = (error) => {
  const description = error?.response?.description ?? error?.message ?? '';
  return (
    description.includes('message is not modified') ||
    description.includes('message to edit not found') ||
    description.includes('query is too old')
  );
};

/** Xabar yuborish (HTML) */
export async function send(ctx, text, extra = {}) {
  return ctx.reply(text, { ...HTML, ...extra });
}

/**
 * Telegramda tahrirlash metodi xabar QANDAY yuborilganiga bog'liq: rasm/video bilan
 * yuborilgan xabarni `editMessageText` bilan tahrirlab bo'lmaydi — u
 * "there is no text in the message to edit" xatosini qaytaradi. Bunday xabar uchun
 * `editMessageCaption` ishlatiladi (mahsulot kartasi shunday yuboriladi).
 */
const MEDIA_KEYS = ['photo', 'video', 'document', 'animation', 'audio', 'voice'];

function hasMedia(message) {
  return MEDIA_KEYS.some((key) => message?.[key] != null);
}

/** Izoh (caption) uchun: `link_preview_options` bu metodda qo'llanilmaydi */
function captionOptions(extra = {}) {
  const merged = { ...HTML, ...extra };
  delete merged.link_preview_options;
  return merged;
}

/** Callback bo'lsa mavjud xabarni tahrirlaydi, aks holda yangi xabar yuboradi */
export async function editOrSend(ctx, text, extra = {}) {
  const message = ctx.callbackQuery?.message;
  if (message) {
    try {
      if (hasMedia(message)) await ctx.editMessageCaption(text, captionOptions(extra));
      else await ctx.editMessageText(text, { ...HTML, ...extra });
      return;
    } catch (error) {
      if (!isIgnorable(error)) throw error;
      return;
    }
  }
  await send(ctx, text, extra);
}

/** Mahsulot kartasini rasm bilan yuboradi; rasm bo'lmasa — faqat matn */
export async function sendProductCard(ctx, { caption, image, keyboard = undefined }) {
  const source = resolveImageSource(image);
  const options = { ...HTML, ...(keyboard ? { reply_markup: keyboard.reply_markup } : {}) };

  if (source) {
    try {
      await ctx.replyWithPhoto(source, { ...options, caption });
      return;
    } catch (error) {
      logger.warn('Rasmni yuborishda xatolik, matn ko‘rinishida yuboriladi', error?.response?.description ?? error);
    }
  }
  await ctx.reply(caption, options);
}

/** Status o'zgargani haqida xabar (yumshoq xatolar yutiladi) */
export async function notifyAdmin(telegram, adminTelegramId, text, keyboard = undefined) {
  try {
    await telegram.sendMessage(adminTelegramId, text, {
      ...HTML,
      ...(keyboard ? { reply_markup: keyboard.reply_markup } : {}),
    });
    return true;
  } catch (error) {
    logger.warn(`Adminga xabar yuborilmadi (${adminTelegramId})`, error?.response?.description ?? error);
    return false;
  }
}

export { isIgnorable, hasMedia };

export default { HTML, send, editOrSend, sendProductCard, notifyAdmin, hasMedia };
