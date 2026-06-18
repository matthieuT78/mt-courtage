export function UploadProgressBar({ progress, className = "" }: { progress: number | null; className?: string }) {
  if (progress === null) return null;
  return (
    <div className={`rounded-xl border border-sky-200 bg-sky-50 px-3 py-2.5 ${className}`}>
      <div className="mb-1.5 flex items-center justify-between">
        <span className="text-xs font-medium text-sky-700">Upload en cours…</span>
        <span className="text-xs font-semibold text-sky-700">{progress}%</span>
      </div>
      <div className="h-1.5 w-full overflow-hidden rounded-full bg-sky-100">
        <div
          className="h-full rounded-full bg-sky-500 transition-all duration-200"
          style={{ width: `${progress}%` }}
        />
      </div>
    </div>
  );
}
