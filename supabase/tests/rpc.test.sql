-- Do the atomic workflows actually hold?
--
-- Three functions carry guarantees the app relies on: finishing practice
-- writes exactly one log however many times it is called; ending a class
-- lands whole or not at all; a role change can't strip the last admin. Those
-- were claims in a commit message until now.

BEGIN;
SELECT plan(10);

INSERT INTO auth.users (id, email) VALUES
  ('11111111-1111-1111-1111-111111111111', 'student@test'),
  ('33333333-3333-3333-3333-333333333333', 'teacher@test'),
  ('55555555-5555-5555-5555-555555555555', 'admin@test'),
  ('66666666-6666-6666-6666-666666666666', 'admin2@test');

INSERT INTO public.user_roles (user_id, role) VALUES
  ('11111111-1111-1111-1111-111111111111', 'student'),
  ('33333333-3333-3333-3333-333333333333', 'teacher'),
  ('55555555-5555-5555-5555-555555555555', 'admin');

INSERT INTO public.instruments (id, name) VALUES ('aaaaaaaa-0000-0000-0000-000000000001','ukulele') ON CONFLICT DO NOTHING;
INSERT INTO public.locations   (id, name) VALUES ('aaaaaaaa-0000-0000-0000-000000000002','Room 1')  ON CONFLICT DO NOTHING;
INSERT INTO public.teachers (id, user_id, name) VALUES ('bbbbbbbb-0000-0000-0000-000000000001','33333333-3333-3333-3333-333333333333','T');
INSERT INTO public.batches (id, instrument_id, location_id, teacher_id, day_of_week, start_time, duration_min, semester_start)
VALUES ('cccccccc-0000-0000-0000-00000000000a','aaaaaaaa-0000-0000-0000-000000000001','aaaaaaaa-0000-0000-0000-000000000002',
        'bbbbbbbb-0000-0000-0000-000000000001',0,'15:00',60,'2026-01-04');
INSERT INTO public.students (id, user_id, name) VALUES ('dddddddd-0000-0000-0000-00000000000a','11111111-1111-1111-1111-111111111111','S');
INSERT INTO public.enrollments (student_id, batch_id, status) VALUES ('dddddddd-0000-0000-0000-00000000000a','cccccccc-0000-0000-0000-00000000000a','active');

INSERT INTO public.weekly_plan_sessions
  (id, student_id, week_start, session_index, scheduled_date, session_type, focus_song_id,
   focus_instruction, focus_target_min, warmup_target_min, warmup_instruction,
   bonus_target_min, bonus_type, bonus_instruction)
VALUES
  ('eeeeeeee-0000-0000-0000-00000000000a','dddddddd-0000-0000-0000-00000000000a','2026-01-05',0,'2026-01-05',
   'build','sunshine','focus',15,5,'warm',10,'callback_song','bonus');

-- ------------------------------------------------ finishing practice
SET LOCAL role authenticated;
SET LOCAL request.jwt.claims TO '{"sub":"11111111-1111-1111-1111-111111111111","role":"authenticated"}';

SELECT public.complete_practice_segment('eeeeeeee-0000-0000-0000-00000000000a','warmup');
SELECT public.complete_practice_segment('eeeeeeee-0000-0000-0000-00000000000a','focus');

SELECT is(
  (SELECT count(*)::int FROM public.practice_logs),
  0,
  'no log until every segment is done'
);

SELECT public.complete_practice_segment('eeeeeeee-0000-0000-0000-00000000000a','bonus');

SELECT is((SELECT count(*)::int FROM public.practice_logs), 1, 'finishing writes one log');
SELECT isnt(
  (SELECT completed_at FROM public.weekly_plan_sessions WHERE id='eeeeeeee-0000-0000-0000-00000000000a'),
  NULL,
  'finishing marks the session complete'
);
SELECT is(
  (SELECT duration_min FROM public.practice_logs LIMIT 1),
  30,
  'the log carries the session total, not a guess'
);

-- Tapping again must not write a second log.
SELECT public.complete_practice_segment('eeeeeeee-0000-0000-0000-00000000000a','bonus');
SELECT is((SELECT count(*)::int FROM public.practice_logs), 1, 'a second tap writes nothing more');

SELECT throws_ok(
  $$ SELECT public.complete_practice_segment('eeeeeeee-0000-0000-0000-00000000000a','elbow') $$,
  NULL,
  'an unknown segment is refused'
);

-- ------------------------------------------------------ ending a class
SET LOCAL request.jwt.claims TO '{"sub":"33333333-3333-3333-3333-333333333333","role":"authenticated"}';

SELECT lives_ok(
  $$ SELECT public.end_class(
       'cccccccc-0000-0000-0000-00000000000a', '2026-01-11', 'went well',
       '[{"student_id":"dddddddd-0000-0000-0000-00000000000a","status":"present"}]'::jsonb,
       '[{"student_id":"dddddddd-0000-0000-0000-00000000000a","song_id":"sunshine","teacher_badge":3}]'::jsonb,
       NULL) $$,
  'the teacher of a class can end it'
);

SELECT is(
  (SELECT count(*)::int FROM public.attendance),
  1,
  'ending a class records the register in the same breath'
);

-- A student is not a teacher.
SET LOCAL request.jwt.claims TO '{"sub":"11111111-1111-1111-1111-111111111111","role":"authenticated"}';
SELECT throws_ok(
  $$ SELECT public.end_class('cccccccc-0000-0000-0000-00000000000a','2026-01-18','x','[]'::jsonb,'[]'::jsonb,NULL) $$,
  NULL,
  'someone else cannot end your class'
);

-- ------------------------------------------------------- changing a role
SET LOCAL request.jwt.claims TO '{"sub":"55555555-5555-5555-5555-555555555555","role":"authenticated"}';
SELECT throws_ok(
  $$ SELECT public.set_user_role('55555555-5555-5555-5555-555555555555','student') $$,
  NULL,
  'the last admin cannot demote themselves'
);

SELECT * FROM finish();
ROLLBACK;
