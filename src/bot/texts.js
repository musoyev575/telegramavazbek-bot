/**
 * Bot interfeysi matnlari — bitta joyda, o'zbek tilida.
 *
 * Qoidalar:
 *  - Interfeys keraksiz matn bilan to'ldirilmaydi: faqat muhim ma'lumot + tugmalar.
 *  - Foydalanuvchi va admin kiritgan HAR QANDAY matn escapeHtml'dan o'tadi.
 *  - Har bir funksiya tayyor HTML matn qaytaradi (parse_mode: 'HTML').
 */
import { escapeHtml as e, b, truncate } from '../utils/html.js';
import { formatPrice, formatPhone, formatDateTime, discountPercent } from '../utils/format.js';
import { formatGb, formatStorage } from '../utils/format.js';
import { stockState, deliveryInfo, shopInfo } from '../services/productService.js';
import {
  ORDER_STATUS_LABEL,
  DELIVERY_LABEL,
  PAYMENT_META,
  SORT_LABEL,
} from '../config/constants.js';

/** Telefon kartasi — rasm tagidagi qisqa izoh */
export function productCard(product) {
  const lines = [`<b>${e(product.brand)} ${e(product.model)}</b>`];

  const percent = discountPercent(product.price, product.old_price);
  if (percent) lines.push(`🏷 Chegirma: <b>−${percent}%</b>`);
  lines.push(`💰 <b>${formatPrice(product.price)}</b>${percent ? `  <s>${formatPrice(product.old_price)}</s>` : ''}`);
  lines.push(`⚙️ ${formatGb(product.ram)} / ${formatStorage(product.storage)}`);
  if (product.screen) lines.push(`📱 ${e(product.screen)}`);
  if (product.processor) lines.push(`🚀 ${e(product.processor)}`);
  lines.push(stockState(product).text);

  return lines.join('\n');
}

/** Telefon sahifasi — to'liq texnik ma'lumotlar */
export function productDetails(product) {
  const { fee, freeFrom } = deliveryInfo();
  const percent = discountPercent(product.price, product.old_price);
  const stock = stockState(product);

  const specs = [
    product.screen && `📱 Ekran: ${e(product.screen)}`,
    product.camera && `📸 Kamera: ${e(product.camera)}`,
    product.battery && `🔋 Batareya: ${e(product.battery)}`,
    product.processor && `🚀 Protsessor: ${e(product.processor)}`,
    product.os && `🖥 OS: ${e(product.os)}`,
    product.ram || product.storage ? `💾 Xotira: ${formatGb(product.ram, 'GB RAM')} / ${formatStorage(product.storage)}` : null,
    product.color && `🎨 Rang: ${e(product.color)}`,
    product.warranty && `🛡 Kafolat: ${e(product.warranty)}`,
  ].filter(Boolean);

  const lines = [
    `<b>${e(product.brand)} ${e(product.model)}</b>`,
    product.description ? `<i>${e(truncate(product.description, 220))}</i>` : null,
    '',
    percent
      ? `💰 <b>${formatPrice(product.price)}</b>  <s>${formatPrice(product.old_price)}</s>  (−${percent}%)`
      : `💰 <b>${formatPrice(product.price)}</b>`,
    '',
    specs.join('\n'),
    '',
    stock.text,
    '',
    `🚚 Yetkazish: ${formatPrice(fee)}${freeFrom > 0 ? ` · ${formatPrice(freeFrom)} dan bepul` : ''}`,
    `🛡 Kafolat va sifat kafolati`,
  ].filter((line) => line !== null);

  return lines.join('\n');
}

/** Katalog sarlavhasi */
export function catalogTitle({ total, page, totalPages, filters = {} }) {
  const SECTION_TITLES = {
    sale: '🏷 <b>Aksiyalar</b>',
    new: '🆕 <b>Yangi kelganlar</b>',
    popular: '⭐ <b>Mashhur telefonlar</b>',
  };
  const parts = [SECTION_TITLES[filters.section] ?? '📱 <b>Telefonlar</b>'];
  const chips = [];
  if (filters.query) chips.push(`"${e(filters.query)}"`);
  if (filters.brand) chips.push(e(filters.brand));
  if (filters.sort && filters.sort !== 'new' && !filters.section) chips.push(SORT_LABEL[filters.sort] ?? filters.sort);
  if (filters.minPrice || filters.maxPrice) {
    chips.push(`${formatPrice(filters.minPrice ?? 0, { withCurrency: false })} – ${formatPrice(filters.maxPrice ?? 0)}`);
  }
  if (filters.storage) chips.push(formatStorage(filters.storage));
  if (filters.ram) chips.push(formatGb(filters.ram));
  if (filters.inStock) chips.push('omborda bor');

  parts.push(`Topildi: <b>${total}</b> ta${chips.length ? ` · ${chips.join(' · ')}` : ''}`);
  parts.push(`Sahifa ${page}/${totalPages}`);
  return parts.join('\n');
}

export function searchPrompt() {
  return [
    '🔍 <b>Qidiruv</b>',
    "Telefon nomi, brendi yoki modelini yozing.",
    '<i>Masalan: iPhone 15, Samsung S24, Redmi Note</i>',
  ].join('\n');
}

export function noResults(query) {
  return [
    "😕 Hech narsa topilmadi.",
    `So'rov: <b>${e(truncate(query, 60))}</b>`,
    '',
    "Boshqa nom bilan urinib ko'ring yoki brendlar ro'yxatidan tanlang.",
  ].join('\n');
}

/**
 * Bo'lim (aksiya / yangi / mashhur) bo'sh bo'lganda ko'rsatiladigan matn.
 * Foydalanuvchi "nima uchun bo'sh" ekanini tushunadi va katalogga o'tadi.
 */
export function emptySectionText(section) {
  const messages = {
    sale: ['🏷 <b>Aksiyalar</b>', '', 'Hozircha chegirmadagi telefonlar yo‘q.', 'Tez orada yangi aksiyalar qo‘shiladi. 👌'],
    new: ['🆕 <b>Yangi kelganlar</b>', '', 'Hozircha yangi partiya kutilmoqda. 👌'],
    popular: ['⭐ <b>Mashhur telefonlar</b>', '', 'Hozircha mashhur deb belgilangan telefonlar yo‘q. 👌'],
  };
  return (messages[section] ?? ['📱 <b>Telefonlar</b>', '', 'Telefonlar topilmadi.']).join('\n');
}

export function cartText({ items, totals }) {
  if (items.length === 0) {
    return ['🛒 <b>Savatcha bo\'sh</b>', '', "Katalogdan telefon tanlab, «🛒 Savatchaga qo'shish» tugmasini bosing."].join('\n');
  }

  const lines = ['🛒 <b>Savatcha</b>', ''];
  items.forEach((item, index) => {
    lines.push(`${index + 1}. <b>${e(item.brand)} ${e(item.model)}</b>`);
    lines.push(`   ${item.quantity} × ${formatPrice(item.price)} = <b>${formatPrice(item.lineTotal)}</b>`);
    if (item.stockIssue === 'stock') lines.push(`   ⚠️ Omborda faqat ${item.stock} dona qoldi`);
    if (item.stockIssue === 'inactive') lines.push('   ⚠️ Mahsulot sotuvdan olingan');
  });
  lines.push('');
  lines.push(`Mahsulotlar: <b>${formatPrice(totals.subtotal)}</b>`);
  if (totals.discountTotal > 0) lines.push(`Tejaldi: <b>${formatPrice(totals.discountTotal)}</b>`);
  lines.push(
    totals.deliveryFee > 0
      ? `Yetkazish: ${formatPrice(totals.deliveryFee)}`
      : `Yetkazish: <b>bepul</b>`,
  );
  lines.push(`Jami: <b>${formatPrice(totals.total)}</b>`);

  return lines.join('\n');
}

/** Buyurtmani tasdiqlashdan oldin to'liq ko'rsatish */
export function orderReview(data, { items, totals }) {
  const lines = [
    '📋 <b>Buyurtmani tekshiring</b>',
    '',
    `<b>Ism:</b> ${e(data.customerName)}`,
    `<b>Telefon:</b> ${formatPhone(data.customerPhone)}`,
    `<b>Yetkazish:</b> ${DELIVERY_LABEL[data.deliveryMethod] ?? data.deliveryMethod}`,
  ];
  if (data.address) lines.push(`<b>Manzil:</b> ${e(data.address)}`);
  lines.push(`<b>To'lov:</b> ${PAYMENT_META[data.paymentMethod]?.label ?? data.paymentMethod}`);
  if (data.comment) lines.push(`<b>Izoh:</b> ${e(data.comment)}`);
  lines.push('', '━━━━━━━━━━━━━━━');
  items.forEach((item) => {
    lines.push(`${e(item.brand)} ${e(item.model)} — ${item.quantity} × ${formatPrice(item.price)}`);
  });
  lines.push('', `Mahsulotlar: <b>${formatPrice(totals.subtotal)}</b>`);
  if (totals.deliveryFee > 0) lines.push(`Yetkazish: ${formatPrice(totals.deliveryFee)}`);
  lines.push(`<b>Jami: ${formatPrice(totals.total)}</b>`);
  return lines.join('\n');
}

/** Buyurtma kartasi (foydalanuvchi va admin uchun) */
export function orderCard(order, { forAdmin = false } = {}) {
  const lines = [
    `📦 <b>Buyurtma ${e(order.order_number)}</b>`,
    `Holat: <b>${ORDER_STATUS_LABEL[order.status] ?? order.status}</b>`,
    `Sana: ${formatDateTime(order.created_at)}`,
    '',
  ];
  if (forAdmin) {
    lines.push(`👤 ${e(order.customer_name)} · ${formatPhone(order.customer_phone)}`);
    if (order.customer?.username) lines.push(`🔗 @${e(order.customer.username)} (ID: ${order.customer.telegram_id})`);
  }
  lines.push(`<b>Yetkazish:</b> ${DELIVERY_LABEL[order.delivery_method] ?? order.delivery_method}`);
  if (order.customer_address) lines.push(`<b>Manzil:</b> ${e(order.customer_address)}`);
  lines.push(`<b>To'lov:</b> ${PAYMENT_META[order.payment_method]?.label ?? order.payment_method}`);
  if (order.comment) lines.push(`<b>Izoh:</b> ${e(order.comment)}`);
  lines.push('', '━━━━━━━━━━━━━━━');
  for (const item of order.items) {
    lines.push(`▪️ ${e(item.brand)} ${e(item.model)} — ${item.quantity} × ${formatPrice(item.unit_price)}`);
  }
  lines.push('', `Mahsulotlar: ${formatPrice(order.subtotal)}`);
  if (order.discount_total > 0) lines.push(`Chegirma bilan tejaldi: ${formatPrice(order.discount_total)}`);
  if (order.delivery_fee > 0) lines.push(`Yetkazish: ${formatPrice(order.delivery_fee)}`);
  if (order.promo_discount > 0) lines.push(`Promokod (${e(order.promo_code)}): −${formatPrice(order.promo_discount)}`);
  lines.push(`<b>Jami: ${formatPrice(order.total)}</b>`);
  return lines.join('\n');
}

/** Foydalanuvchi buyurtmalari ro'yxati */
export function ordersList(orders) {
  if (orders.length === 0) {
    return ['📦 <b>Buyurtmalarim</b>', '', "Sizda hali buyurtma yo'q."].join('\n');
  }
  return ['📦 <b>Buyurtmalarim</b>', '', orders.map((order) => orderShortLine(order)).join('\n')].join('\n');
}

export function orderShortLine(order) {
  return `• <code>${e(order.order_number)}</code> — ${formatPrice(order.total)} · ${
    ORDER_STATUS_LABEL[order.status] ?? order.status
  } · ${formatDateTime(order.created_at, { withTime: false })}`;
}

export function favoritesText(products) {
  if (products.length === 0) {
    return ['❤️ <b>Sevimlilar</b>', '', "Sevimlilar ro'yxati bo'sh. Telefon sahifasida ❤️ tugmasini bosing."].join('\n');
  }
  return ['❤️ <b>Sevimlilar</b>', '', `Saqlangan: <b>${products.length}</b> ta`].join('\n');
}

export function favoritesListText(products) {
  return [
    '❤️ <b>Sevimlilar</b>',
    '',
    products
      .map((product, index) => `${index + 1}. ${e(product.brand)} ${e(product.model)} — <b>${formatPrice(product.price)}</b>`)
      .join('\n'),
    '',
    "Batafsil ma'lumot uchun raqamni tanlang.",
  ].join('\n');
}

export function mainMenu(user) {
  const name = user?.first_name ? e(user.first_name) : 'hurmatli mijoz';
  return [
    `Assalomu alaykum, <b>${name}</b>! 👋`,
    '',
    '<b>Telefon Store</b> — rasmiy kafolatli smartfonlar do‘koni.',
    '',
    "Kerakli bo'limni tanlang 👇",
  ].join('\n');
}

export function helpText() {
  const shop = shopInfo();
  return [
    'ℹ️ <b>Yordam</b>',
    '',
    '• 📱 Telefonlar — butun katalog',
    '• 🔍 Qidirish — nom yoki model bo‘yicha izlash',
    '• 🛒 Savatcha — tanlangan telefonlar',
    '• 📦 Buyurtmalarim — buyurtma holati',
    '',
    `Savol bo‘lsa: ${e(shop.phone)}`,
    shop.support ? `<i>${e(shop.support)}</i>` : null,
  ]
    .filter(Boolean)
    .join('\n');
}

export function contactText() {
  const shop = shopInfo();
  return [
    '📞 <b>Bog‘lanish</b>',
    '',
    `Do‘kon: <b>${e(shop.name)}</b>`,
    `Telefon: <b>${e(shop.phone)}</b>`,
    `Ish vaqti: ${e(shop.hours)}`,
    shop.support ? `\n<i>${e(shop.support)}</i>` : null,
  ]
    .filter(Boolean)
    .join('\n');
}

export function addressText() {
  const shop = shopInfo();
  return ['📍 <b>Do‘kon manzili</b>', '', e(shop.address), '', `Ish vaqti: ${e(shop.hours)}`].join('\n');
}

/** Admin uchun yangi buyurtma xabari */
export function newOrderNotification(order) {
  return ['🔔 <b>YANGI BUYURTMA</b>', '', orderCard(order, { forAdmin: true })].join('\n');
}

export function statusChangedNotification(order, status) {
  return [
    `Holat o'zgardi: <b>${ORDER_STATUS_LABEL[status] ?? status}</b>`,
    `Buyurtma: <code>${e(order.order_number)}</code>`,
  ].join('\n');
}

export function statusChangedForUser(order, status) {
  return [
    `📦 <b>${e(order.order_number)}</b>`,
    '',
    `Holat: <b>${ORDER_STATUS_LABEL[status] ?? status}</b>`,
    status === 'delivering' ? '\n🚚 Kuryer tez orada siz bilan bog‘lanadi.' : null,
    status === 'delivered' ? '\n🎉 Xaridingiz uchun rahmat!' : null,
    status === 'cancelled' ? '\nSavol bo‘lsa, do‘kon raqamiga murojaat qiling.' : null,
  ]
    .filter(Boolean)
    .join('\n');
}

export function errorText() {
  return '⚠️ Kutilmagan xatolik yuz berdi. Birozdan so‘ng qayta urinib ko‘ring.';
}

export function rateLimitText() {
  return '⏳ Juda ko‘p so‘rov yuborildi. Iltimos, bir necha soniyadan so‘ng qayta urinib ko‘ring.';
}

export function adminDenied() {
  return '⛔ Bu bo‘lim faqat administratorlar uchun.';
}

export function adminPanelText() {
  return [
    '🛠 <b>Administrator bo‘limi</b>',
    '',
    '• 📊 Statistika — bugungi savdo va buyurtmalar',
    '• 🖥 Web panel — mahsulot va buyurtmalarni boshqarish',
    '• 🔗 Telegram ulash — buyurtma xabarlarini olish',
  ].join('\n');
}

export function adminStatsText(dashboard, { url = null } = {}) {
  const { revenueSeries, topProducts } = dashboard;
  const lines = [
    '📊 <b>Statistika</b>',
    '',
    `👥 Foydalanuvchilar: <b>${dashboard.users}</b> (bugun +${dashboard.newUsersToday})`,
    `📦 Buyurtmalar: <b>${dashboard.allOrders}</b> (kutilmoqda: ${dashboard.pendingOrders})`,
    `💰 Umumiy savdo: <b>${formatPrice(dashboard.revenue)}</b>`,
    `📅 Bugun: <b>${formatPrice(dashboard.todayRevenue)}</b> · ${dashboard.todayPaidOrders} ta buyurtma`,
    `🧾 O‘rtacha chek: <b>${formatPrice(dashboard.averageOrder)}</b>`,
    `📱 Mahsulotlar: ${dashboard.activeProducts}/${dashboard.products} faol`,
  ];

  if (topProducts.length) {
    lines.push('', '<b>Top mahsulotlar:</b>');
    topProducts.forEach((product, index) => {
      lines.push(`${index + 1}. ${e(product.name)} — ${product.sold} ta`);
    });
  }

  if (revenueSeries.length) {
    lines.push('', '<b>Oxirgi 7 kun:</b>');
    revenueSeries.forEach((day) => {
      lines.push(`${day.day.slice(5)} — ${formatPrice(day.revenue, { withCurrency: false })} (${day.orders})`);
    });
  }

  if (dashboard.lowStock?.length) {
    lines.push('', '<b>⚠️ Ombor kam:</b>');
    dashboard.lowStock.forEach((product) => {
      lines.push(`• ${e(product.brand)} ${e(product.model)} — ${product.stock} dona`);
    });
  }

  if (url) lines.push('', `🖥 Web panel: <a href="${e(url)}">${e(url)}</a>`);
  return lines.join('\n');
}

export default {
  productCard,
  productDetails,
  catalogTitle,
  searchPrompt,
  noResults,
  emptySectionText,
  cartText,
  orderReview,
  orderCard,
  ordersList,
  orderShortLine,
  favoritesText,
  favoritesListText,
  mainMenu,
  helpText,
  contactText,
  addressText,
  newOrderNotification,
  statusChangedNotification,
  statusChangedForUser,
  errorText,
  rateLimitText,
  adminDenied,
  adminPanelText,
  adminStatsText,
};
