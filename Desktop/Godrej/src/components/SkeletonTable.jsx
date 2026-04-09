function SkeletonTable() {
  return (
    <div className="rounded-xl border border-border bg-white p-4 shadow-card">
      <div className="mb-4 h-8 w-56 animate-pulse rounded bg-slate-200" />
      {Array.from({ length: 5 }).map((_, i) => (
        <div key={i} className="mb-2 h-10 animate-pulse rounded bg-slate-100" />
      ))}
    </div>
  );
}

export default SkeletonTable;
