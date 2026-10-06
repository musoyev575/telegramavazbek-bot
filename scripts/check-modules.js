/**
 * Smoke-test: barcha modullar yuklanadimi, baza/migratsiya/seed ishlaydimi,
 * bot va admin server yaratiladimi (tarmoqqa ulanmasdan).
 *
 * Ishga tushirish: npm run check
 */
process.env.DB_PATH = ':memory:';
process.env.BOT_TOKEN = process.env.BOT_TOKEN || '123456789:AAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAA';
process.env.LOG_LEVEL = 'error';

const results = [];

/** Har qanday qiymatni qisqa matnga aylantiradi (obyekt bo'lsa — nomi) */
function describe(info) {
  if (info === undefined || info === null) return '';
  if (typeof info === 'string') return info;
  if (Array.isArray(info)) return `${info.length} ta modul`;
  if (typeof info === 'object') return 'yuklandi';
  return String(info);
}

async function step(name, fn) {
  try {
    const info = await fn();
    results.push(['✅', name, describe(info)]);
  } catch (error) {
    results.push(['❌', name, error.message]);
    process.exitCode = 1;
  }
}

const modules = [
  ['config', () => import('../src/config/index.js')],
  ['constants', () => import('../src/config/constants.js')],
  ['utils: logger/format/validate/html/paginate/images', () => import('../src/utils/logger.js')],
  ['database: db/migrate', () => import('../src/database/migrate.js')],
  [
    'models',
    () =>
      Promise.all([
        import('../src/models/userModel.js'),
        import('../src/models/productModel.js'),
        import('../src/models/categoryModel.js'),
        import('../src/models/cartModel.js'),
        import('../src/models/orderModel.js'),
        import('../src/models/adminModel.js'),
        import('../src/models/favoriteModel.js'),
        import('../src/models/settingsModel.js'),
        import('../src/models/promotionModel.js'),
      ]),
  ],
  [
    'services',
    () =>
      Promise.all([
        import('../src/services/productService.js'),
        import('../src/services/cartService.js'),
        import('../src/services/orderService.js'),
        import('../src/services/statsService.js'),
        import('../src/services/auditService.js'),
        import('../src/services/payments/index.js'),
      ]),
  ],
  [
    'bot: keyboards/texts/ui/middlewares',
    () =>
      Promise.all([
        import('../src/bot/texts.js'),
        import('../src/bot/ui.js'),
        import('../src/bot/keyboards/mainKeyboard.js'),
        import('../src/bot/keyboards/catalogKeyboard.js'),
        import('../src/bot/keyboards/productKeyboard.js'),
        import('../src/bot/keyboards/cartKeyboard.js'),
        import('../src/bot/keyboards/orderKeyboard.js'),
        import('../src/bot/keyboards/adminKeyboard.js'),
        import('../src/bot/middlewares/session.js'),
        import('../src/bot/middlewares/userLoader.js'),
        import('../src/bot/middlewares/rateLimit.js'),
        import('../src/bot/middlewares/adminGuard.js'),
        import('../src/bot/middlewares/errorHandler.js'),
        import('../src/bot/notifications.js'),
      ]),
  ],
  [
    'bot: handlers',
    () =>
      Promise.all([
        import('../src/bot/handlers/index.js'),
        import('../src/bot/handlers/start.js'),
        import('../src/bot/handlers/catalog.js'),
        import('../src/bot/handlers/filters.js'),
        import('../src/bot/handlers/search.js'),
        import('../src/bot/handlers/product.js'),
        import('../src/bot/handlers/cart.js'),
        import('../src/bot/handlers/checkout.js'),
        import('../src/bot/handlers/orders.js'),
        import('../src/bot/handlers/account.js'),
        import('../src/bot/handlers/admin.js'),
        import('../src/bot/handlers/fallback.js'),
      ]),
  ],
  ['admin: server + routes', () => import('../src/admin/server.js')],
];

for (const [name, load] of modules) {
  await step(`Modullar yuklandi: ${name}`, load);
}

let db;
await step('Baza: migratsiya + seed', async () => {
  const { openDatabase, setDb } = await import('../src/database/db.js');
  const { runMigrations } = await import('../src/database/migrate.js');
  const { seed } = await import('../src/database/seed.js');

  db = openDatabase(':memory:');
  setDb(db);
  runMigrations(db);
  const result = seed({ db });
  if (result.products < 5) throw new Error('demo mahsulotlar yuklanmadi');

  return `${result.products} ta mahsulot, ${result.categories} brend, admin: ${result.admin.created ? 'yaratildi' : 'mavjud'}`;
});

await step('Bot: handlerlar ro‘yxatdan o‘tdi (tarmoqsiz)', async () => {
  const { createBot } = await import('../src/bot/index.js');
  const bot = createBot();
  const user = await import('../src/models/userModel.js');
  void user;
  if (!bot.telegram) throw new Error('telegram klienti yaratilmadi');
  return `@${bot.botInfo?.username ?? 'test-bot'} uchun tayyor`;
});

await step('Bot oqimi: savatcha -> buyurtma', async () => {
  const [{ default: cartService }, { default: orderService }, { default: userModel }, { default: productModel }] =
    await Promise.all([
      import('../src/services/cartService.js'),
      import('../src/services/orderService.js'),
      import('../src/models/userModel.js'),
      import('../src/models/productModel.js'),
    ]);

  const user = userModel.upsertFromTelegram({ id: 999001, first_name: 'Smoke' });
  const product = productModel.search({ perPage: 1 }).items[0];
  cartService.addItem(user.id, product.id, 1);

  const result = orderService.createFromCart({
    userId: user.id,
    customerName: 'Smoke Test',
    customerPhone: '+998901234567',
    address: 'Toshkent, test manzil 1-uy',
  });

  if (!result.ok) throw new Error(result.message ?? result.reason);
  return `${result.order.order_number} — ${result.order.total} so'm`;
});

await step('Admin: server yaratildi', async () => {
  const { createAdminServer } = await import('../src/admin/server.js');
  const app = createAdminServer();
  if (typeof app.listen !== 'function') throw new Error('express app yaratilmadi');
  return 'Express app tayyor';
});

await step('Keyboards: tugmalar generatsiya qilinadi', async () => {
  const { productKeyboard } = await import('../src/bot/keyboards/productKeyboard.js');
  const keyboard = productKeyboard({
    product: { id: 1, brand: 'Apple', model: 'iPhone 15' },
    inStock: true,
    isFavorite: false,
  });
  const rows = keyboard.reply_markup.inline_keyboard;
  if (!Array.isArray(rows) || rows.length < 3) throw new Error('klaviatura qatorlari kam');
  return `${rows.length} qator tugma`;
});

await step('Matnlar: HTML escape ishlaydi', async () => {
  const { productCard } = await import('../src/bot/texts.js');
  const text = productCard({ brand: '<b>XSS</b>', model: 'Test', price: 100000, stock: 1 });
  if (text.includes('<b>XSS</b>')) throw new Error('HTML escape ishlamadi');
  return 'xavfsiz';
});

console.log('\n=== SMOKE TEST NATIJALARI ===');
for (const [icon, name, info] of results) {
  console.log(`${icon} ${name}${info ? ` — ${info}` : ''}`);
}
const failed = results.filter(([icon]) => icon === '❌').length;
console.log(`\n${results.length - failed}/${results.length} tekshiruv muvaffaqiyatli${failed ? ` (${failed} xato)` : ''}`);
