// Creates and manages student logins for children who have no email address.
//
// Students sign in with a username and password. Supabase needs an email
// underneath every account, so each username is stored as
// "<username>@students.bam.invalid" — .invalid is reserved by RFC 2606 and can
// never receive mail, which is deliberate: nothing is ever sent to it.
//
// This runs server-side because creating users needs the service role key,
// which must never reach the browser. Every call is checked: only a signed-in
// admin may provision or reset a student login.

import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const STUDENT_EMAIL_DOMAIN = "students.bam.invalid";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
  "Access-Control-Allow-Methods": "POST, OPTIONS",
};

const json = (body: unknown, status = 200) =>
  new Response(JSON.stringify(body), {
    status,
    headers: { ...corsHeaders, "Content-Type": "application/json" },
  });

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response("ok", { headers: corsHeaders });

  const SUPABASE_URL = Deno.env.get("SUPABASE_URL")!;
  const SERVICE_KEY = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
  const ANON_KEY = Deno.env.get("SUPABASE_ANON_KEY")!;

  const admin = createClient(SUPABASE_URL, SERVICE_KEY, {
    auth: { autoRefreshToken: false, persistSession: false },
  });

  try {
    // --- who is calling? ---
    const authHeader = req.headers.get("Authorization") ?? "";
    if (!authHeader) return json({ error: "Not signed in" }, 401);

    const caller = createClient(SUPABASE_URL, ANON_KEY, {
      global: { headers: { Authorization: authHeader } },
    });
    const { data: { user }, error: userErr } = await caller.auth.getUser();
    if (userErr || !user) return json({ error: "Not signed in" }, 401);

    // --- are they an admin? checked with the service client, not the caller's ---
    const { data: roles } = await admin
      .from("user_roles")
      .select("role")
      .eq("user_id", user.id);
    if (!(roles ?? []).some((r: { role: string }) => r.role === "admin")) {
      return json({ error: "Admins only" }, 403);
    }

    const { action, studentId, username, password } = await req.json();
    if (!studentId || !password) return json({ error: "studentId and password are required" }, 400);
    if (String(password).length < 6) return json({ error: "Password must be at least 6 characters" }, 400);

    const { data: student, error: sErr } = await admin
      .from("students")
      .select("id, name, user_id")
      .eq("id", studentId)
      .maybeSingle();
    if (sErr || !student) return json({ error: "Student not found" }, 404);

    /* ---------- reset an existing login ---------- */
    if (action === "reset") {
      if (!student.user_id) return json({ error: "This student has no login yet" }, 400);
      const { error } = await admin.auth.admin.updateUserById(student.user_id, { password });
      if (error) return json({ error: error.message }, 400);
      return json({ ok: true, action: "reset" });
    }

    /* ---------- create a new login ---------- */
    if (student.user_id) return json({ error: "This student already has a login" }, 400);

    const base = String(username || student.name)
      .toLowerCase()
      .normalize("NFD").replace(/[̀-ͯ]/g, "")
      .replace(/[^a-z0-9]+/g, ".")
      .replace(/^\.+|\.+$/g, "")
      .slice(0, 40) || "student";

    // Usernames must be unique; add a numeric suffix if this one is taken.
    let handle = base;
    for (let n = 2; n < 50; n++) {
      const { data: existing } = await admin
        .from("students")
        .select("id")
        .eq("login_username", handle)
        .maybeSingle();
      if (!existing) break;
      handle = `${base}${n}`;
    }

    const email = `${handle}@${STUDENT_EMAIL_DOMAIN}`;
    const { data: created, error: cErr } = await admin.auth.admin.createUser({
      email,
      password,
      email_confirm: true, // nothing is ever sent to a .invalid address
      user_metadata: { student_name: student.name, provisioned: true },
    });
    if (cErr || !created?.user) return json({ error: cErr?.message ?? "Could not create the login" }, 400);

    // Attach the account to the student and give them the student role. The
    // sign-in trigger can't match these, since the address is synthetic.
    const { error: linkErr } = await admin
      .from("students")
      .update({ user_id: created.user.id, login_username: handle })
      .eq("id", student.id);
    if (linkErr) {
      await admin.auth.admin.deleteUser(created.user.id); // don't leave an orphan
      return json({ error: linkErr.message }, 400);
    }
    await admin.from("user_roles").insert({ user_id: created.user.id, role: "student" });

    return json({ ok: true, action: "created", username: handle, email });
  } catch (e) {
    return json({ error: e instanceof Error ? e.message : "Unexpected error" }, 500);
  }
});
