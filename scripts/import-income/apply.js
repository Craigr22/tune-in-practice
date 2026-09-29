/**
 * Apply an import plan through the signed-in admin's session.
 *
 * Run in the browser, on the portal, signed in as an admin. It reads the plan
 * from /__import/plan.json and writes it table by table:
 *
 *   await importPlan()          // writes it
 *   await importPlan({dry:true})// counts only
 *   await undoImport()          // removes exactly what the plan adds
 *
 * Every row has an id fixed by its source in the workbook, and inserts ignore
 * ids already present — so running it twice adds nothing the second time, and
 * a run that stops part-way is finished by running it again.
 *
 * Existing students get a fee only where theirs is still unset; nothing they
 * already have is overwritten.
 */
(() => {
  const URL_ = "https://utjyntenlpopnxpjvwkh.supabase.co/rest/v1";
  const ANON =
    "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InV0anludGVubHBvcG54cGp2d2toIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NzkzNjYyMjQsImV4cCI6MjA5NDk0MjIyNH0.F6Emn64I_rd0Zgh6sxog3k22z6z-Wn09cq_G6MXVsIs";
  const ORDER = ["instruments", "teachers", "batches", "students", "enrollments", "payments"];

  const headers = (extra = {}) => {
    const key = Object.keys(localStorage).find((k) => k.includes("auth-token"));
    if (!key) throw new Error("Not signed in");
    const token = JSON.parse(localStorage.getItem(key)).access_token;
    return { apikey: ANON, Authorization: `Bearer ${token}`, "Content-Type": "application/json", ...extra };
  };

  // Fields starting "_" are notes for the review, not columns.
  const clean = (row) => Object.fromEntries(Object.entries(row).filter(([k]) => !k.startsWith("_")));

  async function hasColumn(table, column) {
    const r = await fetch(`${URL_}/${table}?select=${column}&limit=1`, { headers: headers() });
    return r.ok;
  }

  async function insert(table, rows) {
    for (let i = 0; i < rows.length; i += 100) {
      const chunk = rows.slice(i, i + 100);
      const r = await fetch(`${URL_}/${table}?on_conflict=id`, {
        method: "POST",
        headers: headers({ Prefer: "resolution=ignore-duplicates,return=minimal" }),
        body: JSON.stringify(chunk),
      });
      if (!r.ok) throw new Error(`${table} rows ${i}–${i + chunk.length}: ${r.status} ${await r.text()}`);
    }
  }

  async function count(table, ids) {
    let n = 0;
    for (let i = 0; i < ids.length; i += 100) {
      const list = ids.slice(i, i + 100).join(",");
      const r = await fetch(`${URL_}/${table}?select=id&id=in.(${list})`, { headers: headers() });
      if (!r.ok) throw new Error(`${table}: ${r.status} ${await r.text()}`);
      n += (await r.json()).length;
    }
    return n;
  }

  async function load() {
    const r = await fetch("/__import/plan.json", { cache: "no-store" });
    if (!r.ok) throw new Error("No plan at /__import/plan.json");
    return r.json();
  }

  window.importPlan = async ({ dry = false } = {}) => {
    const plan = await load();
    const report = {};
    // Payments name their class once the payment_batch migration has run.
    // Before it, they go in without; its backfill attaches each one to the
    // class of a student who is in exactly one.
    const withBatch = await hasColumn("payments", "batch_id");
    const rows = {
      ...plan,
      payments: plan.payments.map((p) => {
        const row = clean(p);
        if (!withBatch) delete row.batch_id;
        return row;
      }),
    };
    for (const table of ORDER) {
      const list = (rows[table] ?? []).map(clean);
      const before = await count(table, list.map((x) => x.id));
      if (!dry && list.length) await insert(table, list);
      const after = dry ? before : await count(table, list.map((x) => x.id));
      report[table] = { planned: list.length, alreadyThere: before, nowThere: after };
    }
    // Fees for students who were already in the portal — only where unset.
    let feesSet = 0;
    for (const u of plan.student_updates) {
      if (dry) continue;
      const r = await fetch(`${URL_}/students?id=eq.${u.id}&fee_amount=eq.0`, {
        method: "PATCH",
        headers: headers({ Prefer: "return=representation" }),
        body: JSON.stringify({ fee_amount: u.fee_amount, fee_cycle: u.fee_cycle }),
      });
      if (!r.ok) throw new Error(`student ${u._name}: ${r.status} ${await r.text()}`);
      feesSet += (await r.json()).length;
    }
    report.existingStudentFeesSet = dry ? `${plan.student_updates.length} planned` : feesSet;
    report.paymentsCarryClass = withBatch;
    return report;
  };

  window.undoImport = async () => {
    const plan = await load();
    const report = {};
    for (const table of [...ORDER].reverse()) {
      const ids = (plan[table] ?? []).map((x) => x.id);
      for (let i = 0; i < ids.length; i += 100) {
        const list = ids.slice(i, i + 100).join(",");
        const r = await fetch(`${URL_}/${table}?id=in.(${list})`, { method: "DELETE", headers: headers() });
        if (!r.ok) throw new Error(`${table}: ${r.status} ${await r.text()}`);
      }
      report[table] = { removed: ids.length, left: await count(table, ids) };
    }
    // Put back the fees set on existing students, only if still as the import left them.
    for (const u of plan.student_updates) {
      await fetch(`${URL_}/students?id=eq.${u.id}&fee_amount=eq.${u.fee_amount}`, {
        method: "PATCH",
        headers: headers(),
        body: JSON.stringify({ fee_amount: 0, fee_cycle: "monthly" }),
      });
    }
    return report;
  };
})();
