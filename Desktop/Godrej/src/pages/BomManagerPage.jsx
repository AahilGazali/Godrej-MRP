import { useMemo, useState } from "react";
import DataTable from "../components/DataTable";
import SkeletonTable from "../components/SkeletonTable";
import FileDropzone from "../components/FileDropzone";
import { useAddCustomBom, useBom, useDeleteBomRow, useFileUpload, useUpdateBomRow } from "../hooks/useMrpData";
import toast from "react-hot-toast";
import { useQueryClient } from "@tanstack/react-query";

function BomManagerPage({ user }) {
  const isManager = user?.role === "manager";
  const { data = [], isLoading } = useBom();
  const queryClient = useQueryClient();
  const addCustomBomMutation = useAddCustomBom();
  const updateBomRowMutation = useUpdateBomRow();
  const deleteBomRowMutation = useDeleteBomRow();
  const uploadMutation = useFileUpload();
  const [lockerModel, setLockerModel] = useState("All");
  const [type, setType] = useState("All");
  const [showCustomForm, setShowCustomForm] = useState(false);
  const [customRows, setCustomRows] = useState([{ item_code: "", component_type: "", qty: "" }]);
  const [selectedCustomModel, setSelectedCustomModel] = useState("");
  const [step, setStep] = useState(1);
  const [lastUploadInfo, setLastUploadInfo] = useState(null);
  const [editingRowKey, setEditingRowKey] = useState("");
  const [editingForm, setEditingForm] = useState(null);
  const [deleteModalRow, setDeleteModalRow] = useState(null);
  const [deleteBomModalModel, setDeleteBomModalModel] = useState(null);

  const mergedRows = data;
  const models = useMemo(() => {
    const bomModels = mergedRows.map((d) => d.locker_model);
    return ["All", ...new Set([...bomModels].filter(Boolean))];
  }, [mergedRows]);
  const filtered = mergedRows.filter((r) => {
    const modelPass = lockerModel === "All" || r.locker_model === lockerModel;
    const typePass = type === "All" || r.bom_type === type;
    return modelPass && typePass;
  });
  const grouped = filtered.reduce((acc, row) => {
    (acc[row.locker_model] = acc[row.locker_model] || []).push(row);
    return acc;
  }, {});
  const tableColumns = [
    { key: "level", label: "Level" },
    { key: "position", label: "Position" },
    { key: "item_code", label: "Item Code" },
    { key: "description", label: "Description" },
    { key: "drawing_no", label: "Drawing No" },
    { key: "drawing_rev_no", label: "Drawing Rev No" },
    { key: "op", label: "Op?" },
    { key: "warehouse", label: "Warehouse" },
    { key: "use_pnt_wh", label: "Use Pnt wh" },
    { key: "entrp_unit", label: "Entrp Unit" },
    { key: "lot_sel", label: "Lot/sel" },
    { key: "revision", label: "Revision" },
    { key: "effective_date", label: "Effective Date" },
    { key: "expiry_date", label: "Expiry Date" },
    { key: "length_mm", label: "length(mm)" },
    { key: "width_mm", label: "Width(mm)" },
    { key: "number_of_units", label: "Number of Units" },
    { key: "inv_unit", label: "Inv Unit" },
    { key: "net_quantity", label: "Net Quantity" },
    { key: "scrap_percent", label: "Scrap(%)" },
    { key: "scrap_quantity", label: "Scrap Quantity" },
    { key: "extra_info", label: "Extra Info" },
    { key: "bom_type", label: "BOM Type" },
  ];

  const startRowEdit = (row) => {
    setEditingRowKey(`${row.row_source}:${row.id}`);
    setEditingForm({
      level: row.level ?? "",
      position: row.position ?? "",
      item_code: row.item_code ?? "",
      description: row.description ?? "",
      drawing_no: row.drawing_no ?? "",
      drawing_rev_no: row.drawing_rev_no ?? "",
      op: row.op ?? "",
      warehouse: row.warehouse ?? "",
      use_pnt_wh: row.use_pnt_wh ?? "",
      entrp_unit: row.entrp_unit ?? "",
      lot_sel: row.lot_sel ?? "",
      revision: row.revision ?? "",
      effective_date: row.effective_date ?? "",
      expiry_date: row.expiry_date ?? "",
      length_mm: row.length_mm ?? "",
      width_mm: row.width_mm ?? "",
      number_of_units: row.number_of_units ?? "",
      inv_unit: row.inv_unit ?? "",
      net_quantity: row.net_quantity ?? "",
      scrap_percent: row.scrap_percent ?? "",
      scrap_quantity: row.scrap_quantity ?? "",
      extra_info: row.extra_info ?? "",
      bom_type: row.bom_type ?? "",
      component_type: row.component_type ?? "",
    });
  };

  const cancelRowEdit = () => {
    setEditingRowKey("");
    setEditingForm(null);
  };

  const saveRowEdit = async (row) => {
    if (!editingForm) return;
    try {
      await updateBomRowMutation.mutateAsync({
        source: row.row_source,
        id: row.id,
        payload: editingForm,
      });
      await queryClient.invalidateQueries({ queryKey: ["bomData"] });
      cancelRowEdit();
      toast.success("BOM row updated");
    } catch (error) {
      toast.error(error?.response?.data?.message || error?.message || "Failed to update BOM row");
    }
  };

  const confirmDeleteRow = async () => {
    if (!deleteModalRow) return;
    try {
      await deleteBomRowMutation.mutateAsync({ source: deleteModalRow.row_source, id: deleteModalRow.id });
      await queryClient.invalidateQueries({ queryKey: ["bomData"] });
      if (editingRowKey === `${deleteModalRow.row_source}:${deleteModalRow.id}`) {
        cancelRowEdit();
      }
      setDeleteModalRow(null);
      toast.success("BOM row deleted");
    } catch (error) {
      toast.error(error?.response?.data?.message || error?.message || "Failed to delete BOM row");
    }
  };

  const deleteEntireBom = async () => {
    if (!deleteBomModalModel) return;
    const rows = grouped[deleteBomModalModel] || [];
    if (!rows.length) {
      setDeleteBomModalModel(null);
      return;
    }

    try {
      await Promise.all(
        rows.map((row) =>
          deleteBomRowMutation.mutateAsync({
            source: row.row_source,
            id: row.id,
          })
        )
      );
      await queryClient.invalidateQueries({ queryKey: ["bomData"] });
      if (rows.some((row) => editingRowKey === `${row.row_source}:${row.id}`)) {
        cancelRowEdit();
      }
      setDeleteBomModalModel(null);
      toast.success("BOM deleted");
    } catch (error) {
      toast.error(error?.response?.data?.message || error?.message || "Failed to delete BOM");
    }
  };

  const saveCustomBom = () => {
    if (!selectedCustomModel) {
      toast.error("Select locker model");
      return;
    }
    const validRows = customRows.filter((r) => r.item_code && r.component_type && Number(r.qty) > 0);
    if (!validRows.length) {
      toast.error("Add at least one valid BOM row");
      return;
    }
    const newRows = validRows.map((r) => ({
      locker_model: selectedCustomModel,
      item_code: r.item_code,
      component_type: r.component_type,
      qty: Number(r.qty),
    }));
    addCustomBomMutation.mutate(
      { locker_model: selectedCustomModel, rows: newRows },
      {
        onSuccess: async () => {
          await queryClient.invalidateQueries({ queryKey: ["bomData"] });
          setCustomRows([{ item_code: "", component_type: "", qty: "" }]);
          setSelectedCustomModel("");
          setStep(1);
          setShowCustomForm(false);
          toast.success("Custom BOM saved");
        },
      }
    );
  };

  const handleBomUpload = async (file, onProgress) => {
    const inferredModel = file?.name?.replace(/\.[^/.]+$/, "").trim() || "Uploaded-BOM";
    const uploadModel = lockerModel && lockerModel !== "All" ? lockerModel : inferredModel;
    const result = await uploadMutation.mutateAsync({
      file,
      onProgress,
      module: "bom-manager",
      date: uploadModel,
    });
    setLastUploadInfo({ fileName: result.fileName, uploadedAt: result.uploadedAt });
    await queryClient.invalidateQueries({ queryKey: ["bomData"] });
    toast.success(`BOM uploaded to model "${uploadModel}": ${result.rowsSaved} rows saved`);
  };

  return (
    <section className="space-y-6 rounded-lg border border-[#810055]/20 bg-white p-6 shadow-sm">
      <div className="flex flex-wrap items-center gap-3 border-b border-[#810055]/20 pb-5">
        <select
          value={lockerModel}
          onChange={(e) => setLockerModel(e.target.value)}
          className="h-10 rounded-lg border border-[#810055]/30 px-3 text-sm text-black outline-none focus:border-transparent focus:ring-2 focus:ring-secondary"
        >
          {models.map((m) => (
            <option key={m}>{m}</option>
          ))}
        </select>
        <div className="inline-flex rounded-lg border border-[#810055]/30 p-1">
          {["All", "Standard", "Custom"].map((item) => (
            <button
              key={item}
              type="button"
              onClick={() => setType(item)}
              className={`rounded-md px-3 py-1.5 text-sm font-medium transition-colors duration-150 ${
                type === item ? "bg-secondary text-white" : "text-black hover:bg-[#f9ecf5]"
              }`}
            >
              {item}
            </button>
          ))}
        </div>
        <button
          type="button"
          onClick={() => setShowCustomForm(true)}
          className="ml-auto rounded-lg bg-secondary px-4 py-2 text-sm font-medium text-white transition-colors duration-150 hover:bg-secondary"
        >
          Add Custom BOM
        </button>
      </div>
      {isManager && (
        <FileDropzone
          uploading={uploadMutation.isPending}
          onUpload={handleBomUpload}
          persistedUploadInfo={lastUploadInfo}
        />
      )}
      {isLoading ? (
        <SkeletonTable />
      ) : (
        <div className="space-y-6">
          {Object.keys(grouped).length === 0 ? (
            <div className="rounded-lg border border-[#810055]/20 bg-white p-8 text-center text-sm text-black">
              {lockerModel === "All"
                ? "No BOM records available for the selected filters"
                : `No BOM records found for locker model ${lockerModel}. Add Custom BOM to create one.`}
            </div>
          ) : (
            Object.entries(grouped).map(([model, rows]) => (
              <div key={model}>
                <div className="mb-3 flex flex-wrap items-center justify-between gap-3">
                  <h3 className="text-lg font-medium text-black">Locker Model: {model}</h3>
                  {isManager && (
                    <button
                      type="button"
                      onClick={() => setDeleteBomModalModel(model)}
                      disabled={deleteBomRowMutation.isPending}
                      className="rounded-md bg-red-50 px-3 py-1 text-xs font-medium text-red-700 transition-colors hover:bg-red-100 disabled:cursor-not-allowed disabled:opacity-60"
                    >
                      Delete BOM
                    </button>
                  )}
                </div>
                <DataTable
                  columns={[
                    ...tableColumns.map((col) => ({
                      ...col,
                      render: (value, row) =>
                        editingRowKey === `${row.row_source}:${row.id}` && col.key !== "bom_type" ? (
                          <input
                            value={editingForm?.[col.key] ?? ""}
                            onChange={(e) => setEditingForm((prev) => ({ ...(prev || {}), [col.key]: e.target.value }))}
                            className="h-9 min-w-[120px] rounded-md border border-[#810055]/30 px-2 text-sm text-black outline-none focus:border-transparent focus:ring-2 focus:ring-secondary"
                          />
                        ) : (
                          value
                        ),
                    })),
                    {
                      key: "actions",
                      label: "Actions",
                      sortable: false,
                      render: (_value, row) =>
                        editingRowKey === `${row.row_source}:${row.id}` ? (
                          <div className="flex gap-2">
                            <button
                              type="button"
                              onClick={() => saveRowEdit(row)}
                              disabled={updateBomRowMutation.isPending}
                              className="rounded-md bg-blue-50 px-3 py-1 text-xs font-medium text-blue-700 transition-colors hover:bg-blue-100 disabled:cursor-not-allowed disabled:opacity-60"
                            >
                              Save
                            </button>
                            <button
                              type="button"
                              onClick={cancelRowEdit}
                              className="rounded-md border border-[#810055]/30 px-3 py-1 text-xs font-medium text-black transition-colors hover:bg-[#f9ecf5]"
                            >
                              Cancel
                            </button>
                          </div>
                        ) : (
                          <div className="flex gap-2">
                            <button
                              type="button"
                              onClick={() => startRowEdit(row)}
                              className="rounded-md bg-blue-50 px-3 py-1 text-xs font-medium text-blue-700 transition-colors hover:bg-blue-100"
                            >
                              Edit
                            </button>
                            <button
                              type="button"
                              onClick={() => setDeleteModalRow(row)}
                              disabled={deleteBomRowMutation.isPending}
                              className="rounded-md bg-red-50 px-3 py-1 text-xs font-medium text-red-700 transition-colors hover:bg-red-100 disabled:cursor-not-allowed disabled:opacity-60"
                            >
                              Delete
                            </button>
                          </div>
                        ),
                    },
                  ]}
                  rows={rows}
                  emptyText="No records"
                />
              </div>
            ))
          )}
        </div>
      )}
      {showCustomForm && (
        <div className="fixed inset-0 z-30 grid place-items-center bg-gray-900/40 p-4">
          <div className="relative w-full max-w-2xl rounded-lg border border-[#810055]/20 bg-white p-6 shadow-lg">
            <button
              onClick={() => setShowCustomForm(false)}
              className="absolute right-4 top-4 flex items-center justify-center rounded-md p-1.5 text-neutral transition-colors duration-200 hover:bg-secondary/10 hover:text-secondary focus:outline-none"
              aria-label="Close modal"
            >
              <svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" strokeWidth={2.5} stroke="currentColor" className="h-4 w-4">
                <path strokeLinecap="round" strokeLinejoin="round" d="M6 18L18 6M6 6l12 12" />
              </svg>
            </button>
            <h3 className="mb-5 text-lg font-medium text-black">Custom BOM - Step {step}/2</h3>
            {step === 1 ? (
              <div className="space-y-4">
                <select
                  value={selectedCustomModel}
                  onChange={(e) => setSelectedCustomModel(e.target.value)}
                  className="h-10 w-full rounded-lg border border-[#810055]/30 px-3 text-sm text-black outline-none focus:border-transparent focus:ring-2 focus:ring-secondary"
                >
                  <option value="">Select Locker Model</option>
                  {models.filter((m) => m !== "All").map((m) => (
                    <option key={m}>{m}</option>
                  ))}
                </select>
                <button
                  type="button"
                  className="rounded-lg bg-secondary px-4 py-2 text-sm font-medium text-white transition-colors duration-150 hover:bg-secondary"
                  onClick={() => setStep(2)}
                >
                  Next
                </button>
              </div>
            ) : (
              <div className="space-y-4">
                {customRows.map((row, i) => (
                  <div key={i} className="grid gap-2 md:grid-cols-3">
                    <input
                      value={row.item_code}
                      onChange={(e) => setCustomRows((p) => p.map((r, idx) => (idx === i ? { ...r, item_code: e.target.value } : r)))}
                      placeholder="Item Code"
                      className="h-10 rounded-lg border border-[#810055]/30 px-3 text-sm text-black outline-none focus:border-transparent focus:ring-2 focus:ring-secondary"
                    />
                    <input
                      value={row.component_type}
                      onChange={(e) => setCustomRows((p) => p.map((r, idx) => (idx === i ? { ...r, component_type: e.target.value } : r)))}
                      placeholder="Component Type"
                      className="h-10 rounded-lg border border-[#810055]/30 px-3 text-sm text-black outline-none focus:border-transparent focus:ring-2 focus:ring-secondary"
                    />
                    <input
                      type="number"
                      value={row.qty}
                      onChange={(e) => setCustomRows((p) => p.map((r, idx) => (idx === i ? { ...r, qty: e.target.value } : r)))}
                      placeholder="Qty"
                      className="h-10 rounded-lg border border-[#810055]/30 px-3 text-sm text-black outline-none focus:border-transparent focus:ring-2 focus:ring-secondary"
                    />
                  </div>
                ))}
                <div className="flex flex-wrap gap-2">
                  <button
                    type="button"
                    onClick={() => setCustomRows((p) => [...p, { item_code: "", component_type: "", qty: "" }])}
                    className="rounded-lg border border-[#810055]/30 px-4 py-2 text-sm font-medium text-black transition-colors duration-150 hover:bg-[#f9ecf5]"
                  >
                    + Row
                  </button>
                  <button
                    type="button"
                    onClick={saveCustomBom}
                    className="rounded-lg bg-secondary px-4 py-2 text-sm font-medium text-white transition-colors duration-150 hover:bg-secondary"
                  >
                    Save Custom BOM
                  </button>
                </div>
              </div>
            )}
          </div>
        </div>
      )}
      {deleteModalRow && (
        <div className="fixed inset-0 z-40 grid place-items-center bg-gray-900/45 p-4">
          <div className="w-full max-w-md rounded-xl border border-[#810055]/20 bg-white p-6 shadow-xl">
            <h3 className="text-lg font-semibold text-black">Delete BOM row?</h3>
            <p className="mt-2 text-sm text-black/80">
              This row will be marked as deleted and hidden from BOM Manager.
            </p>
            <p className="mt-1 text-xs text-black/60">Item: {deleteModalRow.item_code || `#${deleteModalRow.id}`}</p>
            <div className="mt-6 flex justify-end gap-2">
              <button
                type="button"
                onClick={() => setDeleteModalRow(null)}
                className="rounded-lg border border-[#810055]/30 px-4 py-2 text-sm font-medium text-black transition-colors duration-150 hover:bg-[#f9ecf5]"
              >
                Cancel
              </button>
              <button
                type="button"
                onClick={confirmDeleteRow}
                disabled={deleteBomRowMutation.isPending}
                className="rounded-lg bg-red-600 px-4 py-2 text-sm font-medium text-white transition-colors duration-150 hover:bg-red-700 disabled:cursor-not-allowed disabled:opacity-60"
              >
                {deleteBomRowMutation.isPending ? "Deleting..." : "Delete"}
              </button>
            </div>
          </div>
        </div>
      )}
      {deleteBomModalModel && (
        <div className="fixed inset-0 z-40 grid place-items-center bg-gray-900/45 p-4">
          <div className="w-full max-w-md rounded-xl border border-[#810055]/20 bg-white p-6 shadow-xl">
            <h3 className="text-lg font-semibold text-black">Delete entire BOM?</h3>
            <p className="mt-2 text-sm text-black/80">
              This will permanently delete all rows for Locker Model: {deleteBomModalModel}. This cannot be undone.
            </p>
            <div className="mt-6 flex justify-end gap-2">
              <button
                type="button"
                onClick={() => setDeleteBomModalModel(null)}
                className="rounded-lg border border-[#810055]/30 px-4 py-2 text-sm font-medium text-black transition-colors duration-150 hover:bg-[#f9ecf5]"
              >
                Cancel
              </button>
              <button
                type="button"
                onClick={deleteEntireBom}
                disabled={deleteBomRowMutation.isPending}
                className="rounded-lg bg-red-600 px-4 py-2 text-sm font-medium text-white transition-colors duration-150 hover:bg-red-700 disabled:cursor-not-allowed disabled:opacity-60"
              >
                {deleteBomRowMutation.isPending ? "Deleting..." : "Delete Entire BOM"}
              </button>
            </div>
          </div>
        </div>
      )}
    </section>
  );
}

export default BomManagerPage;
