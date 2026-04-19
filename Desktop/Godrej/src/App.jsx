import { Navigate, Route, Routes, useLocation } from "react-router-dom";
import Sidebar from "./components/Sidebar";
import ProtectedRoute from "./components/ProtectedRoute";
import LoginPage from "./pages/LoginPage";
import LockerMasterPage from "./pages/LockerMasterPage";
import BomManagerPage from "./pages/BomManagerPage";
import StockUploadPage from "./pages/StockUploadPage";
import PlanEntryPage from "./pages/PlanEntryPage";
import MrpOutputPage from "./pages/MrpOutputPage";
import UserManagementPage from "./pages/UserManagementPage";
import { useMe } from "./hooks/useAuth";

const titles = {
  "/locker-master": "Locker Master",
  "/bom-manager": "BOM Manager",
  "/stock-upload": "Stock Upload",
  "/plan-entry": "Plan Entry",
  "/mrp-calculate": "MRP Output",
  "/users": "User Management",
};

function AppLayout() {
  const location = useLocation();
  const title = titles[location.pathname] || "Godrej MRP";
  const { data: user } = useMe();

  return (
    <div className="flex h-screen min-h-0 overflow-hidden bg-appbg font-sans text-neutral selection:bg-secondary/20 selection:text-secondary">
      <Sidebar user={user} />
      <main className="min-h-0 min-w-0 flex-1 overflow-y-auto bg-appbg">
        <header className="sticky top-0 z-20 flex min-h-16 items-center justify-between border-b border-border bg-white/90 px-4 py-4 shadow-sm backdrop-blur-md transition-all duration-300 md:px-8">
          <div className="flex items-center gap-3">
            <h1 className="text-2xl font-bold tracking-tight text-neutral">{title}</h1>
          </div>
          <div className="hidden items-center gap-3 sm:flex">
            <span className="flex h-2 w-2 rounded-full bg-secondary shadow-[0_0_8px_rgba(129,0,85,0.6)] animate-pulse"></span>
            <div className="text-xs font-bold uppercase tracking-widest text-secondary">
              SDLC
            </div>
          </div>
        </header>
        <div className="space-y-6 p-4 pb-10 md:p-8">
          <Routes>
            <Route path="/" element={<Navigate to="/locker-master" replace />} />
            <Route path="/locker-master" element={<LockerMasterPage user={user} />} />
            <Route path="/bom-manager" element={<BomManagerPage user={user} />} />
            <Route path="/stock-upload" element={<StockUploadPage user={user} />} />
            <Route path="/plan-entry" element={<PlanEntryPage user={user} />} />
            <Route path="/mrp-calculate" element={<MrpOutputPage user={user} />} />
            <Route path="/users" element={<UserManagementPage />} />
          </Routes>
        </div>
      </main>
    </div>
  );
}

function App() {
  return (
    <Routes>
      <Route path="/login" element={<LoginPage />} />
      <Route
        path="/*"
        element={
          <ProtectedRoute>
            <AppLayout />
          </ProtectedRoute>
        }
      />
    </Routes>
  );
}

export default App;
