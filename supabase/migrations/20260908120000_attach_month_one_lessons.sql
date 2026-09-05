-- Attach the uploaded lesson clips to the first month of the ukulele course.
--
-- The plan already carried the class topics and the day instructions; only
-- week 1 had videos, so from week 2 onward students saw instructions telling
-- them to watch something with nothing to watch.
--
-- Clips are matched by title rather than by id, so this reads as the
-- curriculum rather than as a list of UUIDs, and a title that doesn't exist is
-- skipped instead of writing a broken reference. Everything here stays
-- editable in Course Work — this seeds the plan, it doesn't own it.
--
-- Week 1 days 1-2 are deliberately left alone: they already hold the tuning
-- and first-lesson clips plus the bpm tracks someone added by hand.

with wanted(week_number, day_number, titles) as (
  values
    -- Week 1 · C and F, tuning, You Are My Sunshine without the G chord
    (1, 3, array['You are my Sunshine', 'You are my Sunshine CF Slow']),

    -- Week 2 · Piyu Bole, the G chord, Sunshine completed
    (2, 1, array['Piyu Bole Tutorial']),
    (2, 2, array['2. Technical C and G', 'Completed: You are my Sunshine']),
    (2, 3, array['Piyu Bole Slow', 'Piyu Bole Playalong normal']),

    -- Week 3 · Photograph, arpeggios
    (3, 1, array['Photograph Tutorial']),
    (3, 2, array['4. arpegios chord clarity']),
    (3, 3, array['Photograph slow playalong', 'Photograph normal playalong']),

    -- Week 4 · everything in tempo, with tracks
    (4, 1, array['Photograph normal playalong']),
    (4, 2, array['You are my sunshine cfg slow', '3. Technical cfag']),
    (4, 3, array['Piyu Bole Playalong normal'])
),
resolved as (
  select
    w.week_number,
    w.day_number,
    coalesce(
      array_agg(cv.id order by t.ord) filter (where cv.id is not null),
      '{}'::uuid[]
    ) as ids
  from wanted w
  cross join lateral unnest(w.titles) with ordinality as t(title, ord)
  left join public.course_videos cv on cv.title = t.title
  group by w.week_number, w.day_number
)
update public.course_plan_days d
set video_ids = r.ids,
    updated_at = now()
from resolved r
where d.instrument = 'ukulele'
  and d.week_number = r.week_number
  and d.day_number = r.day_number;
