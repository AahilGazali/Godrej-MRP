import { useState } from "react";
import toast from "react-hot-toast";
import { useQueryClient } from "@tanstack/react-query";
import FileDropzone from "../components/FileDropzone";
import DataTable from "../components/DataTable";
import SkeletonTable from "../components/SkeletonTable";
import { useAddLocker, useDeleteLocker, useFileUpload, useLockerMaster, useUpdateLocker } from "../hooks/useMrpData";

const EMPTY_FORM = { product: "", subtype: "", locker_code: "" };

function LockerMasterPage() {
  const { data = [], isLoading } = useLockerMaster();
  const queryClient = useQueryClient();
  const uploadMutation = useFileUpload();
  const addLockerMutation = useAddLocker();
  const updateLockerMutation = useUpdateLocker();
  const deleteLockerMutation = useDeleteLocker();
  const [showModal, setShowModal] = useState(false);
  const [lastUploadInfo, setLastUploadInfo] = useState(null);
  const [editingLocker, setEditingLocker] = useState(null);
  const [form, setForm] = useState(EMPTY_FORM);
  const rows = data;
  const isSaving = addLockerMutation.isPending || updateLockerMutation.isPending;

  const closeModal = () => {
    setShowModal(false);
    setEditingLocker(null);
    setForm(EMPTY_FORM);
  };

  const openAddModal = () => {
    setEditingLocker(null);
    setForm(EMPTY_FORM);
    setShowModal(true);
  };

  const openEditModal = (locker) => {
    setEditingLocker(locker);
    setForm({
      product: locker.product ?? "",
      subtype: locker.subtype ?? "",
      locker_code: locker.locker_code ?? "",
    });
    setShowModal(true);
  };

  const handleUpload = async (file, onProgress) => {
    const result = await uploadMutation.mutateAsync({ file, onProgress, module: "locker-master" });
    setLastUploadInfo({ fileName: result.fileName, uploadedAt: result.uploadedAt });
    await queryClient.invalidateQueries({ queryKey: ["lockerMaster"] });
    toast.success(`${result.rowsSaved} locker rows imported`);
  };

  const handleSaveLocker = async () => {
    const payload = {
      product: form.product.trim(),
      subtype: form.subtype.trim(),
      locker_code: form.locker_code.trim(),
    };

    if (!payload.product || !payload.subtype || !payload.locker_code) {
      toast.error("Product, SubType and Locker code are required");
      return;
    }

    try {
      if (editingLocker?.id) {
        await updateLockerMutation.mutateAsync({ id: editingLocker.id, ...payload });
        toast.success("Locker updated permanently");
      } else {
        await addLockerMutation.mutateAsync(payload);
        toast.success("Locker added permanently");
      }
      await queryClient.invalidateQueries({ queryKey: ["lockerMaster"] });
      closeModal();
    } catch (error) {
      toast.error(error?.response?.data?.message || error?.message || "Failed to save locker");
    }
  };

  const handleDeleteLocker = async (locker) => {
    const confirmed = window.confirm(`Delete locker code ${locker.locker_code}? This will remove it from the database.`);
    if (!confirmed) return;

    try {
      await deleteLockerMutation.mutateAsync(locker.locker_code);
      await queryClient.invalidateQueries({ queryKey: ["lockerMaster"] });
      toast.success("Locker deleted permanently");
    } catch (error) {
      toast.error(error?.response?.data?.message || error?.message || "Failed to delete locker");
    }
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
              onClick={openAddModal}
              className="rounded-lg bg-secondary px-4 py-2 text-sm font-medium text-white transition-colors duration-150 hover:bg-secondary"
            >
              + Add Locker
            </button>
          </div>
          {isLoading ? (
            <SkeletonTable />
          ) : (
            <DataTable
              searchKeys={["product", "subtype", "locker_code"]}
              columns={[
                { key: "product", label: "Product" },
                { key: "subtype", label: "SubType" },
                { key: "locker_code", label: "Locker code" },
                {
                  key: "actions",
                  label: "Actions",
                  sortable: false,
                  render: (_value, row) => (
                    <div className="flex gap-2">
                      <button
                        type="button"
                        onClick={() => openEditModal(row)}
                        className="rounded-md bg-blue-50 px-3 py-1 text-xs font-medium text-blue-700 transition-colors hover:bg-blue-100"
                      >
                        Edit
                      </button>
                      <button
                        type="button"
                        onClick={() => handleDeleteLocker(row)}
                        className="rounded-md bg-red-50 px-3 py-1 text-xs font-medium text-red-700 transition-colors hover:bg-red-100"
                      >
                        Delete
                      </button>
                    </div>
                  ),
                },
              ]}
              rows={rows}
              emptyText="No locker records found"
            />
          )}
        </section>
      </div>
      {showModal && (
        <div className="fixed inset-0 z-30 grid place-items-center bg-gray-900/40 p-4">
          <div className="relative w-full max-w-lg rounded-lg border border-[#810055]/20 bg-white p-6 shadow-lg">
            <button
              onClick={closeModal}
              className="absolute right-4 top-4 flex items-center justify-center rounded-md p-1.5 text-neutral transition-colors duration-200 hover:bg-secondary/10 hover:text-secondary focus:outline-none"
              aria-label="Close modal"
            >
              <svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" strokeWidth={2.5} stroke="currentColor" className="h-4 w-4">
                <path strokeLinecap="round" strokeLinejoin="round" d="M6 18L18 6M6 6l12 12" />
              </svg>
            </button>
            <h3 className="mb-5 text-lg font-medium text-black">{editingLocker ? "Edit Locker" : "Add Locker"}</h3>
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
                onClick={closeModal}
                className="rounded-lg border border-[#810055]/30 px-4 py-2 text-sm font-medium text-black transition-colors duration-150 hover:bg-[#f9ecf5]"
              >
                Cancel
              </button>
              <button
                type="button"
                onClick={handleSaveLocker}
                disabled={isSaving}
                className="rounded-lg bg-secondary px-4 py-2 text-sm font-medium text-white transition-colors duration-150 hover:bg-secondary disabled:cursor-not-allowed disabled:opacity-60"
              >
                {isSaving ? "Saving..." : editingLocker ? "Update" : "Save"}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

export default LockerMasterPage;
