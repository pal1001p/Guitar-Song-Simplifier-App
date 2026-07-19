"use client";

type ActionButtonsProps = {
  selected: File | null;
  uploading: boolean;
  upload: boolean;
  analyzing: boolean;
  analyze: boolean;
  recording: boolean;
  cacheing: boolean;
  onFileSelect: (event: React.ChangeEvent<HTMLInputElement>) => void;
  onUpload: () => void;
  onAnalyze: () => void;
  onRecord: () => void;
};

export function ActionButtons({
  selected,
  uploading,
  upload,
  analyzing,
  analyze,
  recording,
  cacheing,
  onFileSelect,
  onUpload,
  onAnalyze,
  onRecord,
}: ActionButtonsProps) {
  return (
    <div className="flex gap-4 items-center flex-col sm:flex-row">
        {/* browse file button */}
      <input
        className="rounded-full px-5 py-3 font-medium bg-gray-200 hover:bg-gray-300 text-black"
        type="file"
        accept="audio/*"
        onChange={onFileSelect}
      />

        {/* upload file button */}
      <button
        onClick={onUpload}
        disabled={!selected || uploading}
        className={`rounded-full px-5 py-3 font-medium ${
          selected && !uploading
            ? "bg-gray-200 hover:bg-gray-300 text-black"
            : "bg-gray-400 cursor-not-allowed text-gray-200"
        }`}
      >
        {uploading ? "Uploading..." : "Upload Song"}
      </button>

        {/* analyze button after uploading song */}
      <button
        onClick={onAnalyze}
        disabled={!upload || uploading}
        className={`rounded-full px-5 py-3 font-medium ${
          upload && !uploading
            ? "bg-gray-200 hover:bg-gray-300 text-black"
            : "bg-gray-400 cursor-not-allowed text-gray-200"
        }`}
      >
        {analyzing ? "Analyzing..." : "Analyze Song"}
      </button>

        {/* record button after analyzing song */}
      <button
        onClick={onRecord}
        disabled={!analyze || analyzing || cacheing}
        className={`rounded-full px-5 py-3 font-medium ${
          analyze && !analyzing && !cacheing
            ? recording
              ? "bg-red-500 hover:bg-red-600 text-white"
              : "bg-gray-200 hover:bg-gray-300 text-black"
            : "bg-gray-400 cursor-not-allowed text-gray-200"
        }`}
      >
        {recording ? "Stop Recording" : "Start Recording"}
      </button>
    </div>
  );
}
