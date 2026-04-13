import { useEffect, useMemo, useState } from "react";
import { useNavigate } from "react-router-dom";
import toast from "react-hot-toast";
import DataTable from "../components/DataTable";
import { useSavePlan, useLockerMaster } from "../hooks/useMrpData";
import { useQueryClient } from "@tanstack/react-query";

const PLAN_ENTRY_DRAFT_KEY = "plan_entry_draft";

function readPlanEntryDraft() {
  try {
    const raw = sessionStorage.getItem(PLAN_ENTRY_DRAFT_KEY);
    if (!raw) return { date: null, rows: [] };
    const parsed = JSON.parse(raw);
    if (!parsed || typeof parsed !== "object") return { date: null, rows: [] };
    const dateOk =
      typeof parsed.date === "string" && /^\d{4}-\d{2}-\d{2}$/.test(parsed.date.trim());
    const date = dateOk ? parsed.date.trim() : null;
    if (!Array.isArray(parsed.rows)) return { date, rows: [] };
    const rows = parsed.rows
      .filter(
        (r) =>
          r &&
          typeof r.locker_item_code === "string" &&
          r.locker_item_code.trim() !== "" &&
          typeof r.quantity === "number" &&
          !Number.isNaN(r.quantity) &&
          r.quantity > 0
      )
      .map((r, i) => ({
        id: typeof r.id === "number" && r.id > 0 ? r.id : Date.now() + i,
        locker_item_code: String(r.locker_item_code).trim(),
        subtype: typeof r.subtype === "string" ? r.subtype : "Standard",
        quantity: r.quantity,
      }));
    return { date, rows };
  } catch {
    return { date: null, rows: [] };
  }
}

function PlanEntryPage() {
  const [date, setDate] = useState(() => {
    const { date: d } = readPlanEntryDraft();
    return d ?? new Date().toISOString().slice(0, 10);
  });
  const [rows, setRows] = useState(() => readPlanEntryDraft().rows);
  const [form, setForm] = useState({ locker_item_code: "", quantity: "1" });
  const navigate = useNavigate();
  const queryClient = useQueryClient();
  const savePlanMutation = useSavePlan();
  const { data: lockers = [] } = useLockerMaster();

  const lockerCodes = useMemo(() => lockers.map((l) => l.locker_code).filter(Boolean), [lockers]);

  useEffect(() => {
    try {
      sessionStorage.setItem(PLAN_ENTRY_DRAFT_KEY, JSON.stringify({ date, rows }));
    } catch {
      /* ignore quota / private mode */
    }
  }, [date, rows]);

  const addRow = () => {
    if (!form.locker_item_code?.trim()) {
      toast.error("Enter a locker item code");
      return;
    }
    const qty = Number(form.quantity);
    if (!form.quantity || Number.isNaN(qty) || qty <= 0) {
      toast.error("Enter a valid quantity");
      return;
    }
    setRows((prev) => [
      ...prev,
      {
        id: Date.now(),
        locker_item_code: form.locker_item_code.trim(),
        subtype: "Standard",
        quantity: qty,
      },
    ]);
    setForm({ locker_item_code: "", quantity: "1" });
  };

  const removeRow = (id) => setRows((prev) => prev.filter((r) => r.id !== id));

  const handleCalculate = async () => {
    if (!date || rows.length === 0) {
      toast.error("Select a date and add at least one locker line");
      return;
    }
    try {
      await savePlanMutation.mutateAsync({ date, rows });
      const snapshot = {
        date,
        rows: rows.map(({ locker_item_code, quantity }) => ({ locker_item_code, quantity })),
      };
      sessionStorage.setItem("mrp_plan_snapshot", JSON.stringify(snapshot));
      sessionStorage.removeItem(PLAN_ENTRY_DRAFT_KEY);
      await queryClient.invalidateQueries({ queryKey: ["mrpResults"] });
      toast.success("Plan saved. Opening MRP results…");
      navigate("/mrp-calculate", { state: snapshot });
    } catch (error) {
      toast.error(error?.message || "Failed to save plan");
    }
  };

  return (
    <div className="space-y-6">
      <div className="border-b border-[#810055]/20 pb-4">
        <h2 className="text-2xl font-semibold text-black">Plan Entry</h2>
        <p className="mt-1 text-sm text-black">
          Add locker codes and quantities, then calculate material requirements.
        </p>
      </div>

      <section className="rounded-lg border border-[#810055]/20 bg-white p-6 shadow-sm">
        <div className="mb-6 max-w-xs">
          <label htmlFor="plan-date" className="mb-1 block text-xs font-medium uppercase tracking-wide text-black">
            Date
          </label>
          <input
            id="plan-date"
            type="date"
            value={date}
            onChange={(e) => setDate(e.target.value)}
            className="h-10 w-full rounded-lg border border-[#810055]/30 px-3 text-sm text-black outline-none focus:border-transparent focus:ring-2 focus:ring-secondary"
          />
        </div>

        <div className="flex flex-col gap-4 sm:flex-row sm:items-end">
          <div className="min-w-0 flex-1">
            <label className="mb-1 block text-xs font-medium uppercase tracking-wide text-black">Locker item code</label>
            <input
              list="planLockerCodes"
              placeholder="Locker Item Code"
              value={form.locker_item_code}
              onChange={(e) => setForm((p) => ({ ...p, locker_item_code: e.target.value }))}
              className="h-10 w-full rounded-lg border border-[#810055]/30 px-3 text-sm text-black outline-none focus:border-transparent focus:ring-2 focus:ring-secondary"
            />
            <datalist id="planLockerCodes">
              {lockerCodes.map((c) => (
                <option key={c} value={c} />
              ))}
            </datalist>
          </div>
          <div className="w-full sm:w-28">
            <label className="mb-1 block text-xs font-medium uppercase tracking-wide text-black">Qty</label>
            <input
              type="number"
              min={1}
              placeholder="1"
              value={form.quantity}
              onChange={(e) => setForm((p) => ({ ...p, quantity: e.target.value }))}
              className="h-10 w-full rounded-lg border border-[#810055]/30 px-3 text-sm text-black outline-none focus:border-transparent focus:ring-2 focus:ring-secondary"
            />
          </div>
          <button
            type="button"
            onClick={addRow}
            className="rounded-lg bg-secondary px-5 py-3 text-sm font-semibold text-white transition-opacity duration-150 hover:opacity-95 sm:shrink-0"
          >
            + Add Locker
          </button>
        </div>

        <div className="mt-6">
          <DataTable
            showSearch={false}
            columns={[
              { key: "locker_item_code", label: "Locker Item Code" },
              { key: "quantity", label: "Quantity" },
              {
                key: "action",
                label: "",
                render: (_v, row) => (
                  <button
                    type="button"
                    onClick={() => removeRow(row.id)}
                    className="rounded-lg bg-red-50 px-2 py-1 text-sm font-medium text-red-600 transition-colors duration-150 hover:bg-red-100"
                  >
                    Delete
                  </button>
                ),
              },
            ]}
            rows={rows}
            emptyText="No items added yet"
          />
        </div>

        <div className="mt-6 flex justify-end border-t border-[#810055]/20 pt-6">
          <button
            type="button"
            disabled={savePlanMutation.isPending}
            onClick={handleCalculate}
            className="rounded-lg bg-secondary px-8 py-2.5 text-sm font-medium text-white transition-colors duration-150 hover:bg-secondary disabled:cursor-not-allowed disabled:opacity-50"
          >
            {savePlanMutation.isPending ? "Saving…" : "Calculate Materials"}
          </button>
        </div>
      </section>
    </div>
  );
}

export default PlanEntryPage;
