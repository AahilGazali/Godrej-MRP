import { useState } from "react";
import toast from "react-hot-toast";
import { useQueryClient } from "@tanstack/react-query";
import FileDropzone from "../components/FileDropzone";
import DataTable from "../components/DataTable";
import SkeletonTable from "../components/SkeletonTable";
import { useAddLocker, useFileUpload, useLockerMaster } from "../hooks/useMrpData";

function LockerMasterPage() {
  const { data = [], isLoading } = useLockerMaster();
  const queryClient = useQueryClient();
  const uploadMutation = useFileUpload();
  const addLockerMutation = useAddLocker();
  const [showModal, setShowModal] = useState(false);
  const [lastUploadInfo, setLastUploadInfo] = useState(null);
  const [form, setForm] = useState({ product: "", subtype: "", locker_code: "" });
  const rows = data;

  const handleUpload = async (file, onProgress) => {
    const result = await uploadMutation.mutateAsync({ file, onProgress, module: "locker-master" });
    setLastUploadInfo({ fileName: result.fileName, uploadedAt: result.uploadedAt });
    await queryClient.invalidateQueries({ queryKey: ["lockerMaster"] });
    toast.success(`${result.rowsSaved} locker rows imported`);
  };

  const handleSaveLocker = () => {
    if (!form.product || !form.subtype || !form.locker_code) {
      toast.error("Product, SubType and Locker code are required");
      return;
    }
    addLockerMutation.mutate(form, {
      onSuccess: async () => {
        await queryClient.invalidateQueries({ queryKey: ["lockerMaster"] });
      },
    });
    setForm({ product: "", subtype: "", locker_code: "" });
    setShowModal(false);
    toast.success("Locker added");
  };

  return (
    <div className="space-y-5">
      <div className="grid gap-5 xl:grid-cols-[1fr,2fr]">
        <FileDropzone
          uploading={uploadMutation.isPending}
          onUpload={handleUpload}
          persistedUploadInfo={lastUploadInfo}
        />
        <section className="rounded-xl border border-border bg-white p-4 shadow-card">
          <div className="mb-4 flex items-center justify-between">
            <h2 className="text-base font-semibold text-slate-900">Locker Master Data</h2>
            <button
              type="button"
              onClick={() => setShowModal(true)}
              className="rounded-md bg-primary px-4 py-2 text-sm font-semibold text-white"
            >
              + Add Locker
            </button>
          </div>
          {isLoading ? (
            <SkeletonTable />
          ) : (
            <DataTable
              columns={[
                { key: "product", label: "Product" },
                { key: "subtype", label: "SubType" },
                { key: "locker_code", label: "Locker code" },
              ]}
              rows={rows}
              emptyText="No locker records found"
            />
          )}
        </section>
      </div>
      {showModal && (
        <div className="fixed inset-0 z-30 grid place-items-center bg-slate-900/35">
          <div className="w-full max-w-lg rounded-xl bg-white p-5 shadow-xl">
            <h3 className="mb-4 text-lg font-semibold">Add Locker</h3>
            <div className="grid gap-3">
              <input
                value={form.product}
                onChange={(e) => setForm((p) => ({ ...p, product: e.target.value }))}
                className="rounded border border-border px-3 py-2"
                placeholder="Product"
              />
              <input
                value={form.subtype}
                onChange={(e) => setForm((p) => ({ ...p, subtype: e.target.value }))}
                className="rounded border border-border px-3 py-2"
                placeholder="SubType"
              />
              <input
                value={form.locker_code}
                onChange={(e) => setForm((p) => ({ ...p, locker_code: e.target.value }))}
                className="rounded border border-border px-3 py-2"
                placeholder="Locker code"
              />
            </div>
            <div className="mt-4 flex justify-end gap-2">
              <button onClick={() => setShowModal(false)} className="rounded border border-border px-4 py-2 text-sm">
                Cancel
              </button>
              <button onClick={handleSaveLocker} className="rounded bg-primary px-4 py-2 text-sm text-white">
                Save
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

export default LockerMasterPage;
