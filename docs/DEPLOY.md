# 24/7 ishga tushirish qo‘llanmasi (deploy)

Maqsad: bot **doim** ishlaydi — server qayta yuklansa ham, jarayon qulasa ham o‘zi tiklanadi,
ma’lumotlar (SQLite) yo‘qolmaydi, eski loglar diskni to‘ldirmaydi.

---

## 1. Hosting tanlash

Bu bot **uzluksiz ishlaydigan (long-running) jarayon** + **faylga yozadigan SQLite baza**.
Shuning uchun kerak: **doimiy disk** va **fon jarayonini ushlab turadigan** muhit.

Mos variantlar (arzon → qulay):

| Variant | Narx (taxminan) | Nega mos |
|---|---|---|
| **Hetzner Cloud** (CX22) | ~€4/oy | Eng arzon ishonchli VPS; 2 vCPU / 4 GB. EU region. |
| **DigitalOcean Droplet** | $4–6/oy | Oson boshqaruv, **Singapore** regioni O‘zbekistonga eng yaqin. |
| **Vultr / Linode (Akamai)** | $5/oy | Mumbai/Seoul regionlari, tez tarmoq. |
| **Fly.io** | ~$2–5/oy | Konteyner + **volume** (SQLite uchun doimiy disk). `auto_stop_machines = false` qilinishi shart. |

**Mos EMAS (ehtiyot bo‘ling):**
- Vercel / Netlify / Cloudflare Workers / Cloud Run — serverless, fon jarayoni yo‘q, fayl saqlanmaydi.
- Render / Heroku bepul tariflari — jarayon to‘xtatiladi va **disk vaqtinchalik** (SQLite o‘chib ketadi).
- PaaS ishlatilsa, albatta **doimiy volume** ulanishi va `auto-stop` o‘chirilishi kerak.

Minimal resurs: **1 vCPU / 1 GB RAM / 10 GB SSD** yetarli (bot + admin panel juda yengil).

---

## 2. Serverni tayyorlash (Ubuntu 22.04/24.04)

Serverda kod turishi kerak (git orqali yoki `rsync`/`scp` bilan):

```bash
# lokal kompyuterda (Windows Git Bash):
rsync -av --exclude node_modules --exclude storage --exclude logs \
  ./ root@SERVER_IP:/root/telefon-bot-src/
```

Keyin serverda:

```bash
ssh root@SERVER_IP
apt-get update && apt-get install -y rsync
bash /root/telefon-bot-src/deploy/setup-ubuntu.sh /root/telefon-bot-src
```

Skript nima qiladi (batafsil: `deploy/setup-ubuntu.sh`):

1. Node.js 22 LTS + `build-essential` (better-sqlite3 uchun) o‘rnatadi.
2. `telefon` nomli **tizim foydalanuvchisini** yaratadi — bot **root sifatida ishlamaydi**.
3. Loyihani `/opt/telefon-bot` ga ko‘chiradi va bog‘lanishlarni o‘rnatadi.
4. `telefon-bot` systemd xizmatini yoqadi (`Restart=always`, bootda avtomatik).
5. Har kuni **03:15** da ishlaydigan zaxira nusxa cron‘ini qo‘shadi.
6. journald hajmini 500 MB bilan cheklaydi.

### `.env` fayli (majburiy)

```bash
cd /opt/telefon-bot
cp .env.example .env
nano .env      # BOT_TOKEN, ADMIN_PUBLIC_URL, SEED_ADMIN_* ni to'ldiring
chown telefon:telefon .env && chmod 600 .env
systemctl restart telefon-bot
```

Production uchun muhim qiymatlar:

```ini
NODE_ENV=production                  # cookie'ga Secure qo'shiladi, xato tafsilotlari yashiriladi
LOG_LEVEL=info
LOG_RETENTION_DAYS=14
ADMIN_HOST=127.0.0.1                 # panel faqat ichkaridan (tashqi kirish — nginx orqali)
ADMIN_PUBLIC_URL=https://panel.example.uz
BACKUP_KEEP=14
```

> `NODE_ENV=production` bo‘lsa admin cookie `Secure` bo‘ladi — ya’ni panel **HTTPS** orqali
> ochilishi shart (3-bo‘limga qarang).

---

## 3. Admin panelni HTTPS bilan ochish (nginx + Let's Encrypt)

Panel `127.0.0.1:3000` da turadi; tashqi dunyoga faqat nginx orqali chiqariladi.
`panel.example.uz` domenini server IP ga yo‘naltiring, so‘ng:

```bash
apt-get install -y nginx certbot python3-certbot-nginx
```

`/etc/nginx/sites-available/telefon-panel`:

```nginx
server {
    listen 80;
    server_name panel.example.uz;

    location / {
        proxy_pass http://127.0.0.1:3000;
        proxy_http_version 1.1;
        proxy_set_header Host              $host;
        proxy_set_header X-Real-IP         $remote_addr;
        proxy_set_header X-Forwarded-For   $proxy_add_x_forwarded_for;
        proxy_set_header X-Forwarded-Proto $scheme;
    }

    client_max_body_size 8m;   # rasm yuklash uchun (multer limiti 5 MB)
}
```

```bash
ln -s /etc/nginx/sites-available/telefon-panel /etc/nginx/sites-enabled/
nginx -t && systemctl reload nginx
certbot --nginx -d panel.example.uz     # HTTPS sertifikat + avtomatik yangilanish
```

Firewall (botga **kiruvchi port kerak emas** — long polling o‘zi Telegramga ulanadi):

```bash
ufw allow OpenSSH && ufw allow 80 && ufw allow 443 && ufw enable
```

Qattiqroq xavfsizlik uchun panelni IP bilan cheklash yoki `auth_basic` qo‘shish mumkin.

---

## 4. Kuzatuv (bot tirikmi?)

Ilova ichida monitoring endpoint bor (autentifikatsiyasiz, maxfiy ma’lumot yo‘q):

```bash
curl -fsS http://127.0.0.1:3000/health | jq
```

```json
{
  "ok": true,
  "env": "production",
  "uptimeSeconds": 48210,
  "database": { "ok": true },
  "bot": {
    "running": true,
    "username": "Suxtelefonchi_bot",
    "startedAt": "2026-10-05T10:59:35.776Z",
    "lastUpdateAt": "2026-10-05T12:15:02.114Z",
    "uptimeSeconds": 48210,
    "lastError": null
  }
}
```

- `ok` = `false` yoki HTTP **503** → **baza** bilan muammo.
- `bot.running` = `false` → bot to‘xtagan (jarayon ishlab turgan bo‘lishi mumkin!). Sabab `bot.lastError` da.
- `bot.lastUpdateAt` — oxirgi foydalanuvchi xabari vaqti (bot haqiqatan javob beryaptimi).

Tashqi monitoring uchun: **UptimeRobot / Better Stack** bilan `http://127.0.0.1:3000/health` ni
tashqi domenga chiqarib (nginx `location /health`) kuzatish yoki `systemd` `OnFailure=` bilan
ogohlantirish yuborish mumkin.

---

## 5. Zaxira nusxa (backup)

`npm run backup` **online** nusxa oladi (`better-sqlite3` `db.backup()`) — WAL rejimida
ishlayotgan bazani to‘xtatmasdan, izchil holatda. Faylni shunchaki `cp` qilish **xavfli**.

```bash
cd /opt/telefon-bot && npm run backup
# ✅ Backup: /opt/telefon-bot/storage/backups/shop-2026-10-05_0315.sqlite
```

- Nusxa yaratilgach `PRAGMA integrity_check` bilan **tekshiriladi** — buzuq nusxa jimgina qolmaydi.
- Oxirgi `BACKUP_KEEP` (standart 14) nusxa saqlanadi, eskisi o‘chiriladi.
- Cron: `deploy/setup-ubuntu.sh` tomonidan `/etc/cron.d/telefon-backup` ga yoziladi.

**Kunlik nusxani serverdan tashqariga chiqarish** (bu juda muhim — server o‘zi bilan birga
nusxani ham yo‘qotmasligi kerak). Masalan, `storage/backups/` ni S3/R2/yandex disk'ka sinxronlash:

```bash
rclone sync /opt/telefon-bot/storage/backups remote:telefon-backups
```

Kodning o‘zi uchun Git: GitHub’da **private** repo + serverda `git pull` → `setup-ubuntu.sh` qayta
ishga tushirish.

---

## 6. Yangilash tartibi (kod o‘zgarganda)

```bash
cd /opt/telefon-bot-src && git pull           # yoki rsync bilan yangi kod
bash deploy/setup-ubuntu.sh /opt/telefon-bot-src
systemctl status telefon-bot                   # holat
journalctl -u telefon-bot -n 50                # loglar
curl -fsS http://127.0.0.1:3000/health         # bot.running = true?
```

`rsync` `storage/*` va `logs/*` ni **tegmaydi** — ma’lumotlar saqlanadi. Migratsiyalar
(`src/database/migrate.js`) ilova ishga tushganda o‘zi qo‘llanadi.

> Yangilashdan oldin qo‘lda bitta nusxa olish tavsiya etiladi: `npm run backup`.

---

## 7. Muammolarni bartaraf etish

| Belgi | Sabab | Yechim |
|---|---|---|
| `Bot ishga tushmadi: 401 Unauthorized` | Token noto‘g‘ri yoki bekor qilingan | `.env` dagi `BOT_TOKEN` ni @BotFather’dan qayta oling, `systemctl restart telefon-bot` |
| `409 Conflict` | **Ikkinchi instansiya** shu token bilan ishlayapti | `systemctl list-units | grep telefon`; ortiqcha jarayonni to‘xtating (`pkill -f 'src/index.js'`) |
| Jarayon qulayapti: `SQLITE_BUSY` | Admin panel va bot bir bazani yozmoqda | Bir jarayonda ishlatilsin (`npm start`) va `DB_PATH` bir xil bo‘lsin; WAL yoqilganini tekshiring |
| Bot javob bermayapti, `running=true` | Telegram tarmog‘i uzildi | Telegraf o‘zi qayta ulanadi; `lastUpdateAt` ni kuzating |
| Disk to‘lib ketdi | Loglar/journal | `LOG_RETENTION_DAYS` + `SystemMaxUse=500M` (skript qo‘shadi): `journalctl --vacuum-size=200M` |
| `npm ci` da better-sqlite3 qurilmayapti | Node too new / build tools yo‘q | `apt-get install -y build-essential python3 && npm rebuild better-sqlite3` |

---

## 8. Foydali buyruqlar

```bash
systemctl status telefon-bot        # holat + oxirgi loglar
systemctl restart telefon-bot       # qayta ishga tushirish
journalctl -u telefon-bot -f        # jonli loglar
journalctl -u telefon-bot --since "1 hour ago"
tail -f /opt/telefon-bot/logs/app-$(date +%F).log
curl -fsS http://127.0.0.1:3000/health
```

---

## 9. Alternativa: PM2 (systemd o‘rniga)

Docker/PM2 afzal ko‘rilsa:

```bash
npm install -g pm2
cd /opt/telefon-bot
pm2 start src/index.js --name telefon-bot --time
pm2 save && pm2 startup            # bootda avtomatik ishga tushadi
pm2 logs telefon-bot
```

`pm2` ham jarayonni qayta uradi, lekin **systemd sandbox** (ProtectSystem, ReadWritePaths)
himoyasi yo‘q. Ishlab chiqarish uchun systemd tavsiya etiladi.
