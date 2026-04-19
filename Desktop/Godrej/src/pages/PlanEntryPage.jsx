import { useEffect, useMemo, useRef, useState } from "react";
import { useNavigate } from "react-router-dom";
import toast from "react-hot-toast";
import DataTable from "../components/DataTable";
import { useSavePlan, useLockerMaster, useUpdatePlanQuantity } from "../hooks/useMrpData";
import { useQueryClient } from "@tanstack/react-query";

const PLAN_ENTRY_DRAFT_KEY = "plan_entry_draft";

function normalizeLockerCode(value) {
  return String(value ?? "").trim().toLowerCase();
}

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

function PlanEntryPage({ user }) {
  const [date, setDate] = useState(() => {
    const { date: d } = readPlanEntryDraft();
    return d ?? new Date().toISOString().slice(0, 10);
  });
  const [rows, setRows] = useState(() => readPlanEntryDraft().rows);
  const [form, setForm] = useState({ locker_item_code: "", quantity: "1" });
  const navigate = useNavigate();
  const queryClient = useQueryClient();
  const savePlanMutation = useSavePlan();
  const updatePlanQuantityMutation = useUpdatePlanQuantity();
  const { data: lockers = [], isLoading: lockersLoading } = useLockerMaster();
  const [editingRowId, setEditingRowId] = useState(null);
  const [editingQuantity, setEditingQuantity] = useState("");
  const [showLockerDropdown, setShowLockerDropdown] = useState(false);
  const [lockerSearch, setLockerSearch] = useState("");
  const lockerDropdownRef = useRef(null);

  const lockerCodes = useMemo(() => lockers.map((l) => l.locker_code).filter(Boolean), [lockers]);
  const lockerCodeMap = useMemo(() => {
    const map = new Map();
    for (const code of lockerCodes) {
      const normalized = normalizeLockerCode(code);
      if (normalized) map.set(normalized, code);
    }
    return map;
  }, [lockerCodes]);

  const filteredLockers = useMemo(() => {
    const query = normalizeLockerCode(lockerSearch);
    if (!query) return lockers;

    return lockers.filter((locker) => {
      const code = normalizeLockerCode(locker.locker_code);
      const product = normalizeLockerCode(locker.product);
      const subtype = normalizeLockerCode(locker.subtype);
      return code.includes(query) || product.includes(query) || subtype.includes(query);
    });
  }, [lockers, lockerSearch]);

  useEffect(() => {
    try {
      sessionStorage.setItem(PLAN_ENTRY_DRAFT_KEY, JSON.stringify({ date, rows }));
    } catch {
      /* ignore quota / private mode */
    }
  }, [date, rows]);

  useEffect(() => {
    const handleClickOutside = (event) => {
      if (lockerDropdownRef.current && !lockerDropdownRef.current.contains(event.target)) {
        setShowLockerDropdown(false);
      }
    };

    document.addEventListener("mousedown", handleClickOutside);
    return () => document.removeEventListener("mousedown", handleClickOutside);
  }, []);

  const addRow = () => {
    const enteredCode = String(form.locker_item_code ?? "").trim();
    if (!enteredCode) {
      toast.error("Select a locker model");
      return;
    }
    if (lockersLoading) {
      toast.error("Locker Master is still loading. Try again in a moment.");
      return;
    }
    const normalizedCode = normalizeLockerCode(enteredCode);
    const matchedLockerCode = lockerCodeMap.get(normalizedCode);
    if (!matchedLockerCode) {
      toast.error("Locker item code does not exist in Locker Master");
      return;
    }
    const alreadyAdded = rows.some((row) => normalizeLockerCode(row.locker_item_code) === normalizedCode);
    if (alreadyAdded) {
      toast.error("This locker item code has already been added");
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
        locker_item_code: matchedLockerCode,
        subtype: "Standard",
        quantity: qty,
      },
    ]);
    setForm({ locker_item_code: "", quantity: "1" });
  };

  const removeRow = (id) => setRows((prev) => prev.filter((r) => r.id !== id));

  const startEditQuantity = (row) => {
    setEditingRowId(row.id);
    setEditingQuantity(String(row.quantity ?? ""));
  };

  const cancelEditQuantity = () => {
    setEditingRowId(null);
    setEditingQuantity("");
  };

  const saveEditQuantity = async (row) => {
    const nextQty = Number(editingQuantity);
    if (!editingQuantity || Number.isNaN(nextQty) || nextQty <= 0) {
      toast.error("Enter a valid quantity");
      return;
    }

    setRows((prev) => prev.map((r) => (r.id === row.id ? { ...r, quantity: nextQty } : r)));

    try {
      await updatePlanQuantityMutation.mutateAsync({
        date,
        locker_item_code: row.locker_item_code,
        quantity: nextQty,
      });
    } catch (error) {
      const status = error?.response?.status;
      if (status !== 404) {
        toast.error(error?.response?.data?.message || error?.message || "Failed to update quantity");
        return;
      }
    }

    cancelEditQuantity();
    toast.success("Quantity updated");
  };

  const handleCalculate = async () => {
    if (!date || rows.length === 0) {
      toast.error("Select a date and add at least one locker line");
      return;
    }
    const invalidRow = rows.find((row) => !lockerCodeMap.has(normalizeLockerCode(row.locker_item_code)));
    if (invalidRow) {
      toast.error(`Locker item code \"${invalidRow.locker_item_code}\" does not exist in Locker Master`);
      return;
    }
    const seenCodes = new Set();
    const duplicateRow = rows.find((row) => {
      const normalizedCode = normalizeLockerCode(row.locker_item_code);
      if (seenCodes.has(normalizedCode)) return true;
      seenCodes.add(normalizedCode);
      return false;
    });
    if (duplicateRow) {
      toast.error(`Locker item code \"${duplicateRow.locker_item_code}\" is duplicated in the plan`);
      return;
    }
    try {
      await savePlanMutation.mutateAsync({ date, rows });
      const snapshot = {
        date,
        rows: rows.map(({ locker_item_code, quantity }) => ({ locker_item_code, quantity })),
      };
      sessionStorage.setItem("mrp_plan_snapshot", JSON.stringify(snapshot));
      localStorage.setItem("mrp_plan_snapshot", JSON.stringify(snapshot));
      sessionStorage.removeItem(PLAN_ENTRY_DRAFT_KEY);
      await queryClient.invalidateQueries({ queryKey: ["mrpResults"] });
      toast.success("Plan saved. Opening MRP results…");
      navigate("/mrp-calculate", { state: snapshot });
    } catch (error) {
      toast.error(error?.response?.data?.message || error?.message || "Failed to save plan");
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
          <div className="min-w-0 flex-1 relative" ref={lockerDropdownRef}>
            <label className="mb-1 block text-xs font-medium uppercase tracking-wide text-black">
              Locker item code
            </label>
            <div className="relative">
              <input
                type="text"
                placeholder="Select or type locker code"
                value={lockerSearch}
                onFocus={() => setShowLockerDropdown(true)}
                onChange={(e) => {
                  const value = e.target.value;
                  setLockerSearch(value);
                  setForm((p) => ({ ...p, locker_item_code: value }));
                  setShowLockerDropdown(true);
                }}
                className="h-10 w-full rounded-lg border border-[#810055]/30 px-3 pr-10 text-sm text-black outline-none focus:border-transparent focus:ring-2 focus:ring-secondary"
              />
              <button
                type="button"
                onClick={() => setShowLockerDropdown((prev) => !prev)}
                className="absolute inset-y-0 right-0 flex items-center px-3 text-secondary"
              >
                ▾
              </button>
            </div>
            {showLockerDropdown && (
              <div className="absolute z-20 mt-1 max-h-64 w-full overflow-y-auto rounded-lg border border-[#810055]/30 bg-white shadow-lg">
                <button
                  type="button"
                  onClick={() => {
                    setLockerSearch("");
                    setForm((p) => ({ ...p, locker_item_code: "" }));
                    setShowLockerDropdown(false);
                  }}
                  className="block w-full border-b border-[#810055]/10 px-3 py-2 text-left text-sm text-gray-500 hover:bg-[#f9ecf5]"
                >
                  Select Locker
                </button>
                {filteredLockers.length === 0 ? (
                  <div className="px-3 py-2 text-sm text-gray-500">No matching lockers found</div>
                ) : (
                  filteredLockers.map((l) => (
                    <button
                      type="button"
                      key={l.locker_code}
                      onClick={() => {
                        setLockerSearch(l.locker_code);
                        setForm((p) => ({ ...p, locker_item_code: l.locker_code }));
                        setShowLockerDropdown(false);
                      }}
                      className="block w-full px-3 py-2 text-left text-sm text-black hover:bg-[#f9ecf5]"
                    >
                      {l.locker_code} — {l.product} | {l.subtype}
                    </button>
                  ))
                )}
              </div>
            )}
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
              {
                key: "quantity",
                label: "Quantity",
                render: (value, row) =>
                  editingRowId === row.id ? (
                    <input
                      type="number"
                      min={1}
                      value={editingQuantity}
                      onChange={(e) => setEditingQuantity(e.target.value)}
                      className="h-9 w-24 rounded-lg border border-[#810055]/30 px-2 text-sm text-black outline-none focus:border-transparent focus:ring-2 focus:ring-secondary"
                    />
                  ) : (
                    value
                  ),
              },
              {
                key: "action",
                label: "Actions",
                sortable: false,
                render: (_v, row) => (
                  <div className="flex gap-2">
                    {editingRowId === row.id ? (
                      <>
                        <button
                          type="button"
                          onClick={() => saveEditQuantity(row)}
                          disabled={updatePlanQuantityMutation.isPending}
                          className="rounded-lg bg-blue-50 px-2 py-1 text-sm font-medium text-blue-700 transition-colors duration-150 hover:bg-blue-100 disabled:cursor-not-allowed disabled:opacity-60"
                        >
                          Save
                        </button>
                        <button
                          type="button"
                          onClick={cancelEditQuantity}
                          className="rounded-lg border border-[#810055]/30 px-2 py-1 text-sm font-medium text-black transition-colors duration-150 hover:bg-[#f9ecf5]"
                        >
                          Cancel
                        </button>
                      </>
                    ) : (
                      <>
                        <button
                          type="button"
                          onClick={() => startEditQuantity(row)}
                          className="rounded-lg bg-blue-50 px-2 py-1 text-sm font-medium text-blue-700 transition-colors duration-150 hover:bg-blue-100"
                        >
                          Edit
                        </button>
                        <button
                          type="button"
                          onClick={() => removeRow(row.id)}
                          className="rounded-lg bg-red-50 px-2 py-1 text-sm font-medium text-red-600 transition-colors duration-150 hover:bg-red-100"
                        >
                          Delete
                        </button>
                      </>
                    )}
                  </div>
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
