-- =============================================================================
--  TELEFON DO'KONI BOTI — MA'LUMOTLAR BAZASI SXEMASI (SQLite)
--  Barcha jadvallar idempotent: IF NOT EXISTS. Migratsiyalar src/database/migrate.js
--  orqali boshqariladi. Cheklovlar (CHECK / FOREIGN KEY) ma'lumot izchilligini
--  bazaning o'zida kafolatlaydi — bu eng ishonchli himoya qatlami.
-- =============================================================================

PRAGMA foreign_keys = ON;

-- -----------------------------------------------------------------------------
-- 1. Foydalanuvchilar
-- -----------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS users (
  id            INTEGER PRIMARY KEY AUTOINCREMENT,
  telegram_id   INTEGER NOT NULL UNIQUE,
  username      TEXT,
  first_name    TEXT,
  last_name     TEXT,
  phone         TEXT,
  language_code TEXT    NOT NULL DEFAULT 'uz',
  is_blocked    INTEGER NOT NULL DEFAULT 0,
  orders_count  INTEGER NOT NULL DEFAULT 0,
  total_spent   INTEGER NOT NULL DEFAULT 0,
  last_seen_at  TEXT,
  created_at    TEXT    NOT NULL DEFAULT (datetime('now')),
  updated_at    TEXT    NOT NULL DEFAULT (datetime('now'))
);
CREATE INDEX IF NOT EXISTS idx_users_telegram ON users (telegram_id);

-- -----------------------------------------------------------------------------
-- 2. Kategoriyalar (= brendlar). Mahsulotdagi `brand` maydoni tez qidirish uchun
--    denormalizatsiya qilingan nusxa.
-- -----------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS categories (
  id          INTEGER PRIMARY KEY AUTOINCREMENT,
  name        TEXT    NOT NULL UNIQUE,
  slug        TEXT    NOT NULL UNIQUE,
  description TEXT,
  logo_url    TEXT,
  sort_order  INTEGER NOT NULL DEFAULT 0,
  is_active   INTEGER NOT NULL DEFAULT 1,
  created_at  TEXT    NOT NULL DEFAULT (datetime('now'))
);

-- -----------------------------------------------------------------------------
-- 3. Mahsulotlar (telefonlar)
-- -----------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS products (
  id          INTEGER PRIMARY KEY AUTOINCREMENT,
  category_id INTEGER REFERENCES categories (id) ON DELETE SET NULL,
  brand       TEXT    NOT NULL,
  model       TEXT    NOT NULL,
  price       INTEGER NOT NULL CHECK (price >= 0),
  old_price   INTEGER CHECK (old_price IS NULL OR old_price >= 0),
  ram         INTEGER CHECK (ram IS NULL OR ram > 0),
  storage     INTEGER CHECK (storage IS NULL OR storage > 0),
  screen      TEXT,
  camera      TEXT,
  battery     TEXT,
  processor   TEXT,
  os          TEXT,
  color       TEXT,
  warranty    TEXT,
  stock       INTEGER NOT NULL DEFAULT 0 CHECK (stock >= 0),
  description TEXT,
  is_active   INTEGER NOT NULL DEFAULT 1,
  is_featured INTEGER NOT NULL DEFAULT 0,
  sort_order  INTEGER NOT NULL DEFAULT 0,
  created_at  TEXT    NOT NULL DEFAULT (datetime('now')),
  updated_at  TEXT    NOT NULL DEFAULT (datetime('now'))
);
CREATE INDEX IF NOT EXISTS idx_products_category ON products (category_id);
CREATE INDEX IF NOT EXISTS idx_products_brand ON products (brand);
CREATE INDEX IF NOT EXISTS idx_products_price ON products (price);
CREATE INDEX IF NOT EXISTS idx_products_active ON products (is_active, is_featured);

-- -----------------------------------------------------------------------------
-- 4. Mahsulot rasmlari
-- -----------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS product_images (
  id         INTEGER PRIMARY KEY AUTOINCREMENT,
  product_id INTEGER NOT NULL REFERENCES products (id) ON DELETE CASCADE,
  url        TEXT    NOT NULL,
  sort_order INTEGER NOT NULL DEFAULT 0,
  created_at TEXT    NOT NULL DEFAULT (datetime('now'))
);
CREATE INDEX IF NOT EXISTS idx_product_images_product ON product_images (product_id, sort_order);

-- -----------------------------------------------------------------------------
-- 5. Administratorlar (faqat ular admin panelga va admin buyruqlariga kira oladi)
-- -----------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS admins (
  id            INTEGER PRIMARY KEY AUTOINCREMENT,
  username      TEXT    NOT NULL UNIQUE,
  password_hash TEXT    NOT NULL,
  full_name     TEXT,
  role          TEXT    NOT NULL DEFAULT 'admin',  -- superadmin | admin | manager
  telegram_id   INTEGER UNIQUE,                    -- buyurtma xabarlari uchun
  is_active     INTEGER NOT NULL DEFAULT 1,
  last_login_at TEXT,
  last_login_ip TEXT,
  created_at    TEXT    NOT NULL DEFAULT (datetime('now')),
  updated_at    TEXT    NOT NULL DEFAULT (datetime('now'))
);

-- Admin sessiyalari: cookie'da faqat token, bazada uning SHA-256 xeshi saqlanadi
CREATE TABLE IF NOT EXISTS admin_sessions (
  id         INTEGER PRIMARY KEY AUTOINCREMENT,
  admin_id   INTEGER NOT NULL REFERENCES admins (id) ON DELETE CASCADE,
  token_hash TEXT    NOT NULL UNIQUE,
  ip         TEXT,
  user_agent TEXT,
  expires_at TEXT    NOT NULL,
  created_at TEXT    NOT NULL DEFAULT (datetime('now'))
);
CREATE INDEX IF NOT EXISTS idx_admin_sessions_expires ON admin_sessions (expires_at);

-- -----------------------------------------------------------------------------
-- 6. Savatcha
-- -----------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS carts (
  id         INTEGER PRIMARY KEY AUTOINCREMENT,
  user_id    INTEGER NOT NULL UNIQUE REFERENCES users (id) ON DELETE CASCADE,
  status     TEXT    NOT NULL DEFAULT 'active',
  created_at TEXT    NOT NULL DEFAULT (datetime('now')),
  updated_at TEXT    NOT NULL DEFAULT (datetime('now'))
);

CREATE TABLE IF NOT EXISTS cart_items (
  id         INTEGER PRIMARY KEY AUTOINCREMENT,
  cart_id    INTEGER NOT NULL REFERENCES carts (id) ON DELETE CASCADE,
  product_id INTEGER NOT NULL REFERENCES products (id) ON DELETE CASCADE,
  quantity   INTEGER NOT NULL CHECK (quantity > 0),
  added_price INTEGER,
  created_at TEXT    NOT NULL DEFAULT (datetime('now')),
  updated_at TEXT    NOT NULL DEFAULT (datetime('now')),
  UNIQUE (cart_id, product_id)
);

-- -----------------------------------------------------------------------------
-- 7. Sevimlilar
-- -----------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS favorites (
  id         INTEGER PRIMARY KEY AUTOINCREMENT,
  user_id    INTEGER NOT NULL REFERENCES users (id) ON DELETE CASCADE,
  product_id INTEGER NOT NULL REFERENCES products (id) ON DELETE CASCADE,
  created_at TEXT    NOT NULL DEFAULT (datetime('now')),
  UNIQUE (user_id, product_id)
);
CREATE INDEX IF NOT EXISTS idx_favorites_user ON favorites (user_id);

-- -----------------------------------------------------------------------------
-- 8. Buyurtmalar
-- -----------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS orders (
  id               INTEGER PRIMARY KEY AUTOINCREMENT,
  order_number     TEXT    NOT NULL UNIQUE,
  user_id          INTEGER NOT NULL REFERENCES users (id) ON DELETE RESTRICT,
  status           TEXT    NOT NULL DEFAULT 'new',
  subtotal         INTEGER NOT NULL DEFAULT 0,   -- mahsulotlar narxi (chegirma bilan)
  discount_total   INTEGER NOT NULL DEFAULT 0,   -- eski narxlar bo'yicha tejalgan summa
  delivery_fee     INTEGER NOT NULL DEFAULT 0,
  promo_discount   INTEGER NOT NULL DEFAULT 0,
  total            INTEGER NOT NULL DEFAULT 0,
  promo_code       TEXT,
  delivery_method  TEXT    NOT NULL DEFAULT 'delivery',
  payment_method   TEXT    NOT NULL DEFAULT 'cash',
  payment_status   TEXT    NOT NULL DEFAULT 'pending',
  customer_name    TEXT    NOT NULL,
  customer_phone   TEXT    NOT NULL,
  customer_address TEXT,
  comment          TEXT,
  handled_by       INTEGER REFERENCES admins (id) ON DELETE SET NULL,
  created_at       TEXT    NOT NULL DEFAULT (datetime('now')),
  updated_at       TEXT    NOT NULL DEFAULT (datetime('now')),
  accepted_at      TEXT,
  delivered_at     TEXT,
  cancelled_at     TEXT
);
CREATE INDEX IF NOT EXISTS idx_orders_user ON orders (user_id);
CREATE INDEX IF NOT EXISTS idx_orders_status ON orders (status);
CREATE INDEX IF NOT EXISTS idx_orders_created ON orders (created_at);

CREATE TABLE IF NOT EXISTS order_items (
  id           INTEGER PRIMARY KEY AUTOINCREMENT,
  order_id     INTEGER NOT NULL REFERENCES orders (id) ON DELETE CASCADE,
  product_id   INTEGER REFERENCES products (id) ON DELETE SET NULL,
  product_name TEXT    NOT NULL,
  brand        TEXT,
  model        TEXT,
  color        TEXT,
  warranty     TEXT,
  unit_price   INTEGER NOT NULL,
  old_price    INTEGER,
  quantity     INTEGER NOT NULL CHECK (quantity > 0),
  total        INTEGER NOT NULL
);
CREATE INDEX IF NOT EXISTS idx_order_items_order ON order_items (order_id);

-- Buyurtma statusi o'zgarishlari tarixi (audit)
CREATE TABLE IF NOT EXISTS order_status_history (
  id         INTEGER PRIMARY KEY AUTOINCREMENT,
  order_id   INTEGER NOT NULL REFERENCES orders (id) ON DELETE CASCADE,
  status     TEXT    NOT NULL,
  comment    TEXT,
  changed_by TEXT,
  created_at TEXT    NOT NULL DEFAULT (datetime('now'))
);
CREATE INDEX IF NOT EXISTS idx_order_history_order ON order_status_history (order_id);

-- -----------------------------------------------------------------------------
-- 9. To'lovlar (Click / Payme / Uzum shu jadval orqali ulanadi)
-- -----------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS payments (
  id          INTEGER PRIMARY KEY AUTOINCREMENT,
  order_id    INTEGER NOT NULL REFERENCES orders (id) ON DELETE CASCADE,
  provider    TEXT    NOT NULL,
  amount      INTEGER NOT NULL CHECK (amount >= 0),
  status      TEXT    NOT NULL DEFAULT 'pending',
  external_id TEXT,
  payload     TEXT,
  paid_at     TEXT,
  created_at  TEXT    NOT NULL DEFAULT (datetime('now')),
  updated_at  TEXT    NOT NULL DEFAULT (datetime('now'))
);
CREATE INDEX IF NOT EXISTS idx_payments_order ON payments (order_id);

-- -----------------------------------------------------------------------------
-- 10. Sozlamalar (kalit-qiymat: do'kon manzili, yetkazish narxi va h.k.)
-- -----------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS settings (
  key        TEXT PRIMARY KEY,
  value      TEXT,
  updated_at TEXT NOT NULL DEFAULT (datetime('now'))
);

-- -----------------------------------------------------------------------------
-- 11. Promokodlar (feature-flag ostida; jadval hozirdan tayyor)
-- -----------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS promocodes (
  id             INTEGER PRIMARY KEY AUTOINCREMENT,
  code           TEXT    NOT NULL UNIQUE,
  discount_type  TEXT    NOT NULL DEFAULT 'percent', -- percent | fixed
  discount_value INTEGER NOT NULL CHECK (discount_value > 0),
  min_amount     INTEGER NOT NULL DEFAULT 0,
  usage_limit    INTEGER,
  used_count     INTEGER NOT NULL DEFAULT 0,
  starts_at      TEXT,
  expires_at     TEXT,
  is_active      INTEGER NOT NULL DEFAULT 1,
  created_at     TEXT    NOT NULL DEFAULT (datetime('now'))
);

-- -----------------------------------------------------------------------------
-- 12. Audit jurnali (kim, qachon, nima qildi — xavfsizlik uchun)
-- -----------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS audit_logs (
  id         INTEGER PRIMARY KEY AUTOINCREMENT,
  actor      TEXT,
  action     TEXT NOT NULL,
  entity     TEXT,
  entity_id  TEXT,
  details    TEXT,
  ip         TEXT,
  created_at TEXT NOT NULL DEFAULT (datetime('now'))
);
CREATE INDEX IF NOT EXISTS idx_audit_created ON audit_logs (created_at);
