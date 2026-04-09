import { useMemo, useState } from "react";

function DataTable({ columns, rows, emptyText = "No data available", rowClassName, rowStyle, showSearch = true }) {
  const [query, setQuery] = useState("");
  const [sortKey, setSortKey] = useState(columns[0]?.key);
  const [sortDir, setSortDir] = useState("asc");

  const filteredRows = useMemo(() => {
    const q = query.trim().toLowerCase();
    let data = rows;
    if (q) {
      data = rows.filter((r) => Object.values(r).some((v) => String(v).toLowerCase().includes(q)));
    }
    if (sortKey) {
      data = [...data].sort((a, b) => {
        const av = String(a[sortKey] ?? "");
        const bv = String(b[sortKey] ?? "");
        return sortDir === "asc" ? av.localeCompare(bv) : bv.localeCompare(av);
      });
    }
    return data;
  }, [rows, query, sortKey, sortDir]);

  const toggleSort = (key) => {
    if (sortKey === key) {
      setSortDir((d) => (d === "asc" ? "desc" : "asc"));
    } else {
      setSortKey(key);
      setSortDir("asc");
    }
  };

  return (
    <div className="rounded-xl border border-border bg-white shadow-card">
      {showSearch && (
        <div className="flex items-center justify-between gap-3 border-b border-border p-3">
          <input
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            placeholder="Search..."
            className="w-full max-w-sm rounded-md border border-border px-3 py-2 text-sm outline-none focus:border-primary"
          />
        </div>
      )}
      {filteredRows.length === 0 ? (
        <div className="p-8 text-center text-sm text-slate-500">{emptyText}</div>
      ) : (
        <div className="max-h-[430px] overflow-auto">
          <table className="w-full border-collapse text-sm">
            <thead className="sticky top-0 z-10 bg-slate-100">
              <tr>
                {columns.map((col) => (
                  <th
                    key={col.key}
                    onClick={() => toggleSort(col.key)}
                    className="cursor-pointer border-b border-border px-4 py-3 text-left font-semibold text-slate-700"
                  >
                    {col.label}
                  </th>
                ))}
              </tr>
            </thead>
            <tbody>
              {filteredRows.map((row, idx) => (
                <tr
                  key={row.id || idx}
                  className={`${idx % 2 ? "bg-slate-50" : "bg-white"} ${
                    rowClassName ? rowClassName(row) : ""
                  }`}
                  style={rowStyle ? rowStyle(row) : undefined}
                >
                  {columns.map((col) => (
                    <td key={col.key} className="border-b border-border px-4 py-3">
                      {col.render ? col.render(row[col.key], row) : row[col.key]}
                    </td>
                  ))}
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
}

export default DataTable;
