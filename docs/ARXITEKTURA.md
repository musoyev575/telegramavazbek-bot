# 🏗 Arxitektura

Hujjat loyihaning ichki tuzilishini, ma'lumotlar oqimini va kengaytirish nuqtalarini tushuntiradi.

## 1. Umumiy ko'rinish

```
                  ┌──────────────────────────────┐
   Telegram  ───► │  bot (Telegraf)              │
                  │  middlewares → handlers      │
                  └──────────────┬───────────────┘
                                 │
                                 ▼
                  ┌──────────────────────────────┐        ┌───────────────┐
   Brauzer  ───►  │  services (biznes-logika)    │ ◄────► │  SQLite (WAL) │
                  │  cart / order / product /    │        │  storage/db   │
                  │  stats / payments            │        └───────────────┘
                  └──────────────▲───────────────┘
                                 │
                  ┌──────────────┴───────────────┐
                  │  admin panel (Express + SPA) │
                  └──────────────────────────────┘
```

**Asosiy qoida:** biznes-logika faqat `services/` qatlamida. Bot ham, admin panel ham aynan shu
funksiyalarni chaqiradi — natijada qoidalar ikki joyda takrorlanmaydi (masalan, "ombor manfiy
bo'lmasin" yoki "bekor qilinganda ombor qaytarilsin" qoidasi bitta joyda yozilgan).

| Qatlam | Vazifasi | Nima qilmaydi |
| --- | --- | --- |
| `bot/` | Telegram interfeysi: matnlar, tugmalar, oqimlar | SQL yozmaydi, hisob-kitob qilmaydi |
| `admin/` | HTTP API + web interfeys | biznes-qoidalarni takrorlamaydi |
| `services/` | qoidalar, tranzaksiyalar, hisob-kitoblar | Telegram/HTTP haqida bilmaydi |
| `models/` | SQL so'rovlar (parametrlangan) | biznes qarorlar qabul qilmaydi |
| `database/` | ulanish, sxema, migratsiya, seed | — |
| `utils/` | logger, format, validatsiya, HTML escape | — |

## 2. Ma'lumotlar oqimi: buyurtma misolida

1. **Mijoz** botda «🛒 Savatchaga qo'shish» tugmasini bosadi → `cartService.addItem()`.
   Miqdor ombordagi qoldiq bilan solishtiriladi (`setQuantity` hech qachon qoldiqdan oshmaydi).
2. **Checkout** oqimi (`bot/handlers/checkout.js`, `ctx.session.data.step`):
   `name → phone → delivery → address → payment → comment → confirm`.
   Har bir qadamda kirish ma'lumoti `utils/validate.js` orqali tekshiriladi.
3. **Tasdiqlashda** (`checkout:confirm`) `orderService.createFromCart()` chaqiriladi. U bitta
   **tranzaksiya** ichida:
   - har bir mahsulotning qoldig'ini qayta tekshiradi va `stock - qty` qiladi (race condition yo'q),
   - `orders` va `order_items` yozuvlarini (narx snapshoti bilan) qo'shadi,
   - `order_status_history` ga `new` yozuvini qo'shadi,
   - savatchani tozalaydi.
   Biror qadamda xatolik bo'lsa — hammasi orqaga qaytariladi (`inTransaction`).
4. **Xabarnoma**: `bot/notifications.js` barcha adminlarga buyurtma kartasi va holat tugmalarini
   yuboradi. Admin panelda ham o'sha buyurtma darhol ko'rinadi.
5. **Holat o'zgarishi** — `orderService.changeStatus()`:
   `ORDER_STATUS_FLOW` (state machine) ruxsat bergan o'tishlar ichida ishlaydi,
   `cancelled` da ombor qaytariladi, `delivered` da mijoz statistikasi yangilanadi,
   `paid` da to'lov holati belgilanadi. Tarix `order_status_history` ga yoziladi.

## 3. Sessiya va holat (bot)

- `sessionMiddleware` — Telegraf sessiyasi; har bir foydalanuvchi uchun:
  `flow` (faol oqim), `data` (oqim ma'lumotlari), `catalog` (filtr/sahifa/saralash).
- Sessiya xotirada saqlanadi — bir instansiyada ishlash uchun yetarli.
  Gorizontal kengaytirish kerak bo'lsa `@telegraf/session` + Redis'ga almashtiriladi (interfeys bir xil).
- Matn routeri (`bot/handlers/index.js`) faol oqimga qarab yo'naltiradi:
  `flow === 'search'` → qidiruv, `flow === 'checkout'` → buyurtma qadami, aks holda fallback.

## 4. Xavfsizlik modeli

| Tahdid | Himoya |
| --- | --- |
| SQL injection | faqat parametrlangan so'rovlar (`@param`), `escapeLike()` qidiruvda |
| HTML injection (bot) | `escapeHtml()` har bir foydalanuvchi/mahsulot matnida |
| XSS (admin panel) | DOM faqat `textContent` orqali quriladi, `innerHTML` ishlatilmaydi + CSP |
| CSRF | `X-Requested-With: fetch` sarlavhasi + `Origin` tekshiruvi |
| Clickjacking | `X-Frame-Options: DENY`, CSP `frame-ancestors` |
| Brute-force | 15 daqiqada 5 urinish (IP bo'yicha), `admins.last_login_ip` yoziladi |
| Sessiya o'g'irlash | `HttpOnly` + `SameSite=Strict` cookie, bazada faqat SHA-256 xesh |
| Path traversal | `/uploads/...` yo'llari `path.basename` + papka tekshiruvi bilan cheklanadi |
| Fayl yuklash | MIME whitelist (JPG/PNG/WEBP/GIF), 5 MB limit, tasodifiy nom |
| Ma'lumot yo'qolishi | `CHECK` cheklovlari, tranzaksiyalar, `orders` snapshotlari |
| Kuzatuv | `audit_logs` + `logs/app-*.log` (token loglarda yashiriladi) |
| DoS/spam (bot) | `rateLimitMiddleware` (10 soniyada 15 so'rov/foydalanuvchi) |

## 5. To'lov provayderlari (kengaytirish)

Har bir usul — alohida modul, quyidagi interfeys bilan:

```js
export default {
  code: 'click',
  label: '🟢 Click',
  enabled: false,            // interfeysda ko'rinadimi
  online: true,              // webhook orqali tasdiqlanadimi
  instructions(order) {},    // foydalanuvchiga matn
  createPayment(order) {},   // { ok, paymentId?, requiresManualConfirmation? }
  handleCallback(payload) {},// { ok, orderId, status, externalId }
};
```

Ulash tartibi: `.env` ga kalitlar → `enabled: true` → `createPayment` da provayder API'si →
`src/admin/routes/` dagi webhook endpointi → `orderService.setPaymentStatus(orderId, 'paid')`.
`payments` jadvali va `orders.payment_status` allaqachon mavjud.

## 6. Feature-flag'lar

`src/config/index.js` → `config.features`. Yoqish uchun `.env` da `FEATURE_X=1`:

`onlinePayments`, `promocodes`, `bonuses`, `cashback`, `compare`, `reviews`, `courier`,
`smsNotifications`, `marketing`, `crm`.

Shu sababli kelajakdagi funksiyalar uchun kodni qayta yozish shart emas — yoqish va ulash kifoya.

## 7. Migratsiya siyosati

- Har bir o'zgarish `src/database/migrate.js` dagi `MIGRATIONS` ro'yxatiga yangi element sifatida
  qo'shiladi (`version`, `name`, `up(db)`).
- `schema_migrations` jadvali qaysi versiyalar qo'llanganini yozib boradi — mavjud bazalar ham
  yangilanadi, yangi bazalar ham to'g'ri yaratiladi.
- Eski jadval/ustunlarni o'chirishdan oldin backup: `storage/db/shop.sqlite` nusxasini oling.

## 8. Nima uchun SQLite?

Do'kon hajmi (kuniga o'nlab–yuzlab buyurtma) uchun SQLite ortiqcha; WAL rejimi bot va admin
panelning bir vaqtda ishlashini ta'minlaydi, backup — bitta fayl. Katta yuklamaga o'tish kerak
bo'lsa: `src/models/*` va `src/database/db.js` ni PostgreSQL'ga almashtirish yetarli — servis
qatlami va bot/admin kodi o'zgarmaydi.

## 9. Ishlab chiqish oqimi (tavsiya)

1. `npm run check` — modullar va baza ishlayaptimi?
2. `npm test` — biznes-logika va API testlari.
3. `npm run admin` (bot tokenisiz) + `node scripts/demo-order.js` — panelni tez sinash.
4. `npm start` — to'liq tizim (bot + panel).
