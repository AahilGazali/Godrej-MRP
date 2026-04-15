import { useMemo, useState } from "react";

function DataTable({
  columns,
  rows,
  emptyText = "No data available",
  rowClassName,
  rowStyle,
  showSearch = true,
  searchKeys,
  searchAction,
}) {
  const [query, setQuery] = useState("");
  const defaultSortKey = columns.find((c) => c.sortable !== false)?.key;
  const [sortKey, setSortKey] = useState(defaultSortKey);
  const [sortDir, setSortDir] = useState("asc");

  const filteredRows = useMemo(() => {
    const q = query.trim().toLowerCase();
    let data = rows;
    if (q) {
      data = rows.filter((r) => {
        const values =
          Array.isArray(searchKeys) && searchKeys.length
            ? searchKeys.map((key) => r?.[key])
            : Object.values(r);
        return values.some((v) => String(v ?? "").toLowerCase().includes(q));
      });
    }
    if (sortKey) {
      data = [...data].sort((a, b) => {
        const av = String(a[sortKey] ?? "");
        const bv = String(b[sortKey] ?? "");
        return sortDir === "asc" ? av.localeCompare(bv) : bv.localeCompare(av);
      });
    }
    return data;
  }, [rows, query, sortKey, sortDir, searchKeys]);

  const toggleSort = (key) => {
    if (sortKey === key) {
      setSortDir((d) => (d === "asc" ? "desc" : "asc"));
    } else {
      setSortKey(key);
      setSortDir("asc");
    }
  };

  return (
    <div className="overflow-hidden rounded-lg border border-[#810055]/20 bg-white shadow-sm">
      {(showSearch || searchAction) && (
        <div className="flex flex-col gap-3 border-b border-[#810055]/20 p-3 sm:flex-row sm:items-center sm:justify-between">
          {showSearch ? (
            <input
              value={query}
              onChange={(e) => setQuery(e.target.value)}
              placeholder="Search..."
              className="h-10 w-full max-w-sm rounded-lg border border-[#810055]/30 px-3 py-2 text-sm text-black outline-none transition-shadow focus:border-transparent focus:ring-2 focus:ring-secondary"
            />
          ) : (
            <div />
          )}
          {searchAction ? <div className="shrink-0">{searchAction}</div> : null}
        </div>
      )}
      {filteredRows.length === 0 ? (
        <div className="p-8 text-center text-sm text-black">{emptyText}</div>
      ) : (
        <div className="max-h-[430px] overflow-x-auto overflow-y-auto">
          <table className="min-w-full border-collapse divide-y divide-[#810055]/20 text-sm">
            <thead className="sticky top-0 z-10 bg-white">
              <tr>
                {columns.map((col) => (
                  <th
                    key={col.key}
                    onClick={col.sortable === false ? undefined : () => toggleSort(col.key)}
                    className={`whitespace-nowrap px-4 py-3 text-left text-xs font-semibold uppercase tracking-wider text-black ${
                      col.sortable === false ? "" : "cursor-pointer hover:text-secondary"
                    }`}
                  >
                    {col.label}
                  </th>
                ))}
              </tr>
            </thead>
            <tbody className="divide-y divide-[#810055]/20 bg-white">
              {filteredRows.map((row, idx) => (
                <tr
                  key={row.id || idx}
                  className={`transition-colors duration-100 hover:bg-[#f9ecf5] ${idx % 2 === 1 ? "bg-[#fdf7fb]" : "bg-white"} ${
                    rowClassName ? rowClassName(row) : ""
                  }`}
                  style={rowStyle ? rowStyle(row) : undefined}
                >
                  {columns.map((col) => (
                    <td
                      key={col.key}
                      className={`px-4 py-3 text-sm text-black ${col.cellClassName ?? ""}`}
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
