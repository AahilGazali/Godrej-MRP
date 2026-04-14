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
    <div className="rounded-lg border border-[#810055]/20 bg-white p-5 shadow-sm">
      <div
        {...getRootProps()}
        className={`cursor-pointer rounded-lg border-2 border-dashed p-8 text-center transition-colors duration-150 ${
          isDragActive ? "border-secondary bg-[#f9ecf5]" : "border-[#810055]/30 bg-white hover:bg-[#f9ecf5]"
        }`}
      >
        <input {...getInputProps()} />
        <p className="text-sm font-medium text-black">Drag & drop file here, or click to browse</p>
        <p className="mt-2 text-sm text-black">Accepted: .csv, .xlsx</p>
      </div>
      {file && (
        <div className="mt-4 flex items-center justify-between rounded-lg border border-[#810055]/20 bg-white px-3 py-2 text-sm text-black">
          <span className="truncate">{file.name}</span>
          <span className="text-black">{Math.ceil(file.size / 1024)} KB</span>
        </div>
      )}
      {!file && persistedUploadInfo?.fileName && (
        <div className="mt-4 rounded-lg border border-[#810055]/20 bg-white p-3 text-sm">
          <p className="truncate text-black">Last uploaded: {persistedUploadInfo.fileName}</p>
          {persistedUploadInfo.uploadedAt && (
            <p className="mt-1 text-xs text-black">Date: {persistedUploadInfo.uploadedAt}</p>
          )}
        </div>
      )}
      <div className="mt-4">
        <button
          type="button"
          disabled={!file || uploading}
          onClick={handleUpload}
          className="rounded-lg bg-secondary px-4 py-2 text-sm font-medium text-white transition-colors duration-150 hover:bg-secondary disabled:cursor-not-allowed disabled:opacity-50"
        >
          {uploading ? "Uploading..." : "Upload File"}
        </button>
      </div>
      {progress > 0 && (
        <div className="mt-4">
          <div className="h-2 w-full rounded-full bg-[#f2f1ec]">
            <div className="h-2 rounded-full bg-secondary transition-all" style={{ width: `${progress}%` }} />
          </div>
          <p className="mt-1 text-xs text-black">{progress}% complete</p>
        </div>
      )}
    </div>
  );
}

export default FileDropzone;
