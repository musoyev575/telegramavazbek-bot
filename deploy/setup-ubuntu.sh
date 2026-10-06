#!/usr/bin/env bash
#
# Telefon Store botini Ubuntu/Debian serverda 24/7 ishlashga tayyorlaydi.
#
# Nima qiladi:
#   1) Node.js 22 LTS (NodeSource) va kerakli paketlarni o'rnatadi
#   2) `telefon` nomli tizim foydalanuvchisini yaratadi (root sifatida ishlamaydi)
#   3) Loyihani /opt/telefon-bot ga ko'chiradi va bog'lanishlarni o'rnatadi
#   4) systemd xizmatini yoqadi (avtomatik qayta ishga tushish + serverda boot)
#   5) Har kuni 03:15 da ishlaydigan zaxira nusxa (backup) cron'ini qo'shadi
#
# Ishlatish (serverda, root sifatida):
#   bash deploy/setup-ubuntu.sh /path/to/loyiha              # standart: /opt/telefon-bot
#   APP_DIR=/srv/bot bash deploy/setup-ubuntu.sh /path/to/loyiha
#
set -euo pipefail

SOURCE_DIR="${1:-$(pwd)}"
APP_DIR="${APP_DIR:-/opt/telefon-bot}"
APP_USER="${APP_USER:-telefon}"
NODE_MAJOR=22

log() { printf '\n\033[1;36m==> %s\033[0m\n' "$1"; }
die() { printf '\n\033[1;31mXATO: %s\033[0m\n' "$1" >&2; exit 1; }

[[ $EUID -eq 0 ]] || die "Bu skript root sifatida ishga tushirilishi kerak (sudo bash deploy/setup-ubuntu.sh)."
[[ -f "$SOURCE_DIR/package.json" ]] || die "$SOURCE_DIR ichida package.json topilmadi. Loyiha papkasini ko'rsating."
[[ -f "$SOURCE_DIR/.env" ]] || printf '\033[1;33mOGOHLANTIRISH: %s/.env topilmadi — BOT_TOKEN yozilmasa bot ishga tushmaydi.\033[0m\n' "$SOURCE_DIR"

log "1/6 Paketlar va Node.js ${NODE_MAJOR} LTS"
export DEBIAN_FRONTEND=noninteractive
apt-get update -qq
apt-get install -y -qq ca-certificates curl gnupg git build-essential python3 rsync

# better-sqlite3 uchun build vositalari kerak; NodeSource'dan tayyor Node olamiz
if ! command -v node >/dev/null 2>&1 || [[ "$(node -v | cut -d. -f1 | tr -d v)" -lt "$NODE_MAJOR" ]]; then
  curl -fsSL "https://deb.nodesource.com/setup_${NODE_MAJOR}.x" | bash -
  apt-get install -y -qq nodejs
fi
node -v
npm -v

log "2/6 '$APP_USER' tizim foydalanuvchisi"
if ! id -u "$APP_USER" >/dev/null 2>&1; then
  useradd --system --create-home --shell /usr/sbin/nologin "$APP_USER"
fi

log "3/6 Loyiha -> $APP_DIR"
mkdir -p "$APP_DIR" "$APP_DIR/storage" "$APP_DIR/logs"
rsync -a --delete \
  --exclude node_modules --exclude .git --exclude 'storage/*' --exclude 'logs/*' \
  "$SOURCE_DIR"/ "$APP_DIR"/

log "4/6 Bog'lanishlar (npm ci)"
cd "$APP_DIR"
# npm 11+ o'rnatish skriptlarini bloklaydi — better-sqlite3 uchun ruxsat kerak
npm ci --omit=dev --ignore-scripts || npm install --omit=dev --ignore-scripts
npx --yes npm@latest install-scripts approve better-sqlite3 --yes >/dev/null 2>&1 || true
npm rebuild better-sqlite3
chown -R "$APP_USER:$APP_USER" "$APP_DIR"
chmod 600 "$APP_DIR/.env" 2>/dev/null || true

log "5/6 systemd xizmati"
install -m 644 deploy/telefon-bot.service /etc/systemd/system/telefon-bot.service
systemctl daemon-reload
systemctl enable telefon-bot
systemctl restart telefon-bot

log "6/6 Zaxira nusxa (har kuni 03:15) va journal chegarasi"
cat >/etc/cron.d/telefon-backup <<EOF
# SQLite zaxira nusxasi — oxirgi 14 ta nusxa saqlanadi
15 3 * * * $APP_USER cd $APP_DIR && /usr/bin/node scripts/backup.js >> $APP_DIR/logs/backup.log 2>&1
EOF
chmod 644 /etc/cron.d/telefon-backup

# journald diskni to'ldirmasligi uchun chegara
mkdir -p /etc/systemd/journald.conf.d
cat >/etc/systemd/journald.conf.d/telefon-bot.conf <<'EOF'
[Journal]
SystemMaxUse=500M
EOF
systemctl restart systemd-journald

log "Tayyor"
systemctl --no-pager --lines=15 status telefon-bot || true
cat <<EOF

Keyingi qadamlar:
  1) Kodni yangilash:        bash $APP_DIR/deploy/setup-ubuntu.sh /yangi/kod
  2) Holatni tekshirish:     systemctl status telefon-bot
  3) Loglarni ko'rish:       journalctl -u telefon-bot -f
  4) Health check:           curl -fsS http://127.0.0.1:\${ADMIN_PORT:-3000}/health
  5) Admin panelni HTTPS bilan ochish: docs/DEPLOY.md → «nginx + HTTPS» bo'limi
EOF
