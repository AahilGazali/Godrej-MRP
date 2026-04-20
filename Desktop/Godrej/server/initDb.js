import { pool } from "./db.js";
import bcrypt from "bcrypt";

const schemaSql = `
CREATE TABLE IF NOT EXISTS roles (
  id SERIAL PRIMARY KEY,
  name TEXT UNIQUE NOT NULL
);

CREATE TABLE IF NOT EXISTS users (
  id SERIAL PRIMARY KEY,
  name TEXT NOT NULL,
  email TEXT UNIQUE NOT NULL,
  password_hash TEXT NOT NULL,
  role TEXT NOT NULL DEFAULT 'employee' 
    CHECK (role IN ('admin', 'manager', 'employee')),
  is_active BOOLEAN DEFAULT true,
  created_at TIMESTAMP DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS lockers (
  id SERIAL PRIMARY KEY,
  locker_item_code TEXT UNIQUE NOT NULL,
  model TEXT NOT NULL,
  description TEXT NOT NULL,
  product TEXT,
  subtype TEXT,
  created_at TIMESTAMP DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS bom_items (
  id SERIAL PRIMARY KEY,
  locker_model TEXT NOT NULL,
  item_code TEXT NOT NULL,
  component_type TEXT NOT NULL,
  qty NUMERIC NOT NULL,
  bom_type TEXT NOT NULL CHECK (bom_type IN ('Standard','Custom')),
  status TEXT NOT NULL DEFAULT 'active' CHECK (status IN ('active','deleted')),
  deleted_at TIMESTAMP,
  created_at TIMESTAMP DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS bom_uploaded_rows (
  id SERIAL PRIMARY KEY,
  locker_model TEXT NOT NULL,
  bom_type TEXT NOT NULL DEFAULT 'Standard',
  level TEXT,
  position TEXT,
  item_code TEXT,
  description TEXT,
  drawing_no TEXT,
  drawing_rev_no TEXT,
  op TEXT,
  warehouse TEXT,
  use_pnt_wh TEXT,
  entrp_unit TEXT,
  lot_sel TEXT,
  revision TEXT,
  effective_date TEXT,
  expiry_date TEXT,
  length_mm TEXT,
  width_mm TEXT,
  number_of_units TEXT,
  inv_unit TEXT,
  net_quantity TEXT,
  scrap_percent TEXT,
  scrap_quantity TEXT,
  extra_info TEXT,
  status TEXT NOT NULL DEFAULT 'active' CHECK (status IN ('active','deleted')),
  deleted_at TIMESTAMP,
  created_at TIMESTAMP DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS stock_uploads (
  id SERIAL PRIMARY KEY,
  upload_date DATE NOT NULL,
  file_name TEXT NOT NULL,
  rows_saved INTEGER NOT NULL,
  warnings INTEGER NOT NULL DEFAULT 0,
  created_at TIMESTAMP DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS stock_items (
  id SERIAL PRIMARY KEY,
  item_code TEXT UNIQUE NOT NULL,
  stock_qty NUMERIC NOT NULL,
  sr_no TEXT,
  stock_material TEXT,
  ln_description TEXT,
  short_description TEXT,
  uom TEXT,
  data_used_by TEXT,
  updated_at TIMESTAMP DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS plan_entries (
  id SERIAL PRIMARY KEY,
  plan_date DATE NOT NULL,
  locker_item_code TEXT NOT NULL,
  subtype TEXT NOT NULL,
  quantity NUMERIC NOT NULL,
  created_at TIMESTAMP DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS app_meta (
  key TEXT PRIMARY KEY,
  value TEXT NOT NULL
);
`;

const seedSql = `
INSERT INTO lockers (locker_item_code, model, description)
VALUES
('LKR-1001', 'GX-2', '2-door premium locker'),
('LKR-1002', 'GX-4', '4-door industrial locker'),
('LKR-1003', 'GX-6', '6-door welded locker')
ON CONFLICT (locker_item_code) DO NOTHING;

INSERT INTO bom_items (locker_model, item_code, component_type, qty, bom_type)
SELECT v.locker_model, v.item_code, v.component_type, v.qty, v.bom_type::text
FROM (
  VALUES
    ('GX-2', 'MAT-101', 'Sheet', 2::numeric, 'Standard'),
    ('GX-2', 'MAT-115', 'Hinge', 4::numeric, 'Custom'),
    ('GX-4', 'MAT-201', 'Frame', 1::numeric, 'Standard')
) AS v(locker_model, item_code, component_type, qty, bom_type)
WHERE NOT EXISTS (
  SELECT 1 FROM bom_items bi
  WHERE bi.locker_model = v.locker_model AND bi.item_code = v.item_code
);

INSERT INTO stock_items (item_code, stock_qty)
VALUES
('MAT-101', 250),
('MAT-115', 980),
('MAT-201', 400)
ON CONFLICT (item_code) DO NOTHING;
`;

export async function initDb() {
  await pool.query(schemaSql);
  await pool.query(`ALTER TABLE users DROP CONSTRAINT IF EXISTS users_role_check`);
  await pool.query(`
    ALTER TABLE users
    ADD CONSTRAINT users_role_check
    CHECK (role IN ('admin', 'manager', 'employee'))
  `);
  await pool.query(`ALTER TABLE lockers ADD COLUMN IF NOT EXISTS product TEXT`);
  await pool.query(`ALTER TABLE lockers ADD COLUMN IF NOT EXISTS subtype TEXT`);
  await pool.query(`UPDATE lockers SET product = COALESCE(product, description), subtype = COALESCE(subtype, model)`);
  await pool.query(`ALTER TABLE bom_items ADD COLUMN IF NOT EXISTS status TEXT NOT NULL DEFAULT 'active'`);
  await pool.query(`ALTER TABLE bom_items ADD COLUMN IF NOT EXISTS deleted_at TIMESTAMP`);
  await pool.query(`UPDATE bom_items SET status = 'active' WHERE status IS NULL OR TRIM(status) = ''`);
  await pool.query(`ALTER TABLE bom_uploaded_rows ADD COLUMN IF NOT EXISTS status TEXT NOT NULL DEFAULT 'active'`);
  await pool.query(`ALTER TABLE bom_uploaded_rows ADD COLUMN IF NOT EXISTS deleted_at TIMESTAMP`);
  await pool.query(`UPDATE bom_uploaded_rows SET status = 'active' WHERE status IS NULL OR TRIM(status) = ''`);
  await pool.query(`ALTER TABLE stock_items ADD COLUMN IF NOT EXISTS sr_no TEXT`);
  await pool.query(`ALTER TABLE stock_items ADD COLUMN IF NOT EXISTS stock_material TEXT`);
  await pool.query(`ALTER TABLE stock_items ADD COLUMN IF NOT EXISTS ln_description TEXT`);
  await pool.query(`ALTER TABLE stock_items ADD COLUMN IF NOT EXISTS short_description TEXT`);
  await pool.query(`ALTER TABLE stock_items ADD COLUMN IF NOT EXISTS uom TEXT`);
  await pool.query(`ALTER TABLE stock_items ADD COLUMN IF NOT EXISTS data_used_by TEXT`);

  // Demo seed at most once, and only if DB was empty — so Remove / Remove BOM stay gone after restart
  const { rows: seeded } = await pool.query(
    `SELECT 1 FROM app_meta WHERE key = 'demo_seed_v1' LIMIT 1`
  );
  if (seeded.length === 0) {
    const { rows: cnt } = await pool.query(`SELECT COUNT(*)::int AS n FROM lockers`);
    if (cnt[0]?.n === 0) {
      await pool.query(seedSql);
    }
    await pool.query(
      `INSERT INTO app_meta (key, value) VALUES ('demo_seed_v1', '1') ON CONFLICT (key) DO NOTHING`
    );
  }

  // Seed default admin user if not exists
  const { rows: adminExists } = await pool.query(
    `SELECT 1 FROM users WHERE email = 'admin@godrej.com' LIMIT 1`
  );
  if (adminExists.length === 0) {
    const passwordHash = await bcrypt.hash('Admin@123', 10);
    await pool.query(
      `INSERT INTO users (name, email, password_hash, role, is_active)
       VALUES ('Admin', 'admin@godrej.com', $1, 'admin', true)
       ON CONFLICT (email) DO NOTHING`,
      [passwordHash]
    );
  }
  await pool.query(`UPDATE users SET role = 'admin', is_active = true WHERE email = 'admin@godrej.com'`);
}
