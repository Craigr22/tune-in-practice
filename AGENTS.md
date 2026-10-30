# Project rules

- Fire-and-forget database calls (`supabase.from(...)`, `supabase.rpc(...)`) must call `.then()` or be awaited — the builders are lazy and `void`-ing one never sends the request.
- "Last opened" (`user_profiles.last_seen_at`) is marked from `useAuth` on load and when the app returns to the screen, throttled in `src/lib/appOpen.ts` — students keep the app open for days, so load-only tracking misses visits.
- `room_plan_classes` holds workbook-only weekly classes (teacher name + student names, no portal records); only the room efficiency page and `save_room_usage_month` read them — keeps the planning timetable out of Schedule, People and teacher pages.
