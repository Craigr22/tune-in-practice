-- A practice week now runs lesson to lesson.
--
-- Weeks used to be keyed on the Monday of the calendar week. Every batch here
-- meets on a Sunday — the last day of such a week — so the lesson sat at the
-- end of one week and the practice that follows it at the start of the next.
-- The week is now anchored on the class day itself: day 1 is the lesson, and
-- practice falls two and four days after it.
--
-- Sessions already generated against the old anchor fall on the wrong dates.
-- Only future, untouched ones are removed — the app regenerates those on the
-- new anchor the next time the student opens the app. Anything a student has
-- started or finished is left exactly as it is, and practice_logs (which the
-- streak and the teacher's roster read) is not touched at all.

delete from public.weekly_plan_sessions s
using public.enrollments e
join public.batches b on b.id = e.batch_id
where e.student_id = s.student_id
  and e.status = 'active'
  -- Keyed on a day that is not this student's class day: the old anchor.
  and extract(dow from s.week_start) <> b.day_of_week
  and s.scheduled_date >= current_date
  and s.completed_at is null
  and not s.warmup_completed
  and not s.focus_completed
  and not s.bonus_completed;
