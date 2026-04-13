function SkeletonTable() {
  return (
    <div className="rounded-lg border border-[#810055]/20 bg-white p-6 shadow-sm">
      <div className="mb-4 h-8 w-56 animate-pulse rounded-lg bg-[#f2f1ec]" />
      {Array.from({ length: 5 }).map((_, i) => (
        <div key={i} className="mb-2 h-10 animate-pulse rounded-lg bg-[#f9ecf5]" />
      ))}
    </div>
  );
}

export default SkeletonTable;
