-- A class starts when it first meets.
--
-- semester_start was free to be any date, so a class running on Sundays could
-- be stored as starting on a Wednesday. Everything downstream keys off that
-- date: practice was generated from the Wednesday, while the calendar's first
-- class marker sat on the following Sunday. One field, two apparent start
-- dates — and students given practice before their first lesson.
--
-- Snap existing starts forward to the class's own weekday. Postgres EXTRACT(DOW)
-- is 0=Sunday..6=Saturday, the same convention as batches.day_of_week.

update public.batches
set semester_start = semester_start
      + (((day_of_week - extract(dow from semester_start)::int) + 7) % 7)
where semester_start is not null
  and extract(dow from semester_start)::int <> day_of_week;

-- Practice already generated for the days between the old and corrected start
-- is now scheduled before the course begins. Drop those, but never touch a
-- session a student has already worked on.
delete from public.weekly_plan_sessions wps
using public.enrollments e, public.batches b
where wps.student_id = e.student_id
  and e.batch_id = b.id
  and e.status = 'active'
  and b.semester_start is not null
  and wps.scheduled_date < b.semester_start
  and wps.completed_at is null
  and not wps.warmup_completed
  and not wps.focus_completed
  and not wps.bonus_completed;
