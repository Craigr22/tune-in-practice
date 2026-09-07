-- A practice week now runs lesson to lesson.
--
-- Weeks used to be keyed on the Monday of the calendar week. Every batch here
-- meets on a Sunday — the last day of such a week — so the lesson sat at the
-- end of one week and the practice that follows it at the start of the next.
-- The week is now anchored on the class day itself: day 1 is the lesson, and
-- practice falls two and four days after it.
--
-- Sessions generated against the old anchor are keyed to a Monday, so the app
-- no longer finds them — it looks for the week that began at the class. Those
-- students open the portal to an empty page, and only the ones who have signed
-- in since the change have had a week rebuilt for them.
--
-- The content of those rows is right: the same course week, the same songs and
-- instructions. Only the dates are a day out. So they are moved onto the new
-- anchor rather than deleted and left to be rebuilt one login at a time.
--
-- Only future, untouched sessions are touched. Anything a student has started
-- or finished stays exactly where it is, and practice_logs — which the streak
-- and the teacher's roster read — is not touched at all.

-- Each row's rightful place: the class day on or before the date it falls on,
-- and its own day within that week (the lesson, +2, +4).
--
-- Derived from scheduled_date rather than week_start, because some rows were
-- written against a week that never existed: while the class day was still
-- loading, the strip briefly assumed Saturday and generated against that.
-- Those are dropped below rather than moved.

/* ---------- 1. drop what cannot be moved ---------- */
with anchor as (
  select distinct on (e.student_id)
         e.student_id,
         b.day_of_week                                    as dow,
         coalesce(bs.course_start_date, b.semester_start)  as start_date
  from public.enrollments e
  join public.batches b on b.id = e.batch_id
  left join public.batch_settings bs on bs.batch_id = b.id
  where e.status = 'active'
  order by e.student_id, b.semester_start nulls last, b.id
),
lesson_one as (
  -- The course begins when the class first meets, not on the date typed in.
  select student_id, dow,
         (start_date + ((dow - extract(dow from start_date)::int + 7) % 7))::date as first_lesson
  from anchor
  where start_date is not null
),
moved as (
  select s.id,
         s.student_id,
         s.week_start,
         s.session_index,
         l.first_lesson,
         (s.scheduled_date
           - ((extract(dow from s.scheduled_date)::int - l.dow + 7) % 7))::date as new_week_start
  from public.weekly_plan_sessions s
  join lesson_one l on l.student_id = s.student_id
  where s.scheduled_date >= current_date
    and s.completed_at is null
    and not s.warmup_completed
    and not s.focus_completed
    and not s.bonus_completed
)
delete from public.weekly_plan_sessions s
using moved m
where s.id = m.id
  -- Leave rows already in the right place alone.
  and m.new_week_start is distinct from m.week_start
  and (
    -- A week before the first lesson is not a week of this course.
    m.new_week_start < m.first_lesson
    -- Or a student who has already signed in has the real row; this is its
    -- stale twin, and the one that is already in place wins.
    or exists (
      select 1
      from public.weekly_plan_sessions x
      where x.student_id = m.student_id
        and x.week_start = m.new_week_start
        and x.session_index = m.session_index
        and x.id <> m.id
    )
  );

/* ---------- 2. move the rest onto the class-day anchor ---------- */
with anchor as (
  select distinct on (e.student_id)
         e.student_id,
         b.day_of_week                                    as dow,
         coalesce(bs.course_start_date, b.semester_start)  as start_date
  from public.enrollments e
  join public.batches b on b.id = e.batch_id
  left join public.batch_settings bs on bs.batch_id = b.id
  where e.status = 'active'
  order by e.student_id, b.semester_start nulls last, b.id
),
lesson_one as (
  select student_id, dow,
         (start_date + ((dow - extract(dow from start_date)::int + 7) % 7))::date as first_lesson
  from anchor
  where start_date is not null
),
moved as (
  select s.id,
         s.week_start,
         s.session_index,
         (s.scheduled_date
           - ((extract(dow from s.scheduled_date)::int - l.dow + 7) % 7))::date as new_week_start
  from public.weekly_plan_sessions s
  join lesson_one l on l.student_id = s.student_id
  where s.scheduled_date >= current_date
    and s.completed_at is null
    and not s.warmup_completed
    and not s.focus_completed
    and not s.bonus_completed
)
update public.weekly_plan_sessions s
set week_start     = m.new_week_start,
    scheduled_date = (m.new_week_start + (2 * m.session_index))::date
from moved m
where s.id = m.id
  and m.new_week_start is distinct from m.week_start;
