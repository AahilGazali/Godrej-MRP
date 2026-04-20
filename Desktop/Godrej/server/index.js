import 'dotenv/config';   // ✅ correct way for ES modules
import express from "express";
import cors from "cors";
import helmet from "helmet";
import cookieParser from "cookie-parser";
import rateLimit from "express-rate-limit";
import bcrypt from "bcrypt";
import jwt from "jsonwebtoken";
import { pool } from "./db.js";
import { initDb } from "./initDb.js";

const app = express();
app.use(helmet());
app.use(cors({
  origin: true,
  credentials: true
}));
app.use(cookieParser());
app.use(express.json({ limit: "2mb" }));

// Rate limiter for login route
const loginLimiter = rateLimit({
  windowMs: 15 * 60 * 1000, // 15 minutes
  max: 10, // 10 requests per 15 minutes
  message: { message: 'Too many login attempts, please try again after 15 minutes' }
});

// Authentication middleware
const authenticate = async (req, res, next) => {
  const token = req.cookies.token;
  if (!token) return res.status(401).json({ message: 'Not logged in' });
  try {
    const decoded = jwt.verify(token, process.env.JWT_SECRET);
    req.user = decoded;
    next();
  } catch {
    return res.status(401).json({ message: 'Invalid session' });
  }
};

// Authorization middleware
const authorize = (allowedRoles) => (req, res, next) => {
  if (!req.user) return res.status(401).json({ message: 'Unauthorized' });
  if (!allowedRoles.includes(req.user.role)) {
    return res.status(403).json({ message: 'Access denied' });
  }
  next();
};

// Auth routes
app.post("/api/login", loginLimiter, async (req, res) => {
  const { email, password } = req.body;
  
  if (!email || !password) {
    return res.status(400).json({ message: 'Email and password are required' });
  }
  
  if (!email.endsWith('@godrej.com')) {
    return res.status(400).json({ message: 'Email must end with @godrej.com' });
  }
  
  const { rows } = await pool.query(
    'SELECT id, name, email, password_hash, role, is_active FROM users WHERE email = $1',
    [email]
  );
  
  if (rows.length === 0) {
    return res.status(401).json({ message: 'Invalid credentials' });
  }
  
  const user = rows[0];
  
  if (!user.is_active) {
    return res.status(403).json({ message: 'Account is deactivated' });
  }
  
  const validPassword = await bcrypt.compare(password, user.password_hash);
  if (!validPassword) {
    return res.status(401).json({ message: 'Invalid credentials' });
  }
  
  const token = jwt.sign(
    { id: user.id, name: user.name, email: user.email, role: user.role },
    process.env.JWT_SECRET,
    { expiresIn: '1d' }
  );
  
  res.cookie('token', token, {
    httpOnly: true,
    sameSite: 'lax'
  });
  
  res.json({ name: user.name, email: user.email, role: user.role });
});

app.post("/api/logout", (_req, res) => {
  res.clearCookie('token');
  res.json({ success: true });
});

app.get("/api/me", authenticate, (req, res) => {
  res.json(req.user);
});

app.get("/api/users", authenticate, authorize(['admin']), async (_req, res) => {
  const { rows } = await pool.query(
    'SELECT id, name, email, role, is_active FROM users ORDER BY id'
  );
  res.json(rows);
});

app.post("/api/users", authenticate, authorize(['admin']), async (req, res) => {
  const { name, email, password, role } = req.body;
  
  if (!name || !email || !password || !role) {
    return res.status(400).json({ message: 'Name, email, password, and role are required' });
  }
  
  if (!email.endsWith('@godrej.com')) {
    return res.status(400).json({ message: 'Email must end with @godrej.com' });
  }
  
  if (!['manager', 'employee'].includes(role)) {
    return res.status(400).json({ message: 'Role must be manager or employee' });
  }
  
  const passwordHash = await bcrypt.hash(password, 10);
  
  try {
    const { rows } = await pool.query(
      `INSERT INTO users (name, email, password_hash, role)
       VALUES ($1, $2, $3, $4)
       RETURNING id, name, email, role, is_active`,
      [name, email, passwordHash, role]
    );
    res.status(201).json(rows[0]);
  } catch (err) {
    if (err.code === '23505') { // unique violation
      return res.status(409).json({ message: 'Email already exists' });
    }
    throw err;
  }
});

app.patch("/api/users/:id", authenticate, authorize(['admin']), async (req, res) => {
  const userId = Number(req.params.id);
  const { role, is_active } = req.body;
  
  if (!Number.isInteger(userId) || userId <= 0) {
    return res.status(400).json({ message: 'Valid user id is required' });
  }
  
  const updates = [];
  const values = [];
  let paramIndex = 1;
  
  if (role !== undefined) {
    if (!['manager', 'employee'].includes(role)) {
      return res.status(400).json({ message: 'Role must be manager or employee' });
    }
    updates.push(`role = $${paramIndex++}`);
    values.push(role);
  }
  
  if (is_active !== undefined) {
    updates.push(`is_active = $${paramIndex++}`);
    values.push(is_active);
  }
  
  if (updates.length === 0) {
    return res.status(400).json({ message: 'No fields to update' });
  }
  
  values.push(userId);
  const { rows } = await pool.query(
    `UPDATE users SET ${updates.join(', ')} WHERE id = $${paramIndex}
     RETURNING id, name, email, role, is_active`,
    values
  );
  
  if (rows.length === 0) {
    return res.status(404).json({ message: 'User not found' });
  }
  
  res.json(rows[0]);
});

app.get("/api/health", async (_req, res) => {
  const { rows } = await pool.query("SELECT NOW() as now");
  res.json({ ok: true, now: rows[0].now });
});

async function findMissingBomLockerCodes(planRows = []) {
  const lockerCodes = [
    ...new Set(
      planRows
        .map((row) => String(row?.locker_item_code ?? "").trim())
        .filter(Boolean)
    ),
  ];

  if (lockerCodes.length === 0) {
    return [];
  }

  const { rows } = await pool.query(
    `WITH requested_codes AS (
      SELECT DISTINCT TRIM(code) AS locker_item_code
      FROM unnest($1::text[]) AS code
    ),
    combined_bom AS (
      SELECT TRIM(locker_model) AS locker_model FROM bom_items WHERE COALESCE(status, 'active') = 'active'
      UNION
      SELECT TRIM(locker_model) AS locker_model FROM bom_uploaded_rows WHERE COALESCE(status, 'active') = 'active'
    )
    SELECT r.locker_item_code
    FROM requested_codes r
    LEFT JOIN lockers l ON TRIM(l.locker_item_code) = r.locker_item_code
    WHERE l.id IS NULL
      OR NOT EXISTS (
        SELECT 1
        FROM combined_bom b
        WHERE LOWER(TRIM(b.locker_model)) = LOWER(TRIM(l.model))
          OR (COALESCE(l.subtype, '') <> '' AND LOWER(TRIM(b.locker_model)) = LOWER(TRIM(l.subtype)))
          OR (COALESCE(l.product, '') <> '' AND LOWER(TRIM(b.locker_model)) = LOWER(TRIM(l.product)))
          OR LOWER(TRIM(b.locker_model)) = LOWER(TRIM(l.description))
          OR LOWER(TRIM(b.locker_model)) = LOWER(TRIM(l.locker_item_code))
          OR regexp_replace(LOWER(TRIM(b.locker_model)), '\\s+', '', 'g') = regexp_replace(LOWER(TRIM(l.model)), '\\s+', '', 'g')
          OR (COALESCE(l.subtype, '') <> '' AND regexp_replace(LOWER(TRIM(b.locker_model)), '\\s+', '', 'g') = regexp_replace(LOWER(TRIM(l.subtype)), '\\s+', '', 'g'))
          OR (COALESCE(l.product, '') <> '' AND regexp_replace(LOWER(TRIM(b.locker_model)), '\\s+', '', 'g') = regexp_replace(LOWER(TRIM(l.product)), '\\s+', '', 'g'))
          OR regexp_replace(LOWER(TRIM(b.locker_model)), '[^a-z0-9]+', '', 'g') = regexp_replace(
            LOWER(TRIM(COALESCE(l.product, '') || COALESCE(l.subtype, ''))), '[^a-z0-9]+', '', 'g'
          )
          OR regexp_replace(LOWER(TRIM(b.locker_model)), '[^a-z0-9]+', '', 'g') = regexp_replace(
            LOWER(TRIM(COALESCE(l.product, '') || ' ' || COALESCE(l.subtype, ''))), '[^a-z0-9]+', '', 'g'
          )
          OR regexp_replace(LOWER(TRIM(b.locker_model)), '[^a-z0-9]+', '', 'g') = regexp_replace(
            LOWER(TRIM(COALESCE(l.subtype, '') || COALESCE(l.product, ''))), '[^a-z0-9]+', '', 'g'
          )
          OR (
            length(regexp_replace(LOWER(TRIM(b.locker_model)), '[^a-z0-9]+', '', 'g')) >= 3
            AND regexp_replace(LOWER(TRIM(COALESCE(l.product, '') || COALESCE(l.subtype, ''))), '[^a-z0-9]+', '', 'g')
              LIKE '%' || regexp_replace(LOWER(TRIM(b.locker_model)), '[^a-z0-9]+', '', 'g') || '%'
          )
          OR (
            length(regexp_replace(LOWER(TRIM(b.locker_model)), '[^a-z0-9]+', '', 'g')) >= 3
            AND regexp_replace(LOWER(TRIM(b.locker_model)), '[^a-z0-9]+', '', 'g')
              LIKE '%' || regexp_replace(LOWER(TRIM(COALESCE(l.product, '') || COALESCE(l.subtype, ''))), '[^a-z0-9]+', '', 'g') || '%'
          )
      )
    ORDER BY r.locker_item_code`,
    [lockerCodes]
  );

  return rows.map((row) => row.locker_item_code);
}

app.get("/api/lockers", authenticate, async (_req, res) => {
  const { rows } = await pool.query(
    `SELECT
      id,
      COALESCE(product, description) AS product,
      COALESCE(subtype, model) AS subtype,
      locker_item_code AS locker_code
     FROM lockers
     ORDER BY id DESC`
  );
  res.json(rows);
});

app.post("/api/lockers", authenticate, authorize(['admin', 'manager']), async (req, res) => {
  const { product, subtype, locker_code } = req.body;

  const { rows: existing } = await pool.query(
    'SELECT id FROM lockers WHERE LOWER(TRIM(product)) = LOWER(TRIM($1)) AND LOWER(TRIM(subtype)) = LOWER(TRIM($2))',
    [product, subtype]
  );
  if (existing.length > 0) {
    return res.status(409).json({
      message: `A locker with product "${product}" and subtype "${subtype}" already exists.`
    });
  }

  const { rows } = await pool.query(
    `INSERT INTO lockers (locker_item_code, model, description, product, subtype)
     VALUES ($1, $2, $3, $4, $5)
     ON CONFLICT (locker_item_code)
     DO UPDATE SET
      model = EXCLUDED.model,
      description = EXCLUDED.description,
      product = EXCLUDED.product,
      subtype = EXCLUDED.subtype
     RETURNING id, COALESCE(product, description) AS product, COALESCE(subtype, model) AS subtype, locker_item_code AS locker_code`,
    [locker_code, subtype, product, product, subtype]
  );
  res.status(201).json(rows[0]);
});

app.put("/api/lockers/:id", authenticate, authorize(['admin', 'manager']), async (req, res) => {
  const id = Number(req.params.id);
  const { product, subtype, locker_code } = req.body;

  if (!Number.isInteger(id) || id <= 0) {
    return res.status(400).json({ message: "Valid locker id is required" });
  }
  if (!product || !subtype || !locker_code) {
    return res.status(400).json({ message: "Product, SubType and Locker code are required" });
  }

  const duplicate = await pool.query(
    "SELECT id FROM lockers WHERE locker_item_code = $1 AND id <> $2 LIMIT 1",
    [locker_code, id]
  );
  if (duplicate.rowCount > 0) {
    return res.status(409).json({ message: "Locker code already exists" });
  }

  const current = await pool.query("SELECT locker_item_code FROM lockers WHERE id = $1", [id]);
  if (current.rowCount === 0) {
    return res.status(404).json({ message: "Locker not found" });
  }

  const previousLockerCode = current.rows[0].locker_item_code;
  const { rows } = await pool.query(
    `UPDATE lockers
     SET locker_item_code = $1,
         model = $2,
         description = $3,
         product = $4,
         subtype = $5
     WHERE id = $6
     RETURNING id, COALESCE(product, description) AS product, COALESCE(subtype, model) AS subtype, locker_item_code AS locker_code`,
    [locker_code, subtype, product, product, subtype, id]
  );

  if (previousLockerCode !== locker_code) {
    await pool.query(
      "UPDATE plan_entries SET locker_item_code = $1, subtype = $2 WHERE locker_item_code = $3",
      [locker_code, subtype, previousLockerCode]
    );
  }

  res.json(rows[0]);
});

app.post("/api/lockers/upload", authenticate, authorize(['admin', 'manager']), async (req, res) => {
  const { rows = [], fileName = "uploaded-file" } = req.body;
  let count = 0;
  let warnings = 0;
  for (const row of rows) {
    const product = row.Product ?? row.product ?? "";
    const subtype = row.SubType ?? row.subtype ?? row["Sub Type"] ?? "";
    const code = row["Locker code"] ?? row.locker_code ?? row.locker_item_code ?? row["Locker Code"] ?? "";
    if (!code || !product || !subtype) {
      warnings += 1;
      continue;
    }
    await pool.query(
      `INSERT INTO lockers (locker_item_code, model, description, product, subtype)
       VALUES ($1, $2, $3, $4, $5)
       ON CONFLICT (locker_item_code)
       DO UPDATE SET
        model = EXCLUDED.model,
        description = EXCLUDED.description,
        product = EXCLUDED.product,
        subtype = EXCLUDED.subtype`,
      [code, subtype, product, product, subtype]
    );
    count += 1;
  }
  res.json({ success: true, rowsSaved: count, warnings, fileName });
});

app.delete("/api/lockers", authenticate, authorize(['admin', 'manager']), async (_req, res) => {
  const { rowCount } = await pool.query("DELETE FROM lockers");
  res.json({ success: true, deleted: rowCount });
});

app.delete("/api/lockers/:lockerCode", authenticate, authorize(['admin', 'manager']), async (req, res) => {
  const lockerCode = String(req.params.lockerCode || "").trim();
  if (!lockerCode) {
    return res.status(400).json({ message: "lockerCode is required" });
  }
  await pool.query("DELETE FROM plan_entries WHERE locker_item_code = $1", [lockerCode]);
  const { rowCount } = await pool.query("DELETE FROM lockers WHERE locker_item_code = $1", [lockerCode]);
  res.json({ success: true, deleted: rowCount });
});

app.get("/api/bom", authenticate, async (_req, res) => {
  const uploaded = await pool.query(
    `SELECT
      'uploaded'::text AS row_source,
      id, locker_model, bom_type, level, position, item_code, description, drawing_no, drawing_rev_no,
      op, warehouse, use_pnt_wh, entrp_unit, lot_sel, revision, effective_date, expiry_date,
      length_mm, width_mm, number_of_units, inv_unit, net_quantity, scrap_percent, scrap_quantity, extra_info
     FROM bom_uploaded_rows
     WHERE COALESCE(status, 'active') = 'active'
     ORDER BY locker_model, id`
  );
  const classic = await pool.query(
    `SELECT
      'classic'::text AS row_source,
      id, locker_model, bom_type, '' AS level, '' AS position, item_code, '' AS description, '' AS drawing_no, '' AS drawing_rev_no,
      '' AS op, '' AS warehouse, '' AS use_pnt_wh, '' AS entrp_unit, '' AS lot_sel, '' AS revision, '' AS effective_date, '' AS expiry_date,
      '' AS length_mm, '' AS width_mm, '' AS number_of_units, '' AS inv_unit, qty::text AS net_quantity, '' AS scrap_percent, '' AS scrap_quantity, '' AS extra_info
     FROM bom_items
     WHERE COALESCE(status, 'active') = 'active'
     ORDER BY locker_model, id`
  );
  res.json([...uploaded.rows, ...classic.rows]);
});

app.post("/api/bom/upload", authenticate, authorize(['admin', 'manager']), async (req, res) => {
  const { locker_model, rows = [], fileName = "uploaded-bom.xlsx" } = req.body;
  if (!locker_model) {
    return res.status(400).json({ message: "locker_model is required" });
  }

  await pool.query("DELETE FROM bom_uploaded_rows WHERE locker_model = $1", [locker_model]);

  let rowsSaved = 0;
  let warnings = 0;
  const normBomItemCode = (raw) =>
    raw != null && raw !== "" ? String(raw).trim().replace(/\s+/g, "") : "";
  for (const row of rows) {
    const level = row.Level ?? row.level ?? "";
    const position = row.Position ?? row.position ?? "";
    const itemCode = normBomItemCode(row.Item ?? row.item ?? row.item_code ?? "");
    const description = row.Description ?? row.description ?? "";
    const drawingNo = row["Drawing No"] ?? row.drawing_no ?? "";
    const drawingRevNo = row["Drawing Rev No"] ?? row.drawing_rev_no ?? "";
    const op = row.Op ?? row.OP ?? row.op ?? "";
    const warehouse = row.Warehouse ?? row.warehouse ?? "";
    const usePntWh = row["Use Pnt wh"] ?? row.use_pnt_wh ?? "";
    const entrpUnit = row["Entrp Unit"] ?? row.entrp_unit ?? "";
    const lotSel = row["Lot/sel"] ?? row.lot_sel ?? "";
    const revision = row.Revision ?? row.revision ?? "";
    const effectiveDate = row["Effective Date"] ?? row.effective_date ?? "";
    const expiryDate = row["Expiry Date"] ?? row.expiry_date ?? "";
    const lengthMm = row["length(mm)"] ?? row.length_mm ?? "";
    const widthMm = row["Width(mm)"] ?? row.width_mm ?? "";
    const numberOfUnits = row["Number of Units"] ?? row.number_of_units ?? "";
    const invUnit = row["Inv Unit"] ?? row.inv_unit ?? "";
    const netQuantity = row["Net Quantity"] ?? row.net_quantity ?? "";
    const scrapPercent = row["Scrap(%)"] ?? row.scrap_percent ?? "";
    const scrapQuantity = row["Scrap Quantity"] ?? row.scrap_quantity ?? "";
    const extraInfo = row["Extra Info"] ?? row.extra_info ?? "";

    if (!itemCode && !description) {
      warnings += 1;
      continue;
    }

    await pool.query(
      `INSERT INTO bom_uploaded_rows (
        locker_model, bom_type, level, position, item_code, description, drawing_no, drawing_rev_no, op,
        warehouse, use_pnt_wh, entrp_unit, lot_sel, revision, effective_date, expiry_date,
        length_mm, width_mm, number_of_units, inv_unit, net_quantity, scrap_percent, scrap_quantity, extra_info
      ) VALUES (
        $1, 'Standard', $2, $3, $4, $5, $6, $7, $8,
        $9, $10, $11, $12, $13, $14, $15,
        $16, $17, $18, $19, $20, $21, $22, $23
      )`,
      [
        locker_model, level, position, itemCode, description, drawingNo, drawingRevNo, op,
        warehouse, usePntWh, entrpUnit, lotSel, revision, effectiveDate, expiryDate,
        lengthMm, widthMm, numberOfUnits, invUnit, netQuantity, scrapPercent, scrapQuantity, extraInfo,
      ]
    );
    rowsSaved += 1;
  }

  res.status(201).json({ success: true, rowsSaved, warnings, fileName });
});

app.post("/api/bom/custom", authenticate, authorize(['admin', 'manager']), async (req, res) => {
  const { locker_model, rows = [] } = req.body;
  const inserted = [];
  for (const r of rows) {
    const { rows: out } = await pool.query(
      `INSERT INTO bom_items (locker_model, item_code, component_type, qty, bom_type)
       VALUES ($1, $2, $3, $4, 'Custom')
       RETURNING id, locker_model, item_code, component_type, qty, bom_type`,
      [locker_model, r.item_code, r.component_type, r.qty]
    );
    inserted.push(out[0]);
  }
  res.status(201).json(inserted);
});

app.put("/api/bom/row/:source/:id", authenticate, authorize(['admin', 'manager']), async (req, res) => {
  const source = String(req.params.source || "").trim().toLowerCase();
  const id = Number(req.params.id);
  if (!Number.isInteger(id) || id <= 0) {
    return res.status(400).json({ message: "Valid BOM row id is required" });
  }
  if (source !== "uploaded" && source !== "classic") {
    return res.status(400).json({ message: "source must be uploaded or classic" });
  }

  if (source === "uploaded") {
    const level = String(req.body.level ?? "").trim();
    const position = String(req.body.position ?? "").trim();
    const item_code = String(req.body.item_code ?? "").trim().replace(/\s+/g, "");
    const description = String(req.body.description ?? "").trim();
    const drawing_no = String(req.body.drawing_no ?? "").trim();
    const drawing_rev_no = String(req.body.drawing_rev_no ?? "").trim();
    const op = String(req.body.op ?? "").trim();
    const warehouse = String(req.body.warehouse ?? "").trim();
    const use_pnt_wh = String(req.body.use_pnt_wh ?? "").trim();
    const entrp_unit = String(req.body.entrp_unit ?? "").trim();
    const lot_sel = String(req.body.lot_sel ?? "").trim();
    const revision = String(req.body.revision ?? "").trim();
    const effective_date = String(req.body.effective_date ?? "").trim();
    const expiry_date = String(req.body.expiry_date ?? "").trim();
    const length_mm = String(req.body.length_mm ?? "").trim();
    const width_mm = String(req.body.width_mm ?? "").trim();
    const number_of_units = String(req.body.number_of_units ?? "").trim();
    const inv_unit = String(req.body.inv_unit ?? "").trim();
    const net_quantity = String(req.body.net_quantity ?? "").trim();
    const scrap_percent = String(req.body.scrap_percent ?? "").trim();
    const scrap_quantity = String(req.body.scrap_quantity ?? "").trim();
    const extra_info = String(req.body.extra_info ?? "").trim();

    const { rows } = await pool.query(
      `UPDATE bom_uploaded_rows
       SET level = $1,
           position = $2,
           item_code = $3,
           description = $4,
           drawing_no = $5,
           drawing_rev_no = $6,
           op = $7,
           warehouse = $8,
           use_pnt_wh = $9,
           entrp_unit = $10,
           lot_sel = $11,
           revision = $12,
           effective_date = $13,
           expiry_date = $14,
           length_mm = $15,
           width_mm = $16,
           number_of_units = $17,
           inv_unit = $18,
           net_quantity = $19,
           scrap_percent = $20,
           scrap_quantity = $21,
           extra_info = $22
       WHERE id = $23 AND COALESCE(status, 'active') = 'active'
       RETURNING
         'uploaded'::text AS row_source,
         id, locker_model, bom_type, level, position, item_code, description, drawing_no, drawing_rev_no,
         op, warehouse, use_pnt_wh, entrp_unit, lot_sel, revision, effective_date, expiry_date,
         length_mm, width_mm, number_of_units, inv_unit, net_quantity, scrap_percent, scrap_quantity, extra_info`,
      [
        level, position, item_code, description, drawing_no, drawing_rev_no, op, warehouse, use_pnt_wh, entrp_unit, lot_sel,
        revision, effective_date, expiry_date, length_mm, width_mm, number_of_units, inv_unit, net_quantity, scrap_percent,
        scrap_quantity, extra_info, id,
      ]
    );
    if (rows.length === 0) {
      return res.status(404).json({ message: "BOM row not found" });
    }
    return res.json(rows[0]);
  }

  const item_code = String(req.body.item_code ?? "").trim().replace(/\s+/g, "");
  const net_quantity = Number(req.body.net_quantity);
  const component_type = String(req.body.component_type ?? "").trim();
  if (!item_code) {
    return res.status(400).json({ message: "item_code is required" });
  }
  if (Number.isNaN(net_quantity)) {
    return res.status(400).json({ message: "net_quantity must be numeric" });
  }
  const { rows } = await pool.query(
    `UPDATE bom_items
     SET item_code = $1,
         qty = $2,
         component_type = CASE WHEN $3 = '' THEN component_type ELSE $3 END
     WHERE id = $4 AND COALESCE(status, 'active') = 'active'
     RETURNING
       'classic'::text AS row_source,
       id, locker_model, bom_type, '' AS level, '' AS position, item_code, '' AS description, '' AS drawing_no, '' AS drawing_rev_no,
       '' AS op, '' AS warehouse, '' AS use_pnt_wh, '' AS entrp_unit, '' AS lot_sel, '' AS revision, '' AS effective_date, '' AS expiry_date,
       '' AS length_mm, '' AS width_mm, '' AS number_of_units, '' AS inv_unit, qty::text AS net_quantity, '' AS scrap_percent, '' AS scrap_quantity, '' AS extra_info`,
    [item_code, net_quantity, component_type, id]
  );
  if (rows.length === 0) {
    return res.status(404).json({ message: "BOM row not found" });
  }
  return res.json(rows[0]);
});

app.delete("/api/bom/row/:source/:id", authenticate, authorize(['admin', 'manager']), async (req, res) => {
  const source = String(req.params.source || "").trim().toLowerCase();
  const id = Number(req.params.id);
  if (!Number.isInteger(id) || id <= 0) {
    return res.status(400).json({ message: "Valid BOM row id is required" });
  }
  if (source !== "uploaded" && source !== "classic") {
    return res.status(400).json({ message: "source must be uploaded or classic" });
  }

  if (source === "uploaded") {
    const { rowCount } = await pool.query(
      `UPDATE bom_uploaded_rows
       SET status = 'deleted', deleted_at = NOW()
       WHERE id = $1 AND COALESCE(status, 'active') = 'active'`,
      [id]
    );
    return res.json({ success: true, deleted: rowCount });
  }

  const { rowCount } = await pool.query(
    `UPDATE bom_items
     SET status = 'deleted', deleted_at = NOW()
     WHERE id = $1 AND COALESCE(status, 'active') = 'active'`,
    [id]
  );
  return res.json({ success: true, deleted: rowCount });
});

app.delete("/api/bom/model/:lockerModel", authenticate, authorize(['admin', 'manager']), async (req, res) => {
  const lockerModel = String(req.params.lockerModel || "").trim();
  if (!lockerModel) {
    return res.status(400).json({ message: "lockerModel is required" });
  }
  const uploaded = await pool.query("DELETE FROM bom_uploaded_rows WHERE locker_model = $1", [lockerModel]);
  const custom = await pool.query("DELETE FROM bom_items WHERE locker_model = $1", [lockerModel]);
  res.json({
    success: true,
    deletedUploaded: uploaded.rowCount,
    deletedCustom: custom.rowCount,
    deletedTotal: (uploaded.rowCount || 0) + (custom.rowCount || 0),
  });
});

app.get("/api/uploads", authenticate, async (_req, res) => {
  const { rows } = await pool.query(
    `SELECT id, TO_CHAR(upload_date, 'YYYY-MM-DD') AS date, file_name AS file, rows_saved, warnings
     FROM stock_uploads
     ORDER BY upload_date DESC, id DESC
     LIMIT 7`
  );
  res.json(rows);
});

app.post("/api/uploads", authenticate, authorize(['admin', 'manager', 'employee']), async (req, res) => {
  const { date, fileName, stockRows = [] } = req.body;
  let warnings = 0;
  const str = (v) => (v == null || v === "" ? "" : String(v).trim());
  /** Match MRP/BOM join: trim + collapse spaces (same normalization as MRP SQL) */
  const normalizeItemCode = (raw) => {
    if (raw == null || raw === "") return "";
    return String(raw).trim().replace(/\s+/g, "");
  };
  /** Last occurrence wins if the same item_code appears more than once in the file */
  const byItemCode = new Map();
  for (const row of stockRows) {
    const rawCode = row.item_code || row.code;
    const item_code = normalizeItemCode(rawCode);
    const rawQty = row.stock ?? row.stock_qty ?? row.qty;
    const stock_qty = Number(rawQty);
    if (!item_code || Number.isNaN(stock_qty)) {
      warnings += 1;
      continue;
    }
    byItemCode.set(item_code, {
      item_code,
      stock_qty,
      data_used_by: str(row.data_used_by),
      sr_no: str(row.sr_no),
      stock_material: str(row.material ?? row.stock_material),
      ln_description: str(row.ln_description),
      short_description: str(row.short_description),
      uom: str(row.uom),
    });
  }
  const validRows = Array.from(byItemCode.values());
  if (validRows.length === 0) {
    return res.status(400).json({ message: "No valid stock rows to import" });
  }

  const client = await pool.connect();
  try {
    await client.query("BEGIN");
    await client.query("DELETE FROM stock_items");
    await client.query("DELETE FROM stock_uploads");
    for (const r of validRows) {
      await client.query(
        `INSERT INTO stock_items (
          item_code, stock_qty, data_used_by, sr_no, stock_material, ln_description, short_description, uom, updated_at
        ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, NOW())`,
        [
          r.item_code,
          r.stock_qty,
          r.data_used_by || null,
          r.sr_no || null,
          r.stock_material || null,
          r.ln_description || null,
          r.short_description || null,
          r.uom || null,
        ]
      );
    }
    await client.query(
      `INSERT INTO stock_uploads (upload_date, file_name, rows_saved, warnings)
       VALUES ($1, $2, $3, $4)`,
      [date, fileName, validRows.length, warnings]
    );
    await client.query("COMMIT");
    res.status(201).json({
      rowsSaved: validRows.length,
      warnings,
      fileName,
      replacedPreviousStock: true,
    });
  } catch (e) {
    await client.query("ROLLBACK");
    throw e;
  } finally {
    client.release();
  }
});

app.post("/api/plan", authenticate, authorize(['admin', 'manager', 'employee']), async (req, res) => {
  const { date, rows = [] } = req.body;

  const missingBomCodes = await findMissingBomLockerCodes(rows);
  if (missingBomCodes.length > 0) {
    return res.status(400).json({
      message: `Following item codes do not have BOM: ${missingBomCodes.join(", ")}. Please add BOM before calculating.`,
      missingBomCodes,
    });
  }

  await pool.query("DELETE FROM plan_entries WHERE plan_date = $1", [date]);
  for (const row of rows) {
    await pool.query(
      `INSERT INTO plan_entries (plan_date, locker_item_code, subtype, quantity)
       VALUES ($1, $2, $3, $4)`,
      [date, row.locker_item_code, row.subtype, row.quantity]
    );
  }
  res.status(201).json({ success: true, count: rows.length });
});

app.put("/api/plan/quantity", authenticate, async (req, res) => {
  const date = String(req.body?.date ?? "").trim();
  const lockerItemCode = String(req.body?.locker_item_code ?? "").trim();
  const quantity = Number(req.body?.quantity);

  if (!/^\d{4}-\d{2}-\d{2}$/.test(date)) {
    return res.status(400).json({ message: "Valid date is required" });
  }
  if (!lockerItemCode) {
    return res.status(400).json({ message: "locker_item_code is required" });
  }
  if (Number.isNaN(quantity) || quantity <= 0) {
    return res.status(400).json({ message: "quantity must be a positive number" });
  }

  const existing = await pool.query(
    `SELECT id, subtype
     FROM plan_entries
     WHERE plan_date = $1 AND locker_item_code = $2
     ORDER BY id DESC
     LIMIT 1`,
    [date, lockerItemCode]
  );
  if (existing.rowCount === 0) {
    return res.status(404).json({ message: "Plan entry not found for given date and locker item code" });
  }

  const subtype = existing.rows[0].subtype || "Standard";
  const { rows } = await pool.query(
    `UPDATE plan_entries
     SET quantity = $1
     WHERE id = $2
     RETURNING id, TO_CHAR(plan_date, 'YYYY-MM-DD') AS date, locker_item_code, subtype, quantity`,
    [quantity, existing.rows[0].id]
  );
  return res.json(rows[0]);
});

app.get("/api/mrp/results", authenticate, async (req, res) => {
  const planDateParam = req.query.planDate ? String(req.query.planDate).trim() : null;

  const sql = `
    WITH plan_scope AS (
      SELECT locker_item_code, quantity
      FROM plan_entries
      WHERE plan_date = (
        CASE
          WHEN $1::text IS NOT NULL AND $1::text <> '' THEN $1::date
          ELSE (SELECT MAX(plan_date) FROM plan_entries)
        END
      )
    ),
    uploaded_qty AS (
      SELECT
        id AS source_id,
        'uploaded'::text AS source_type,
        locker_model,
        level,
        position,
        item_code,
        COALESCE(NULLIF(TRIM(description), ''), 'Component') AS component_type,
        COALESCE(NULLIF(TRIM(description), ''), NULLIF(TRIM(item_code), '')) AS material_label,
        TRIM(COALESCE(description, '')) AS bom_description,
        TRIM(COALESCE(inv_unit, '')) AS bom_inv_unit,
        TRIM(COALESCE(drawing_no, '')) AS bom_drawing_no,
        CASE
          WHEN (regexp_replace(TRIM(COALESCE(net_quantity, '')), ',', '.', 'g') ~ '^-?[0-9]+(\\.[0-9]+)?$')
          THEN (regexp_replace(TRIM(COALESCE(net_quantity, '')), ',', '.', 'g'))::numeric
          WHEN TRIM(COALESCE(net_quantity, '')) ~ '^-?[0-9]+(\\.[0-9]+)?$'
          THEN TRIM(COALESCE(net_quantity, ''))::numeric
          ELSE 0::numeric
        END AS qty
      FROM bom_uploaded_rows
      WHERE COALESCE(status, 'active') = 'active'
    ),
    combined_bom AS (
      SELECT
        id AS source_id,
        'classic'::text AS source_type,
        locker_model,
        NULL::text AS level,
        NULL::text AS position,
        item_code,
        component_type,
        item_code AS material_label,
        NULL::text AS bom_description,
        NULL::text AS bom_inv_unit,
        NULL::text AS bom_drawing_no,
        qty::numeric AS qty
      FROM bom_items
      WHERE COALESCE(status, 'active') = 'active'
      UNION ALL
      SELECT source_id, source_type, locker_model, level, position, item_code, component_type, material_label, bom_description, bom_inv_unit, bom_drawing_no, qty
      FROM uploaded_qty
    ),
    plan_scoped_bom AS (
      SELECT b.*, p.locker_item_code AS match_locker_code
      FROM plan_scope p
      INNER JOIN lockers l ON l.locker_item_code = p.locker_item_code
      INNER JOIN combined_bom b ON (
        LOWER(TRIM(b.locker_model)) = LOWER(TRIM(l.model))
        OR (COALESCE(l.subtype, '') <> '' AND LOWER(TRIM(b.locker_model)) = LOWER(TRIM(l.subtype)))
        OR (COALESCE(l.product, '') <> '' AND LOWER(TRIM(b.locker_model)) = LOWER(TRIM(l.product)))
        OR LOWER(TRIM(b.locker_model)) = LOWER(TRIM(l.description))
        OR LOWER(TRIM(b.locker_model)) = LOWER(TRIM(l.locker_item_code))
        OR regexp_replace(LOWER(TRIM(b.locker_model)), '\\s+', '', 'g') = regexp_replace(LOWER(TRIM(l.model)), '\\s+', '', 'g')
        OR (COALESCE(l.subtype, '') <> '' AND regexp_replace(LOWER(TRIM(b.locker_model)), '\\s+', '', 'g') = regexp_replace(LOWER(TRIM(l.subtype)), '\\s+', '', 'g'))
        OR (COALESCE(l.product, '') <> '' AND regexp_replace(LOWER(TRIM(b.locker_model)), '\\s+', '', 'g') = regexp_replace(LOWER(TRIM(l.product)), '\\s+', '', 'g'))
        OR regexp_replace(LOWER(TRIM(b.locker_model)), '[^a-z0-9]+', '', 'g') = regexp_replace(
          lower(trim(COALESCE(l.product, '') || COALESCE(l.subtype, ''))), '[^a-z0-9]+', '', 'g')
        OR regexp_replace(LOWER(TRIM(b.locker_model)), '[^a-z0-9]+', '', 'g') = regexp_replace(
          lower(trim(COALESCE(l.product, '') || ' ' || COALESCE(l.subtype, ''))), '[^a-z0-9]+', '', 'g')
        OR regexp_replace(LOWER(TRIM(b.locker_model)), '[^a-z0-9]+', '', 'g') = regexp_replace(
          lower(trim(COALESCE(l.subtype, '') || COALESCE(l.product, ''))), '[^a-z0-9]+', '', 'g')
        OR (
          length(regexp_replace(LOWER(TRIM(b.locker_model)), '[^a-z0-9]+', '', 'g')) >= 3
          AND regexp_replace(lower(trim(COALESCE(l.product, '') || COALESCE(l.subtype, ''))), '[^a-z0-9]+', '', 'g')
            LIKE '%' || regexp_replace(LOWER(TRIM(b.locker_model)), '[^a-z0-9]+', '', 'g') || '%'
        )
        OR (
          length(regexp_replace(LOWER(TRIM(b.locker_model)), '[^a-z0-9]+', '', 'g')) >= 3
          AND regexp_replace(LOWER(TRIM(b.locker_model)), '[^a-z0-9]+', '', 'g')
            LIKE '%' || regexp_replace(lower(trim(COALESCE(l.product, '') || COALESCE(l.subtype, ''))), '[^a-z0-9]+', '', 'g') || '%'
        )
      )
      WHERE b.qty IS NOT NULL
    ),
    fallback_bom AS (
      SELECT b.*, p2.locker_item_code AS match_locker_code
      FROM combined_bom b
      CROSS JOIN plan_scope p2
      WHERE b.qty IS NOT NULL
        AND (SELECT COUNT(*) FROM plan_scoped_bom) = 0
        AND (SELECT COUNT(DISTINCT locker_model) FROM combined_bom WHERE qty IS NOT NULL) = 1
    ),
    bom_resolved AS (
      SELECT * FROM plan_scoped_bom
      UNION ALL
      SELECT * FROM fallback_bom
    )
    SELECT
      ROW_NUMBER() OVER (
        ORDER BY MIN(COALESCE(NULLIF(TRIM(b.item_code), ''), b.material_label))
      ) AS line_no,
      COALESCE(NULLIF(TRIM(b.item_code), ''), b.material_label) AS item_code,
      SUM(COALESCE((b.qty * p.quantity), 0)) AS required_quantity,
      MAX(COALESCE(s.stock_qty, 0)) AS stock_available,
      NULLIF(TRIM(MAX(s.stock_material)), '') AS material,
      COALESCE(
        NULLIF(TRIM(MAX(s.ln_description)), ''),
        NULLIF(TRIM(MAX(b.bom_description)), ''),
        ''
      ) AS ln_description,
      COALESCE(
        NULLIF(TRIM(MAX(s.short_description)), ''),
        NULLIF(TRIM(MAX(b.bom_drawing_no)), ''),
        ''
      ) AS short_description
    FROM bom_resolved b
    INNER JOIN plan_scope p ON p.locker_item_code = b.match_locker_code
    INNER JOIN stock_items s ON regexp_replace(lower(trim(s.item_code)), '\\s+', '', 'g')
      = regexp_replace(
        lower(trim(COALESCE(NULLIF(TRIM(b.item_code), ''), b.material_label))),
        '\\s+',
        '',
        'g'
      )
    GROUP BY COALESCE(NULLIF(TRIM(b.item_code), ''), b.material_label)
    ORDER BY line_no
  `;

  const { rows } = await pool.query(sql, [planDateParam]);
  const mapped = rows
    .map((r) => {
      const required_quantity = Number(r.required_quantity || 0);
      const stock_available = Number(r.stock_available || 0);
      const difference = stock_available - required_quantity;
      return {
        id: Number(r.line_no),
        sr_no: Number(r.line_no),
        item_code: r.item_code,
        material: r.material ?? "",
        ln_description: r.ln_description ?? "",
        short_description: r.short_description ?? "",
        required_quantity,
        stock_available,
        difference,
        status: difference < 0 ? "LOW" : "OK",
      };
    });
  res.json(mapped);
});

app.use((err, _req, res, _next) => {
  console.error(err);
  res.status(500).json({ message: err.message || "Internal server error" });
});

const port = Number(process.env.PORT || 4000);
initDb()
  .then(() => {
    app.listen(port, () => {
      console.log(`API server running on http://localhost:${port}`);
    });
  })
  .catch((e) => {
    console.error("Failed to initialize database:", e.message || e.code || "");
    if (e.errors?.length) {
      for (const sub of e.errors) {
        console.error(" ", sub.message || sub.code || sub);
      }
    } else if (!e.message) {
      console.error(e);
    }
    process.exit(1);
  });
  