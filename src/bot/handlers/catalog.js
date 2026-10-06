/**
 * Telefonlar katalogi: ro'yxat, brend bo'yicha filtr, sahifalash.
 * Boshqa handlerlar ham shu yerdagi `showCatalog` funksiyasidan foydalanadi.
 */
import { catalogKeyboard, emptyCatalogKeyboard, productPickKeyboard } from '../keyboards/catalogKeyboard.js';
import { catalogTitle, emptySectionText, noResults } from '../texts.js';
import { editOrSend } from '../ui.js';
import { MENU, SORT } from '../../config/constants.js';
import { activeFilterCount, resetCatalog } from '../middlewares/session.js';
import productService from '../../services/productService.js';
import { formatPrice } from '../../utils/format.js';
import { escapeHtml as e } from '../../utils/html.js';

/** Ro'yxatdagi har bir telefon uchun qisqa qator */
export function productLines(products) {
  return products
    .map((product, index) => {
      const stock = productService.stockState(product);
      const dot = stock.code === 'out' ? '🔴' : stock.code === 'low' ? '🟠' : '🟢';
      return `${index + 1}. <b>${e(product.brand)} ${e(product.model)}</b> — ${formatPrice(product.price)} ${dot}`;
    })
    .join('\n');
}

/**
 * Katalogni ko'rsatadi (joriy filtr va sahifa bo'yicha).
 * @param {object} ctx
 * @param {object} options
 * @param {boolean} options.edit - callback bo'lsa mavjud xabarni tahrirlash
 */
export async function showCatalog(ctx, { edit = true } = {}) {
  const filters = ctx.session.catalog;
  const result = productService.catalog({ ...filters });

  if (result.items.length === 0) {
    const text = filters.query
      ? noResults(filters.query)
      : filters.section
        ? emptySectionText(filters.section)
        : '😕 Tanlangan shartlarga mos telefon topilmadi.';
    await editOrSend(ctx, text, emptyCatalogKeyboard());
    return result;
  }

  const text = [
    catalogTitle({
      total: result.total,
      page: result.page,
      totalPages: result.totalPages,
      filters,
    }),
    '',
    productLines(result.items),
    '',
    "Batafsil ma'lumot uchun telefonni tanlang 👇",
  ].join('\n');

  // Avval telefonlar ro'yxati (tanlash uchun), keyin boshqaruv tugmalari
  const navigation = catalogKeyboard({
    brands: productService.brands().slice(0, 8),
    page: result.page,
    totalPages: result.totalPages,
    filters: { ...filters, activeFilterCount: activeFilterCount(filters) },
  });

  const inline_keyboard = [
    ...productPickKeyboard(result.items).reply_markup.inline_keyboard,
    ...navigation.reply_markup.inline_keyboard,
  ];

  await editOrSend(ctx, text, { reply_markup: { inline_keyboard } });
  return result;
}

/**
 * Bo'limni ochish: butun katalog, aksiyalar, yangi kelganlar yoki mashhur telefonlar.
 * Har bir bo'lim o'z filtrini o'rnatadi (filtrlar tozalanadi).
 */
export async function openSection(ctx, section = null, { edit = Boolean(ctx.callbackQuery) } = {}) {
  resetCatalog(ctx);
  ctx.session.flow = null;

  switch (section) {
    case 'sale':
      ctx.session.catalog.onSale = true;
      break;
    case 'popular':
      ctx.session.catalog.sort = SORT.POPULAR;
      break;
    case 'new':
      ctx.session.catalog.sort = SORT.NEW;
      break;
    default:
      break;
  }

  ctx.session.catalog.section = section;
  await showCatalog(ctx, { edit });
}

export function registerCatalog(bot) {
  const openCatalog = (ctx) => openSection(ctx, null);

  bot.hears(MENU.PHONES, openCatalog);
  bot.command('katalog', openCatalog);
  bot.hears(MENU.PROMOS, (ctx) => openSection(ctx, 'sale'));
  bot.hears(MENU.NEW, (ctx) => openSection(ctx, 'new'));
  bot.hears(MENU.POPULAR, (ctx) => openSection(ctx, 'popular'));

  bot.action(/^catalog:page:(\d+)$/, async (ctx) => {
    ctx.session.catalog.page = Number(ctx.match[1]);
    await ctx.answerCbQuery();
    await showCatalog(ctx);
  });

  bot.action(/^catalog:brand:(.+)$/, async (ctx) => {
    ctx.session.catalog.brand = ctx.match[1];
    ctx.session.catalog.page = 1;
    await ctx.answerCbQuery(`Brend: ${ctx.match[1]}`);
    await showCatalog(ctx);
  });

  bot.action('catalog:open', async (ctx) => {
    ctx.session.flow = null;
    await ctx.answerCbQuery();
    await showCatalog(ctx);
  });

  // Bo'limlardan butun katalogga qaytish (barcha filtrlar tozalanadi)
  bot.action('catalog:all', async (ctx) => {
    await ctx.answerCbQuery();
    await openSection(ctx, null);
  });
}

export default registerCatalog;
