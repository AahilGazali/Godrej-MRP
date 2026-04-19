import { useState } from "react";
import FileDropzone from "../components/FileDropzone";
import DataTable from "../components/DataTable";
import SkeletonTable from "../components/SkeletonTable";
import { useFileUpload, useUploads } from "../hooks/useMrpData";
import toast from "react-hot-toast";
import { useQueryClient } from "@tanstack/react-query";

function StockUploadPage({ user }) {
  const isManager = user?.role === "manager";
  const { data = [], isLoading } = useUploads();
  const queryClient = useQueryClient();
  const uploadMutation = useFileUpload();
  const [date, setDate] = useState(() => new Date().toISOString().slice(0, 10));
  const [summary, setSummary] = useState({ rows_saved: 0, warnings: 0 });
  const [lastUploadInfo, setLastUploadInfo] = useState(null);

  const handleUpload = async (file, onProgress) => {
    if (!date) {
      toast.error("Select stock date before upload");
      throw new Error("Date is required");
    }
    const result = await uploadMutation.mutateAsync({ file, onProgress, module: "stock-upload", date });
    setSummary({ rows_saved: result.rowsSaved, warnings: result.warnings });
    setLastUploadInfo({ fileName: result.fileName, uploadedAt: result.uploadedAt });
    await queryClient.invalidateQueries({ queryKey: ["uploadHistory"] });
    if (result.stockDateNote) {
      toast(result.stockDateNote, { icon: "ℹ️", duration: 6000 });
    }
  };

  return (
    <div className={`grid gap-6 ${isManager ? "xl:grid-cols-[1fr,2fr]" : ""}`}>
      {isManager && (
        <section className="space-y-4 rounded-lg border border-[#810055]/20 bg-white p-6 shadow-sm">
          <h2 className="text-lg font-medium text-black">Upload Stock</h2>
          <input
            type="date"
            value={date}
            onChange={(e) => setDate(e.target.value)}
            className="h-10 w-full rounded-lg border border-[#810055]/30 px-3 text-sm text-black outline-none focus:border-transparent focus:ring-2 focus:ring-secondary"
          />
          <p className="text-sm text-black">
            Only stock values from the selected date column are imported from the sheet.
          </p>
          <FileDropzone
            uploading={uploadMutation.isPending}
            onUpload={handleUpload}
            persistedUploadInfo={lastUploadInfo}
          />
          <div className="rounded-lg border border-[#810055]/20 bg-white p-4 text-sm text-black">
            <p className="text-xs font-medium uppercase tracking-wide text-black">Upload summary</p>
            <p className="mt-2">
              Rows saved: {summary.rows_saved} | Warnings: {summary.warnings}
            </p>
          </div>
        </section>
      )}
      <section className="rounded-lg border border-[#810055]/20 bg-white p-6 shadow-sm">
        <h2 className="mb-4 text-lg font-medium text-black">Last 7 Uploads</h2>
        {isLoading ? (
          <SkeletonTable />
        ) : (
          <DataTable
            columns={[
              { key: "date", label: "Date" },
              { key: "file", label: "File Name" },
              { key: "rows_saved", label: "Rows Saved" },
              { key: "warnings", label: "Warnings" },
            ]}
            rows={data}
            emptyText="No uploads found in the last 7 days"
          />
        )}
      </section>
    </div>
  );
}

export default StockUploadPage;
