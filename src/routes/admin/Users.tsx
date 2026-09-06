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
import LoginDialog, { type LoginTarget } from "@/components/admin/LoginDialog";
import { toast } from "sonner";
import { rpcError } from "@/lib/rpc";

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

/**
 * One editable table cell. At module scope on purpose: nested inside the page
 * component it would be a new component type on every render, so React would
 * remount the input and drop focus mid-typing.
 */
function EditableCell({
  editing, value, placeholder, editValue, setEditValue, onStart, onSave, onCancel,
}: {
  editing: boolean;
  value: string | null;
  placeholder?: string;
  editValue: string;
  setEditValue: (v: string) => void;
  onStart: () => void;
  onSave: () => void;
  onCancel: () => void;
}) {
  if (editing) {
    // Icon-only buttons and a wrapping layout: these columns are narrow, and a
    // text "Save" button squeezed the field down to a few pixels.
    return (
      <div className="flex items-center gap-1 min-w-[150px]">
        <Input
          value={editValue}
          onChange={(e) => setEditValue(e.target.value)}
          onKeyDown={(e) => {
            if (e.key === "Enter") onSave();
            if (e.key === "Escape") onCancel();
          }}
          // Saving on blur means a click anywhere else keeps the edit rather
          // than quietly discarding it.
          onBlur={(e) => {
            if (!e.relatedTarget?.closest?.("[data-cell-action]")) onSave();
          }}
          className="h-8 text-sm flex-1 min-w-0"
          autoFocus
        />
        <button
          data-cell-action
          onClick={onSave}
          title="Save (Enter)"
          className="shrink-0 h-8 w-7 grid place-items-center rounded-md text-white"
          style={{ background: "var(--navy)" }}
        >
          ✓
        </button>
        <button
          data-cell-action
          onClick={onCancel}
          title="Cancel (Esc)"
          className="shrink-0 h-8 w-7 grid place-items-center rounded-md border text-muted-foreground"
        >
          ✕
        </button>
      </div>
    );
  }
  return (
    <button onClick={onStart} className="text-left hover:underline w-full" title="Click to edit">
      {value || <span className="italic text-muted-foreground">{placeholder ?? "—"}</span>}
    </button>
  );
}

function AddUserDialog({ instrumentsMap }: { instrumentsMap: Map<string, string> }) {
  const qc = useQueryClient();
  const [open, setOpen] = useState(false);
  const [role, setRole] = useState<"admin" | "teacher" | "student">("student");
  const [form, setForm] = useState({ name: "", email: "", phone: "", parent_name: "" });
  const [selectedInstruments, setSelectedInstruments] = useState<string[]>([]);
  const [saving, setSaving] = useState(false);

  const reset = () => {
    setForm({ name: "", email: "", phone: "", parent_name: "" });
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
    // Teachers sign in by email; only students get a username instead.
    if (role === "teacher" && !form.email.trim()) {
      return toast.error("Teachers sign in by email, so an email is required");
    }
    setSaving(true);
    if (role === "student") {
      const { error } = await supabase.from("students").insert({
        name: form.name.trim(),
        email: form.email.trim() || null,
        phone: form.phone.trim() || null,
        parent_name: form.parent_name.trim() || null,
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
                They get full access to schedule, people and course work. We'll email a sign-in link
                now — or set them a password from the list once they're added.
              </p>
            </div>
          ) : (
            <>
              <div className="space-y-1">
                <Label>Name *</Label>
                <Input value={form.name} onChange={(e) => setForm({ ...form, name: e.target.value })} />
              </div>
              <div className="space-y-1">
                <Label>Email {role === "teacher" ? "*" : ""}</Label>
                <Input
                  type="email"
                  value={form.email}
                  onChange={(e) => setForm({ ...form, email: e.target.value })}
                  placeholder={role === "teacher" ? "they sign in with this" : "optional"}
                />
                <p className="text-xs text-muted-foreground">
                  {role === "teacher"
                    ? "Teachers sign in with their email — we'll send them an invite link."
                    : "Optional. Students sign in with a username and password instead."}
                </p>
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
            </>
          )}

          {role === "teacher" && (
            <>
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
  const [loginFor, setLoginFor] = useState<LoginTarget | null>(null);
  // Inline editing, one cell at a time, keyed "<row key>|<field>".
  const [editingCell, setEditingCell] = useState<string | null>(null);
  const [editValue, setEditValue] = useState("");
  type Field = "name" | "email" | "phone";

  const startEdit = (row: UserRow, field: Field, current: string | null) => {
    setEditingCell(`${row.key}|${field}`);
    setEditValue(current ?? "");
  };

  /**
   * Save one field. Teachers and students own a record; an admin has only a
   * profile row, and an invited admin only a pending_roles row.
   */
  const saveCell = async (row: UserRow, field: Field) => {
    let value: string | null = editValue.trim() || null;
    if (field === "email" && value) value = value.toLowerCase();
    if (field === "name" && !value) return toast.error("Name can't be empty");

    const [prefix, id] = row.key.split(":");
    let error: { message: string } | null = null;

    if (prefix === "t" || prefix === "s") {
      const table = prefix === "t" ? "teachers" : "students";
      ({ error } = await (supabase as any).from(table).update({ [field]: value }).eq("id", id));
      qc.invalidateQueries({ queryKey: [table] });
    } else if (prefix === "auth" && row.user_id) {
      if (field === "phone") return toast.error("Phone isn't stored for this account.");
      ({ error } = await (supabase as any).from("user_profiles").upsert(
        { user_id: row.user_id, [field]: value, updated_at: new Date().toISOString() },
        { onConflict: "user_id" },
      ));
    } else if (prefix === "pending") {
      if (field !== "email" || !value) return toast.error("An invited admin needs an email.");
      ({ error } = await (supabase as any).from("pending_roles").update({ email: value }).eq("email", row.email));
    } else {
      return toast.error("This entry can't be edited here.");
    }

    if (error) return toast.error(error.message);
    toast.success("Saved");
    setEditingCell(null);
    qc.invalidateQueries({ queryKey: ["admin-users"] });
  };

  const cellProps = (row: UserRow, field: Field, value: string | null) => ({
    editing: editingCell === `${row.key}|${field}`,
    value,
    editValue,
    setEditValue,
    onStart: () => startEdit(row, field, value),
    onSave: () => saveCell(row, field),
    onCancel: () => setEditingCell(null),
  });

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

      // Admins own no teacher/student row; their name and email live here.
      const { data: profiles } = await (supabase as any)
        .from("user_profiles")
        .select("user_id, name, email");
      const profileByUser = new Map<string, any>((profiles ?? []).map((p: any) => [p.user_id, p]));
      const tByUser = new Map((teachers ?? []).filter((t: any) => t.user_id).map((t: any) => [t.user_id, t]));
      const sByUser = new Map((students ?? []).filter((s: any) => s.user_id).map((s: any) => [s.user_id, s]));
      const seenUserIds = new Set<string>();
      const list: UserRow[] = [];

      (roles ?? []).forEach((r: any) => {
        seenUserIds.add(r.user_id);
        const t = tByUser.get(r.user_id) as any;
        const s = sByUser.get(r.user_id) as any;
        list.push({
          // One row per role: an account carrying two of them (a leftover
          // from the old self-signup trigger) gave two rows the same key,
          // and React drops or duplicates rows that collide.
          key: `auth:${r.user_id}:${r.role}`,
          user_id: r.user_id,
          role: r.role,
          name: t?.name ?? s?.name ?? profileByUser.get(r.user_id)?.name ?? "—",
          email: t?.email ?? s?.email ?? profileByUser.get(r.user_id)?.email ?? null,
          phone: t?.phone ?? s?.phone ?? null,
          source: "auth",
          // A provisioned student signs in with this, not with the address in
          // their record. It was only carried on the fallback pass below —
          // the one that runs for students who have no login — so for every
          // student who does have one the screen showed no username at all,
          // and the reset dialog fell back to naming students.email. That is
          // an address no account answers to, handed over at exactly the
          // moment someone is trying to get a student back in.
          login_username: s?.login_username ?? null,
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
    // Delete-then-insert in one transaction. Run separately, a failure between
    // them stripped the old role and never added the new one, locking the
    // person out of the app entirely.
    const { error } = await (supabase as any).rpc("set_user_role", {
      p_user_id: pending.userId,
      p_role: pending.next,
    });
    setApplying(false);
    if (error) return toast.error(rpcError(error, "Changing the role").message);
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

  if (role !== "admin") return <Navigate to="/" replace />;

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
              <th className="text-left p-3">Signs in with</th>
              <th className="text-left p-3">Phone</th>
              <th className="text-left p-3 w-32">Role</th>
              <th className="text-left p-3 w-40">Account</th>
            </tr>
          </thead>
          <tbody>
            {filtered.map((r) => (
              <tr key={r.key} className="border-t">
                <td className="p-3 font-medium">
                  <EditableCell {...cellProps(r, "name", r.name === "—" ? null : r.name)} placeholder="add name" />
                </td>
                <td className="p-3 text-muted-foreground">
                  {/* A student has no email — they sign in with a username
                      made from their name. Showing the address off their
                      record here is what got the wrong thing handed out. */}
                  {r.login_username ? (
                    <span className="text-xs font-mono px-2 py-0.5 rounded bg-muted" title="Their username">
                      {r.login_username}
                    </span>
                  ) : r.role === "student" && r.user_id ? (
                    <span className="text-xs opacity-60">no username yet</span>
                  ) : (
                    <EditableCell {...cellProps(r, "email", r.email)} placeholder="add email" />
                  )}
                </td>
                <td className="p-3 text-muted-foreground">
                  {r.source === "auth"
                    ? (r.phone ?? "—")
                    : <EditableCell {...cellProps(r, "phone", r.phone)} placeholder="add phone" />}
                </td>
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
                  {/* Everyone can be given a password directly. Teachers and
                      admins can also be sent an invite link instead. */}
                  <div className="flex items-center gap-2 flex-wrap">
                    {r.user_id && !r.login_username && (
                      <span className="text-xs px-2 py-0.5 rounded-full bg-emerald-500/15 text-emerald-600">
                        Linked
                      </span>
                    )}
                    <Button
                      size="sm"
                      variant="outline"
                      onClick={() => {
                        const [prefix, id] = r.key.split(":");
                        setLoginFor({
                          role: r.role,
                          name: r.name,
                          recordId: prefix === "t" || prefix === "s" ? id : null,
                          email: r.email,
                          userId: r.user_id,
                          username: r.login_username ?? null,
                        });
                      }}
                    >
                      <KeyRound className="w-3.5 h-3.5 mr-1" />
                      {r.user_id || r.login_username ? "Reset password" : "Create login"}
                    </Button>
                    {r.role !== "student" && !r.user_id && r.email && (
                      <Button
                        size="sm"
                        variant="ghost"
                        disabled={invitingEmail === r.email}
                        onClick={() => sendInvite(r.email!, r.name)}
                        title="Email a sign-in link instead"
                      >
                        <Mail className="w-3.5 h-3.5 mr-1" />
                        {invitingEmail === r.email ? "Sending…" : "Invite"}
                      </Button>
                    )}
                  </div>
                </td>
              </tr>
            ))}
            {filtered.length === 0 && (
              <tr><td colSpan={5} className="p-6 text-center text-muted-foreground">No users found.</td></tr>
            )}
          </tbody>
        </table>
      </div>

      <p className="text-xs text-muted-foreground max-w-3xl">
        <strong>Create login</strong> sets a password you hand over. Students sign in with a username
        (no email needed); teachers and admins sign in with their email. <strong>Invite</strong> is an
        alternative for teachers and admins — it emails a sign-in link instead. Click any name, email
        or phone to edit it.
      </p>

      <LoginDialog target={loginFor} onClose={() => setLoginFor(null)} />

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
