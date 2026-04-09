import express from "express";
import cors from "cors";
import { pool } from "./db.js";
import { initDb } from "./initDb.js";

const app = express();
app.use(cors());
app.use(express.json({ limit: "2mb" }));

app.get("/api/health", async (_req, res) => {
  const { rows } = await pool.query("SELECT NOW() as now");
  res.json({ ok: true, now: rows[0].now });
});

app.get("/api/lockers", async (_req, res) => {
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

app.post("/api/lockers", async (req, res) => {
  const { product, subtype, locker_code } = req.body;
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

app.post("/api/lockers/upload", async (req, res) => {
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

app.get("/api/bom", async (_req, res) => {
  const uploaded = await pool.query(
    `SELECT
      id, locker_model, bom_type, level, position, item_code, description, drawing_no, drawing_rev_no,
      op, warehouse, use_pnt_wh, entrp_unit, lot_sel, revision, effective_date, expiry_date,
      length_mm, width_mm, number_of_units, inv_unit, net_quantity, scrap_percent, scrap_quantity, extra_info
     FROM bom_uploaded_rows
     ORDER BY locker_model, id`
  );
  const classic = await pool.query(
    `SELECT
      id, locker_model, bom_type, '' AS level, '' AS position, item_code, '' AS description, '' AS drawing_no, '' AS drawing_rev_no,
      '' AS op, '' AS warehouse, '' AS use_pnt_wh, '' AS entrp_unit, '' AS lot_sel, '' AS revision, '' AS effective_date, '' AS expiry_date,
      '' AS length_mm, '' AS width_mm, '' AS number_of_units, '' AS inv_unit, qty::text AS net_quantity, '' AS scrap_percent, '' AS scrap_quantity, '' AS extra_info
     FROM bom_items
     ORDER BY locker_model, id`
  );
  res.json([...uploaded.rows, ...classic.rows]);
});

app.post("/api/bom/upload", async (req, res) => {
  const { locker_model, rows = [], fileName = "uploaded-bom.xlsx" } = req.body;
  if (!locker_model) {
    return res.status(400).json({ message: "locker_model is required" });
  }

  await pool.query("DELETE FROM bom_uploaded_rows WHERE locker_model = $1", [locker_model]);

  let rowsSaved = 0;
  let warnings = 0;
  for (const row of rows) {
    const level = row.Level ?? row.level ?? "";
    const position = row.Position ?? row.position ?? "";
    const itemCode = row.Item ?? row.item ?? row.item_code ?? "";
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

app.post("/api/bom/custom", async (req, res) => {
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

app.get("/api/uploads", async (_req, res) => {
  const { rows } = await pool.query(
    `SELECT id, TO_CHAR(upload_date, 'YYYY-MM-DD') AS date, file_name AS file, rows_saved, warnings
     FROM stock_uploads
     ORDER BY upload_date DESC, id DESC
     LIMIT 7`
  );
  res.json(rows);
});

app.post("/api/uploads", async (req, res) => {
  const { date, fileName, stockRows = [] } = req.body;
  let rowsSaved = 0;
  let warnings = 0;
  for (const row of stockRows) {
    const item_code = row.item_code || row.code;
    const rawQty = row.stock ?? row.stock_qty ?? row.qty;
    const stock_qty = Number(rawQty);
    if (!item_code || Number.isNaN(stock_qty)) {
      warnings += 1;
      continue;
    }
    await pool.query(
      `INSERT INTO stock_items (item_code, stock_qty, updated_at)
       VALUES ($1, $2, NOW())
       ON CONFLICT (item_code)
       DO UPDATE SET stock_qty = EXCLUDED.stock_qty, updated_at = NOW()`,
      [item_code, stock_qty]
    );
    rowsSaved += 1;
  }
  await pool.query(
    `INSERT INTO stock_uploads (upload_date, file_name, rows_saved, warnings)
     VALUES ($1, $2, $3, $4)`,
    [date, fileName, rowsSaved, warnings]
  );
  res.status(201).json({ rowsSaved, warnings, fileName });
});

app.post("/api/plan", async (req, res) => {
  const { date, rows = [] } = req.body;
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

app.get("/api/mrp/results", async (req, res) => {
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
        locker_model,
        item_code,
        COALESCE(NULLIF(TRIM(description), ''), 'Component') AS component_type,
        COALESCE(NULLIF(TRIM(description), ''), NULLIF(TRIM(item_code), '')) AS material_label,
        CASE
          WHEN (regexp_replace(TRIM(COALESCE(net_quantity, '')), ',', '.', 'g') ~ '^-?[0-9]+(\\.[0-9]+)?$')
          THEN (regexp_replace(TRIM(COALESCE(net_quantity, '')), ',', '.', 'g'))::numeric
          WHEN TRIM(COALESCE(net_quantity, '')) ~ '^-?[0-9]+(\\.[0-9]+)?$'
          THEN TRIM(COALESCE(net_quantity, ''))::numeric
          ELSE 0::numeric
        END AS qty
      FROM bom_uploaded_rows
    ),
    combined_bom AS (
      SELECT locker_model, item_code, component_type,
        item_code AS material_label,
        qty::numeric AS qty
      FROM bom_items
      UNION ALL
      SELECT locker_model, item_code, component_type, material_label, qty
      FROM uploaded_qty
    ),
    locker_bom_match AS (
      SELECT b.*, l.locker_item_code AS match_locker_code
      FROM combined_bom b
      INNER JOIN lockers l ON (
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
      WHERE b.qty > 0
    ),
    fallback_bom AS (
      SELECT b.*, p2.locker_item_code AS match_locker_code
      FROM combined_bom b
      CROSS JOIN plan_scope p2
      WHERE b.qty > 0
        AND (SELECT COUNT(*) FROM locker_bom_match) = 0
        AND (SELECT COUNT(DISTINCT locker_model) FROM combined_bom WHERE qty > 0) = 1
    ),
    bom_resolved AS (
      SELECT * FROM locker_bom_match
      UNION ALL
      SELECT * FROM fallback_bom
    )
    SELECT
      COALESCE(NULLIF(TRIM(MAX(b.item_code)), ''), MAX(b.material_label)) AS item_code,
      MAX(b.component_type) AS component_type,
      MAX(b.material_label) AS material_name,
      COALESCE(SUM(b.qty * p.quantity), 0) AS required_quantity,
      COALESCE(MAX(s.stock_qty), 0) AS stock_available
    FROM bom_resolved b
    INNER JOIN plan_scope p ON p.locker_item_code = b.match_locker_code
    LEFT JOIN stock_items s ON s.item_code = COALESCE(NULLIF(TRIM(b.item_code), ''), b.material_label)
    GROUP BY COALESCE(NULLIF(TRIM(b.item_code), ''), b.material_label)
    ORDER BY 1
  `;

  const { rows } = await pool.query(sql, [planDateParam]);
  const mapped = rows
    .map((r, idx) => {
      const required_quantity = Number(r.required_quantity || 0);
      const stock_available = Number(r.stock_available || 0);
      const difference = stock_available - required_quantity;
      return {
        id: idx + 1,
        material_name: r.material_name,
        component_type: r.component_type,
        item_code: r.item_code,
        required_quantity,
        stock_available,
        difference,
        status: difference < 0 ? "LOW" : "OK",
      };
    })
    .filter((r) => r.required_quantity > 0);
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
    console.error("Failed to initialize database:", e.message);
    process.exit(1);
  });
