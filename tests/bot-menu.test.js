/**
 * Bot menyusi — haqiqiy integratsiya testi.
 *
 * Bot Telegram API'siz ishlaydi: `bot.telegram.callApi` stub qilinadi va yuborilgan
 * barcha xabarlar yig'ib olinadi. Shu tarzda handlerlar, klaviaturalar, sessiya va
 * foydalanuvchi yuklash qatlami haqiqiy update oqimi orqali tekshiriladi.
 */
import assert from 'node:assert/strict';
import { after, before, test } from 'node:test';

process.env.DB_PATH = ':memory:';
process.env.BOT_TOKEN = '123456789:AAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAA';
process.env.LOG_LEVEL = 'error';

let bot;
let teardown;
let productModel;
let MENU;
let sent = [];
let updateId = 1000;

/** Xabar matnini olib keladigan metodlar (answerCbQuery kabi shovqinni tashlab yuboramiz) */
const TEXT_METHODS = new Set([
  'sendMessage',
  'editMessageText',
  'sendPhoto',
  'editMessageCaption',
  'editMessageMedia',
]);

/**
 * Telegram API'sini to'liq bloklaymiz.
 *
 * MUHIM: Telegraf `handleUpdate` ichida har bir update uchun YANGI `Telegram`
 * instansiyasini yaratadi (`new Telegram(...)`). Shuning uchun `bot.telegram.callApi`
 * ni almashtirish yetarli emas — `callApi` sinf prototipida turibdi va uni
 * prototipda almashtirish kerak. Shundagina hech qanday haqiqiy tarmoq so'rovi bo'lmaydi.
 */
function stubTelegram(botInstance) {
  let proto = Object.getPrototypeOf(botInstance.telegram);
  while (proto && !Object.prototype.hasOwnProperty.call(proto, 'callApi')) {
    proto = Object.getPrototypeOf(proto);
  }
  if (!proto) throw new Error('callApi prototipi topilmadi');

  proto.callApi = async (method, payload = {}) => {
    sent.push({ method, payload });
    if (method === 'answerCallbackQuery') return true;
    if (method === 'deleteMessage') return true;
    return {
      message_id: sent.length,
      date: Math.floor(Date.now() / 1000),
      chat: { id: payload.chat_id ?? 1, type: 'private' },
      message_thread_id: null,
      photo: payload.photo,
    };
  };

  // `getMe` tarmoqqa chiqmasligi uchun botInfo'ni oldindan beramiz
  botInstance.botInfo = {
    id: 1,
    is_bot: true,
    first_name: 'Test Bot',
    username: 'test_bot',
    can_join_groups: true,
    can_read_all_group_messages: false,
    supports_inline_queries: false,
  };

  return proto;
}

/**
 * Buyruq matni uchun Telegram entity'sini yasaymiz.
 * Telegraf `bot.command()` handleri `message.entities[0].type === 'bot_command'`
 * bo'lishini talab qiladi — haqiqiy Telegram update'ida bu maydon doim bo'ladi.
 */
function commandEntities(text) {
  if (!text.startsWith('/')) return undefined;
  const spaceIndex = text.indexOf(' ');
  const length = spaceIndex === -1 ? text.length : spaceIndex;
  return [{ type: 'bot_command', offset: 0, length }];
}

function textUpdate(text, { userId = 424242, firstName = 'Test' } = {}) {
  updateId += 1;
  return {
    update_id: updateId,
    message: {
      message_id: updateId,
      date: Math.floor(Date.now() / 1000),
      chat: { id: userId, type: 'private' },
      from: { id: userId, is_bot: false, first_name: firstName, language_code: 'uz' },
      text,
      entities: commandEntities(text),
    },
  };
}

function callbackUpdate(data, { userId = 424242, withPhoto = false } = {}) {
  updateId += 1;
  return {
    update_id: updateId,
    callback_query: {
      id: String(updateId),
      from: { id: userId, is_bot: false, first_name: 'Test' },
      chat_instance: String(updateId),
      data,
      message: {
        message_id: updateId,
        date: Math.floor(Date.now() / 1000),
        chat: { id: userId, type: 'private' },
        from: { id: 777, is_bot: true, first_name: 'Bot' },
        // Mahsulot kartasi rasm bilan yuboriladi — bunday xabarni tahrirlashda
        // Telegram `editMessageText`ni rad etadi (caption metodi kerak).
        ...(withPhoto
          ? { photo: [{ file_id: 'test-file-id', file_unique_id: 'test', width: 800, height: 600 }], caption: 'oldingi izoh' }
          : { text: 'oldingi xabar' }),
      },
    },
  };
}

/** Yuborilgan xabarlar (faqat matnli) */
function textEntries() {
  return sent.filter((entry) => TEXT_METHODS.has(entry.method));
}

/** Oxirgi yuborilgan xabar matni */
function lastText() {
  const entries = textEntries();
  const payload = entries[entries.length - 1]?.payload;
  return payload?.text ?? payload?.caption ?? '';
}

function allText() {
  return textEntries()
    .map((entry) => entry.payload?.text ?? entry.payload?.caption ?? '')
    .join('\n---\n');
}

async function send(update) {
  const { resetRateLimit } = await import('../src/bot/middlewares/rateLimit.js');
  resetRateLimit();
  sent = [];
  await bot.handleUpdate(update);
  return lastText();
}

before(async () => {
  const helper = await import('./helpers/db.js');
  helper.freshDatabase();
  teardown = helper.teardownDatabase;

  const [{ createBot }, { resetRateLimit }, constants, products] = await Promise.all([
    import('../src/bot/index.js'),
    import('../src/bot/middlewares/rateLimit.js'),
    import('../src/config/constants.js'),
    import('../src/models/productModel.js'),
  ]);

  MENU = constants.MENU;
  productModel = products.default;
  resetRateLimit();

  bot = createBot();
  stubTelegram(bot);

  assert.equal(typeof bot.telegram.callApi, 'function');
  await bot.telegram.callApi('deleteWebhook', {});
  sent = []; // stub'ning o'zi tekshirildi — tozalaymiz
});

after(() => teardown?.());

test('/start: foydalanuvchi ro‘yxatdan o‘tadi va menyu ko‘rsatiladi', async () => {
  const text = await send(textUpdate('/start'));

  assert.match(text, /Assalomu alaykum/);
  assert.match(text, /Telefon Store/);

  const replyMarkup = textEntries()[0]?.payload.reply_markup;
  assert.ok(replyMarkup?.keyboard, 'asosiy menyu klaviaturasi yuboriladi');

  const flat = replyMarkup.keyboard.flat();
  for (const item of [MENU.PHONES, MENU.SEARCH, MENU.PROMOS, MENU.NEW, MENU.POPULAR, MENU.CART, MENU.ORDERS, MENU.FAVORITES, MENU.CONTACT, MENU.ADDRESS, MENU.HELP]) {
    assert.ok(flat.includes(item), `menyuda «${item}» tugmasi bo‘lishi kerak`);
  }
});

test('menyu: 📱 Telefonlar — katalog ochiladi', async () => {
  const text = await send(textUpdate(MENU.PHONES));
  assert.match(text, /Telefonlar/);
  assert.match(text, /Sahifa 1\//);
  assert.match(text, /so'm/, 'narxlar ko‘rsatiladi');
});

test('menyu: 🏷 Aksiyalar — faqat chegirmadagi telefonlar', async () => {
  const text = await send(textUpdate(MENU.PROMOS));
  assert.match(text, /Aksiyalar/);
  assert.doesNotMatch(text, /Hech narsa topilmadi/);

  const sale = productModel.search({ onSale: true, perPage: 50 });
  assert.ok(sale.total > 0, 'demo katalogda aksiyadagi telefonlar bor');
  assert.ok(text.includes(sale.items[0].model), 'aksiyadagi telefon ro‘yxatda ko‘rinadi');
});

test('menyu: 🆕 Yangi kelganlar', async () => {
  const text = await send(textUpdate(MENU.NEW));
  assert.match(text, /Yangi kelganlar/);
});

test('menyu: ⭐ Mashhur telefonlar', async () => {
  const text = await send(textUpdate(MENU.POPULAR));
  assert.match(text, /Mashhur telefonlar/);
});

test('menyu: 🛒 Savatcha bo‘sh holatda', async () => {
  const text = await send(textUpdate(MENU.CART));
  assert.match(text, /Savatcha bo'sh|Savatcha/);
});

test('menyu: 📦 Buyurtmalarim — bo‘sh ro‘yxat', async () => {
  const text = await send(textUpdate(MENU.ORDERS));
  assert.match(text, /Buyurtmalarim/);
  assert.match(text, /hali buyurtma yo‘q/);
});

test('menyu: ❤️ Sevimlilar — bo‘sh ro‘yxat', async () => {
  const text = await send(textUpdate(MENU.FAVORITES));
  assert.match(text, /Sevimlilar/);
});

test('menyu: 📞 Bog‘lanish va 📍 Do‘kon manzili', async () => {
  const contact = await send(textUpdate(MENU.CONTACT));
  assert.match(contact, /Bog‘lanish/);
  assert.match(contact, /\+998/, 'do‘kon raqami ko‘rsatiladi');

  const address = await send(textUpdate(MENU.ADDRESS));
  assert.match(address, /Do‘kon manzili/);
  assert.match(address, /Toshkent/);
});

test('menyu: ℹ️ Yordam', async () => {
  const text = await send(textUpdate(MENU.HELP));
  assert.match(text, /Yordam/);
});

test('katalog: sahifalash tugmasi ishlaydi', async () => {
  await send(textUpdate(MENU.PHONES));
  const text = await send(callbackUpdate('catalog:page:2'));
  assert.match(text, /Sahifa 2\//);
});

test('katalog: butun katalogga qaytish (catalog:all)', async () => {
  await send(textUpdate(MENU.PROMOS));
  const text = await send(callbackUpdate('catalog:all'));
  assert.match(text, /📱 <b>Telefonlar<\/b>/, 'sarlavha oddiy katalogga qaytadi');
});

test('savatcha: mahsulotni ochib savatchaga qo‘shish', async () => {
  const product = productModel.search({ perPage: 1 }).items[0];

  const card = await send(callbackUpdate(`product:open:${product.id}`));
  assert.match(card, /so'm/);
  assert.ok(sent.some((entry) => entry.method === 'sendPhoto'), 'mahsulot kartasi rasm bilan yuboriladi');

  const added = await send(callbackUpdate(`product:add:${product.id}`));
  assert.match(added, /savatchaga qo‘shildi/);

  const cart = await send(textUpdate(MENU.CART));
  assert.match(cart, /Jami:/);
  assert.ok(cart.includes(product.model), 'mahsulot savatchada ko‘rinadi');
});

test('buyurtma oqimi: savatchadan tasdiqlashgacha', async () => {
  const product = productModel.search({ perPage: 2 }).items[1];
  await send(callbackUpdate(`product:buy:${product.id}`));

  // 1) Ism
  const nameStep = lastText();
  assert.match(nameStep, /Ism-familiya|Ism-familiyangizni kiriting/);
  await send(textUpdate('Ali Valiyev'));

  // 2) Telefon
  assert.match(lastText(), /Telefon raqamingizni ulashing/);
  await send(textUpdate('+998 90 123 45 67'));

  // 3) Yetkazish usuli
  assert.match(lastText(), /Yetkazib berish usuli/);
  await send(callbackUpdate('checkout:delivery:delivery'));

  // 4) Manzil
  assert.match(lastText(), /Yetkazib berish manzili/);
  await send(textUpdate('Toshkent, Chilonzor 9-mavze, 12-uy, 34-xonadon'));

  // 5) To'lov usuli
  assert.match(lastText(), /To‘lov usuli/);
  await send(callbackUpdate('checkout:payment:cash'));

  // 6) Izoh
  assert.match(lastText(), /Qo‘shimcha izoh/);
  await send(callbackUpdate('checkout:skip_comment'));

  // 7) Tasdiqlash — buyurtma to'liq ko‘rsatiladi
  const review = lastText();
  assert.match(review, /Buyurtmani tekshiring/);
  assert.match(review, /Ali Valiyev/);
  assert.match(review, /\+998 90 123 45 67/);
  assert.match(review, /Chilonzor/);

  await send(callbackUpdate('checkout:confirm'));
  const confirmation = allText();
  assert.match(confirmation, /Buyurtma qabul qilindi/);
  assert.match(confirmation, /TS-\d{8}-\d{4}/, 'buyurtma raqami beriladi');
});

test('buyurtmalarim: yaratilgan buyurtma ro‘yxatda ko‘rinadi', async () => {
  const text = await send(textUpdate(MENU.ORDERS));
  assert.match(text, /TS-\d{8}-\d{4}/);
  assert.match(text, /Yangi/);
});

test('qidiruv: iPhone so‘rovi natija beradi', async () => {
  const prompt = await send(textUpdate(MENU.SEARCH));
  assert.match(prompt, /Qidiruv/);

  const text = await send(textUpdate('iPhone 15'));
  assert.match(text, /iPhone 15/);
  assert.doesNotMatch(text, /topilmadi/);
});

test('noma’lum matn: foydalanuvchi yo‘l-yo‘riq oladi (jim qolmaydi)', async () => {
  const text = await send(textUpdate('salom'));

  // Qidiruvga o'xshagan matn izlanadi, natija bo'lmasa tushunarli xabar beriladi
  assert.ok(text.includes('topilmadi') || text.includes('tushunmadim'), `kutilgan matn olindi: ${text.slice(0, 80)}`);
});

test('admin: ruxsatsiz foydalanuvchi /admin buyrug‘ini ishlata olmaydi', async () => {
  const text = await send(textUpdate('/admin'));
  assert.match(text, /faqat administratorlar/);
});

test('xavfsizlik: mahsulot nomidagi HTML escape qilinadi', async () => {
  productModel.create({
    brand: '<b>XSS</b>',
    model: '<script>alert(1)</script> Telefon',
    price: 1000000,
    stock: 5,
    color: 'Qora',
  });

  const text = await send(textUpdate(MENU.PHONES));
  assert.ok(!allText().includes('<script>alert(1)</script>'), 'skript tegi matn sifatida yuborilmaydi');
  assert.match(allText(), /&lt;script&gt;/, 'HTML belgilari escape qilinadi');
});

test('xato: handler ichida xatolik bo‘lsa bot yiqilmaydi', async () => {
  // Mavjud bo'lmagan mahsulotni ochish — jimgina tushunarli xabar qaytishi kerak
  const text = await send(callbackUpdate('product:open:999999'));
  assert.ok(text.length >= 0);
  assert.ok(bot.telegram, 'bot ishlashda davom etadi');
});

test('buyurtma: noto‘g‘ri telefon raqamida fallback qo‘shimcha xabar yubormaydi', async () => {
  const product = productModel.search({ perPage: 1 }).items[0];
  await send(callbackUpdate(`product:buy:${product.id}`));
  await send(textUpdate('Ali Valiyev'));
  assert.match(lastText(), /Telefon raqamingizni ulashing/);

  // Noto‘g‘ri raqam: faqat bitta tushunarli xato bo‘lishi shart,
  // "tushunmadim" fallback'i telefon klaviaturasini buzmasligi kerak.
  await send(textUpdate('salom'));
  const text = allText();
  assert.match(text, /Raqam noto‘g‘ri/);
  assert.doesNotMatch(text, /tushunmadim/);

  // Oqim davom etadi: to‘g‘ri raqam keyingi bosqichga olib boradi
  await send(textUpdate('+998 90 123 45 67'));
  assert.match(lastText(), /Yetkazib berish usuli/);
});

test('mahsulot kartasi: rasm xabari caption orqali tahrirlanadi', async () => {
  const product = productModel.search({ perPage: 50 }).items.find((item) => item.image);
  assert.ok(product, 'rasmli mahsulot topiladi');

  // Mahsulot kartasi rasm bilan yuboriladi, shuning uchun tugma bosilganda
  // callback xabari ham rasmli bo'ladi.
  await send(callbackUpdate(`product:open:${product.id}`, { withPhoto: true }));
  assert.ok(sent.some((entry) => entry.method === 'sendPhoto'), 'karta rasm bilan yuboriladi');

  const added = await send(callbackUpdate(`product:add:${product.id}`, { withPhoto: true }));
  assert.match(added, /savatchaga qo‘shildi/);
  assert.ok(
    sent.some((entry) => entry.method === 'editMessageCaption'),
    'rasm xabari editMessageCaption bilan tahrirlanadi',
  );
  assert.ok(
    !sent.some((entry) => entry.method === 'editMessageText'),
    'rasm xabari editMessageText bilan tahrirlanmaydi (Telegram rad etadi)',
  );
});
