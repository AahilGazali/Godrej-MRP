import { useMemo, useState, useEffect } from "react";
import { useLocation } from "react-router-dom";
import DataTable from "../components/DataTable";
import SkeletonTable from "../components/SkeletonTable";
import { useBom, useLockerMaster, useMrpResults } from "../hooks/useMrpData";

function StatCard({ title, value, tone = "default" }) {
  const wrap =
    tone === "danger"
      ? "border-[#810055]/40 bg-red-50"
      : tone === "success"
        ? "border-[#008000]/40 bg-green-50"
        : "border-[#810055]/40 bg-white";
  const num =
    tone === "danger" ? "text-red-600" : tone === "success" ? "text-green-600" : "text-secondary";
  return (
    <div className={`rounded-lg border p-5 shadow-sm ${wrap}
    transition-all duration-300 ease-in-out
    hover:shadow-md hover:-translate-y-1 hover:scale-[1.02] cursor-pointer`}>
      <p className="text-sm text-black">{title}</p>
      <p className={`mt-1 text-3xl font-bold ${num}`}>{value}</p>
    </div>
  );
}

function formatPlanDate(iso) {
  if (!iso) return "—";
  const [y, m, d] = iso.split("-");
  if (!y || !m || !d) return iso;
  return `${d}-${m}-${y}`;
}

function getSubtypeMultiplier(subtype) {
  const match = String(subtype ?? "").match(/(\d+)/);
  const value = match ? Number(match[1]) : 1;
  return Number.isFinite(value) && value > 0 ? value : 1;
}

function normalizeTraceKey(value) {
  return String(value ?? "").trim().toLowerCase().replace(/[^a-z0-9]+/g, "");
}

function normalizeWhitespaceKey(value) {
  return String(value ?? "").trim().toLowerCase().replace(/\s+/g, "");
}

function bomMatchesLocker(bomLockerModel, locker) {
  const exactKey = String(bomLockerModel ?? "").trim().toLowerCase();
  const compactKey = normalizeWhitespaceKey(bomLockerModel);
  const traceKey = normalizeTraceKey(bomLockerModel);
  if (!traceKey || !locker) return false;

  const candidates = [
    locker.locker_code,
    locker.product,
    locker.subtype,
    `${locker.product ?? ""}${locker.subtype ?? ""}`,
    `${locker.product ?? ""} ${locker.subtype ?? ""}`,
    `${locker.subtype ?? ""}${locker.product ?? ""}`,
  ]
    .map((value) => String(value ?? "").trim())
    .filter(Boolean);

  return candidates.some((candidate) => {
    const candidateTraceKey = normalizeTraceKey(candidate);
    if (!candidateTraceKey) return false;

    return (
      candidate.toLowerCase() === exactKey ||
      normalizeWhitespaceKey(candidate) === compactKey ||
      candidateTraceKey === traceKey ||
      (traceKey.length >= 3 && candidateTraceKey.includes(traceKey)) ||
      (candidateTraceKey.length >= 3 && traceKey.includes(candidateTraceKey))
    );
  });
}

function MrpOutputPage() {
  const location = useLocation();
  const { data = [], isLoading } = useMrpResults();
  const { data: lockers = [] } = useLockerMaster();
  const { data: bomData = [] } = useBom();
  const [showWarnings, setShowWarnings] = useState(true);
  const [downloading, setDownloading] = useState(false);
  const [planSnapshot, setPlanSnapshot] = useState(null);

  useEffect(() => {
    if (location.state?.date && location.state?.rows) {
      setPlanSnapshot(location.state);
      try {
        sessionStorage.setItem("mrp_plan_snapshot", JSON.stringify(location.state));
        localStorage.setItem("mrp_plan_snapshot", JSON.stringify(location.state));
      } catch {
        /* ignore storage issues */
      }
      return;
    }
    try {
      const raw = sessionStorage.getItem("mrp_plan_snapshot") || localStorage.getItem("mrp_plan_snapshot");
      if (raw) {
        setPlanSnapshot(JSON.parse(raw));
        return;
      }
      setPlanSnapshot(null);
    } catch {
      setPlanSnapshot(null);
    }
  }, [location.state]);

  const stats = useMemo(() => {
    const shortages = data.filter((d) => d.status === "LOW").length;
    const ok = data.filter((d) => d.status === "OK").length;
    const lockerMap = new Map(
      lockers.map((locker) => [String(locker.locker_code ?? "").trim().toLowerCase(), locker])
    );

    const planRows = Array.isArray(planSnapshot?.rows) ? planSnapshot.rows : [];
    const totals = planRows.reduce(
      (acc, row) => {
        const quantity = Number(row.quantity) || 0;
        if (quantity <= 0) return acc;

        acc.totalLockers += quantity;
        const key = String(row.locker_item_code ?? "").trim().toLowerCase();
        const subtype = lockerMap.get(key)?.subtype;
        acc.totalBoxes += quantity * getSubtypeMultiplier(subtype);
        return acc;
      },
      { totalLockers: 0, totalBoxes: 0 }
    );

    return { total: data.length, shortages, ok, ...totals };
  }, [data, lockers, planSnapshot]);

  const warningItems = useMemo(() => data.filter((d) => d.status === "LOW").slice(0, 10), [data]);

  const sourcesMap = useMemo(() => {
    const result = new Map();

    // Build locker lookup: locker_code → locker object
    const lockerByCode = new Map(
      lockers.map((l) => [String(l.locker_code ?? "").trim(), l])
    );

    // Build all possible locker_model keys for a locker
    function getLockerModelKeys(locker) {
      if (!locker) return new Set();
      const product = String(locker.product ?? "").trim();
      const subtype = String(locker.subtype ?? "").trim();
      const keys = new Set();

      // Normalize: lowercase, remove hyphens, collapse spaces
      const norm = (s) => s.toLowerCase().replace(/-/g, " ").replace(/\s+/g, " ").trim();
      const compact = (s) => s.toLowerCase().replace(/[-\s]/g, "");

      const p = norm(product);
      const s = norm(subtype);

      // Add all combinations
      [
        `${p} ${s}`,
        `${p}${s}`,
        `${s} ${p}`,
        `${s}${p}`,
        compact(`${p}${s}`),
        compact(`${product}${subtype}`),
        p,
        s,
      ]
        .map((k) => k.trim())
        .filter(Boolean)
        .forEach((k) => keys.add(k));

      return keys;
    }

    for (const mrpRow of data) {
      if (mrpRow.status !== "LOW") continue;

      const materialCode = String(mrpRow.item_code ?? "").trim();
      if (!materialCode) continue;

      const sourceMap = new Map();

      for (const planRow of planSnapshot?.rows ?? []) {
        const planQty = Number(planRow.quantity) || 0;
        if (planQty <= 0) continue;

        const planLockerCode = String(planRow.locker_item_code ?? "").trim();

        // Step 1: Find locker in locker master
        const locker = lockerByCode.get(planLockerCode);
        if (!locker) continue;

        // Step 2: Get all valid locker_model keys for this locker
        const validModelKeys = getLockerModelKeys(locker);

        // Step 3: Find BOM rows where:
        //   - bom.item_code === materialCode (exact)
        //   - bom.locker_model matches one of the locker's keys
        const matchingBomRows = bomData.filter((bom) => {
          const bomItemCode = String(bom.item_code ?? "").trim();
          const bomLockerModel = String(bom.locker_model ?? "")
            .trim()
            .toLowerCase()
            .replace(/-/g, " ")
            .replace(/\s+/g, " ");
          return (
            bomItemCode === materialCode &&
            validModelKeys.has(bomLockerModel)
          );
        });

        for (const bom of matchingBomRows) {
          const bomQty = Number(bom.net_quantity ?? bom.qty ?? 0) || 0;
          if (bomQty <= 0) continue;

          const contribution = bomQty * planQty;
          sourceMap.set(
            planLockerCode,
            (sourceMap.get(planLockerCode) || 0) + contribution
          );
        }
      }

      if (sourceMap.size > 0) {
        result.set(
          materialCode,
          Array.from(sourceMap.entries())
            .map(([locker_item_code, quantity]) => ({ locker_item_code, quantity }))
            .sort((a, b) => b.quantity - a.quantity)
        );
      }
    }

    return result;
  }, [bomData, data, lockers, planSnapshot]);

  const handleDownload = () => {
    setDownloading(true);
    const headers = [
      "SR NO.",
      "ITEM CODE",
      "Material",
      "LN Description",
      "Short Description",
      "required_quantity",
      "stock_available",
      "difference",
      "status",
    ];
    const lines = data.map((r) =>
      [
        r.sr_no,
        r.item_code,
        r.material,
        r.ln_description,
        r.short_description,
        r.required_quantity,
        r.stock_available,
        r.difference,
        r.status,
      ].join(",")
    );
    // --- existing first table ---
    const firstTable = [headers.join(","), ...lines];

    // --- spacer (blank lines) ---
    const spacer = ["", "", ""]; // 3 blank lines (adjust if needed)

    // --- second table (Plan Snapshot) ---
    const secondHeaders = ["Locker Item Code", "Quantity"];

    const secondLines = (planSnapshot?.rows || []).map((r) =>
      [
        r.locker_item_code ?? "",
        r.quantity ?? "",
      ].join(",")
    );

    const secondTable =
      secondLines.length > 0
        ? [secondHeaders.join(","), ...secondLines]
        : [];

    // --- final CSV ---
    const csv = [...firstTable, ...spacer, ...secondTable].join("\n");
    const blob = new Blob([csv], { type: "text/csv;charset=utf-8;" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = `mrp-output-${new Date().toISOString().slice(0, 10)}.csv`;
    a.click();
    URL.revokeObjectURL(url);
    setDownloading(false);
  };

  return (
    <div className="space-y-6">
      {planSnapshot?.rows?.length > 0 && (
        <section className="rounded-lg border border-[#810055]/20 bg-white p-6 shadow-sm">
          <h3 className="text-lg font-medium text-black">Plan used for this run</h3>
          <p className="mt-1 text-xs font-medium uppercase tracking-wide text-black">Date: {formatPlanDate(planSnapshot.date)}</p>
          <div className="mt-4">
            <DataTable
              showSearch={false}
              columns={[
                { key: "locker_item_code", label: "Locker Item Code" },
                { key: "quantity", label: "Quantity" },
              ]}
              rows={planSnapshot.rows.map((r, i) => ({ ...r, id: i }))}
              emptyText="No plan rows"
            />
          </div>
        </section>
      )}

      <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 xl:grid-cols-5">
        <StatCard title="Total materials" value={stats.total} />
        <StatCard title="Shortages" value={stats.shortages} tone="danger" />
        <StatCard title="OK" value={stats.ok} tone="success" />
        <StatCard title="Total Lockers" value={stats.totalLockers} />
        <StatCard title="Total Boxes" value={stats.totalBoxes} />
      </div>

      <section className="rounded-lg border border-[#810055]/20 bg-white p-6 shadow-sm">
        <button
          type="button"
          onClick={() => setShowWarnings((p) => !p)}
          className="w-full text-left text-sm font-semibold text-black"
        >
          Warnings {showWarnings ? "−" : "+"}
        </button>
        {showWarnings && (
          <div className="mt-3 text-sm text-black">
            {warningItems.length === 0 ? (
              <p>No shortage warnings in the current result set.</p>
            ) : (
              <ul className="list-disc space-y-1 pl-5">
                {warningItems.map((r) => {
                  const sources = sourcesMap.get(String(r.item_code ?? "").trim()) ?? [];
                  return (
                    <li key={r.item_code}>
                      <span className="font-medium text-black">{r.item_code}</span> — required{" "}
                      {r.required_quantity}, stock {r.stock_available}, short by {Math.abs(r.difference)}.
                      {sources.length > 0 && (
                        <div className="mt-1 pl-2 text-xs text-black/70">
                          <span className="font-medium">Caused by:</span>
                          <ul className="list-none mt-0.5 space-y-0.5">
                            {sources.map((s) => (
                              <li key={s.locker_item_code}>
                                → Locker <span className="font-medium">{s.locker_item_code}</span> — {s.quantity} units
                              </li>
                            ))}
                          </ul>
                        </div>
                      )}
                    </li>
                  );
                })}
              </ul>
            )}
          </div>
        )}
      </section>

      {isLoading ? (
        <SkeletonTable />
      ) : (
        <DataTable
          searchAction={
            <button
              type="button"
              disabled={downloading || isLoading || data.length === 0}
              onClick={handleDownload}
              className="rounded-lg bg-secondary px-4 py-2 text-sm font-medium text-white transition-colors duration-150 hover:bg-secondary disabled:cursor-not-allowed disabled:opacity-50"
            >
              {downloading ? "Preparing…" : "Download Excel"}
            </button>
          }
          columns={[
            { key: "sr_no", label: "SR NO.", sortable: false },
            { key: "item_code", label: "ITEM CODE" },
            {
              key: "material",
              label: "Material",
              cellClassName: "max-w-[14rem] align-top whitespace-pre-wrap break-words text-left",
            },
            {
              key: "ln_description",
              label: "LN Description",
              cellClassName: "max-w-[18rem] align-top whitespace-pre-wrap break-words text-left",
            },
            {
              key: "short_description",
              label: "Short Description",
              cellClassName: "max-w-[12rem] align-top whitespace-pre-wrap break-words text-left",
            },
            { key: "required_quantity", label: "required_quantity" },
            { key: "stock_available", label: "stock_available" },
            { key: "difference", label: "difference" },
            {
              key: "status",
              label: "status",
              sortable: false,
              render: (status) => (
                <span
                  className={`inline-flex rounded-full px-2 py-0.5 text-xs font-medium ${
                    status === "LOW" ? "bg-red-100 text-red-700" : "bg-green-100 text-green-700"
                  }`}
                >
                  {status}
                </span>
              ),
            },
          ]}
          rows={data}
          rowStyle={(row) =>
            row.status === "LOW"
              ? { backgroundColor: "#FEF2F2" }
              : row.status === "OK"
                ? { backgroundColor: "#F0FDF4" }
                : undefined
          }
          emptyText={
            planSnapshot?.rows?.length
              ? "No requirements computed. Ensure this locker code exists in Locker Master and BOM locker_model matches locker model / product / subtype (or upload BOM for that locker)."
              : "No MRP output — add a plan and click Calculate Materials."
          }
        />
      )}
    </div>
  );
}

export default MrpOutputPage;
