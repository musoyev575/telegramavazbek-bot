/**
 * Filtrlash: brend, narx oralig'i, xotira, RAM, rang, mavjudlik.
 * Har bir amal `ctx.session.catalog` ga yoziladi — server xotirasida, keyingi so'rovlarda qayta ishlatiladi.
 */
import {
  brandFilterKeyboard,
  colorsKeyboard,
  filtersKeyboard,
  priceRangeKeyboard,
  sortKeyboard,
  valueFilterKeyboard,
} from '../keyboards/catalogKeyboard.js';
import { editOrSend } from '../ui.js';
import { activeFilterCount, resetCatalog } from '../middlewares/session.js';
import { showCatalog } from './catalog.js';
import productService from '../../services/productService.js';

const FILTER_MENU_TEXT = [
  '🔎 <b>Filtrlar</b>',
  '',
  'Kerakli shartlarni tanlang. «Ko‘rsatish» tugmasi natijalarni yangilaydi.',
].join('\n');

function openFilters(ctx) {
  return editOrSend(ctx, FILTER_MENU_TEXT, filtersKeyboard({ active: ctx.session.catalog }));
}

export function registerFilters(bot) {
  bot.action('filters:open', async (ctx) => {
    await ctx.answerCbQuery();
    await openFilters(ctx);
  });

  bot.action('filters:back', async (ctx) => {
    await ctx.answerCbQuery();
    await showCatalog(ctx);
  });

  bot.action('filters:apply', async (ctx) => {
    ctx.session.catalog.page = 1;
    await ctx.answerCbQuery('Natijalar yangilandi');
    await showCatalog(ctx);
  });

  // --- Saralash ---
  bot.action('filters:sort', async (ctx) => {
    await ctx.answerCbQuery();
    await editOrSend(ctx, '↕️ <b>Saralash</b>\n\nQanday tartibda ko‘rsatilsin?', sortKeyboard(ctx.session.catalog.sort));
  });

  bot.action(/^filters:set_sort:(.+)$/, async (ctx) => {
    ctx.session.catalog.sort = ctx.match[1];
    ctx.session.catalog.page = 1;
    await ctx.answerCbQuery('Saralash o‘zgartirildi');
    await showCatalog(ctx);
  });

  // --- Brend ---
  bot.action('filters:brand', async (ctx) => {
    await ctx.answerCbQuery();
    await editOrSend(
      ctx,
      '🏷 <b>Brend</b>\n\nQaysi brendni ko‘ramiz?',
      brandFilterKeyboard(productService.brands(), ctx.session.catalog.brand),
    );
  });

  bot.action(/^filters:brand_set:(.+)$/, async (ctx) => {
    ctx.session.catalog.brand = ctx.match[1];
    ctx.session.catalog.page = 1;
    await ctx.answerCbQuery(`Brend: ${ctx.match[1]}`);
    await showCatalog(ctx);
  });

  // --- Narx oralig'i ---
  bot.action('filters:price', async (ctx) => {
    const options = productService.filterOptions();
    await ctx.answerCbQuery();
    await editOrSend(
      ctx,
      '💰 <b>Narx oralig‘i</b>\n\nKerakli oraliqni tanlang:',
      priceRangeKeyboard({ min: options.priceMin, max: options.priceMax, current: ctx.session.catalog }),
    );
  });

  bot.action(/^filters:price_set:(\d+):(\d+)$/, async (ctx) => {
    ctx.session.catalog.minPrice = Number(ctx.match[1]);
    ctx.session.catalog.maxPrice = Number(ctx.match[2]);
    ctx.session.catalog.page = 1;
    await ctx.answerCbQuery('Narx filtri qo‘llandi');
    await showCatalog(ctx);
  });

  bot.action('filters:price_clear', async (ctx) => {
    ctx.session.catalog.minPrice = null;
    ctx.session.catalog.maxPrice = null;
    await ctx.answerCbQuery('Narx filtri tozalandi');
    await openFilters(ctx);
  });

  // --- Xotira / RAM / Rang ---
  const valueScreens = {
    storage: { title: '💾 <b>Ichki xotira</b>', options: () => productService.filterOptions().storages },
    ram: { title: '⚙️ <b>RAM</b>', options: () => productService.filterOptions().rams },
  };

  for (const [key, screen] of Object.entries(valueScreens)) {
    bot.action(`filters:${key}`, async (ctx) => {
      await ctx.answerCbQuery();
      const values = screen.options();
      await editOrSend(
        ctx,
        `${screen.title}\n\nQaysi variant?`,
        valueFilterKeyboard({ title: screen.title, values, key, current: ctx.session.catalog[key] }),
      );
    });

    bot.action(new RegExp(`^filters:set_${key}:(\\d+)$`), async (ctx) => {
      ctx.session.catalog[key] = Number(ctx.match[1]);
      ctx.session.catalog.page = 1;
      await ctx.answerCbQuery('Filtr qo‘llandi');
      await showCatalog(ctx);
    });
  }

  bot.action('filters:color', async (ctx) => {
    const { colors } = productService.filterOptions();
    await ctx.answerCbQuery();
    await editOrSend(
      ctx,
      '🎨 <b>Rang</b>\n\nQaysi rang qiziqtiradi?',
      colorsKeyboard(colors, ctx.session.catalog.color),
    );
  });

  bot.action(/^filters:set_color:(.+)$/, async (ctx) => {
    ctx.session.catalog.color = ctx.match[1];
    ctx.session.catalog.page = 1;
    await ctx.answerCbQuery(`Rang: ${ctx.match[1]}`);
    await showCatalog(ctx);
  });

  // --- Mavjudligi ---
  bot.action('filters:stock', async (ctx) => {
    ctx.session.catalog.inStock = !ctx.session.catalog.inStock;
    ctx.session.catalog.page = 1;
    await ctx.answerCbQuery(ctx.session.catalog.inStock ? 'Faqat omborda bor' : 'Barcha telefonlar');
    await openFilters(ctx);
  });

  // --- Tozalash ---
  bot.action('filters:clear', async (ctx) => {
    // Filtrlar bilan birga bo'lim (aksiya/yangi/mashhur) ham tozalanadi
    resetCatalog(ctx);
    ctx.session.catalog.sort = ctx.session.catalog.sort ?? 'new';
    ctx.session.flow = null;
    await ctx.answerCbQuery('Filtrlari tozalandi');
    await showCatalog(ctx);
  });

  bot.action(/^filters:clear_(brand|storage|ram|color)$/, async (ctx) => {
    ctx.session.catalog[ctx.match[1]] = null;
    await ctx.answerCbQuery('Tozalandi');
    await openFilters(ctx);
  });
}

export default registerFilters;
