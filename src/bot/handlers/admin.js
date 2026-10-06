/**
 * Administrator bo'limi (bot tomoni):
 *  - /admin — admin menyusi (faqat administratorlarga)
 *  - /statistika — savdo statistikasi
 *  - buyurtma xabaridagi tugmalar orqali statusni o'zgartirish
 *  - /adminim buyrug'i bilan Telegram akkauntni administrator profiliga ulash
 */
import { Markup } from 'telegraf';
import { cb } from '../keyboards/common.js';
import { adminMenuKeyboard, linkTelegramKeyboard, orderStatusKeyboard } from '../keyboards/adminKeyboard.js';
import { adminStatsText, adminPanelText, orderCard } from '../texts.js';
import { HTML, editOrSend } from '../ui.js';
import { adminGuard } from '../middlewares/adminGuard.js';
import adminModel from '../../models/adminModel.js';
import statsService from '../../services/statsService.js';
import orderService from '../../services/orderService.js';
import { notifyStatusChange, notifyUser, orderPanelUrl } from '../notifications.js';
import config from '../../config/index.js';
import { formatDateTime } from '../../utils/format.js';
import { clean } from '../../utils/validate.js';
import { compare } from 'bcryptjs';

function statsText() {
  return adminStatsText(statsService.dashboard(), { url: config.admin.publicUrl });
}

export function registerAdmin(bot) {
  bot.command('admin', adminGuard(), async (ctx) => {
    await ctx.reply(adminPanelText(), { ...HTML, ...adminMenuKeyboard({ panelUrl: config.admin.publicUrl }) });
  });

  bot.action('admin:menu', adminGuard(), async (ctx) => {
    await ctx.answerCbQuery();
    await editOrSend(ctx, adminPanelText(), { ...adminMenuKeyboard({ panelUrl: config.admin.publicUrl }) });
  });

  bot.command('statistika', adminGuard(), async (ctx) => {
    await ctx.reply(statsText(), HTML);
  });

  bot.action('admin:stats', adminGuard(), async (ctx) => {
    await ctx.answerCbQuery();
    await editOrSend(ctx, statsText(), { ...adminMenuKeyboard({ panelUrl: config.admin.publicUrl }) });
  });

  // Oxirgi buyurtmalar + statusni boshqarish
  bot.action('admin:orders', adminGuard(), async (ctx) => {
    const { items } = orderService.listOrders({ page: 1, perPage: 5 });
    await ctx.answerCbQuery();

    if (items.length === 0) {
      await editOrSend(ctx, '📦 Hozircha buyurtmalar yo‘q.', {
        ...adminMenuKeyboard({ panelUrl: config.admin.publicUrl }),
      });
      return;
    }

    const latest = orderService.getOrder(items[0].id);
    const list = items
      .map((order, index) => `${index + 1}. <code>${order.order_number}</code> — ${order.customer_name} · ${
        order.total.toLocaleString('ru-RU')} so'm`)
      .join('\n');

    await editOrSend(
      ctx,
      ['📦 <b>Oxirgi buyurtmalar</b>', '', list, '', 'Oxirgi buyurtma holatini o‘zgartirish 👇'].join('\n'),
      { ...orderStatusKeyboard(latest, { panelUrl: orderPanelUrl(latest) }) },
    );
  });

  // Statusni o'zgartirish (buyurtma xabarlari va admin panel tugmalari orqali)
  bot.action(/^admin:st:(\d+):([a-z_]+)$/, adminGuard(), async (ctx) => {
    const orderId = Number(ctx.match[1]);
    const nextStatus = ctx.match[2];
    const admin = ctx.state.admin;

    const result = orderService.changeStatus(orderId, nextStatus, {
      changedBy: `admin:${admin.id}`,
      comment: `${admin.username} tomonidan botda o'zgartirildi`,
    });

    if (!result.ok) {
      await ctx.answerCbQuery(
        result.reason === 'invalid_transition' ? '⛔ Bu o‘tish ruxsat etilmagan' : '⚠️ Buyurtma topilmadi',
        { show_alert: true },
      );
      return;
    }

    await ctx.answerCbQuery('✅ Holat yangilandi');

    const order = result.order;
    await editOrSend(ctx, orderCard(order, { forAdmin: true }), {
      ...orderStatusKeyboard(order, { panelUrl: orderPanelUrl(order) }),
    });

    await notifyStatusChange(ctx.telegram, order, { previousStatus: result.previousStatus });
    await notifyUser(ctx.telegram, order, order.status);
  });

  bot.action('admin:link', async (ctx) => {
    await ctx.answerCbQuery();
    await ctx.reply(
      [
        '🔗 <b>Telegram akkauntni ulash</b>',
        '',
        'Buyurtma xabarlarini olish uchun quyidagi buyruqni yuboring:',
        '<code>/adminim login parol</code>',
        '',
        '<i>Masalan: /adminim admin Admin12345!</i>',
      ].join('\n'),
      HTML,
    );
  });

  /** /adminim <username> <parol> — Telegram akkauntni admin profiliga ulaydi */
  bot.command('adminim', async (ctx) => {
    const [, username, password] = clean(ctx.message.text, 200).split(' ');
    if (!username || !password) {
      await ctx.reply(
        ['🔗 <b>Administrator akkauntini ulash</b>', '', 'Buyruq formati:', '<code>/adminim login parol</code>'].join(
          '\n',
        ),
        HTML,
      );
      return;
    }

    const admin = adminModel.findByUsername(username);
    const passwordOk = admin ? await compare(password, admin.password_hash) : false;

    if (!admin || !passwordOk || !admin.is_active) {
      await ctx.reply('⛔ Login yoki parol noto‘g‘ri.');
      return;
    }

    const existing = adminModel.findByTelegramId(ctx.from.id);
    if (existing && existing.id !== admin.id) {
      await ctx.reply('⚠️ Bu Telegram akkaunt boshqa administratorga ulangan.');
      return;
    }

    adminModel.update(admin.id, { telegramId: ctx.from.id });
    await ctx.reply(
      ['✅ Akkaunt ulandi.', '', 'Endi yangi buyurtmalar haqida xabar olasiz.', 'Buyruq: /admin'].join('\n'),
      { ...HTML, ...linkTelegramKeyboard() },
    );
  });
}

export default registerAdmin;
