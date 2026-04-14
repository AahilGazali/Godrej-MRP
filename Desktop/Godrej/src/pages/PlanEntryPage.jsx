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

  const lockerOptions = useMemo(
    () =>
      lockers
        .filter((l) => l.locker_code)
        .map((l) => ({
          code: l.locker_code,
          label: [l.product, l.subtype].filter(Boolean).join(" – "),
        })),
    [lockers],
  );

  const addRow = () => {
    if (!form.locker_item_code?.trim()) {
      toast.error("Select a locker model");
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
      <div className="border-b border-gray-200 pb-4">
        <h2 className="text-2xl font-semibold text-gray-900">Plan Entry</h2>
        <p className="mt-1 text-sm text-gray-600">
          Add locker codes and quantities, then calculate material requirements.
        </p>
      </div>

      <section className="rounded-lg border border-gray-200 bg-white p-6 shadow-sm">
        <div className="mb-6 max-w-xs">
          <label htmlFor="plan-date" className="mb-1 block text-xs font-medium uppercase tracking-wide text-gray-500">
            Date
          </label>
          <input
            id="plan-date"
            type="date"
            value={date}
            onChange={(e) => setDate(e.target.value)}
            className="h-10 w-full rounded-lg border border-gray-300 px-3 text-sm text-gray-700 outline-none focus:border-transparent focus:ring-2 focus:ring-blue-500"
          />
        </div>

        <div className="flex flex-col gap-4 sm:flex-row sm:items-end">
          <div className="min-w-0 flex-1">
            <label className="mb-1 block text-xs font-medium uppercase tracking-wide text-gray-500">Locker Model</label>
            <select
              value={form.locker_item_code}
              onChange={(e) => setForm((p) => ({ ...p, locker_item_code: e.target.value }))}
              className="h-10 w-full rounded-lg border border-gray-300 bg-white px-3 text-sm text-gray-700 outline-none focus:border-transparent focus:ring-2 focus:ring-blue-500"
            >
              <option value="">Select Locker Model</option>
              {lockerOptions.map((o) => (
                <option key={o.code} value={o.code}>
                  {o.label}
                </option>
              ))}
            </select>
          </div>
          {form.locker_item_code && (
            <div className="min-w-0 flex-1 sm:max-w-xs">
              <label className="mb-1 block text-xs font-medium uppercase tracking-wide text-gray-500">Item Code</label>
              <input
                readOnly
                value={form.locker_item_code}
                className="h-10 w-full rounded-lg border border-gray-200 bg-gray-50 px-3 text-sm text-gray-500 outline-none"
              />
            </div>
          )}
          <div className="w-full sm:w-28">
            <label className="mb-1 block text-xs font-medium uppercase tracking-wide text-gray-500">Qty</label>
            <input
              type="number"
              min={1}
              placeholder="1"
              value={form.quantity}
              onChange={(e) => setForm((p) => ({ ...p, quantity: e.target.value }))}
              className="h-10 w-full rounded-lg border border-gray-300 px-3 text-sm text-gray-700 outline-none focus:border-transparent focus:ring-2 focus:ring-blue-500"
            />
          </div>
          <button
            type="button"
            onClick={addRow}
            className="rounded-lg bg-success px-5 py-3 text-sm font-semibold text-white transition-opacity duration-150 hover:opacity-95 sm:shrink-0"
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

        <div className="mt-6 flex justify-end border-t border-gray-200 pt-6">
          <button
            type="button"
            disabled={savePlanMutation.isPending}
            onClick={handleCalculate}
            className="rounded-lg bg-blue-600 px-8 py-2.5 text-sm font-medium text-white transition-colors duration-150 hover:bg-blue-700 disabled:cursor-not-allowed disabled:opacity-50"
          >
            {savePlanMutation.isPending ? "Saving…" : "Calculate Materials"}
          </button>
        </div>
      </section>
    </div>
  );
}

export default PlanEntryPage;
