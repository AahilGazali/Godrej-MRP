import { useState } from "react";
import { useNavigate } from "react-router-dom";
import { useQueryClient } from "@tanstack/react-query";
import godrejLogo from "../assets/godrej.png";

function LoginPage() {
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(false);
  const navigate = useNavigate();
  const queryClient = useQueryClient();

  const handleSubmit = async (e) => {
    e.preventDefault();
    setError("");
    setLoading(true);

    try {
      const res = await fetch("/api/login", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        credentials: "include",
        body: JSON.stringify({ email, password }),
      });

      const data = await res.json();

      if (!res.ok) {
        setError(data.message || "Login failed");
        setLoading(false);
        return;
      }

      await queryClient.invalidateQueries({ queryKey: ["me"] });
      navigate("/locker-master");
    } catch (err) {
      setError(err.message || "Network error");
      setLoading(false);
    }
  };

  return (
    <div className="flex min-h-screen items-center justify-center bg-gradient-to-br from-[#f9ecf5] to-[#f2f1ec] px-4">
      <div className="w-full max-w-md rounded-2xl border border-[#810055]/20 bg-white p-8 shadow-xl">
        <div className="mb-8 flex flex-col items-center">
          <img
            src={godrejLogo}
            alt="Godrej Logo"
            className="mb-4 h-16 object-contain"
          />
          <h1 className="text-2xl font-bold tracking-tight text-[#810055]">
            MRP System
          </h1>
          <p className="mt-1 text-sm text-gray-600">Sign in to your account</p>
        </div>

        <form onSubmit={handleSubmit} className="space-y-5">
          <div>
            <label
              htmlFor="email"
              className="mb-1.5 block text-sm font-medium text-gray-700"
            >
              Email
            </label>
            <input
              id="email"
              type="email"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              placeholder="name@godrej.com"
              required
              className="h-11 w-full rounded-lg border border-[#810055]/30 px-4 text-sm text-black outline-none transition-all focus:border-transparent focus:ring-2 focus:ring-[#810055]"
            />
          </div>

          <div>
            <label
              htmlFor="password"
              className="mb-1.5 block text-sm font-medium text-gray-700"
            >
              Password
            </label>
            <input
              id="password"
              type="password"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              placeholder="••••••••"
              required
              className="h-11 w-full rounded-lg border border-[#810055]/30 px-4 text-sm text-black outline-none transition-all focus:border-transparent focus:ring-2 focus:ring-[#810055]"
            />
          </div>

          {error && (
            <div className="rounded-lg bg-red-50 px-4 py-3 text-sm text-red-700">
              {error}
            </div>
          )}

          <button
            type="submit"
            disabled={loading}
            className="h-11 w-full rounded-lg bg-[#810055] text-sm font-semibold text-white transition-all hover:bg-[#6a0046] disabled:cursor-not-allowed disabled:opacity-60"
          >
            {loading ? "Signing in..." : "Sign In"}
          </button>
        </form>
      </div>
    </div>
  );
}

export default LoginPage;
