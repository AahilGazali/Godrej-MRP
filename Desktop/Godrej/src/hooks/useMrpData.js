import { useMutation, useQuery } from "@tanstack/react-query";
import * as XLSX from "xlsx";
import {
  addCustomBom,
  addLocker,
  deleteBomRow,
  deleteBomByModel,
  deleteLocker,
  fetchBom,
  fetchLockerMaster,
  fetchMrpResults,
  fetchUploads,
  savePlanEntries,
  updatePlanQuantity,
  updateBomRow,
  updateLocker,
  uploadBomRows,
  uploadLockerRows,
  uploadStockRows,
} from "../api/mrpApi";

export const useLockerMaster = () =>
  useQuery({
    queryKey: ["lockerMaster"],
    queryFn: fetchLockerMaster,
  });

export const useBom = () =>
  useQuery({
    queryKey: ["bomData"],
    queryFn: fetchBom,
  });

export const useUploads = () =>
  useQuery({
    queryKey: ["uploadHistory"],
    queryFn: fetchUploads,
  });

export const useMrpResults = () =>
  useQuery({
    queryKey: [
      "mrpResults",
      (() => {
        try {
          const raw = sessionStorage.getItem("mrp_plan_snapshot");
          return raw ? JSON.parse(raw).date : "";
        } catch {
          return "";
        }
      })(),
    ],
    queryFn: async () => {
      let planDate;
      try {
        const raw = sessionStorage.getItem("mrp_plan_snapshot");
        if (raw) planDate = JSON.parse(raw).date;
      } catch {
        planDate = undefined;
      }
      return fetchMrpResults(planDate);
    },
  });

/** Excel serial (approx) to UTC midnight Date */
function excelSerialToDate(serial) {
  if (typeof serial !== "number" || serial < 20000 || serial > 80000) return null;
  const epoch = Date.UTC(1899, 11, 30);
  const ms = epoch + Math.round(serial) * 86400000;
  const d = new Date(ms);
  return Number.isNaN(d.getTime()) ? null : d;
}

function normalizeKey(value) {
  return String(value ?? "")
    .trim()
    .toLowerCase()
    .replace(/\s+/g, "");
}

function makeCalendarDate(year, month, day) {
  const date = new Date(year, month - 1, day);
  if (
    Number.isNaN(date.getTime()) ||
    date.getFullYear() !== year ||
    date.getMonth() !== month - 1 ||
    date.getDate() !== day
  ) {
    return null;
  }
  return date;
}

/** Parse header cell as calendar date (Excel serial, Date, or common sheet date string). */
function headerCellToDate(cell) {
  if (cell instanceof Date && !Number.isNaN(cell.getTime())) {
    return new Date(cell.getFullYear(), cell.getMonth(), cell.getDate());
  }
  if (typeof cell === "number") {
    const fromSerial = excelSerialToDate(cell);
    if (fromSerial) {
      return new Date(fromSerial.getUTCFullYear(), fromSerial.getUTCMonth(), fromSerial.getUTCDate());
    }
  }
  const s = String(cell ?? "").trim();
  if (!s || s === "#####") return null;
  const iso = s.match(/^(\d{4})[-/.](\d{1,2})[-/.](\d{1,2})$/);
  if (iso) {
    const yyyy = parseInt(iso[1], 10);
    const mm = parseInt(iso[2], 10);
    const dd = parseInt(iso[3], 10);
    return makeCalendarDate(yyyy, mm, dd);
  }
  const m = s.match(/^(\d{1,2})([-/.])(\d{1,2})\2(\d{2,4})$/);
  if (m) {
    const first = parseInt(m[1], 10);
    const second = parseInt(m[3], 10);
    const separator = m[2];
    let yyyy = parseInt(m[4], 10);
    if (yyyy < 100) yyyy += 2000;
    let dd;
    let mm;
    if (first > 12 && second <= 12) {
      dd = first;
      mm = second;
    } else if (second > 12 && first <= 12) {
      mm = first;
      dd = second;
    } else if (separator === "/") {
      mm = first;
      dd = second;
    } else {
      dd = first;
      mm = second;
    }
    return makeCalendarDate(yyyy, mm, dd);
  }
  return null;
}

function sameCalendarDay(a, b) {
  return (
    a.getFullYear() === b.getFullYear() &&
    a.getMonth() === b.getMonth() &&
    a.getDate() === b.getDate()
  );
}

function findItemColumnIndex(headers) {
  for (let i = 0; i < headers.length; i++) {
    const nk = normalizeKey(headers[i]);
    if (!nk) continue;
    if (nk === "itemcod" || nk === "itemcode") return i;
    if (nk.includes("item") && (nk.includes("cod") || nk.includes("code"))) return i;
    if (nk === "item" || nk === "code") return i;
  }
  return -1;
}

function findPurchaseCodeColumnIndex(headers) {
  for (let i = 0; i < headers.length; i++) {
    const nk = normalizeKey(headers[i]);
    if (!nk) continue;
    if (nk === "purchasecode" || nk === "purchasecod") return i;
    if (nk.includes("purchase") && (nk.includes("cod") || nk.includes("code"))) return i;
  }
  return -1;
}

function findVdcCodeColumnIndex(headers) {
  for (let i = 0; i < headers.length; i++) {
    const nk = normalizeKey(headers[i]);
    if (!nk) continue;
    if (nk === "vdccode" || nk === "vdccod") return i;
    if (nk.includes("vdc") && (nk.includes("cod") || nk.includes("code"))) return i;
  }
  return -1;
}

/** Header match for stock sheet optional columns (SR NO., Material, LN Description, etc.) */
function normalizeHeaderCompact(value) {
  return String(value ?? "")
    .trim()
    .toLowerCase()
    .replace(/\s+/g, "")
    .replace(/[^a-z0-9]/g, "");
}

function findOptionalColumnIndex(headerRow, matchCompact) {
  for (let i = 0; i < headerRow.length; i++) {
    const c = normalizeHeaderCompact(headerRow[i]);
    if (!c) continue;
    if (matchCompact(c)) return i;
  }
  return -1;
}

/** Column D "Material" (Wood / Wood MTO) — avoid matching "Material description" type headers */
function matchMaterialHeaderCompact(c) {
  if (!c) return false;
  if (c === "material" || c === "materialtype" || c === "materialgroup" || c === "matl") return true;
  if (c.startsWith("material") && !c.includes("description") && !c.includes("desc")) return true;
  return false;
}

/** Header is not always row 0 (titles, blanks above table) */
function findStockHeaderRowIndex(grid) {
  const max = Math.min(grid.length, 40);
  for (let i = 0; i < max; i++) {
    const row = grid[i];
    if (!Array.isArray(row) || !row.length) continue;
    if (
      findItemColumnIndex(row) >= 0 ||
      findPurchaseCodeColumnIndex(row) >= 0 ||
      findVdcCodeColumnIndex(row) >= 0
    ) {
      return i;
    }
  }
  return 0;
}

/**
 * Prefer "Master" / "Stock" tab, else first sheet that has a real ITEM CODE header row.
 */
function pickStockGrid(workbook) {
  const names = workbook.SheetNames || [];
  if (!names.length) return null;
  const compact = (n) => normalizeHeaderCompact(n);
  const ranked = [
    ...names.filter((n) => compact(n) === "master"),
    ...names.filter((n) => compact(n) === "stock"),
    ...names.filter((n) => compact(n) !== "master" && compact(n) !== "stock"),
  ];
  for (const name of ranked) {
    const sheet = workbook.Sheets[name];
    if (!sheet) continue;
    const grid = XLSX.utils.sheet_to_json(sheet, { header: 1, defval: "", blankrows: false, raw: false });
    if (!grid.length) continue;
    const headerRowIndex = findStockHeaderRowIndex(grid);
    const headerRow = grid[headerRowIndex] || [];
    if (
      findItemColumnIndex(headerRow) >= 0 ||
      findPurchaseCodeColumnIndex(headerRow) >= 0 ||
      findVdcCodeColumnIndex(headerRow) >= 0
    ) {
      return { grid, headerRowIndex };
    }
  }
  return null;
}

function cellAt(row, colIdx) {
  if (colIdx < 0) return "";
  const v = row[colIdx];
  if (v === null || v === undefined) return "";
  return String(v).trim();
}

/** Align with server/MRP join: trim and remove spaces so ITEM CODE matches BOM */
function normalizeStockItemCode(raw) {
  if (raw == null || raw === "") return "";
  return String(raw).trim().replace(/\s+/g, "");
}

function stockMetaFromObjectRow(row) {
  const entries = Object.entries(row);
  const pick = (matchCompact) => {
    for (const [k, v] of entries) {
      const c = normalizeHeaderCompact(k);
      if (!c) continue;
      if (matchCompact(c)) {
        if (v === null || v === undefined || v === "") return "";
        return String(v).trim();
      }
    }
    return "";
  };
  return {
    data_used_by: pick(
      (c) =>
        c === "datausedby" ||
        (c.includes("data") && c.includes("used") && c.includes("by"))
    ),
    sr_no: pick(
      (c) =>
        c === "srno" ||
        c === "srnumber" ||
        c === "slno" ||
        c === "sno" ||
        (c.startsWith("sr") && c.includes("no"))
    ),
    material: pick(matchMaterialHeaderCompact),
    ln_description: pick(
      (c) => (c.includes("ln") && (c.includes("description") || c.includes("desc"))) || c === "lndescription"
    ),
    short_description: pick(
      (c) =>
        (c.includes("short") && (c.includes("description") || c.includes("discription"))) ||
        c === "shortdescription" ||
        c === "shortdiscription"
    ),
    uom: pick((c) => c === "uom" || c === "unitofmeasure" || c === "unit"),
  };
}

/**
 * Parse first sheet as grid; pick stock qty column by selected date or latest date column in file.
 */
function parseStockSheetFromXlsx(buffer, selectedIsoDate) {
  const workbook = XLSX.read(buffer, { type: "array", cellDates: true });
  const picked = pickStockGrid(workbook);
  if (!picked) {
    return {
      stockRows: [],
      dateColumnLabel: null,
      usedFallback: false,
      error: "No sheet with an ITEM CODE header row found (use a tab like Master with headers, or put the table at the top).",
    };
  }
  const { grid, headerRowIndex } = picked;
  const headerRow = grid[headerRowIndex];
  const itemCol = findItemColumnIndex(headerRow);
  const purchaseCodeCol = findPurchaseCodeColumnIndex(headerRow);
  const vdcCodeCol = findVdcCodeColumnIndex(headerRow);
  const primaryCodeCol = purchaseCodeCol >= 0 ? purchaseCodeCol : itemCol >= 0 ? itemCol : vdcCodeCol;
  if (primaryCodeCol < 0) {
    return {
      stockRows: [],
      dateColumnLabel: null,
      usedFallback: false,
      error: "No stock code column found (expected ITEM CODE, Purchase Code, or VDC Code)",
    };
  }

  const dateCandidates = [];
  for (let c = 0; c < headerRow.length; c++) {
    if (c === itemCol || c === purchaseCodeCol || c === vdcCodeCol) continue;
    const d = headerCellToDate(headerRow[c]);
    if (d) dateCandidates.push({ col: c, date: d, raw: headerRow[c] });
  }

  const selected = new Date(`${selectedIsoDate}T12:00:00`);
  let qtyCol = -1;
  let usedFallback = false;
  let dateColumnLabel = null;

  if (dateCandidates.length > 0) {
    const exact = dateCandidates.find((x) => sameCalendarDay(x.date, selected));
    if (exact) {
      qtyCol = exact.col;
      dateColumnLabel = String(exact.raw ?? "").trim() || exact.date.toISOString().slice(0, 10);
    } else {
      const latest = dateCandidates.reduce((a, b) => (a.date > b.date ? a : b));
      const latestHasData = grid.slice(headerRowIndex + 1).some((row) => {
        const purchaseCode = normalizeStockItemCode(row[purchaseCodeCol]);
        const itemCode = normalizeStockItemCode(row[itemCol]);
        const vdcCode = normalizeStockItemCode(row[vdcCodeCol]);
        if (!purchaseCode && !itemCode && !vdcCode) return false;
        const raw = row[latest.col];
        if (raw === "" || raw === "-" || raw === null || raw === undefined) return false;
        const stock = typeof raw === "number" ? raw : Number(String(raw).replace(/,/g, ""));
        return !Number.isNaN(stock);
      });
      if (!latestHasData) {
        return {
          stockRows: [],
          dateColumnLabel: null,
          usedFallback: false,
          error:
            "No stock values found for the latest date column. The stock file may not be updated yet for this date. Please select a specific date that matches a column in your sheet.",
        };
      }
      qtyCol = latest.col;
      usedFallback = true;
      dateColumnLabel = String(latest.raw ?? "").trim() || latest.date.toISOString().slice(0, 10);
    }
  }

  if (qtyCol < 0) {
    for (let c = headerRow.length - 1; c >= 0; c--) {
      if (c === itemCol || c === purchaseCodeCol || c === vdcCodeCol) continue;
      const sample = grid.slice(1, 6).map((row) => row[c]);
      const numericish = sample.some((v) => v !== "" && v !== "-" && !Number.isNaN(Number(String(v).replace(/,/g, ""))));
      if (numericish) {
        qtyCol = c;
        usedFallback = true;
        dateColumnLabel = String(headerRow[c] ?? "").trim() || `Column ${c + 1}`;
        break;
      }
    }
  }

  if (qtyCol < 0) {
    return { stockRows: [], dateColumnLabel: null, usedFallback: false, error: "No date or numeric stock column found in the sheet" };
  }

  const srCol = findOptionalColumnIndex(
    headerRow,
    (c) =>
      c === "srno" ||
      c === "srnumber" ||
      c === "slno" ||
      c === "sno" ||
      (c.startsWith("sr") && c.includes("no"))
  );
  const materialCol = findOptionalColumnIndex(headerRow, matchMaterialHeaderCompact);
  const lnDescCol = findOptionalColumnIndex(
    headerRow,
    (c) => (c.includes("ln") && (c.includes("description") || c.includes("desc"))) || c === "lndescription"
  );
  const shortDescCol = findOptionalColumnIndex(
    headerRow,
    (c) =>
      (c.includes("short") && (c.includes("description") || c.includes("discription"))) ||
      c === "shortdescription" ||
      c === "shortdiscription"
  );
  const uomCol = findOptionalColumnIndex(headerRow, (c) => c === "uom" || c === "unitofmeasure" || c === "unit");
  const dataUsedByCol = findOptionalColumnIndex(
    headerRow,
    (c) =>
      c === "datausedby" ||
      (c.includes("data") && c.includes("used") && c.includes("by"))
  );

  const stockRows = [];
  for (let r = headerRowIndex + 1; r < grid.length; r++) {
    const row = grid[r];
    let raw = row[qtyCol];
    if (raw === "" || raw === "-" || raw === null || raw === undefined) continue;
    const stock = typeof raw === "number" ? raw : Number(String(raw).replace(/,/g, ""));
    if (Number.isNaN(stock)) continue;
    const meta = {
      data_used_by: cellAt(row, dataUsedByCol),
      sr_no: cellAt(row, srCol),
      material: cellAt(row, materialCol),
      ln_description: cellAt(row, lnDescCol),
      short_description: cellAt(row, shortDescCol),
      uom: cellAt(row, uomCol),
    };
    const purchaseCode = normalizeStockItemCode(row[purchaseCodeCol >= 0 ? purchaseCodeCol : primaryCodeCol]);
    const vdcCode = normalizeStockItemCode(row[vdcCodeCol]);
    if (!purchaseCode && !vdcCode) continue;
    if (purchaseCode) {
      stockRows.push({ item_code: purchaseCode, stock, ...meta });
    }
    if (vdcCode) {
      stockRows.push({ item_code: vdcCode, stock, ...meta });
    }
  }

  return { stockRows, dateColumnLabel, usedFallback };
}

export const useFileUpload = () =>
  useMutation({
    mutationFn: async ({ file, onProgress, module, date }) => {
      const normalize = (value) => String(value ?? "").trim().toLowerCase().replace(/\s+/g, "");
      const excelDateKeys = (isoDate) => {
        const dt = new Date(isoDate);
        if (Number.isNaN(dt.getTime())) return [];
        const dd = String(dt.getDate()).padStart(2, "0");
        const mm = String(dt.getMonth() + 1).padStart(2, "0");
        const yyyy = String(dt.getFullYear());
        const yy = yyyy.slice(-2);
        return [
          `${dd}-${mm}-${yy}`,
          `${dd}-${mm}-${yyyy}`,
          `${yyyy}-${mm}-${dd}`,
          `${dd}/${mm}/${yy}`,
          `${dd}/${mm}/${yyyy}`,
          `${dd}.${mm}.${yy}`,
          `${dd}.${mm}.${yyyy}`,
        ].map((k) => normalize(k));
      };

      const normalizeStockRowsByDateFromObjects = (rawRows, selectedDate) => {
        const targetKeys = new Set(excelDateKeys(selectedDate));
        return rawRows
          .map((row) => {
            const entries = Object.entries(row);
            const itemCodeEntry = entries.find(([k]) => {
              const nk = normalizeKey(k);
              return (
                nk === "item" ||
                nk === "itemcode" ||
                nk === "itemcod" ||
                nk === "code" ||
                (nk.includes("item") && (nk.includes("cod") || nk.includes("code")))
              );
            });
            const qtyEntry = entries.find(([k]) => targetKeys.has(normalizeKey(k)));
            const item_code = itemCodeEntry?.[1] ? normalizeStockItemCode(itemCodeEntry[1]) : "";
            const stock = qtyEntry?.[1];
            const meta = stockMetaFromObjectRow(row);
            return { item_code, stock, ...meta };
          })
          .filter((r) => r.item_code && r.stock !== "" && r.stock !== null && r.stock !== undefined);
      };

      const parseCsv = (text) => {
        const lines = text.split(/\r?\n/).filter(Boolean);
        if (lines.length < 2) return [];
        const headers = lines[0].split(",").map((h) => h.trim());
        return lines.slice(1).map((line, idx) => {
          const values = line.split(",").map((v) => v.trim());
          const row = { id: `${Date.now()}-${idx}` };
          headers.forEach((h, i) => {
            row[h] = values[i] ?? "";
          });
          return row;
        });
      };

      onProgress?.(35);
      let rows = [];
      let stockParseMeta = null;
      const lowerName = file?.name?.toLowerCase() ?? "";

      if (lowerName.endsWith(".csv")) {
        rows = parseCsv(await file.text());
      } else if (lowerName.endsWith(".xlsx")) {
        const buffer = await file.arrayBuffer();
        if (module === "stock-upload") {
          stockParseMeta = parseStockSheetFromXlsx(buffer, date);
          rows = [];
        } else {
          const workbook = XLSX.read(buffer, { type: "array", cellDates: true });
          const sheetName = workbook.SheetNames[0];
          const sheet = workbook.Sheets[sheetName];
          rows = XLSX.utils.sheet_to_json(sheet, { defval: "" });
        }
      }
      if (rows.length === 0 && module === "locker-master") {
        rows = [];
      }
      onProgress?.(80);

      if (module === "locker-master") {
        const result = await uploadLockerRows({ fileName: file.name, rows });
        onProgress?.(100);
        return { ...result, parsedRows: rows, uploadedAt: new Date().toISOString().slice(0, 10) };
      }

      if (module === "stock-upload") {
        let stockRows = [];
        let dateNote = "";

        if (stockParseMeta) {
          if (stockParseMeta.error) {
            throw new Error(stockParseMeta.error);
          }
          stockRows = stockParseMeta.stockRows;
          if (stockParseMeta.usedFallback && stockParseMeta.dateColumnLabel) {
            dateNote = ` Used column "${stockParseMeta.dateColumnLabel}" (latest date in file — pick that date in the date field for an exact match).`;
          }
        } else {
          stockRows = normalizeStockRowsByDateFromObjects(rows, date);
        }

        if (stockRows.length === 0) {
          throw new Error(
            "No stock values found for the selected date. Pick the date that matches a column header in your sheet, or ensure ITEM COD and numeric stock cells are present."
          );
        }
        const result = await uploadStockRows({
          date,
          fileName: file.name,
          stockRows,
        });
        onProgress?.(100);
        return {
          ...result,
          uploadedAt: new Date().toISOString().slice(0, 10),
          parsedRows: stockRows,
          stockDateNote: dateNote,
        };
      }

      if (module === "bom-manager") {
        const result = await uploadBomRows({
          locker_model: date,
          fileName: file.name,
          rows,
        });
        onProgress?.(100);
        return { ...result, uploadedAt: new Date().toISOString().slice(0, 10), parsedRows: rows };
      }

      onProgress?.(100);
      return { success: true, parsedRows: rows };
    },
  });

export const useAddLocker = () =>
  useMutation({
    mutationFn: addLocker,
  });

export const useDeleteLocker = () =>
  useMutation({
    mutationFn: deleteLocker,
  });

export const useUpdateLocker = () =>
  useMutation({
    mutationFn: updateLocker,
  });

export const useAddCustomBom = () =>
  useMutation({
    mutationFn: addCustomBom,
  });

export const useDeleteBomByModel = () =>
  useMutation({
    mutationFn: deleteBomByModel,
  });

export const useUpdateBomRow = () =>
  useMutation({
    mutationFn: updateBomRow,
  });

export const useDeleteBomRow = () =>
  useMutation({
    mutationFn: deleteBomRow,
  });

export const useSavePlan = () =>
  useMutation({
    mutationFn: savePlanEntries,
  });

export const useUpdatePlanQuantity = () =>
  useMutation({
    mutationFn: updatePlanQuantity,
  });
