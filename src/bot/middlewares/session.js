/**
 * Sessiya middleware'i.
 *
 * Ishlab chiqish/boshlash uchun xotiradagi (in-memory) saqlash ishlatiladi.
 * Kubernetes yoki bir nechta instansiyada ishlatilsa — `@telegraf/session` + Redis'ga
 * o'tish kifoya: bu qatlam shu maqsadda ajratilgan.
 */
import { session } from 'telegraf';
import { SORT } from '../../config/constants.js';

/** Har bir yangi suhbat uchun boshlang'ich holat */
export function defaultSession() {
  return {
    /** Faol oqim: null | 'search' | 'checkout' */
    flow: null,
    /** Oqim ma'lumotlari (masalan, buyurtma maydonlari) */
    data: {},
    /** Katalog holati: filtrlar, sahifa, saralash */
    catalog: {
      page: 1,
      query: '',
      brand: null,
      minPrice: null,
      maxPrice: null,
      ram: null,
      storage: null,
      color: null,
      inStock: false,
      onSale: false,
      /** Bo'lim: null | 'sale' | 'new' | 'popular' (sarlavhada ko'rsatiladi) */
      section: null,
      sort: SORT.NEW,
    },
    /** Oxirgi ko'rilgan mahsulot (orqaga qaytish uchun) */
    lastProductId: null,
    /** Foydalanuvchi tilni o'zgartirishi uchun joy (kelajakda) */
    language: 'uz',
  };
}

export const sessionMiddleware = session({ defaultSession });

/** Oqimni tozalash */
export function resetFlow(ctx) {
  if (!ctx.session) return;
  ctx.session.flow = null;
  ctx.session.data = {};
}

/** Katalog filtrlarini boshlang'ich holatga qaytarish */
export function resetCatalog(ctx) {
  if (!ctx.session) return;
  ctx.session.catalog = defaultSession().catalog;
}

export function activeFilterCount(filters = {}) {
  return [
    filters.brand,
    filters.minPrice,
    filters.maxPrice,
    filters.ram,
    filters.storage,
    filters.color,
    filters.inStock ? true : null,
  ].filter((value) => value !== null && value !== undefined && value !== false).length;
}

export default { sessionMiddleware, defaultSession, resetFlow, resetCatalog, activeFilterCount };
