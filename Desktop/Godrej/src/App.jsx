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
    <div className="min-h-screen bg-page font-sans text-black">
      <div className="flex min-h-screen">
        <Sidebar />
        <main className="min-w-0 flex-1 bg-page">
          <header className="sticky top-0 z-20 flex min-h-16 items-center justify-between border-b border-[#810055]/20 bg-white px-4 py-4 shadow-sm md:px-8">
            <h1 className="text-2xl font-semibold text-black">{title}</h1>
            <div className="hidden text-xs font-medium uppercase tracking-wide text-black sm:block">
              Godrej Locker Manufacturing MRP
            </div>
          </header>
          <div className="space-y-6 p-4 pb-10 md:p-8">
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
