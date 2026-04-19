import { Navigate } from "react-router-dom";
import { useMe } from "../hooks/useAuth";

function ProtectedRoute({ children }) {
  const { data: user, isLoading } = useMe();

  if (isLoading) {
    return (
      <div className="flex h-screen items-center justify-center bg-appbg">
        <div className="flex flex-col items-center gap-4">
          <div className="h-10 w-10 animate-spin rounded-full border-4 border-[#810055]/20 border-t-[#810055]"></div>
          <p className="text-sm font-medium text-gray-600">Loading...</p>
        </div>
      </div>
    );
  }

  if (!user) {
    return <Navigate to="/login" replace />;
  }

  return children;
}

export default ProtectedRoute;
