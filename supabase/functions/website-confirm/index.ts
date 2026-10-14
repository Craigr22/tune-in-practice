// The website calls this straight after Razorpay says a payment went through.
// It checks Razorpay's signature — proof the payment is real and for this
// order — then makes the student and hands back their login, once.

import { corsHeaders, finalise, hmacHex, json, razorpayKeys, safeEqual, serviceClient } from "../_shared/booking.ts";

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response("ok", { headers: corsHeaders });
  if (req.method !== "POST") return json({ error: "POST only" }, 405);

  try {
    const { bookingId, razorpay_order_id, razorpay_payment_id, razorpay_signature } = await req.json();
    if (!bookingId || !razorpay_order_id || !razorpay_payment_id || !razorpay_signature) {
      return json({ error: "Missing payment details" }, 400);
    }

    const { secret } = razorpayKeys();
    const expected = await hmacHex(secret, `${razorpay_order_id}|${razorpay_payment_id}`);
    if (!safeEqual(expected, String(razorpay_signature))) return json({ error: "That payment couldn't be verified" }, 400);

    const db = serviceClient();
    const { data: booking } = await db.from("website_bookings").select("id, razorpay_order_id").eq("id", bookingId).maybeSingle();
    if (!booking || booking.razorpay_order_id !== razorpay_order_id) return json({ error: "Booking not found" }, 404);

    let result = await finalise(db, bookingId, razorpay_payment_id);

    // Razorpay's webhook may be doing the same work at this moment. Give it a
    // few seconds rather than telling someone who has just paid to wait.
    for (let i = 0; i < 6 && result.status === "processing"; i++) {
      await new Promise((r) => setTimeout(r, 1000));
      result = await finalise(db, bookingId, razorpay_payment_id);
    }

    if (result.status !== "paid") {
      return json({ status: result.status, message: "Your payment went through. We're finishing your place and will message you shortly." });
    }

    // The password is handed over here, and then forgotten.
    let password = result.password ?? null;
    if (!password) {
      const { data } = await db.from("website_bookings").select("initial_password").eq("id", bookingId).maybeSingle();
      password = data?.initial_password ?? null;
    }
    await db.from("website_bookings").update({ initial_password: null }).eq("id", bookingId);

    const { data: cls } = await db.rpc("website_timetable");
    const place = (cls ?? []).find((c: any) => c.batch_id === result.batchId) ?? null;

    return json({ status: "paid", username: result.username, password, class: place });
  } catch (e) {
    return json({ error: e instanceof Error ? e.message : "Something went wrong" }, 500);
  }
});
