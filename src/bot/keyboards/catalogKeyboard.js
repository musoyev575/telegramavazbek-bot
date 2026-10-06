/**
 * Katalog klaviaturalari: brendlar, filtrlar, saralash, sahifalash.
 */
import { Markup } from 'telegraf';
import { cb, menuButton, paginationRow } from './common.js';
import { SORT, SORT_LABEL } from '../../config/constants.js';
import { formatPrice, formatStorage } from '../../utils/format.js';

/** Katalog bosh ekrani: brendlar + filtr/saralash + sahifalash */
export function catalogKeyboard({ brands = [], page = 1, totalPages = 1, filters = {} }) {
  const rows = [];

  if (brands.length) {
    const buttons = brands
      .slice(0, 8)
      .map((brand) => cb(`${brand.brand} (${brand.total})`, `catalog:brand:${brand.brand}`));
    for (let index = 0; index < buttons.length; index += 2) {
      rows.push(buttons.slice(index, index + 2));
    }
  }

  rows.push([
    cb(filters.activeFilterCount ? `🔎 Filtrlar (${filters.activeFilterCount})` : '🔎 Filtrlar', 'filters:open'),
    cb(`↕️ ${SORT_LABEL[filters.sort] ?? SORT_LABEL[SORT.NEW]}`, 'filters:sort'),
  ]);
  rows.push(paginationRow({ page, totalPages }, 'catalog:page'));
  rows.push([menuButton()]);

  return Markup.inlineKeyboard(rows);
}

/** Saralash variantlari */
export function sortKeyboard(currentSort = SORT.NEW) {
  const rows = Object.entries(SORT_LABEL).map(([value, label]) => [
    cb(`${value === currentSort ? '✅ ' : ''}${label}`, `filters:set_sort:${value}`),
  ]);
  rows.push([cb('🔙 Orqaga', 'filters:back')]);
  return Markup.inlineKeyboard(rows);
}

/** Filtrlar menyusi */
export function filtersKeyboard({ active = {} } = {}) {
  const mark = (key, label) => cb(`${active[key] ? '✅ ' : ''}${label}`, `filters:${key}`);
  return Markup.inlineKeyboard([
    [mark('brand', 'Brend'), mark('price', 'Narx oralig‘i')],
    [mark('storage', 'Xotira'), mark('ram', 'RAM')],
    [mark('color', 'Rang'), mark('stock', 'Faqat omborda')],
    [
      cb('♻️ Filtrlarni tozalash', 'filters:clear'),
      cb('👀 Ko‘rsatish', 'filters:apply'),
    ],
  ]);
}

/** Brendlar ro'yxati (filtr ichida) */
export function brandFilterKeyboard(brands = [], current = null) {
  const buttons = brands.map((brand) =>
    cb(`${current === brand.brand ? '✅ ' : ''}${brand.brand}`, `filters:brand_set:${brand.brand}`),
  );
  const rows = [];
  for (let index = 0; index < buttons.length; index += 2) rows.push(buttons.slice(index, index + 2));
  rows.push([cb('🔙 Filtrlar', 'filters:open')]);
  return Markup.inlineKeyboard(rows);
}

/** Narx oralig'i variantlari (mavjud katalogdan avtomatik hisoblanadi) */
export function priceRangeKeyboard({ min, max, current = {} } = {}) {
  const step = Math.max(500000, Math.round((max - min) / 6 / 100000) * 100000);
  const ranges = [];
  for (let start = min; start < max; start += step) {
    ranges.push([start, Math.min(start + step, max)]);
  }
  const buttons = ranges.slice(0, 6).map(([from, to]) => {
    const isActive = current.minPrice === from && current.maxPrice === to;
    return cb(
      `${isActive ? '✅ ' : ''}${formatPrice(from, { withCurrency: false })} – ${formatPrice(to, { withCurrency: false })}`,
      `filters:price_set:${from}:${to}`,
    );
  });
  const rows = buttons.map((button) => [button]);
  rows.push([cb('♻️ Tozalash', 'filters:price_clear'), cb('🔙 Filtrlar', 'filters:open')]);
  return Markup.inlineKeyboard(rows);
}

/** Xotira / RAM variantlari */
export function valueFilterKeyboard({ title, values = [], key, current = null }) {
  const buttons = values.map((value) =>
    cb(
      `${current === value ? '✅ ' : ''}${key === 'storage' ? formatStorage(value) : `${value} GB`}`,
      `filters:set_${key}:${value}`,
    ),
  );
  const rows = [];
  for (let index = 0; index < buttons.length; index += 3) rows.push(buttons.slice(index, index + 3));
  if (!values.length) rows.push([cb('Variantlar yo‘q', 'nav:noop')]);
  rows.push([cb(`♻️ Tozalash`, `filters:clear_${key}`), cb('🔙 Filtrlar', 'filters:open')]);
  return Markup.inlineKeyboard(rows);
}

/** Ranglar ro'yxati */
export function colorsKeyboard(colors = [], current = null) {
  const buttons = colors.map((color) =>
    cb(`${current === color ? '✅ ' : ''}${color}`, `filters:set_color:${color}`),
  );
  const rows = [];
  for (let index = 0; index < buttons.length; index += 2) rows.push(buttons.slice(index, index + 2));
  if (!colors.length) rows.push([cb('Variantlar yo‘q', 'nav:noop')]);
  rows.push([cb('🔙 Filtrlar', 'filters:open')]);
  return Markup.inlineKeyboard(rows);
}

/** Katalogda topilgan mahsulotlarni tanlash (raqamlar bilan) */
export function productPickKeyboard(products = [], prefix = 'product:open') {
  const buttons = products.map((product, index) =>
    cb(`${index + 1}. ${product.brand} ${product.model}`, `${prefix}:${product.id}`),
  );
  const rows = buttons.map((button) => [button]);
  rows.push([menuButton()]);
  return Markup.inlineKeyboard(rows);
}

export function emptyCatalogKeyboard() {
  return Markup.inlineKeyboard([
    [cb('📱 Butun katalog', 'catalog:all')],
    [cb('🔎 Filtrlarni tozalash', 'filters:clear')],
    [menuButton()],
  ]);
}

export default {
  catalogKeyboard,
  sortKeyboard,
  filtersKeyboard,
  brandFilterKeyboard,
  priceRangeKeyboard,
  valueFilterKeyboard,
  colorsKeyboard,
  productPickKeyboard,
  emptyCatalogKeyboard,
};
