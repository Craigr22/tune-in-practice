import { describe, it, expect, beforeAll } from "vitest";
import { readFileSync, readdirSync, statSync } from "node:fs";
import { join, resolve } from "node:path";
import { createClient, type SupabaseClient } from "@supabase/supabase-js";

/**
 * Does the database actually have what the code asks it for?
 *
 * Every incident in this project has had the same shape: code shipped, its
 * migration didn't, and a feature quietly did nothing — a pause that never
 * reached students, a roster that dropped its practice bars. Nothing failed
 * loudly, so nothing got noticed.
 *
 * This walks the source for every table and function the app calls and checks
 * each one exists. It talks to the real project read-only with the publishable
 * key, the same key the browser uses, and skips if that isn't configured.
 */

const ROOT = resolve(__dirname, "../..");
const URL_ = process.env.VITE_SUPABASE_URL ?? readEnv("VITE_SUPABASE_URL");
const KEY = process.env.VITE_SUPABASE_PUBLISHABLE_KEY ?? readEnv("VITE_SUPABASE_PUBLISHABLE_KEY");

function readEnv(name: string): string | undefined {
  try {
    const line = readFileSync(join(ROOT, ".env"), "utf8")
      .split("\n")
      .find((l) => l.startsWith(`${name}=`));
    return line?.split("=").slice(1).join("=").trim().replace(/^["']|["']$/g, "");
  } catch {
    return undefined;
  }
}

/** Every src file, so the scan can't miss a call site. */
function sourceFiles(dir: string, out: string[] = []): string[] {
  for (const name of readdirSync(dir)) {
    const p = join(dir, name);
    if (statSync(p).isDirectory()) sourceFiles(p, out);
    else if (/\.tsx?$/.test(name) && !/\.test\./.test(name)) out.push(p);
  }
  return out;
}

const source = sourceFiles(join(ROOT, "src"))
  .filter((f) => !f.includes("integrations/supabase/types"))
  .map((f) => readFileSync(f, "utf8"))
  .join("\n");

/**
 * Whitespace is collapsed first: these calls are often written across several
 * lines (`supabase\n  .storage\n  .from("recordings")`), and matching the raw
 * text mistook that bucket for a table — this test's own first false alarm.
 */
const flat = source.replace(/\s+/g, "");

const tables = [
  ...new Set([...flat.matchAll(/(?<!storage)\.from\("([a-z_]+)"\)/g)].map((m) => m[1])),
].sort();

/**
 * "videos" is named through a BUCKET constant rather than inline, so a text
 * scan can't see it. Anything referenced by a constant has to be listed here.
 */
const KNOWN_BUCKETS = ["videos"];

const buckets = [
  ...new Set([
    ...[...flat.matchAll(/storage\.from\("([a-z_]+)"\)/g)].map((m) => m[1]),
    ...KNOWN_BUCKETS,
  ]),
].sort();

/**
 * Functions need real arguments: PostgREST reports a wrong signature and a
 * missing function identically, so calling blind would prove nothing. These
 * are the shapes the app actually calls with.
 */
const ZERO = "00000000-0000-0000-0000-000000000000";
const RPCS: Record<string, Record<string, unknown>> = {
  has_role: { _user_id: ZERO, _role: "admin" },
  complete_practice_segment: { p_session_id: ZERO, p_segment: "focus" },
  end_class: {
    p_batch_id: ZERO, p_scheduled_date: "2026-01-01", p_teacher_notes: "",
    p_attendance: [], p_badges: [], p_session_id: null,
  },
  set_user_role: { p_user_id: ZERO, p_role: "student" },
  get_batch_shift_weeks: { _batch_id: ZERO },
  get_student_last_seen: { _student_id: ZERO },
  mark_app_open: {},
};

/** Columns whose absence has broken a page before. */
const COLUMNS: Record<string, string[]> = {
  course_videos: ["kind", "sort_order", "song_id", "description", "storage_path"],
  course_plan_days: ["video_ids", "video_notes", "tier", "focus_song_id"],
  batches: ["semester_start", "day_of_week", "code"],
  weekly_plan_sessions: ["completed_at", "warmup_completed", "scheduled_date"],
  user_profiles: ["last_seen_at"],
  batch_plan_shifts: ["weeks", "reason"],
};

const missing = (e: { message?: string; code?: string } | null) =>
  !!e && (/does not exist|schema cache|Could not find/i.test(e.message ?? "") || e.code === "PGRST202");

const configured = !!URL_ && !!KEY;
const maybe = configured ? describe : describe.skip;

let db: SupabaseClient;
beforeAll(() => { if (configured) db = createClient(URL_!, KEY!); });

maybe("the database has what the code asks for", () => {
  it("finds call sites to check", () => {
    expect(tables.length).toBeGreaterThan(10);
  });

  it.each(tables)("table %s exists", async (table) => {
    const { error } = await db.from(table).select("*").limit(0);
    expect(missing(error), `${table}: ${error?.message}`).toBe(false);
  });

  it.each(Object.entries(COLUMNS).flatMap(([t, cols]) => cols.map((c) => [t, c])))(
    "%s.%s exists",
    async (table, column) => {
      const { error } = await db.from(table as string).select(column as string).limit(0);
      expect(missing(error), `${table}.${column}: ${error?.message}`).toBe(false);
    },
  );

  it.each(buckets)("storage bucket %s exists", async (bucket) => {
    const { error } = await db.storage.from(bucket).list("", { limit: 1 });
    expect(missing(error), `${bucket}: ${error?.message}`).toBe(false);
  });

  it.each(Object.keys(RPCS))("function %s exists", async (fn) => {
    const { error } = await db.rpc(fn, RPCS[fn]);
    // A permission or constraint error means it exists and rejected us, which
    // is exactly what an unauthenticated caller should get.
    expect(missing(error), `${fn}: ${error?.message}`).toBe(false);
  });
});

describe("the scan itself", () => {
  it("is looking at the real source, not an empty string", () => {
    expect(flat.length).toBeGreaterThan(50_000);
    expect(tables).toContain("course_videos");
    expect(tables).toContain("weekly_plan_sessions");
    // The bucket must not be mistaken for a table — that was this test's own
    // first false alarm.
    expect(tables).not.toContain("recordings");
    expect(buckets).toContain("videos");
  });
});
