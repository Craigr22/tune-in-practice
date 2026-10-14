// Starts a booking from the public website: checks the class has room,
// works out the price on the server, and opens a Razorpay order for it.
//
// Called by anyone — it is the website's front door — so everything it is
// sent is checked, and the amount is never taken from the request.

import { corsHeaders, json, razorpayKeys, serviceClient } from "../_shared/booking.ts";

const clean = (v: unknown, max: number) => (typeof v === "string" ? v.trim().slice(0, max) : "");

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response("ok", { headers: corsHeaders });
  if (req.method !== "POST") return json({ error: "POST only" }, 405);

  try {
    const body = await req.json().catch(() => ({}));
    const batchId = clean(body.batchId, 64);
    const studentName = clean(body.studentName, 80);
    const parentName = clean(body.parentName, 80) || null;
    const phone = clean(body.phone, 20).replace(/[^\d+]/g, "");
    const email = clean(body.email, 120).toLowerCase() || null;
    const ageGroup = clean(body.ageGroup, 20) || null;

    if (!batchId || studentName.length < 2) return json({ error: "Please give the student's name and pick a class." }, 400);
    if (phone.replace(/\D/g, "").length < 10) return json({ error: "Please give a phone number we can reach you on." }, 400);
    if (email && !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) return json({ error: "That email address doesn't look right." }, 400);

    const db = serviceClient();

    const { data: classes, error: tErr } = await db.rpc("website_timetable");
    if (tErr) throw tErr;
    const cls = (classes ?? []).find((c: any) => c.batch_id === batchId);
    if (!cls) return json({ error: "That class isn't taking bookings." }, 400);
    if (cls.seats_left !== null && cls.seats_left <= 0) return json({ error: "Sorry — that class has just filled up. Please pick another." }, 409);
    if (!cls.fee) return json({ error: "Fees for this class aren't online yet — please message us to join." }, 400);

    const amount = Number(cls.fee) + Number(cls.registration_fee ?? 0);

    const { data: booking, error: bErr } = await db.from("website_bookings").insert({
      batch_id: batchId,
      student_name: studentName,
      parent_name: parentName,
      phone,
      email,
      age_group: ageGroup,
      amount,
    }).select("id").single();
    if (bErr) throw bErr;

    const { keyId, auth } = razorpayKeys();
    const res = await fetch("https://api.razorpay.com/v1/orders", {
      method: "POST",
      headers: { Authorization: auth, "Content-Type": "application/json" },
      body: JSON.stringify({
        amount: Math.round(amount * 100), // paise
        currency: "INR",
        receipt: booking.id,
        notes: { booking_id: booking.id, class: cls.code ?? cls.instrument },
      }),
    });
    const order = await res.json();
    if (!res.ok || !order?.id) {
      await db.from("website_bookings").update({ status: "error", notes: `Razorpay order failed: ${JSON.stringify(order?.error ?? order)}` }).eq("id", booking.id);
      return json({ error: "We couldn't start the payment. Please try again in a moment." }, 502);
    }
    await db.from("website_bookings").update({ razorpay_order_id: order.id }).eq("id", booking.id);

    return json({
      bookingId: booking.id,
      orderId: order.id,
      keyId,
      amount: order.amount,
      currency: order.currency,
      description: `${cls.instrument} · ${cls.code ?? "class"}`,
      prefill: { name: parentName ?? studentName, contact: phone, email: email ?? undefined },
    });
  } catch (e) {
    return json({ error: e instanceof Error ? e.message : "Something went wrong" }, 500);
  }
});
