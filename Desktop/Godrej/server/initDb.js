import { pool } from "./db.js";

const schemaSql = `
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
`;

const seedSql = `
INSERT INTO lockers (locker_item_code, model, description)
VALUES
('LKR-1001', 'GX-2', '2-door premium locker'),
('LKR-1002', 'GX-4', '4-door industrial locker'),
('LKR-1003', 'GX-6', '6-door welded locker')
ON CONFLICT (locker_item_code) DO NOTHING;

INSERT INTO bom_items (locker_model, item_code, component_type, qty, bom_type)
VALUES
('GX-2', 'MAT-101', 'Sheet', 2, 'Standard'),
('GX-2', 'MAT-115', 'Hinge', 4, 'Custom'),
('GX-4', 'MAT-201', 'Frame', 1, 'Standard')
ON CONFLICT DO NOTHING;

INSERT INTO stock_items (item_code, stock_qty)
VALUES
('MAT-101', 250),
('MAT-115', 980),
('MAT-201', 400)
ON CONFLICT (item_code) DO NOTHING;
`;

export async function initDb() {
  await pool.query(schemaSql);
  await pool.query(`ALTER TABLE lockers ADD COLUMN IF NOT EXISTS product TEXT`);
  await pool.query(`ALTER TABLE lockers ADD COLUMN IF NOT EXISTS subtype TEXT`);
  await pool.query(`UPDATE lockers SET product = COALESCE(product, description), subtype = COALESCE(subtype, model)`);
  await pool.query(seedSql);
}
