import { useCallback, useState } from "react";
import { useDropzone } from "react-dropzone";
import toast from "react-hot-toast";

function FileDropzone({ onUpload, uploading, persistedUploadInfo }) {
  const [file, setFile] = useState(null);
  const [progress, setProgress] = useState(0);

  const onDrop = useCallback((acceptedFiles, fileRejections) => {
    if (fileRejections.length) {
      toast.error("Only .xlsx/.csv files are accepted");
      return;
    }
    setFile(acceptedFiles[0]);
    setProgress(0);
  }, []);

  const { getRootProps, getInputProps, isDragActive } = useDropzone({
    onDrop,
    maxFiles: 1,
    accept: {
      "text/csv": [".csv"],
      "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet": [".xlsx"],
    },
  });

  const handleUpload = async () => {
    if (!file || uploading) return;
    try {
      setProgress(35);
      await onUpload(file, (p) => setProgress(p));
      setProgress(100);
      toast.success("File uploaded successfully");
    } catch (error) {
      setProgress(0);
      toast.error(error?.message || "Upload failed");
    }
  };

  return (
    <div className="rounded-xl border border-border bg-white p-4 shadow-card">
      <div
        {...getRootProps()}
        className={`cursor-pointer rounded-lg border-2 border-dashed p-8 text-center transition ${
          isDragActive ? "border-primary bg-blue-50" : "border-border bg-slate-50"
        }`}
      >
        <input {...getInputProps()} />
        <p className="text-sm text-slate-700">Drag & drop file here, or click to browse</p>
        <p className="mt-1 text-xs text-slate-500">Accepted: .csv, .xlsx</p>
      </div>
      {file && (
        <div className="mt-3 flex items-center justify-between rounded-md border border-border p-3 text-sm">
          <span className="truncate">{file.name}</span>
          <span className="text-slate-500">{Math.ceil(file.size / 1024)} KB</span>
        </div>
      )}
      {!file && persistedUploadInfo?.fileName && (
        <div className="mt-3 rounded-md border border-border bg-slate-50 p-3 text-sm">
          <p className="truncate text-slate-700">Last uploaded: {persistedUploadInfo.fileName}</p>
          {persistedUploadInfo.uploadedAt && (
            <p className="mt-1 text-xs text-slate-500">Date: {persistedUploadInfo.uploadedAt}</p>
          )}
        </div>
      )}
      <div className="mt-4">
        <button
          type="button"
          disabled={!file || uploading}
          onClick={handleUpload}
          className="rounded-md bg-primary px-4 py-2 text-sm font-semibold text-white disabled:cursor-not-allowed disabled:opacity-60"
        >
          {uploading ? "Uploading..." : "Upload File"}
        </button>
      </div>
      {progress > 0 && (
        <div className="mt-3">
          <div className="h-2 w-full rounded bg-slate-200">
            <div className="h-2 rounded bg-primary transition-all" style={{ width: `${progress}%` }} />
          </div>
          <p className="mt-1 text-xs text-slate-500">{progress}% complete</p>
        </div>
      )}
    </div>
  );
}

export default FileDropzone;
