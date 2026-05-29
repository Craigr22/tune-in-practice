import { Navigate } from "react-router-dom";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/lib/db";
import { useAuth } from "@/hooks/useAuth";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { toast } from "sonner";

type AppRole = "admin" | "teacher" | "student";

type UserRow = {
  user_id: string;
  role: AppRole;
  name: string;
  email: string | null;
};

export default function AdminUsers() {
  const { role } = useAuth();
  const qc = useQueryClient();

  const { data: rows = [] } = useQuery({
    queryKey: ["admin-users"],
    enabled: role === "admin",
    queryFn: async (): Promise<UserRow[]> => {
      const [{ data: roles }, { data: teachers }, { data: students }] = await Promise.all([
        supabase.from("user_roles").select("user_id, role"),
        supabase.from("teachers").select("user_id, name, email"),
        supabase.from("students").select("user_id, name, email"),
      ]);
      const tMap = new Map((teachers ?? []).filter((t: any) => t.user_id).map((t: any) => [t.user_id, t]));
      const sMap = new Map((students ?? []).filter((s: any) => s.user_id).map((s: any) => [s.user_id, s]));
      return (roles ?? []).map((r: any) => {
        const t = tMap.get(r.user_id) as any;
        const s = sMap.get(r.user_id) as any;
        return {
          user_id: r.user_id,
          role: r.role,
          name: t?.name ?? s?.name ?? "—",
          email: t?.email ?? s?.email ?? null,
        };
      });
    },
  });

  if (role !== "admin") return <Navigate to="/" replace />;

  const setRole = async (userId: string, next: AppRole) => {
    const { error: delErr } = await supabase.from("user_roles").delete().eq("user_id", userId);
    if (delErr) return toast.error(delErr.message);
    const { error } = await supabase.from("user_roles").insert({ user_id: userId, role: next });
    if (error) return toast.error(error.message);
    toast.success("Role updated");
    qc.invalidateQueries({ queryKey: ["admin-users"] });
  };

  return (
    <div className="max-w-5xl mx-auto p-6 space-y-4">
      <h1 className="text-2xl font-semibold">Users</h1>
      <div className="border rounded-lg overflow-hidden">
        <table className="w-full text-sm">
          <thead className="bg-muted">
            <tr>
              <th className="text-left p-3">Name</th>
              <th className="text-left p-3">Email</th>
              <th className="text-left p-3 w-48">Role</th>
            </tr>
          </thead>
          <tbody>
            {rows.map((r) => (
              <tr key={r.user_id} className="border-t">
                <td className="p-3">{r.name}</td>
                <td className="p-3 text-muted-foreground">{r.email ?? "—"}</td>
                <td className="p-3">
                  <Select value={r.role} onValueChange={(v) => setRole(r.user_id, v as AppRole)}>
                    <SelectTrigger><SelectValue /></SelectTrigger>
                    <SelectContent>
                      <SelectItem value="admin">admin</SelectItem>
                      <SelectItem value="teacher">teacher</SelectItem>
                      <SelectItem value="student">student</SelectItem>
                    </SelectContent>
                  </Select>
                </td>
              </tr>
            ))}
            {rows.length === 0 && (
              <tr><td colSpan={3} className="p-6 text-center text-muted-foreground">No users yet.</td></tr>
            )}
          </tbody>
        </table>
      </div>
    </div>
  );
}
