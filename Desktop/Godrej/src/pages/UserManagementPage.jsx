import { useState } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import toast from "react-hot-toast";
import DataTable from "../components/DataTable";
import SkeletonTable from "../components/SkeletonTable";

function UserManagementPage() {
  const queryClient = useQueryClient();
  const [showModal, setShowModal] = useState(false);
  const [form, setForm] = useState({ name: "", email: "", password: "", role: "employee" });

  const { data: users = [], isLoading } = useQuery({
    queryKey: ["users"],
    queryFn: () =>
      fetch("/api/users", { credentials: "include" }).then((r) => {
        if (!r.ok) throw new Error("Failed to fetch users");
        return r.json();
      }),
  });

  const createUserMutation = useMutation({
    mutationFn: (payload) =>
      fetch("/api/users", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        credentials: "include",
        body: JSON.stringify(payload),
      }).then(async (r) => {
        const data = await r.json();
        if (!r.ok) throw new Error(data.message || "Failed to create user");
        return data;
      }),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["users"] });
      toast.success("User created successfully");
      closeModal();
    },
    onError: (err) => {
      toast.error(err.message);
    },
  });

  const updateUserMutation = useMutation({
    mutationFn: ({ id, ...payload }) =>
      fetch(`/api/users/${id}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        credentials: "include",
        body: JSON.stringify(payload),
      }).then(async (r) => {
        const data = await r.json();
        if (!r.ok) throw new Error(data.message || "Failed to update user");
        return data;
      }),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["users"] });
      toast.success("User updated");
    },
    onError: (err) => {
      toast.error(err.message);
    },
  });

  const closeModal = () => {
    setShowModal(false);
    setForm({ name: "", email: "", password: "", role: "employee" });
  };

  const handleCreateUser = () => {
    if (!form.name.trim() || !form.email.trim() || !form.password.trim()) {
      toast.error("All fields are required");
      return;
    }
    if (!form.email.endsWith("@godrej.com")) {
      toast.error("Email must end with @godrej.com");
      return;
    }
    createUserMutation.mutate(form);
  };

  const handleRoleChange = (userId, newRole) => {
    updateUserMutation.mutate({ id: userId, role: newRole });
  };

  const handleStatusToggle = (userId, currentStatus) => {
    updateUserMutation.mutate({ id: userId, is_active: !currentStatus });
  };

  return (
    <div className="space-y-6">
      <section className="rounded-lg border border-[#810055]/20 bg-white p-6 shadow-sm">
        <div className="mb-5 flex items-center justify-between border-b border-[#810055]/20 pb-4">
          <h2 className="text-lg font-medium text-black">User Management</h2>
          <button
            type="button"
            onClick={() => setShowModal(true)}
            className="rounded-lg bg-secondary px-4 py-2 text-sm font-medium text-white transition-colors duration-150 hover:bg-secondary"
          >
            + Add User
          </button>
        </div>

        {isLoading ? (
          <SkeletonTable />
        ) : (
          <DataTable
            searchKeys={["name", "email"]}
            columns={[
              { key: "name", label: "Name" },
              { key: "email", label: "Email" },
              {
                key: "role",
                label: "Role",
                render: (value, row) => (
                  <select
                    value={value}
                    onChange={(e) => handleRoleChange(row.id, e.target.value)}
                    disabled={updateUserMutation.isPending}
                    className="rounded-md border border-[#810055]/30 px-2 py-1 text-sm text-black outline-none focus:border-transparent focus:ring-2 focus:ring-secondary"
                  >
                    <option value="manager">Manager</option>
                    <option value="employee">Employee</option>
                  </select>
                ),
              },
              {
                key: "is_active",
                label: "Status",
                render: (value, row) => (
                  <button
                    type="button"
                    onClick={() => handleStatusToggle(row.id, value)}
                    disabled={updateUserMutation.isPending}
                    className={`rounded-full px-3 py-1 text-xs font-semibold transition-colors ${
                      value
                        ? "bg-green-100 text-green-700 hover:bg-green-200"
                        : "bg-red-100 text-red-700 hover:bg-red-200"
                    } disabled:cursor-not-allowed disabled:opacity-50`}
                  >
                    {value ? "Active" : "Inactive"}
                  </button>
                ),
              },
            ]}
            rows={users}
            emptyText="No users found"
          />
        )}
      </section>

      {/* Add User Modal */}
      {showModal && (
        <div className="fixed inset-0 z-30 grid place-items-center bg-gray-900/40 p-4">
          <div className="relative w-full max-w-lg rounded-lg border border-[#810055]/20 bg-white p-6 shadow-lg">
            <button
              onClick={closeModal}
              className="absolute right-4 top-4 flex items-center justify-center rounded-md p-1.5 text-neutral transition-colors duration-200 hover:bg-secondary/10 hover:text-secondary focus:outline-none"
              aria-label="Close modal"
            >
              <svg
                xmlns="http://www.w3.org/2000/svg"
                fill="none"
                viewBox="0 0 24 24"
                strokeWidth={2.5}
                stroke="currentColor"
                className="h-4 w-4"
              >
                <path strokeLinecap="round" strokeLinejoin="round" d="M6 18L18 6M6 6l12 12" />
              </svg>
            </button>

            <h3 className="mb-5 text-lg font-medium text-black">Add New User</h3>

            <div className="grid gap-4">
              <div>
                <label className="mb-1.5 block text-sm font-medium text-gray-700">Name</label>
                <input
                  value={form.name}
                  onChange={(e) => setForm((p) => ({ ...p, name: e.target.value }))}
                  className="h-10 w-full rounded-lg border border-[#810055]/30 px-3 py-2 text-sm text-black outline-none focus:border-transparent focus:ring-2 focus:ring-secondary"
                  placeholder="Full Name"
                />
              </div>

              <div>
                <label className="mb-1.5 block text-sm font-medium text-gray-700">Email</label>
                <input
                  type="email"
                  value={form.email}
                  onChange={(e) => setForm((p) => ({ ...p, email: e.target.value }))}
                  className="h-10 w-full rounded-lg border border-[#810055]/30 px-3 py-2 text-sm text-black outline-none focus:border-transparent focus:ring-2 focus:ring-secondary"
                  placeholder="name@godrej.com"
                />
              </div>

              <div>
                <label className="mb-1.5 block text-sm font-medium text-gray-700">Password</label>
                <input
                  type="password"
                  value={form.password}
                  onChange={(e) => setForm((p) => ({ ...p, password: e.target.value }))}
                  className="h-10 w-full rounded-lg border border-[#810055]/30 px-3 py-2 text-sm text-black outline-none focus:border-transparent focus:ring-2 focus:ring-secondary"
                  placeholder="••••••••"
                />
              </div>

              <div>
                <label className="mb-1.5 block text-sm font-medium text-gray-700">Role</label>
                <select
                  value={form.role}
                  onChange={(e) => setForm((p) => ({ ...p, role: e.target.value }))}
                  className="h-10 w-full rounded-lg border border-[#810055]/30 px-3 text-sm text-black outline-none focus:border-transparent focus:ring-2 focus:ring-secondary"
                >
                  <option value="employee">Employee</option>
                  <option value="manager">Manager</option>
                </select>
              </div>
            </div>

            <div className="mt-6 flex justify-end gap-2">
              <button
                type="button"
                onClick={closeModal}
                className="rounded-lg border border-[#810055]/30 px-4 py-2 text-sm font-medium text-black transition-colors duration-150 hover:bg-[#f9ecf5]"
              >
                Cancel
              </button>
              <button
                type="button"
                onClick={handleCreateUser}
                disabled={createUserMutation.isPending}
                className="rounded-lg bg-secondary px-4 py-2 text-sm font-medium text-white transition-colors duration-150 hover:bg-secondary disabled:cursor-not-allowed disabled:opacity-60"
              >
                {createUserMutation.isPending ? "Creating..." : "Create User"}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

export default UserManagementPage;
