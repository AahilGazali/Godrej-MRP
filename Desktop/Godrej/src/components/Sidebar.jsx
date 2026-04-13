import { useState } from "react";
import { NavLink } from "react-router-dom";
import godrejLogo from "../assets/godrej.png";

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
      className={`hidden h-screen flex-shrink-0 flex-col border-r border-[#810055]/20 bg-[#ffffff] px-3 py-5 font-['GEGHeadline'] transition-all duration-150 md:flex ${
        collapsed ? "w-20" : "w-64"
      }`}
    >
      <div className="mb-4 border-b border-[#810055]/20 pb-4">
        {!collapsed ? (
          <div className="flex flex-col items-center px-1">
            <img
              src={godrejLogo}
              alt="Godrej Logo"
              className="h-10 object-contain mb-2"
            />
            <p className="text-xs font-medium uppercase tracking-widest text-black">
              MRP System
            </p>
          </div>
        ) : (
          <div className="flex justify-center">
            <img
              src={godrejLogo}
              alt="Godrej Logo"
              className="h-7 object-contain"
            />
          </div>
        )}
      </div>
      <button
        type="button"
        onClick={() => setCollapsed((p) => !p)}
        className="mb-4 w-full rounded-lg border border-[#810055]/30 px-3 py-2 text-left text-sm font-medium text-black transition-colors duration-150 hover:bg-[#810055] hover:text-white"
      >
        {collapsed ? "»" : "Collapse"}
      </button>
      <nav className="flex flex-1 flex-col gap-1">
        {items.map((item) => (
          <NavLink
            key={item.to}
            to={item.to}
            className={({ isActive }) =>
              `flex items-center gap-3 rounded-lg px-3 py-2 text-sm font-medium transition-colors duration-150 ${
                isActive
                  ? "bg-[#810055] text-white"
                  : "text-black hover:bg-[#810055] hover:text-white"
              }`
            }
          >
            <span className="inline-flex h-8 w-8 flex-shrink-0 items-center justify-center rounded-md border border-[#810055]/30 bg-white text-[10px] font-bold text-black">
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