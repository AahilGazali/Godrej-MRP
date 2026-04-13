import { useMemo, useState } from "react";

function DataTable({ columns, rows, emptyText = "No data available", rowClassName, rowStyle, showSearch = true }) {
  const [query, setQuery] = useState("");
  const defaultSortKey = columns.find((c) => c.sortable !== false)?.key;
  const [sortKey, setSortKey] = useState(defaultSortKey);
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
    <div className="overflow-hidden rounded-lg border border-gray-200 bg-white shadow-sm">
      {showSearch && (
        <div className="flex items-center justify-between gap-3 border-b border-gray-200 p-3">
          <input
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            placeholder="Search..."
            className="h-10 w-full max-w-sm rounded-lg border border-gray-300 px-3 py-2 text-sm text-gray-700 outline-none transition-shadow focus:border-transparent focus:ring-2 focus:ring-blue-500"
          />
        </div>
      )}
      {filteredRows.length === 0 ? (
        <div className="p-8 text-center text-sm text-gray-500">{emptyText}</div>
      ) : (
        <div className="max-h-[430px] overflow-x-auto overflow-y-auto">
          <table className="min-w-full border-collapse divide-y divide-gray-200 text-sm">
            <thead className="sticky top-0 z-10 bg-gray-50">
              <tr>
                {columns.map((col) => (
                  <th
                    key={col.key}
                    onClick={col.sortable === false ? undefined : () => toggleSort(col.key)}
                    className={`whitespace-nowrap px-4 py-3 text-left text-xs font-semibold uppercase tracking-wider text-gray-500 ${
                      col.sortable === false ? "" : "cursor-pointer hover:text-gray-700"
                    }`}
                  >
                    {col.label}
                  </th>
                ))}
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-200 bg-white">
              {filteredRows.map((row, idx) => (
                <tr
                  key={row.id || idx}
                  className={`transition-colors duration-100 hover:bg-blue-50 ${idx % 2 === 1 ? "bg-gray-50" : "bg-white"} ${
                    rowClassName ? rowClassName(row) : ""
                  }`}
                  style={rowStyle ? rowStyle(row) : undefined}
                >
                  {columns.map((col) => (
                    <td
                      key={col.key}
                      className={`px-4 py-3 text-sm text-gray-700 ${col.cellClassName ?? ""}`}
                    >
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
