-- Notes that sit around a clip on the day it is shown.
--
-- These used to live on the clip itself, as course_videos.description, so a
-- video carried one note everywhere it appeared. But the same tutorial is
-- worth different things in week 1 and week 4 — "just watch the left hand"
-- the first time, "play it in tempo now" later. The note belongs to the day
-- that uses the clip, which is also where the rest of that day is designed.
--
-- Keyed by video id: { "<uuid>": { "above": "...", "below": "..." } }.
-- video_ids still carries the order.

alter table public.course_plan_days
  add column if not exists video_notes jsonb not null default '{}'::jsonb;
