import { useMemo, useState } from "react";
import { useNavigate } from "react-router-dom";
import toast from "react-hot-toast";
import DataTable from "../components/DataTable";
import { useSavePlan, useLockerMaster } from "../hooks/useMrpData";
import { useQueryClient } from "@tanstack/react-query";

function PlanEntryPage() {
  const [date, setDate] = useState(() => new Date().toISOString().slice(0, 10));
  const [rows, setRows] = useState([]);
  const [form, setForm] = useState({ locker_item_code: "", quantity: "1" });
  const navigate = useNavigate();
  const queryClient = useQueryClient();
  const savePlanMutation = useSavePlan();
  const { data: lockers = [] } = useLockerMaster();

  const lockerCodes = useMemo(() => lockers.map((l) => l.locker_code).filter(Boolean), [lockers]);

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
      await queryClient.invalidateQueries({ queryKey: ["mrpResults"] });
      toast.success("Plan saved. Opening MRP results…");
      navigate("/mrp-calculate", { state: snapshot });
    } catch (error) {
      toast.error(error?.message || "Failed to save plan");
    }
  };

  return (
    <div className="space-y-6">
      <div>
        <h2 className="text-xl font-bold text-slate-900">Plan Entry</h2>
        <p className="mt-1 text-sm text-slate-500">
          Add locker codes and quantities, then calculate material requirements.
        </p>
      </div>

      <section className="rounded-xl border border-border bg-white p-6 shadow-card">
        <div className="mb-5 max-w-xs">
          <label htmlFor="plan-date" className="mb-1 block text-sm font-medium text-slate-700">
            Date
          </label>
          <input
            id="plan-date"
            type="date"
            value={date}
            onChange={(e) => setDate(e.target.value)}
            className="w-full rounded-lg border border-border px-3 py-2.5 text-sm"
          />
        </div>

        <div className="flex flex-col gap-3 sm:flex-row sm:items-end">
          <div className="min-w-0 flex-1">
            <label className="mb-1 block text-sm font-medium text-slate-700">Locker item code</label>
            <input
              list="planLockerCodes"
              placeholder="Locker Item Code"
              value={form.locker_item_code}
              onChange={(e) => setForm((p) => ({ ...p, locker_item_code: e.target.value }))}
              className="w-full rounded-lg border border-border px-4 py-3 text-sm"
            />
            <datalist id="planLockerCodes">
              {lockerCodes.map((c) => (
                <option key={c} value={c} />
              ))}
            </datalist>
          </div>
          <div className="w-full sm:w-28">
            <label className="mb-1 block text-sm font-medium text-slate-700">Qty</label>
            <input
              type="number"
              min={1}
              placeholder="1"
              value={form.quantity}
              onChange={(e) => setForm((p) => ({ ...p, quantity: e.target.value }))}
              className="w-full rounded-lg border border-border px-3 py-3 text-sm"
            />
          </div>
          <button
            type="button"
            onClick={addRow}
            className="rounded-lg bg-success px-5 py-3 text-sm font-semibold text-white hover:opacity-95 sm:shrink-0"
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
                    className="text-sm font-medium text-danger underline decoration-danger/80 hover:opacity-80"
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

        <div className="mt-6 flex justify-end border-t border-border pt-6">
          <button
            type="button"
            disabled={savePlanMutation.isPending}
            onClick={handleCalculate}
            className="rounded-lg border-2 border-border bg-white px-8 py-2.5 text-sm font-semibold text-slate-800 shadow-sm hover:bg-slate-50 disabled:cursor-not-allowed disabled:opacity-60"
          >
            {savePlanMutation.isPending ? "Saving…" : "Calculate Materials"}
          </button>
        </div>
      </section>
    </div>
  );
}

export default PlanEntryPage;
