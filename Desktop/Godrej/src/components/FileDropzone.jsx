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
    <div className="rounded-lg border border-gray-200 bg-white p-5 shadow-sm">
      <div
        {...getRootProps()}
        className={`cursor-pointer rounded-lg border-2 border-dashed p-8 text-center transition-colors duration-150 ${
          isDragActive ? "border-blue-500 bg-blue-50" : "border-gray-300 bg-gray-50 hover:bg-gray-100"
        }`}
      >
        <input {...getInputProps()} />
        <p className="text-sm font-medium text-gray-600">Drag & drop file here, or click to browse</p>
        <p className="mt-2 text-sm text-gray-500">Accepted: .csv, .xlsx</p>
      </div>
      {file && (
        <div className="mt-4 flex items-center justify-between rounded-lg border border-gray-200 bg-white px-3 py-2 text-sm text-gray-700">
          <span className="truncate">{file.name}</span>
          <span className="text-gray-500">{Math.ceil(file.size / 1024)} KB</span>
        </div>
      )}
      {!file && persistedUploadInfo?.fileName && (
        <div className="mt-4 rounded-lg border border-gray-200 bg-gray-50 p-3 text-sm">
          <p className="truncate text-gray-700">Last uploaded: {persistedUploadInfo.fileName}</p>
          {persistedUploadInfo.uploadedAt && (
            <p className="mt-1 text-xs text-gray-500">Date: {persistedUploadInfo.uploadedAt}</p>
          )}
        </div>
      )}
      <div className="mt-4">
        <button
          type="button"
          disabled={!file || uploading}
          onClick={handleUpload}
          className="rounded-lg bg-blue-600 px-4 py-2 text-sm font-medium text-white transition-colors duration-150 hover:bg-blue-700 disabled:cursor-not-allowed disabled:opacity-50"
        >
          {uploading ? "Uploading..." : "Upload File"}
        </button>
      </div>
      {progress > 0 && (
        <div className="mt-4">
          <div className="h-2 w-full rounded-full bg-gray-200">
            <div className="h-2 rounded-full bg-blue-600 transition-all" style={{ width: `${progress}%` }} />
          </div>
          <p className="mt-1 text-xs text-gray-500">{progress}% complete</p>
        </div>
      )}
    </div>
  );
}

export default FileDropzone;
