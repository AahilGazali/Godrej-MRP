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
    <div className="space-y-6">
      <div className="grid gap-6 xl:grid-cols-[1fr,2fr]">
        <FileDropzone
          uploading={uploadMutation.isPending}
          onUpload={handleUpload}
          persistedUploadInfo={lastUploadInfo}
        />
        <section className="rounded-lg border border-[#810055]/20 bg-white p-6 shadow-sm">
          <div className="mb-5 flex items-center justify-between border-b border-[#810055]/20 pb-4">
            <h2 className="text-lg font-medium text-black">Locker Master Data</h2>
            <button
              type="button"
              onClick={() => setShowModal(true)}
              className="rounded-lg bg-secondary px-4 py-2 text-sm font-medium text-white transition-colors duration-150 hover:bg-secondary"
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
        <div className="fixed inset-0 z-30 grid place-items-center bg-gray-900/40 p-4">
          <div className="w-full max-w-lg rounded-lg border border-[#810055]/20 bg-white p-6 shadow-lg">
            <h3 className="mb-5 text-lg font-medium text-black">Add Locker</h3>
            <div className="grid gap-4">
              <input
                value={form.product}
                onChange={(e) => setForm((p) => ({ ...p, product: e.target.value }))}
                className="h-10 w-full rounded-lg border border-[#810055]/30 px-3 py-2 text-sm text-black outline-none focus:border-transparent focus:ring-2 focus:ring-secondary"
                placeholder="Product"
              />
              <input
                value={form.subtype}
                onChange={(e) => setForm((p) => ({ ...p, subtype: e.target.value }))}
                className="h-10 w-full rounded-lg border border-[#810055]/30 px-3 py-2 text-sm text-black outline-none focus:border-transparent focus:ring-2 focus:ring-secondary"
                placeholder="SubType"
              />
              <input
                value={form.locker_code}
                onChange={(e) => setForm((p) => ({ ...p, locker_code: e.target.value }))}
                className="h-10 w-full rounded-lg border border-[#810055]/30 px-3 py-2 text-sm text-black outline-none focus:border-transparent focus:ring-2 focus:ring-secondary"
                placeholder="Locker code"
              />
            </div>
            <div className="mt-6 flex justify-end gap-2">
              <button
                type="button"
                onClick={() => setShowModal(false)}
                className="rounded-lg border border-[#810055]/30 px-4 py-2 text-sm font-medium text-black transition-colors duration-150 hover:bg-[#f9ecf5]"
              >
                Cancel
              </button>
              <button
                type="button"
                onClick={handleSaveLocker}
                className="rounded-lg bg-secondary px-4 py-2 text-sm font-medium text-white transition-colors duration-150 hover:bg-secondary"
              >
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
