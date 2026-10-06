/**
 * Butun loyiha bo'ylab ishlatiladigan o'zgarmas qiymatlar (constants).
 * Matnlar o'zbek tilida, chunki ular to'g'ridan-to'g'ri foydalanuvchiga ko'rsatiladi.
 */

/** Buyurtma statuslari */
export const ORDER_STATUS = Object.freeze({
  NEW: 'new',
  ACCEPTED: 'accepted',
  AWAITING_PAYMENT: 'awaiting_payment',
  PAID: 'paid',
  PREPARING: 'preparing',
  DELIVERING: 'delivering',
  DELIVERED: 'delivered',
  CANCELLED: 'cancelled',
});

export const ORDER_STATUS_LABEL = Object.freeze({
  [ORDER_STATUS.NEW]: '🆕 Yangi',
  [ORDER_STATUS.ACCEPTED]: '✅ Qabul qilindi',
  [ORDER_STATUS.AWAITING_PAYMENT]: '⏳ To‘lov kutilmoqda',
  [ORDER_STATUS.PAID]: '💳 To‘landi',
  [ORDER_STATUS.PREPARING]: '📦 Tayyorlanmoqda',
  [ORDER_STATUS.DELIVERING]: '🚚 Yetkazilmoqda',
  [ORDER_STATUS.DELIVERED]: '🎉 Yetkazildi',
  [ORDER_STATUS.CANCELLED]: '❌ Bekor qilindi',
});

/**
 * Ruxsat etilgan status o'tishlari (state machine).
 * Boshqa har qanday o'tish rad etiladi — bu buyurtmalar tarixini izchil saqlaydi.
 */
export const ORDER_STATUS_FLOW = Object.freeze({
  [ORDER_STATUS.NEW]: [ORDER_STATUS.ACCEPTED, ORDER_STATUS.CANCELLED],
  [ORDER_STATUS.ACCEPTED]: [ORDER_STATUS.AWAITING_PAYMENT, ORDER_STATUS.PREPARING, ORDER_STATUS.CANCELLED],
  [ORDER_STATUS.AWAITING_PAYMENT]: [ORDER_STATUS.PAID, ORDER_STATUS.CANCELLED],
  [ORDER_STATUS.PAID]: [ORDER_STATUS.PREPARING, ORDER_STATUS.CANCELLED],
  [ORDER_STATUS.PREPARING]: [ORDER_STATUS.DELIVERING, ORDER_STATUS.CANCELLED],
  [ORDER_STATUS.DELIVERING]: [ORDER_STATUS.DELIVERED, ORDER_STATUS.CANCELLED],
  [ORDER_STATUS.DELIVERED]: [],
  [ORDER_STATUS.CANCELLED]: [],
});

/** Ombor qoldig'i shu summadan tushsa — admin ogohlantiriladi */
export const LOW_STOCK_THRESHOLD = 3;

/** Yetkazib berish usullari */
export const DELIVERY_METHOD = Object.freeze({
  DELIVERY: 'delivery',
  PICKUP: 'pickup',
});

export const DELIVERY_LABEL = Object.freeze({
  [DELIVERY_METHOD.DELIVERY]: '🚚 Yetkazib berish (kuryer)',
  [DELIVERY_METHOD.PICKUP]: '🏬 Do‘kondan olib ketish',
});

/** To'lov usullari. `enabled: false` bo'lganlar interfeysda "tez orada" ko'rinadi. */
export const PAYMENT_METHOD = Object.freeze({
  CASH: 'cash',
  CARD: 'card',
  CLICK: 'click',
  PAYME: 'payme',
  UZUM: 'uzum',
});

export const PAYMENT_META = Object.freeze({
  [PAYMENT_METHOD.CASH]: {
    label: '💵 Naqd (yetkazilganda)',
    enabled: true,
    online: false,
  },
  [PAYMENT_METHOD.CARD]: {
    label: '💳 Karta orqali o‘tkazma',
    enabled: true,
    online: false,
  },
  [PAYMENT_METHOD.CLICK]: {
    label: '🟢 Click',
    enabled: false,
    online: true,
    soon: 'Click to‘lovi tez orada ulanadi',
  },
  [PAYMENT_METHOD.PAYME]: {
    label: '🔵 Payme',
    enabled: false,
    online: true,
    soon: 'Payme to‘lovi tez orada ulanadi',
  },
  [PAYMENT_METHOD.UZUM]: {
    label: '🟣 Uzum Bank',
    enabled: false,
    online: true,
    soon: 'Uzum Bank to‘lovi tez orada ulanadi',
  },
});

/** To'lov holati */
export const PAYMENT_STATUS = Object.freeze({
  PENDING: 'pending',
  PAID: 'paid',
  FAILED: 'failed',
  CANCELLED: 'cancelled',
  REFUNDED: 'refunded',
});

/** Katalog tartiblash variantlari */
export const SORT = Object.freeze({
  NEW: 'new',
  PRICE_ASC: 'price_asc',
  PRICE_DESC: 'price_desc',
  POPULAR: 'popular',
});

export const SORT_LABEL = Object.freeze({
  [SORT.NEW]: '🆕 Yangi kelganlar',
  [SORT.PRICE_ASC]: '⬆️ Arzon narxlar',
  [SORT.PRICE_DESC]: '⬇️ Qimmat narxlar',
  [SORT.POPULAR]: '⭐ Mashhur',
});

/** Sahifalash */
export const PAGE_SIZE = Object.freeze({
  CATALOG: 5,
  ADMIN: 20,
});

/** Asosiy menyu tugmalari (matni bo'yicha handlerlar topiladi) */
export const MENU = Object.freeze({
  PHONES: '📱 Telefonlar',
  SEARCH: '🔍 Qidirish',
  PROMOS: '🏷 Aksiyalar',
  NEW: '🆕 Yangi kelganlar',
  POPULAR: '⭐ Mashhur telefonlar',
  CART: '🛒 Savatcha',
  ORDERS: '📦 Buyurtmalarim',
  FAVORITES: '❤️ Sevimlilar',
  CONTACT: '📞 Bog‘lanish',
  ADDRESS: '📍 Do‘kon manzili',
  HELP: 'ℹ️ Yordam',
});

/** Sozlamalar uchun standart qiymatlar (settings jadvali) */
export const DEFAULT_SETTINGS = Object.freeze({
  shop_name: 'Telefon Store',
  shop_phone: '+998 71 200 00 00',
  shop_address: 'Toshkent sh., Amir Temur shoh ko‘chasi 108, 1-qavat',
  shop_hours: 'Har kuni 09:00 – 20:00',
  shop_map_url: 'https://yandex.uz/maps/',
  delivery_fee: '30000',
  free_delivery_threshold: '2000000',
  low_stock_threshold: String(LOW_STOCK_THRESHOLD),
  order_prefix: 'TS',
  support_text: 'Savollaringiz bo‘lsa, operator bilan bog‘lanishingiz mumkin.',
});
