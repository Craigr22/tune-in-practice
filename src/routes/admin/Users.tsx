import { useMemo, useState } from "react";
import { Navigate } from "react-router-dom";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/lib/db";
import { useAuth } from "@/hooks/useAuth";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger, DialogFooter } from "@/components/ui/dialog";
import {
  AlertDialog,
  AlertDialogContent,
  AlertDialogHeader,
  AlertDialogTitle,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogCancel,
  AlertDialogAction,
} from "@/components/ui/alert-dialog";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { Label } from "@/components/ui/label";
import { Plus, Mail, KeyRound } from "lucide-react";
import StudentLoginDialog, { type StudentLoginTarget } from "@/components/admin/StudentLoginDialog";
import { toast } from "sonner";

type AppRole = "admin" | "teacher" | "student";

type UserRow = {
  key: string;
  user_id: string | null;
  role: AppRole;
  name: string;
  email: string | null;
  phone: string | null;
  /** Students only: the username they sign in with, once provisioned. */
  login_username?: string | null;
  source: "auth" | "teacher" | "student";
};

function AddUserDialog({ instrumentsMap }: { instrumentsMap: Map<string, string> }) {
  const qc = useQueryClient();
  const [open, setOpen] = useState(false);
  const [role, setRole] = useState<"admin" | "teacher" | "student">("student");
  const [form, setForm] = useState({ name: "", email: "", phone: "", parent_name: "", fee_amount: "", rate: "" });
  const [selectedInstruments, setSelectedInstruments] = useState<string[]>([]);
  const [saving, setSaving] = useState(false);

  const reset = () => {
    setForm({ name: "", email: "", phone: "", parent_name: "", fee_amount: "", rate: "" });
    setSelectedInstruments([]);
    setRole("student");
  };

  const submit = async () => {
    // An admin has no teacher/student record — just an invited email that
    // becomes an admin account the moment they sign in.
    if (role === "admin") {
      const email = form.email.trim().toLowerCase();
      if (!email) return toast.error("Email required for an admin");
      setSaving(true);
      const { error } = await supabase
        .from("pending_roles")
        .upsert({ email, role: "admin" }, { onConflict: "email" });
      if (error) { setSaving(false); return toast.error(error.message); }

      const { error: mailErr } = await supabase.auth.signInWithOtp({
        email,
        options: { shouldCreateUser: true, emailRedirectTo: window.location.origin },
      });
      setSaving(false);
      if (mailErr) {
        toast.error(`Saved, but the invite email failed: ${mailErr.message}`);
      } else {
        toast.success(`Admin invite sent to ${email}`);
      }
      qc.invalidateQueries({ queryKey: ["admin-users"] });
      qc.invalidateQueries({ queryKey: ["pending-roles"] });
      reset();
      setOpen(false);
      return;
    }

    if (!form.name.trim()) return toast.error("Name required");
    setSaving(true);
    if (role === "student") {
      const { error } = await supabase.from("students").insert({
        name: form.name.trim(),
        email: form.email.trim() || null,
        phone: form.phone.trim() || null,
        parent_name: form.parent_name.trim() || null,
        fee_amount: Number(form.fee_amount || 0),
      });
      setSaving(false);
      if (error) return toast.error(error.message);
      toast.success("Student added");
      qc.invalidateQueries({ queryKey: ["students"] });
    } else {
      const { error } = await supabase.from("teachers").insert({
        name: form.name.trim(),
        email: form.email.trim() || null,
        phone: form.phone.trim() || null,
        rate: Number(form.rate || 0),
        instruments: selectedInstruments,
      });
      setSaving(false);
      if (error) return toast.error(error.message);
      toast.success("Teacher added");
      qc.invalidateQueries({ queryKey: ["teachers"] });
    }
    qc.invalidateQueries({ queryKey: ["admin-users"] });
    reset();
    setOpen(false);
  };

  const toggleInstrument = (id: string) =>
    setSelectedInstruments((s) => (s.includes(id) ? s.filter((x) => x !== id) : [...s, id]));

  return (
    <Dialog open={open} onOpenChange={(o) => { setOpen(o); if (!o) reset(); }}>
      <DialogTrigger asChild>
        <Button size="sm"><Plus className="w-4 h-4 mr-1" />Add user</Button>
      </DialogTrigger>
      <DialogContent>
        <DialogHeader><DialogTitle>Add user</DialogTitle></DialogHeader>
        <div className="space-y-3">
          <div className="space-y-1">
            <Label>Role</Label>
            <Select value={role} onValueChange={(v) => setRole(v as any)}>
              <SelectTrigger><SelectValue /></SelectTrigger>
              <SelectContent>
                <SelectItem value="student">Student</SelectItem>
                <SelectItem value="teacher">Teacher</SelectItem>
                <SelectItem value="admin">Admin</SelectItem>
              </SelectContent>
            </Select>
          </div>

          {role === "admin" ? (
            <div className="space-y-1">
              <Label>Email *</Label>
              <Input
                type="email"
                value={form.email}
                onChange={(e) => setForm({ ...form, email: e.target.value })}
                placeholder="name@example.com"
              />
              <p className="text-xs text-muted-foreground">
                We'll email them a sign-in link. They become an admin as soon as they sign in —
                full access to schedule, people and course work.
              </p>
            </div>
          ) : (
            <>
              <div className="space-y-1">
                <Label>Name *</Label>
                <Input value={form.name} onChange={(e) => setForm({ ...form, name: e.target.value })} />
              </div>
              <div className="space-y-1">
                <Label>Email</Label>
                <Input value={form.email} onChange={(e) => setForm({ ...form, email: e.target.value })} />
              </div>
              <div className="space-y-1">
                <Label>Phone</Label>
                <Input value={form.phone} onChange={(e) => setForm({ ...form, phone: e.target.value })} />
              </div>
            </>
          )}

          {role === "student" && (
            <>
              <div className="space-y-1">
                <Label>Parent name</Label>
                <Input value={form.parent_name} onChange={(e) => setForm({ ...form, parent_name: e.target.value })} />
              </div>
              <div className="space-y-1">
                <Label>Fee amount</Label>
                <Input type="number" value={form.fee_amount} onChange={(e) => setForm({ ...form, fee_amount: e.target.value })} />
              </div>
            </>
          )}

          {role === "teacher" && (
            <>
              <div className="space-y-1">
                <Label>Rate</Label>
                <Input type="number" value={form.rate} onChange={(e) => setForm({ ...form, rate: e.target.value })} />
              </div>
              {instrumentsMap.size > 0 && (
                <div className="space-y-1">
                  <Label>Instruments</Label>
                  <div className="flex flex-wrap gap-2">
                    {Array.from(instrumentsMap.entries()).map(([id, name]) => (
                      <button
                        key={id}
                        type="button"
                        onClick={() => toggleInstrument(id)}
                        className={`text-xs px-2 py-1 rounded-full border ${selectedInstruments.includes(id) ? "bg-primary text-primary-foreground" : "bg-muted"}`}
                      >
                        {name}
                      </button>
                    ))}
                  </div>
                </div>
              )}
            </>
          )}
        </div>
        <DialogFooter>
          <Button onClick={submit} disabled={saving}>{saving ? "Saving…" : "Save"}</Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

export default function AdminUsers() {
  const { role } = useAuth();
  const qc = useQueryClient();
  const [search, setSearch] = useState("");
  const [filterRole, setFilterRole] = useState<"all" | AppRole>("all");
  const [pending, setPending] = useState<{ userId: string; name: string; current: AppRole; next: AppRole } | null>(null);
  const [invitingEmail, setInvitingEmail] = useState<string | null>(null);
  const [invitedEmails, setInvitedEmails] = useState<Set<string>>(new Set());
  const [loginFor, setLoginFor] = useState<StudentLoginTarget | null>(null);
  const [editingKey, setEditingKey] = useState<string | null>(null);
  const [editEmail, setEditEmail] = useState("");

  /** Fix a typo'd address. The record's key carries its table and id. */
  const saveEmail = async (row: UserRow) => {
    const email = editEmail.trim().toLowerCase() || null;
    const [prefix, id] = row.key.split(":");
    const table = prefix === "t" ? "teachers" : prefix === "s" ? "students" : null;
    if (!table) return toast.error("This account's email is managed elsewhere.");
    const { error } = await supabase.from(table).update({ email }).eq("id", id);
    if (error) return toast.error(error.message);
    toast.success(email ? `Email updated to ${email}` : "Email cleared");
    setEditingKey(null);
    qc.invalidateQueries({ queryKey: ["admin-users"] });
    qc.invalidateQueries({ queryKey: [table] });
  };

  /**
   * Emails a sign-in link. Supabase creates the account when they click it,
   * and a database trigger links it to this teacher/student record and sets
   * their role — so there are no passwords to set, send or store.
   */
  const sendInvite = async (email: string, name: string) => {
    setInvitingEmail(email);
    const { error } = await supabase.auth.signInWithOtp({
      email,
      options: { shouldCreateUser: true, emailRedirectTo: window.location.origin },
    });
    setInvitingEmail(null);
    if (error) {
      toast.error(
        error.message.toLowerCase().includes("rate")
          ? "Too many invites just now — Supabase limits how fast its built-in mail sends. Try again shortly, or set up a custom SMTP sender."
          : error.message,
      );
      return;
    }
    setInvitedEmails((s) => new Set(s).add(email));
    toast.success(`Invite sent to ${name} at ${email}`);
  };
  const [applying, setApplying] = useState(false);

  const { data: instrumentsMap = new Map() } = useQuery({
    queryKey: ["instruments-map"],
    queryFn: async () => {
      const { data } = await supabase.from("instruments").select("id, name");
      return new Map((data ?? []).map((i: any) => [i.id, i.name]));
    },
  });

  const { data: rows = [] } = useQuery({
    queryKey: ["admin-users"],
    enabled: role === "admin",
    queryFn: async (): Promise<UserRow[]> => {
      const [{ data: roles }, { data: teachers }, { data: students }, { data: invited }] = await Promise.all([
        supabase.from("user_roles").select("user_id, role"),
        supabase.from("teachers").select("id, user_id, name, email, phone"),
        // select("*") rather than naming login_username: the column arrives with
        // a migration, and naming it would fail the whole query until then —
        // silently emptying the list.
        supabase.from("students").select("*"),
        // Invited but not yet signed in — mostly admins, who have no record.
        (supabase as any).from("pending_roles").select("email, role"),
      ]);
      const tByUser = new Map((teachers ?? []).filter((t: any) => t.user_id).map((t: any) => [t.user_id, t]));
      const sByUser = new Map((students ?? []).filter((s: any) => s.user_id).map((s: any) => [s.user_id, s]));
      const seenUserIds = new Set<string>();
      const list: UserRow[] = [];

      (roles ?? []).forEach((r: any) => {
        seenUserIds.add(r.user_id);
        const t = tByUser.get(r.user_id) as any;
        const s = sByUser.get(r.user_id) as any;
        list.push({
          key: `auth:${r.user_id}`,
          user_id: r.user_id,
          role: r.role,
          name: t?.name ?? s?.name ?? "—",
          email: t?.email ?? s?.email ?? null,
          phone: t?.phone ?? s?.phone ?? null,
          source: "auth",
        });
      });

      (teachers ?? []).forEach((t: any) => {
        if (t.user_id && seenUserIds.has(t.user_id)) return;
        list.push({ key: `t:${t.id}`, user_id: t.user_id, role: "teacher", name: t.name, email: t.email, phone: t.phone, source: "teacher" });
      });
      (students ?? []).forEach((s: any) => {
        if (s.user_id && seenUserIds.has(s.user_id)) return;
        list.push({ key: `s:${s.id}`, user_id: s.user_id, role: "student", name: s.name, email: s.email, phone: s.phone, source: "student", login_username: (s as any).login_username ?? null });
      });

      // Invited people with no record of their own (admins) — shown so an
      // invite isn't invisible until they sign in.
      const known = new Set(list.map((r) => (r.email ?? "").toLowerCase()).filter(Boolean));
      (invited ?? []).forEach((p: any) => {
        const email = (p.email ?? "").toLowerCase();
        if (!email || known.has(email)) return;
        list.push({
          key: `pending:${email}`,
          user_id: null,
          role: p.role as AppRole,
          name: email.split("@")[0],
          email: p.email,
          phone: null,
          source: "auth",
        });
      });

      return list.sort((a, b) => a.name.localeCompare(b.name));
    },
  });

  if (role !== "admin") return <Navigate to="/" replace />;

  const adminCount = useMemo(() => rows.filter((r) => r.user_id && r.role === "admin").length, [rows]);

  const requestRoleChange = (userId: string, name: string, current: AppRole, next: AppRole) => {
    if (next === current) return;
    // Guard: never strip the last remaining admin.
    if (current === "admin" && next !== "admin" && adminCount <= 1) {
      return toast.error("Can't change the only admin — promote another admin first.");
    }
    setPending({ userId, name, current, next });
  };

  const confirmRoleChange = async () => {
    if (!pending) return;
    setApplying(true);
    const { error: delErr } = await supabase.from("user_roles").delete().eq("user_id", pending.userId);
    if (delErr) { setApplying(false); return toast.error(delErr.message); }
    const { error } = await supabase.from("user_roles").insert({ user_id: pending.userId, role: pending.next });
    setApplying(false);
    if (error) return toast.error(error.message);
    toast.success(`${pending.name} is now ${pending.next}`);
    qc.invalidateQueries({ queryKey: ["admin-users"] });
    setPending(null);
  };

  const filtered = useMemo(() => {
    const q = search.toLowerCase();
    return rows.filter((r) => {
      if (filterRole !== "all" && r.role !== filterRole) return false;
      if (!q) return true;
      return r.name.toLowerCase().includes(q) || (r.email ?? "").toLowerCase().includes(q);
    });
  }, [rows, search, filterRole]);

  const counts = useMemo(() => ({
    all: rows.length,
    admin: rows.filter((r) => r.role === "admin").length,
    teacher: rows.filter((r) => r.role === "teacher").length,
    student: rows.filter((r) => r.role === "student").length,
  }), [rows]);

  return (
    <div className="max-w-6xl mx-auto p-6 space-y-4">
      <header className="flex items-start justify-between gap-4">
        <div>
          <h1 className="text-2xl font-semibold">Users</h1>
          <p className="text-sm text-muted-foreground">
            All admins, teachers, and students are added and managed here.
          </p>
        </div>
        <AddUserDialog instrumentsMap={instrumentsMap} />
      </header>

      <div className="flex flex-wrap gap-3 items-center">
        <Input
          placeholder="Search name or email…"
          value={search}
          onChange={(e) => setSearch(e.target.value)}
          className="max-w-xs"
        />
        <Select value={filterRole} onValueChange={(v) => setFilterRole(v as any)}>
          <SelectTrigger className="w-40"><SelectValue /></SelectTrigger>
          <SelectContent>
            <SelectItem value="all">All ({counts.all})</SelectItem>
            <SelectItem value="admin">Admins ({counts.admin})</SelectItem>
            <SelectItem value="teacher">Teachers ({counts.teacher})</SelectItem>
            <SelectItem value="student">Students ({counts.student})</SelectItem>
          </SelectContent>
        </Select>
      </div>

      <div className="border rounded-lg overflow-hidden">
        <table className="w-full text-sm">
          <thead className="bg-muted">
            <tr>
              <th className="text-left p-3">Name</th>
              <th className="text-left p-3">Email</th>
              <th className="text-left p-3">Phone</th>
              <th className="text-left p-3 w-32">Role</th>
              <th className="text-left p-3 w-40">Account</th>
            </tr>
          </thead>
          <tbody>
            {filtered.map((r) => (
              <tr key={r.key} className="border-t">
                <td className="p-3 font-medium">{r.name}</td>
                <td className="p-3 text-muted-foreground">
                  {editingKey === r.key ? (
                    <div className="flex items-center gap-1">
                      <Input
                        value={editEmail}
                        onChange={(e) => setEditEmail(e.target.value)}
                        onKeyDown={(e) => {
                          if (e.key === "Enter") saveEmail(r);
                          if (e.key === "Escape") setEditingKey(null);
                        }}
                        className="h-8 text-sm"
                        placeholder="name@example.com"
                        autoFocus
                      />
                      <Button size="sm" className="h-8" onClick={() => saveEmail(r)}>Save</Button>
                      <Button size="sm" variant="outline" className="h-8" onClick={() => setEditingKey(null)}>✕</Button>
                    </div>
                  ) : r.source === "auth" ? (
                    // Admin accounts and pending invites: no record to edit here.
                    <span>{r.email ?? "—"}</span>
                  ) : (
                    <button
                      onClick={() => { setEditingKey(r.key); setEditEmail(r.email ?? ""); }}
                      className="text-left hover:underline"
                      title="Click to edit"
                    >
                      {r.email ?? <span className="italic">add email</span>}
                    </button>
                  )}
                </td>
                <td className="p-3 text-muted-foreground">{r.phone ?? "—"}</td>
                <td className="p-3">
                  {r.user_id ? (
                    <Select value={r.role} onValueChange={(v) => requestRoleChange(r.user_id!, r.name, r.role, v as AppRole)}>
                      <SelectTrigger><SelectValue /></SelectTrigger>
                      <SelectContent>
                        <SelectItem value="admin">admin</SelectItem>
                        <SelectItem value="teacher">teacher</SelectItem>
                        <SelectItem value="student">student</SelectItem>
                      </SelectContent>
                    </Select>
                  ) : (
                    <span className="text-xs px-2 py-0.5 rounded-full bg-muted text-muted-foreground">
                      {r.role}
                    </span>
                  )}
                </td>
                <td className="p-3">
                  {/* Students are children with no inbox: they get a username
                      and password rather than an emailed invite. */}
                  {r.role === "student" ? (
                    <div className="flex items-center gap-2">
                      {r.login_username && (
                        <span className="text-xs font-mono px-2 py-0.5 rounded bg-muted" title="Username">
                          {r.login_username}
                        </span>
                      )}
                      <Button
                        size="sm"
                        variant="outline"
                        onClick={() => setLoginFor({ id: r.key.split(":")[1], name: r.name, username: r.login_username ?? null })}
                      >
                        <KeyRound className="w-3.5 h-3.5 mr-1" />
                        {r.login_username ? "Reset password" : "Create login"}
                      </Button>
                    </div>
                  ) : r.user_id ? (
                    <span className="text-xs px-2 py-0.5 rounded-full bg-emerald-500/15 text-emerald-600">
                      Linked
                    </span>
                  ) : r.email ? (
                    <Button
                      size="sm"
                      variant="outline"
                      disabled={invitingEmail === r.email}
                      onClick={() => sendInvite(r.email!, r.name)}
                    >
                      <Mail className="w-3.5 h-3.5 mr-1" />
                      {invitingEmail === r.email ? "Sending…" : invitedEmails.has(r.email) ? "Resend invite" : "Send invite"}
                    </Button>
                  ) : (
                    <span className="text-xs px-2 py-0.5 rounded-full bg-muted text-muted-foreground" title="Add an email address first">
                      No email
                    </span>
                  )}
                </td>
              </tr>
            ))}
            {filtered.length === 0 && (
              <tr><td colSpan={5} className="p-6 text-center text-muted-foreground">No users found.</td></tr>
            )}
          </tbody>
        </table>
      </div>

      <p className="text-xs text-muted-foreground">
        <strong>Send invite</strong> emails a sign-in link. There's no password to set or share — they
        click the link, their account is created, and it's linked to this record with the right role
        automatically. Rows with no email need one added on the Students or Teachers tab first.
      </p>

      <StudentLoginDialog student={loginFor} onClose={() => setLoginFor(null)} />

      <AlertDialog open={!!pending} onOpenChange={(o) => { if (!o) setPending(null); }}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Change role?</AlertDialogTitle>
            <AlertDialogDescription>
              {pending && (
                <>
                  <strong>{pending.name}</strong> will change from{" "}
                  <strong>{pending.current}</strong> to <strong>{pending.next}</strong>.
                  {pending.next === "admin" && (
                    <span className="block mt-2 text-amber-600">
                      Admins can view and edit everything — finances, all students, teachers, and other admins.
                    </span>
                  )}
                  {pending.current === "admin" && pending.next !== "admin" && (
                    <span className="block mt-2 text-amber-600">
                      This person will lose admin access immediately.
                    </span>
                  )}
                </>
              )}
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel disabled={applying}>Cancel</AlertDialogCancel>
            <AlertDialogAction onClick={(e) => { e.preventDefault(); confirmRoleChange(); }} disabled={applying}>
              {applying ? "Updating…" : "Confirm"}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
}
