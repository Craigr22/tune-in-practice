// Razorpay's own word that a payment was captured. It reaches us even when
// the person who paid closed their browser before the website could, so no
// one pays and ends up without a place.
//
// Set this function's address as a webhook in the Razorpay dashboard, for
// the payment.captured event, with the secret stored as
// RAZORPAY_WEBHOOK_SECRET.

import { finalise, hmacHex, json, safeEqual, serviceClient } from "../_shared/booking.ts";

Deno.serve(async (req) => {
  if (req.method !== "POST") return json({ error: "POST only" }, 405);
  const secret = Deno.env.get("RAZORPAY_WEBHOOK_SECRET");
  if (!secret) return json({ error: "Webhook not configured" }, 500);

  const raw = await req.text();
  const signature = req.headers.get("x-razorpay-signature") ?? "";
  const expected = await hmacHex(secret, raw);
  if (!safeEqual(expected, signature)) return json({ error: "Bad signature" }, 400);

  try {
    const event = JSON.parse(raw);
    if (event?.event !== "payment.captured" && event?.event !== "order.paid") return json({ ok: true, ignored: event?.event });
    const payment = event?.payload?.payment?.entity;
    const orderId = payment?.order_id ?? event?.payload?.order?.entity?.id;
    if (!orderId || !payment?.id) return json({ ok: true, ignored: "no order" });

    const db = serviceClient();
    const { data: booking } = await db.from("website_bookings").select("id").eq("razorpay_order_id", orderId).maybeSingle();
    if (!booking) return json({ ok: true, ignored: "not a website booking" });

    const result = await finalise(db, booking.id, payment.id);
    return json({ ok: true, status: result.status });
  } catch (e) {
    // A 500 makes Razorpay try again later, which is what we want.
    return json({ error: e instanceof Error ? e.message : "Something went wrong" }, 500);
  }
});
