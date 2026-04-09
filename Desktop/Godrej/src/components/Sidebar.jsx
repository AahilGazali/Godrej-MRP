import { useState } from "react";
import { NavLink } from "react-router-dom";

const items = [
  { to: "/locker-master", label: "Locker Master", icon: "LM" },
  { to: "/bom-manager", label: "BOM Manager", icon: "BM" },
  { to: "/stock-upload", label: "Stock Upload", icon: "SU" },
  { to: "/plan-entry", label: "Plan Entry", icon: "PE" },
  { to: "/mrp-calculate", label: "MRP Calculate", icon: "MC" },
];

function Sidebar() {
  const [collapsed, setCollapsed] = useState(false);

  return (
    <aside
      className={`sticky top-0 h-screen border-r border-border bg-white px-3 py-4 transition-all ${
        collapsed ? "w-20" : "w-64"
      }`}
    >
      <button
        type="button"
        onClick={() => setCollapsed((p) => !p)}
        className="mb-5 w-full rounded-lg border border-border px-3 py-2 text-left text-sm font-medium text-slate-600 hover:bg-slate-50"
      >
        {collapsed ? ">>" : "Collapse"}
      </button>
      <nav className="space-y-1">
        {items.map((item) => (
          <NavLink
            key={item.to}
            to={item.to}
            className={({ isActive }) =>
              `flex items-center gap-3 rounded-lg px-3 py-2 text-sm font-medium transition ${
                isActive ? "bg-primary text-white" : "text-slate-700 hover:bg-slate-100"
              }`
            }
          >
            <span className="inline-flex h-7 w-7 items-center justify-center rounded-md border border-border bg-slate-50 text-[10px] font-bold">
              {item.icon}
            </span>
            {!collapsed && <span>{item.label}</span>}
          </NavLink>
        ))}
      </nav>
    </aside>
  );
}

export default Sidebar;
