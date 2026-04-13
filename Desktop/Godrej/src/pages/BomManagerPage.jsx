import { useMemo, useState } from "react";
import DataTable from "../components/DataTable";
import SkeletonTable from "../components/SkeletonTable";
import FileDropzone from "../components/FileDropzone";
import { useAddCustomBom, useBom, useFileUpload } from "../hooks/useMrpData";
import toast from "react-hot-toast";
import { useQueryClient } from "@tanstack/react-query";

function BomManagerPage() {
  const { data = [], isLoading } = useBom();
  const queryClient = useQueryClient();
  const addCustomBomMutation = useAddCustomBom();
  const uploadMutation = useFileUpload();
  const [lockerModel, setLockerModel] = useState("All");
  const [type, setType] = useState("All");
  const [showCustomForm, setShowCustomForm] = useState(false);
  const [customRows, setCustomRows] = useState([{ item_code: "", component_type: "", qty: "" }]);
  const [selectedCustomModel, setSelectedCustomModel] = useState("");
  const [step, setStep] = useState(1);
  const [lastUploadInfo, setLastUploadInfo] = useState(null);

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
      <FileDropzone
        uploading={uploadMutation.isPending}
        onUpload={handleBomUpload}
        persistedUploadInfo={lastUploadInfo}
      />
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
                <h3 className="mb-3 text-lg font-medium text-black">Locker Model: {model}</h3>
                <DataTable
                  columns={[
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
          <div className="w-full max-w-2xl rounded-lg border border-[#810055]/20 bg-white p-6 shadow-lg">
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
    </section>
  );
}

export default BomManagerPage;
