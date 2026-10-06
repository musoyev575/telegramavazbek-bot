# 📱 Telefon Store — Telegram bot + Admin panel

Telefon sotuv magazini uchun to'liq tizim: **O'zbek tilidagi Telegram bot** (katalog, qidiruv,
filtrlar, savatcha, buyurtma) va **zamonaviy web admin panel** (mahsulotlar, narxlar, ombor,
buyurtmalar, statistika).

Tizim **bitta Node.js ilovasi** sifatida ishlaydi: bot (Telegraf) va admin panel (Express) bir xil
ma'lumotlar bazasidan (SQLite) foydalanadi. Shu sababli mahsulot narxi admin panelda o'zgarsa —
botdagi katalog va savatchada darhol yangilanadi.

---

## ✨ Imkoniyatlar

### Foydalanuvchi (bot)
- `/start` — ro'yxatdan o'tish (Telegram ID saqlanadi) va asosiy menyu
- 📱 **Telefonlar** — katalog, sahifalash, brend bo'yicha tanlash
- 🔍 **Qidiruv** — nom, brend yoki model bo'yicha (LIKE injection'dan himoyalangan)
- 🔎 **Filtrlar** — brend, narx oralig'i, xotira, RAM, rang, faqat ombordagilar
- ↕️ **Saralash** — yangi, arzon/qimmat, mashhur
- 🏷 **Aksiyalar**, 🆕 **Yangi kelganlar**, ⭐ **Mashhur telefonlar**
- 📄 **Telefon sahifasi** — rasm, to'liq texnik ma'lumotlar, ombordagi qoldiq
- 🛒 **Savatcha** — qo'shish, miqdorni o'zgartirish, o'chirish, summani hisoblash
- ⚡️ **Hozir sotib olish** — to'g'ridan-to'g'ri buyurtmaga o'tish
- ❤️ **Sevimlilar**
- 📦 **Buyurtmalarim** — holat, tafsilotlar, 🔁 qayta buyurtma qilish
- 📋 **Buyurtma** — ism → telefon → yetkazish usuli → manzil → to'lov usuli → izoh → **tasdiqlash**
- 🚚 Yetkazish narxi avtomatik hisoblanadi (kuryer yoki do'kondan olib ketish; chegara summadan
  yuqorida bepul)
- 📞 **Bog'lanish** va 📍 **Do'kon manzili** (xarita havolasi bilan)

### Administrator
- 🛠 **Botda**: `/admin` menyusi, `/statistika`, buyurtma xabarlaridagi tugmalar orqali holatni
  o'zgartirish, `/adminim` bilan Telegram akkauntni ulash
- 🖥 **Web panel** (`http://127.0.0.1:3000`):
  - **Dashboard** — savdo, buyurtmalar, foydalanuvchilar, 7 kunlik grafik, top mahsulotlar,
    ombor ogohlantirishlari
  - **Mahsulotlar** — qo'shish/tahrirlash/o'chirish, narx va omborni tez o'zgartirish,
    rasm yuklash (JPG/PNG/WEBP/GIF, ≤5 MB)
  - **Buyurtmalar** — status bo'yicha filtrlar, batafsil ko'rish, ruxsat etilgan holat
    o'tishlari, mijozga avtomatik xabar
  - **Foydalanuvchilar** — xarid tarixi, bloklash
  - **Aksiyalar** — chegirma qo'llash/olib tashlash, ⭐ mashhur belgisi, promokodlar
  - **Sozlamalar** — do'kon ma'lumotlari, yetkazish narxi, administratorlar, parolni almashtirish

### Xavfsizlik
- Barcha SQL so'rovlar **parametrlangan** (SQL injection mumkin emas)
- Foydalanuvchi kiritgan matn botda **HTML escape** qilinadi (HTML injection oldini oladi)
- Bot tokeni va parollar faqat `.env` orqali — kod ichida hech qanday sir yo'q
- Admin parollari **bcrypt (12 rounds)**, sessiya tokenlari bazada faqat **SHA-256 xesh** ko'rinishida
- Cookie: `HttpOnly` + `SameSite=Strict` (production'da `Secure`)
- **CSRF** himoyasi (maxsus sarlavha + `Origin` tekshiruvi), **brute-force** limiti (IP bo'yicha)
- Ombor qoldig'i **tranzaksiya** ichida kamayadi, `CHECK (stock >= 0)` bilan bazadan himoyalangan
- Xatoliklar log faylga yoziladi (`logs/app-YYYY-MM-DD.log`), bot tokeni loglarda yashiriladi
- `audit_logs` jadvali: narx, ombor, buyurtma holati va sozlamalar o'zgarishlari kuzatiladi

---

## 🚀 O'rnatish

Talab: **Node.js 20+** (testlar Node 24'da o'tkazilgan).

```bash
# 1. Paketlarni o'rnatish
npm install

# 2. Muhit faylini tayyorlash
cp .env.example .env      # Windows: copy .env.example .env
# .env faylini ochib BOT_TOKEN ni yozing (@BotFather -> /newbot)
# SEED_ADMIN_PASSWORD ni albatta o'zgartiring!

# 3. Ishga tushirish
npm start                 # bot + admin panel
npm run bot               # faqat bot
npm run admin             # faqat admin panel (BOT_TOKEN kerak emas)
```

Birinchi ishga tushirishda avtomatik:
1. ma'lumotlar bazasi yaratiladi va migratsiyalar qo'llanadi (`storage/db/shop.sqlite`),
2. standart sozlamalar, 9 brend va 12 namunali telefon yuklanadi,
3. `.env` dagi login/parol bilan **superadmin** yaratiladi.

Admin panel: <http://127.0.0.1:3000> · bot buyruqlari: `/start`, `/katalog`, `/qidiruv`,
`/buyurtmalarim`, `/sevimlilar`, `/help`, `/admin`.

> **Muhim:** birinchi kirishdan keyin admin panelning *Sozlamalar → Xavfsizlik* bo'limida parolni
> almashtiring. Barcha sessiyalar avtomatik bekor qilinadi.

---

## 🗂 Papka tuzilishi

```
src/
├─ index.js                 # kirish nuqtasi (bot + admin panel + graceful shutdown)
├─ config/
│  ├─ index.js              # .env o'qish, tekshirish, feature-flag'lar, yo'llar
│  └─ constants.js          # statuslar, yetkazish/to'lov usullari, menyu matnlari
├─ database/
│  ├─ db.js                 # SQLite ulanishi (WAL, foreign_keys, tranzaksiyalar)
│  ├─ schema.sql            # barcha jadvallar
│  ├─ migrate.js            # versiyalangan migratsiyalar
│  └─ seed.js               # sozlamalar, brendlar, demo katalog, administrator
├─ models/                  # ma'lumotlarga kirish (faqat SQL, biznes-logika yo'q)
│  ├─ userModel.js  productModel.js  categoryModel.js  cartModel.js
│  └─ orderModel.js  adminModel.js  favoriteModel.js  settingsModel.js  promotionModel.js
├─ services/                # biznes-logika (bot va admin panel uchun umumiy)
│  ├─ productService.js  cartService.js  orderService.js
│  ├─ statsService.js    auditService.js
│  └─ payments/             # to'lov provayderlari: cash, card, click, payme, uzum
├─ bot/
│  ├─ index.js              # bot yaratish, buyruqlar, ishga tushirish
│  ├─ texts.js              # barcha interfeys matnlari (o'zbek tilida)
│  ├─ ui.js                 # xabar yuborish/tahrirlash, rasm bilan karta
│  ├─ notifications.js      # adminlarga va mijozga xabarnomalar
│  ├─ handlers/             # start, catalog, filters, search, product, cart, checkout,
│  │                        # orders, account, admin, fallback
│  ├─ keyboards/            # main, catalog, product, cart, order, admin, common
│  └─ middlewares/          # session, userLoader, rateLimit, adminGuard, errorHandler
├─ admin/
│  ├─ server.js             # Express ilovasi (xavfsizlik sarlavhalari, static, uploads)
│  ├─ auth.js               # sessiya, login limiti, CSRF, rol tekshiruvi
│  ├─ routes/               # auth, products, orders, stats, users, promotions, settings
│  └─ public/               # SPA: index.html, login.html, css/, js/ (api, ui, views/*)
└─ utils/                   # logger, format, validate, html, paginate, images

tests/                      # node:test — 73 ta test (utils, katalog, savatcha, buyurtma,
                            # admin API E2E, seed, promokodlar)
scripts/                    # check-modules.js (smoke test), demo-order.js (demo buyurtma)
storage/                    # db/shop.sqlite + uploads/ (yuklangan rasmlar)
```

---

## 🗄 Ma'lumotlar bazasi

| Jadval | Vazifasi |
| --- | --- |
| `users` | bot foydalanuvchilari, xarid statistikasi |
| `categories` | brendlar (kategoriyalar) |
| `products` | telefonlar: narx, eski narx, RAM/xotira, ekran, kamera, ombor va h.k. |
| `product_images` | mahsulot rasmlari (tartiblangan) |
| `carts`, `cart_items` | savatcha |
| `favorites` | sevimlilar |
| `orders`, `order_items` | buyurtmalar va elementlar (mahsulot nomi/narxi snapshot sifatida) |
| `order_status_history` | buyurtma holatlari tarixi (audit) |
| `payments` | to'lovlar (Click/Payme/Uzum shu jadval orqali ulanadi) |
| `admins`, `admin_sessions` | administratorlar va sessiyalar |
| `settings` | kalit-qiymat sozlamalari |
| `promocodes` | promokodlar (feature-flag ostida) |
| `audit_logs` | admin amallari jurnali |

**Buyurtma holatlari (state machine):**
`new → accepted → awaiting_payment → paid → preparing → delivering → delivered`,
istalgan bosqichdan `cancelled` (bekor qilinganда mahsulot omborga qaytariladi).
Ruxsat etilmagan o'tishlar (masalan `new → delivered`) rad etiladi.

---

## 🧪 Tekshirish

```bash
npm test         # 73 ta test: biznes-logika, xavfsizlik, admin API (HTTP E2E)
npm run check    # smoke test: barcha modullar, migratsiya, seed, bot va server yaratilishi
node scripts/demo-order.js 2   # admin panelni sinash uchun demo buyurtma (2 dona)
```

Testlar xotiradagi (in-memory) bazada ishlaydi — haqiqiy ma'lumotlarga tegmaydi.

---

## 🔒 Production checklist

1. `SEED_ADMIN_PASSWORD` ni kuchli parolga o'zgartirib, birinchi kirishdan keyin uni yana almashtiring
2. `NODE_ENV=production` (cookie'ga `Secure`, loglarni kamaytirish)
3. `ADMIN_HOST=127.0.0.1` + tashqi dunyoga **nginx/caddy** orqali HTTPS bilan chiqaring
4. `ADMIN_PUBLIC_URL=https://admin.example.uz` (bot xabarlaridagi havolalar uchun)
5. Bot tokenini hech qachon git'ga qo'shmang (`.env` `.gitignore`'da)
6. Bir nechta instansiyada ishlatsangiz: sessiyalar uchun **Redis** va umumiy baza
7. 24/7 ishlash (systemd, HTTPS, backup, monitoring): [`docs/DEPLOY.md`](docs/DEPLOY.md)

### 24/7 kuzatuv va zaxira nusxa

- `GET /health` — monitoring endpoint: `ok`, `database.ok`, `bot.running`, `bot.lastUpdateAt` (maxfiy ma'lumot yo'q)
- `npm run backup` — SQLite **online** nusxa (`db.backup()`) + `integrity_check` + eski nusxalarni tozalash (`BACKUP_KEEP`)
- Loglar kun bo'yicha yoziladi va `LOG_RETENTION_DAYS` (standart 14) kundan keyin o'chiriladi
- Bot uzilsa jarayon `exit(1)` bilan to'xtaydi — `deploy/telefon-bot.service` uni avtomatik qayta uradi

---

## 🛣 Kelajakdagi funksiyalar (arxitektura tayyor)

| Funksiya | Qanday qo'shiladi |
| --- | --- |
| 💳 **Click / Payme / Uzum** | `src/services/payments/providers/*.js` — merchant kalitlari `.env` ga, webhook marshruti `src/admin/routes/` ga qo'shiladi (interfeys va `payments` jadvali tayyor) |
| 🎟 **Promokodlar** | `FEATURE_PROMOCODES=1` — bot allaqachon chegirmani hisoblaydi, admin panelda boshqaruv bor |
| 📊 **Solishtirish** | `FEATURE_COMPARE=1` + yangi handler (mahsulot tugmalarida joy tayyor) |
| ⭐ **Sharhlar va reyting** | yangi jadval + mahsulot sahifasida bo'lim (migratsiya qo'shish kifoya) |
| 🚚 **Kuryer tizimi** | `orders.handled_by` va `order_status_history` tayyor; kuryer roli `admins.role` orqali |
| 💰 **Bonus / cashback** | `users.total_spent` hisoblanadi — bonus jadvali qo'shilib, `delivered` holatida yoziladi |
| 📨 **SMS xabarnoma** | `notifications.js` ga provayder qo'shiladi (`FEATURE_SMS=1`) |
| 📣 **Telegram reklama** | `userModel.allTelegramIds()` tayyor (bloklanmaganlarga yuborish) |
| 🤝 **CRM integratsiya** | barcha ma'lumot `services/` orqali olinadi — tashqi API qo'shish oson |

Batafsil: [`docs/ARXITEKTURA.md`](docs/ARXITEKTURA.md).

---

## 📄 Litsenziya

MIT
