import { useMemo, useState, useEffect } from "react";
import { useLocation } from "react-router-dom";
import DataTable from "../components/DataTable";
import SkeletonTable from "../components/SkeletonTable";
import { useMrpResults } from "../hooks/useMrpData";

function StatCard({ title, value, tone = "default" }) {
  const toneClass =
    tone === "danger" ? "text-danger" : tone === "success" ? "text-success" : "text-slate-900";
  return (
    <div className="rounded-xl border border-border bg-white p-4 shadow-card">
      <p className="text-sm text-slate-500">{title}</p>
      <p className={`mt-2 text-2xl font-bold ${toneClass}`}>{value}</p>
    </div>
  );
}

function formatPlanDate(iso) {
  if (!iso) return "—";
  const [y, m, d] = iso.split("-");
  if (!y || !m || !d) return iso;
  return `${d}-${m}-${y}`;
}

function MrpOutputPage() {
  const location = useLocation();
  const { data = [], isLoading } = useMrpResults();
  const [showWarnings, setShowWarnings] = useState(true);
  const [downloading, setDownloading] = useState(false);
  const [planSnapshot, setPlanSnapshot] = useState(null);

  useEffect(() => {
    if (location.state?.date && location.state?.rows) {
      setPlanSnapshot(location.state);
      return;
    }
    try {
      const raw = sessionStorage.getItem("mrp_plan_snapshot");
      if (raw) setPlanSnapshot(JSON.parse(raw));
    } catch {
      setPlanSnapshot(null);
    }
  }, [location.state]);

  const stats = useMemo(() => {
    const shortages = data.filter((d) => d.status === "LOW").length;
    const ok = data.filter((d) => d.status === "OK").length;
    return { total: data.length, shortages, ok };
  }, [data]);

  const warningItems = useMemo(() => data.filter((d) => d.status === "LOW").slice(0, 10), [data]);

  return (
    <div className="space-y-4">
      <div>
        <h2 className="text-xl font-bold text-slate-900">MRP output</h2>
        <p className="mt-1 text-sm text-slate-500">Material requirement planning — shortages and coverage by component.</p>
      </div>

      {planSnapshot?.rows?.length > 0 && (
        <section className="rounded-xl border border-border bg-white p-4 shadow-card">
          <h3 className="text-sm font-semibold text-slate-800">Plan used for this run</h3>
          <p className="mt-1 text-xs text-slate-500">Date: {formatPlanDate(planSnapshot.date)}</p>
          <div className="mt-3">
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

      <div className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
        <div className="grid flex-1 gap-3 sm:grid-cols-3">
          <StatCard title="Total materials" value={stats.total} />
          <StatCard title="Shortages" value={stats.shortages} tone="danger" />
          <StatCard title="OK" value={stats.ok} tone="success" />
        </div>
        <button
          disabled={downloading || isLoading || data.length === 0}
          onClick={() => {
            setDownloading(true);
            const headers = [
              "material_name",
              "component_type",
              "item_code",
              "required_quantity",
              "stock_available",
              "difference",
              "status",
            ];
            const lines = data.map((r) =>
              [
                r.material_name,
                r.component_type,
                r.item_code,
                r.required_quantity,
                r.stock_available,
                r.difference,
                r.status,
              ].join(",")
            );
            const csv = [headers.join(","), ...lines].join("\n");
            const blob = new Blob([csv], { type: "text/csv;charset=utf-8;" });
            const url = URL.createObjectURL(blob);
            const a = document.createElement("a");
            a.href = url;
            a.download = `mrp-output-${new Date().toISOString().slice(0, 10)}.csv`;
            a.click();
            URL.revokeObjectURL(url);
            setDownloading(false);
          }}
          className="shrink-0 rounded-lg bg-primary px-4 py-2 text-sm font-semibold text-white disabled:cursor-not-allowed disabled:opacity-60"
        >
          {downloading ? "Preparing…" : "Download Excel"}
        </button>
      </div>

      {isLoading ? (
        <SkeletonTable />
      ) : (
        <DataTable
          columns={[
            { key: "material_name", label: "material_name" },
            { key: "component_type", label: "component_type" },
            { key: "item_code", label: "item_code" },
            { key: "required_quantity", label: "required_quantity" },
            { key: "stock_available", label: "stock_available" },
            { key: "difference", label: "difference" },
            {
              key: "status",
              label: "status",
              render: (status) => (
                <span
                  className={`rounded-full px-2 py-1 text-xs font-semibold ${
                    status === "LOW" ? "bg-danger text-white" : "bg-success text-white"
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
              ? { backgroundColor: "#FEE2E2" }
              : row.status === "OK"
              ? { backgroundColor: "#DCFCE7" }
              : undefined
          }
          emptyText={
            planSnapshot?.rows?.length
              ? "No requirements computed. Ensure this locker code exists in Locker Master and BOM locker_model matches locker model / product / subtype (or upload BOM for that locker)."
              : "No MRP output — add a plan and click Calculate Materials."
          }
        />
      )}

      <section className="rounded-xl border border-border bg-white p-4 shadow-card">
        <button
          type="button"
          onClick={() => setShowWarnings((p) => !p)}
          className="w-full text-left text-sm font-semibold text-slate-800"
        >
          Warnings {showWarnings ? "−" : "+"}
        </button>
        {showWarnings && (
          <div className="mt-3 text-sm text-slate-600">
            {warningItems.length === 0 ? (
              <p>No shortage warnings in the current result set.</p>
            ) : (
              <ul className="list-disc space-y-1 pl-5">
                {warningItems.map((r) => (
                  <li key={r.item_code}>
                    <span className="font-medium text-slate-800">{r.item_code}</span> — required{" "}
                    {r.required_quantity}, stock {r.stock_available}, short by {Math.abs(r.difference)}.
                  </li>
                ))}
              </ul>
            )}
          </div>
        )}
      </section>
    </div>
  );
}

export default MrpOutputPage;
