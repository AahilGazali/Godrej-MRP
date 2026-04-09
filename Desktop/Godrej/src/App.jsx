import { Navigate, Route, Routes, useLocation } from "react-router-dom";
import Sidebar from "./components/Sidebar";
import LockerMasterPage from "./pages/LockerMasterPage";
import BomManagerPage from "./pages/BomManagerPage";
import StockUploadPage from "./pages/StockUploadPage";
import PlanEntryPage from "./pages/PlanEntryPage";
import MrpOutputPage from "./pages/MrpOutputPage";

const titles = {
  "/locker-master": "Locker Master",
  "/bom-manager": "BOM Manager",
  "/stock-upload": "Stock Upload",
  "/plan-entry": "Plan Entry",
  "/mrp-calculate": "MRP Output",
};

function App() {
  const location = useLocation();
  const title = titles[location.pathname] || "Godrej MRP";

  return (
    <div className="min-h-screen bg-appbg text-slate-800">
      <div className="mx-auto flex max-w-[1680px]">
        <Sidebar />
        <main className="min-w-0 flex-1">
          <header className="sticky top-0 z-20 flex h-16 items-center justify-between border-b border-border bg-appbg/95 px-4 backdrop-blur md:px-6">
            <h1 className="text-lg font-semibold text-slate-900 md:text-xl">{title}</h1>
            <div className="text-xs font-medium text-slate-500">Godrej Locker Manufacturing MRP</div>
          </header>
          <div className="p-4 md:p-6">
            <Routes>
              <Route path="/" element={<Navigate to="/locker-master" replace />} />
              <Route path="/locker-master" element={<LockerMasterPage />} />
              <Route path="/bom-manager" element={<BomManagerPage />} />
              <Route path="/stock-upload" element={<StockUploadPage />} />
              <Route path="/plan-entry" element={<PlanEntryPage />} />
              <Route path="/mrp-calculate" element={<MrpOutputPage />} />
            </Routes>
          </div>
        </main>
      </div>
    </div>
  );
}

export default App;
