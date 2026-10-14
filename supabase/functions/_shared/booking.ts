// Turning a paid website booking into a student.
//
// Shared by the confirmation the website sends straight after payment and by
// Razorpay's own webhook, so that a student whose browser closes mid-payment
// still ends up enrolled. Whichever arrives first does the work; the other
// finds it done.

import { createClient, type SupabaseClient } from "https://esm.sh/@supabase/supabase-js@2";

export const STUDENT_EMAIL_DOMAIN = "students.bam.invalid";
const CYCLE_MONTHS: Record<string, number> = { monthly: 1, quarterly: 3, semester: 6 };

export const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
  "Access-Control-Allow-Methods": "POST, OPTIONS",
};

export const json = (body: unknown, status = 200) =>
  new Response(JSON.stringify(body), { status, headers: { ...corsHeaders, "Content-Type": "application/json" } });

export function serviceClient(): SupabaseClient {
  return createClient(Deno.env.get("SUPABASE_URL")!, Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!, {
    auth: { autoRefreshToken: false, persistSession: false },
  });
}

export function razorpayKeys() {
  const keyId = Deno.env.get("RAZORPAY_KEY_ID");
  const secret = Deno.env.get("RAZORPAY_KEY_SECRET");
  if (!keyId || !secret) throw new Error("Online payment isn't set up yet");
  return { keyId, secret, auth: "Basic " + btoa(`${keyId}:${secret}`) };
}

/** Hex HMAC-SHA256, as Razorpay signs with. */
export async function hmacHex(secret: string, message: string): Promise<string> {
  const key = await crypto.subtle.importKey("raw", new TextEncoder().encode(secret), { name: "HMAC", hash: "SHA-256" }, false, ["sign"]);
  const sig = await crypto.subtle.sign("HMAC", key, new TextEncoder().encode(message));
  return [...new Uint8Array(sig)].map((b) => b.toString(16).padStart(2, "0")).join("");
}

/** Compare without leaking where two strings first differ. */
export function safeEqual(a: string, b: string): boolean {
  if (a.length !== b.length) return false;
  let diff = 0;
  for (let i = 0; i < a.length; i++) diff |= a.charCodeAt(i) ^ b.charCodeAt(i);
  return diff === 0;
}

const today = () => new Date(Date.now() + 5.5 * 3600_000).toISOString().slice(0, 10); // India date

function addMonthsIso(iso: string, months: number): string {
  const [y, m, d] = iso.split("-").map(Number);
  const target = new Date(Date.UTC(y, m - 1 + months, 1));
  const last = new Date(Date.UTC(target.getUTCFullYear(), target.getUTCMonth() + 1, 0)).getUTCDate();
  target.setUTCDate(Math.min(d, last));
  target.setUTCDate(target.getUTCDate() - 1); // the period ends the day before the next one starts
  return target.toISOString().slice(0, 10);
}

function slug(name: string): string {
  return name.toLowerCase().normalize("NFD").replace(/[̀-ͯ]/g, "")
    .replace(/[^a-z0-9]+/g, ".").replace(/^\.+|\.+$/g, "").slice(0, 40) || "student";
}

/** A short password that's easy to read out — the same shape the admin hands out. */
function newPassword(): string {
  const words = ["uku", "strum", "chord", "tune", "song", "beat"];
  const n = crypto.getRandomValues(new Uint32Array(2));
  return `${words[n[0] % words.length]}-${1000 + (n[1] % 9000)}`;
}

/** How Razorpay says it was paid, in the portal's own terms. */
async function paymentMethod(paymentId: string): Promise<"upi" | "card" | "bank"> {
  try {
    const { auth } = razorpayKeys();
    const res = await fetch(`https://api.razorpay.com/v1/payments/${paymentId}`, { headers: { Authorization: auth } });
    const p = await res.json();
    if (p?.method === "upi") return "upi";
    if (p?.method === "card") return "card";
  } catch {
    /* fall through */
  }
  return "bank";
}

export interface Finalised {
  status: "paid" | "processing" | "error";
  username?: string | null;
  password?: string | null;
  batchId?: string;
}

/**
 * Make the student, their enrolment, the payment and their login.
 *
 * Safe to call twice for the same booking: only the call that moves the
 * booking from pending to processing does anything.
 */
export async function finalise(db: SupabaseClient, bookingId: string, paymentId: string): Promise<Finalised> {
  const { data: claimed } = await db
    .from("website_bookings")
    .update({ status: "processing", razorpay_payment_id: paymentId })
    .eq("id", bookingId)
    .eq("status", "pending")
    .select("*")
    .maybeSingle();

  if (!claimed) {
    const { data: b } = await db.from("website_bookings").select("status, username, batch_id").eq("id", bookingId).maybeSingle();
    return { status: (b?.status as Finalised["status"]) ?? "error", username: b?.username, batchId: b?.batch_id };
  }

  const b = claimed as any;
  try {
    const { data: batch } = await db.from("batches").select("id, instrument_id").eq("id", b.batch_id).single();
    const { data: fee } = await db.from("website_fees").select("amount, fee_cycle").eq("instrument_id", batch!.instrument_id).maybeSingle();
    const start = today();
    const cycle = (fee?.fee_cycle as string) ?? "monthly";

    const { data: student, error: sErr } = await db.from("students").insert({
      name: b.student_name,
      parent_name: b.parent_name,
      phone: b.phone,
      email: b.email,
      fee_amount: fee?.amount ?? b.amount,
      fee_cycle: cycle,
      fee_start_date: start,
      joined_on: start,
      is_active: true,
    }).select("id").single();
    if (sErr) throw sErr;

    const { error: eErr } = await db.from("enrollments").insert({ student_id: student.id, batch_id: b.batch_id, status: "active" });
    if (eErr) throw eErr;

    const method = await paymentMethod(paymentId);
    const payment = {
      student_id: student.id,
      amount: b.amount,
      paid_on: start,
      period_start: start,
      period_end: addMonthsIso(start, CYCLE_MONTHS[cycle] ?? 1),
      method,
      status: "paid",
      notes: `Website booking · Razorpay ${paymentId}`,
    };
    // The class a payment is for arrives by a later migration; without it the
    // payment is still recorded.
    let { error: pErr } = await db.from("payments").insert({ ...payment, batch_id: b.batch_id });
    if (pErr && /batch_id/.test(pErr.message)) ({ error: pErr } = await db.from("payments").insert(payment));
    if (pErr) throw pErr;

    // Their login: a username from their name, and a password to show them now.
    const password = newPassword();
    const base = slug(b.student_name);
    let username = "";
    let userId = "";
    for (let n = 1; n < 50 && !userId; n++) {
      username = n === 1 ? base : `${base}${n}`;
      const { data: taken } = await db.from("students").select("id").eq("login_username", username).maybeSingle();
      if (taken) continue;
      const { data: created, error } = await db.auth.admin.createUser({
        email: `${username}@${STUDENT_EMAIL_DOMAIN}`,
        password,
        email_confirm: true,
        user_metadata: { provisioned: true, name: b.student_name, via: "website" },
      });
      if (error && /already|registered|exists/i.test(error.message)) continue;
      if (error || !created?.user) throw error ?? new Error("Could not create the login");
      userId = created.user.id;
    }
    if (!userId) throw new Error("No username was free");

    await db.from("students").update({ user_id: userId, login_username: username }).eq("id", student.id);
    await db.from("user_roles").insert({ user_id: userId, role: "student" });
    await db.from("user_profiles").upsert(
      { user_id: userId, email: `${username}@${STUDENT_EMAIL_DOMAIN}`, name: b.student_name },
      { onConflict: "user_id" },
    );

    await db.from("website_bookings").update({
      status: "paid",
      paid_at: new Date().toISOString(),
      student_id: student.id,
      username,
      initial_password: password,
    }).eq("id", bookingId);

    return { status: "paid", username, password, batchId: b.batch_id };
  } catch (e) {
    // The money has been taken, so this must not vanish: it stays on the
    // booking for an admin to finish by hand.
    await db.from("website_bookings").update({
      status: "error",
      notes: `Paid, but setting up the student failed: ${e instanceof Error ? e.message : String(e)}`,
    }).eq("id", bookingId);
    return { status: "error" };
  }
}
