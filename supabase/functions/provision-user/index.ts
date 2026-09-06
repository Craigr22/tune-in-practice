// Creates and resets logins for students, teachers and admins.
//
// Students have no inbox, so their username becomes
// "<username>@students.bam.invalid" (.invalid is reserved by RFC 2606 and can
// never receive mail). Teachers and admins use their real email address, so
// they can also use magic links and password resets later.
//
// This runs server-side because creating users needs the service role key,
// which must never reach the browser. Every call requires a signed-in admin.

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
    /* ---------- only a signed-in admin may do this ---------- */
    const authHeader = req.headers.get("Authorization") ?? "";
    if (!authHeader) return json({ error: "Not signed in" }, 401);

    const caller = createClient(SUPABASE_URL, ANON_KEY, {
      global: { headers: { Authorization: authHeader } },
    });
    const { data: { user }, error: userErr } = await caller.auth.getUser();
    if (userErr || !user) return json({ error: "Not signed in" }, 401);

    const { data: callerRoles } = await admin
      .from("user_roles").select("role").eq("user_id", user.id);
    if (!(callerRoles ?? []).some((r: { role: string }) => r.role === "admin")) {
      return json({ error: "Admins only" }, 403);
    }

    const { action = "create", role, recordId, email: emailIn, userId, password } = await req.json();
    if (!password || String(password).length < 6) {
      return json({ error: "Password must be at least 6 characters" }, 400);
    }
    if (!["student", "teacher", "admin"].includes(role)) {
      return json({ error: "role must be student, teacher or admin" }, 400);
    }

    const table = role === "student" ? "students" : role === "teacher" ? "teachers" : null;

    /* ---------- find the existing account, if any ---------- */
    let existingUserId: string | null = userId ?? null;
    let record: any = null;
    if (table && recordId) {
      const { data } = await admin
        .from(table).select("id, name, email, user_id").eq("id", recordId).maybeSingle();
      if (!data) return json({ error: `${role} not found` }, 404);
      record = data;
      existingUserId = existingUserId ?? data.user_id;
    }

    /* ---------- reset ---------- */
    if (action === "reset") {
      if (!existingUserId) return json({ error: "This person has no login yet" }, 400);
      const { error } = await admin.auth.admin.updateUserById(existingUserId, { password });
      if (error) return json({ error: error.message }, 400);

      // Hand back what this account actually signs in with. The admin screen
      // used to guess from the person's record, which is a different thing:
      // students.email holds whatever an admin typed there, while the login is
      // the address the account was created with. Guessing wrong is silent —
      // the student is given a name that no account answers to.
      const { data: acct } = await admin.auth.admin.getUserById(existingUserId);
      const loginEmail = acct?.user?.email ?? null;
      const signInWith = loginEmail?.endsWith(`@${STUDENT_EMAIL_DOMAIN}`)
        ? loginEmail.slice(0, -`@${STUDENT_EMAIL_DOMAIN}`.length) // they type the username
        : loginEmail;
      return json({ ok: true, action: "reset", signInWith });
    }

    /* ---------- create ---------- */
    if (existingUserId) return json({ error: "This person already has a login" }, 400);

    let loginEmail: string;
    let username: string | null = null;

    if (role === "student") {
      const base = String(record?.name ?? "student")
        .toLowerCase()
        .normalize("NFD").replace(/[̀-ͯ]/g, "")
        .replace(/[^a-z0-9]+/g, ".")
        .replace(/^\.+|\.+$/g, "")
        .slice(0, 40) || "student";
      username = base;
      for (let n = 2; n < 50; n++) {
        const { data: taken } = await admin
          .from("students").select("id").eq("login_username", username).maybeSingle();
        if (!taken) break;
        username = `${base}${n}`;
      }
      loginEmail = `${username}@${STUDENT_EMAIL_DOMAIN}`;
    } else {
      // Teachers and admins sign in with their real address.
      loginEmail = String(record?.email ?? emailIn ?? "").trim().toLowerCase();
      if (!loginEmail) return json({ error: `This ${role} has no email address yet` }, 400);
    }

    const { data: created, error: cErr } = await admin.auth.admin.createUser({
      email: loginEmail,
      password,
      email_confirm: true, // set by an admin, so no confirmation round-trip
      user_metadata: { provisioned: true, name: record?.name ?? null },
    });
    if (cErr || !created?.user) {
      return json({ error: cErr?.message ?? "Could not create the login" }, 400);
    }
    const newId = created.user.id;

    // Link the account to its record, and give it the right role.
    if (table && record) {
      const patch: Record<string, unknown> = { user_id: newId };
      if (role === "student") patch.login_username = username;
      const { error: linkErr } = await admin.from(table).update(patch).eq("id", record.id);
      if (linkErr) {
        await admin.auth.admin.deleteUser(newId); // don't strand an orphan account
        return json({ error: linkErr.message }, 400);
      }
    }

    await admin.from("user_roles").insert({ user_id: newId, role });
    await admin.from("user_profiles")
      .upsert({ user_id: newId, email: loginEmail, name: record?.name ?? null },
              { onConflict: "user_id" });
    // An invite for this address is now redundant.
    await admin.from("pending_roles").delete().eq("email", loginEmail);

    return json({
      ok: true,
      action: "created",
      role,
      username,
      signInWith: username ?? loginEmail,
    });
  } catch (e) {
    return json({ error: e instanceof Error ? e.message : "Unexpected error" }, 500);
  }
});
