CREATE TABLE IF NOT EXISTS users (
  id TEXT PRIMARY KEY,
  name TEXT NOT NULL UNIQUE,
  pin TEXT NOT NULL,
  role TEXT DEFAULT 'user',
  created_at INTEGER DEFAULT 0
);
-- کاربر پیش‌فرض
INSERT OR IGNORE INTO users(id,name,pin,role,created_at) VALUES('u1','MOLLAEI','6283','admin',0);

CREATE TABLE IF NOT EXISTS products (
  id TEXT PRIMARY KEY,
  barcode TEXT DEFAULT '',
  name TEXT NOT NULL DEFAULT '',
  brand TEXT DEFAULT '',
  buy_price REAL DEFAULT 0,
  sell_price REAL DEFAULT 0,
  qty INTEGER DEFAULT 0,
  volume INTEGER DEFAULT 0,
  description TEXT DEFAULT '',
  created_at INTEGER DEFAULT 0,
  updated_at INTEGER DEFAULT 0
);
CREATE INDEX IF NOT EXISTS idx_prod_barcode ON products(barcode);

CREATE TABLE IF NOT EXISTS sales (
  id TEXT PRIMARY KEY,
  total REAL DEFAULT 0,
  cost REAL DEFAULT 0,
  profit REAL DEFAULT 0,
  date_j TEXT DEFAULT '',
  user_name TEXT DEFAULT '',
  created_at INTEGER DEFAULT 0
);
CREATE INDEX IF NOT EXISTS idx_sale_date ON sales(created_at);

CREATE TABLE IF NOT EXISTS sale_items (
  id TEXT PRIMARY KEY,
  sale_id TEXT NOT NULL,
  product_id TEXT NOT NULL,
  name TEXT DEFAULT '',
  qty INTEGER DEFAULT 1,
  sell_price REAL DEFAULT 0,
  buy_price REAL DEFAULT 0,
  discount REAL DEFAULT 0,
  final_price REAL DEFAULT 0
);
CREATE INDEX IF NOT EXISTS idx_si_sale ON sale_items(sale_id);
