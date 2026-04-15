import { useState } from "react";
import { NavLink } from "react-router-dom";
import godrejLogo from "../assets/godrej.png";

const items = [
  { to: "/locker-master", label: "Product Master", icon: "PM" },
  { to: "/bom-manager", label: "BOM Manager", icon: "BM" },
  { to: "/stock-upload", label: "Stock Upload", icon: "SU" },
  { to: "/plan-entry", label: "Daily Plan", icon: "DP" },
  { to: "/mrp-calculate", label: "MRP", icon: "MC" },
];

function Sidebar() {
  const [collapsed, setCollapsed] = useState(false);

  return (
    <aside
      className={`sticky top-0 hidden h-screen shrink-0 flex-col border-r border-border bg-card px-3 py-5 font-['GEGHeadline'] transition-all duration-300 md:flex ${
        collapsed ? "w-20" : "w-64"
      }`}
    >
      <button
        type="button"
        onClick={() => setCollapsed((p) => !p)}
        className="absolute -right-3.5 top-7 z-50 flex h-7 w-7 items-center justify-center rounded-full border border-border bg-card text-neutral shadow-sm transition-all duration-300 hover:border-secondary hover:bg-secondary hover:text-primary focus:outline-none"
        aria-label="Toggle Sidebar"
      >
        <svg
          xmlns="http://www.w3.org/2000/svg"
          fill="none"
          viewBox="0 0 24 24"
          strokeWidth={2.5}
          stroke="currentColor"
          className={`h-3.5 w-3.5 transition-transform duration-300 ${
            collapsed ? "rotate-180" : ""
          }`}
        >
          <path strokeLinecap="round" strokeLinejoin="round" d="M15.75 19.5L8.25 12l7.5-7.5" />
        </svg>
      </button>

      <div className="mb-4 flex min-h-[4rem] flex-col items-center justify-center border-b border-border pb-4 transition-all duration-300">
        <img
          src={godrejLogo}
          alt="Godrej Logo"
          className={`object-contain transition-all duration-300 ${
            collapsed ? "h-7" : "mb-2 h-10"
          }`}
        />
        {!collapsed && (
          <p className="animate-in fade-in text-xs font-semibold uppercase tracking-widest text-neutral duration-300">
            MRP System
          </p>
        )}
      </div>

      <nav className="mt-2 flex flex-1 flex-col gap-1.5 overflow-y-auto overflow-x-hidden p-1 -mx-1">
        {items.map((item) => (
          <NavLink
            key={item.to}
            to={item.to}
            className={({ isActive }) =>
              `group flex items-center gap-3 rounded-lg px-2 py-2.5 text-sm font-medium transition-all duration-200 ${
                isActive
                  ? "bg-secondary text-primary shadow-sm"
                  : "text-neutral hover:bg-secondary/10 hover:text-secondary"
              }`
            }
          >
            {({ isActive }) => (
              <>
                <span
                  className={`inline-flex h-8 w-8 flex-shrink-0 items-center justify-center rounded-md border text-[10px] font-bold transition-colors duration-200 ${
                    isActive
                      ? "border-primary/30 bg-primary/20 text-primary"
                      : "border-border bg-card text-neutral group-hover:border-secondary/30 group-hover:bg-secondary/10 group-hover:text-secondary"
                  }`}
                >
                  {item.icon}
                </span>
                {!collapsed && (
                   <span className="truncate whitespace-nowrap">{item.label}</span>
                )}
              </>
            )}
          </NavLink>
        ))}
      </nav>
    </aside>
  );
}

export default Sidebar; 