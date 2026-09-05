-- Can one person read another person's data?
--
-- 96 policies decide that, and until now none was tested — the answer was
-- whatever reading them carefully suggested. These sit a student, a teacher
-- and an outsider in front of the tables and check what each can actually see.
--
-- Run by `supabase db test`, which starts a throwaway Postgres, applies every
-- migration, and rolls back afterwards. Nothing here touches a real project.

BEGIN;
SELECT plan(14);

-- ---------------------------------------------------------------- fixtures
-- Two classes with a student each, so "their own" and "someone else's" are
-- both real rather than hypothetical.
INSERT INTO auth.users (id, email) VALUES
  ('11111111-1111-1111-1111-111111111111', 'student.a@test'),
  ('22222222-2222-2222-2222-222222222222', 'student.b@test'),
  ('33333333-3333-3333-3333-333333333333', 'teacher.a@test'),
  ('44444444-4444-4444-4444-444444444444', 'outsider@test');

INSERT INTO public.user_roles (user_id, role) VALUES
  ('11111111-1111-1111-1111-111111111111', 'student'),
  ('22222222-2222-2222-2222-222222222222', 'student'),
  ('33333333-3333-3333-3333-333333333333', 'teacher');

INSERT INTO public.instruments (id, name) VALUES
  ('aaaaaaaa-0000-0000-0000-000000000001', 'ukulele')
  ON CONFLICT DO NOTHING;
INSERT INTO public.locations (id, name) VALUES
  ('aaaaaaaa-0000-0000-0000-000000000002', 'Room 1')
  ON CONFLICT DO NOTHING;

INSERT INTO public.teachers (id, user_id, name) VALUES
  ('bbbbbbbb-0000-0000-0000-000000000001', '33333333-3333-3333-3333-333333333333', 'Teacher A');

INSERT INTO public.batches (id, instrument_id, location_id, teacher_id, day_of_week, start_time, duration_min, semester_start)
VALUES
  ('cccccccc-0000-0000-0000-00000000000a', 'aaaaaaaa-0000-0000-0000-000000000001',
   'aaaaaaaa-0000-0000-0000-000000000002', 'bbbbbbbb-0000-0000-0000-000000000001', 0, '15:00', 60, '2026-01-04'),
  ('cccccccc-0000-0000-0000-00000000000b', 'aaaaaaaa-0000-0000-0000-000000000001',
   'aaaaaaaa-0000-0000-0000-000000000002', NULL, 1, '17:00', 60, '2026-01-05');

INSERT INTO public.students (id, user_id, name) VALUES
  ('dddddddd-0000-0000-0000-00000000000a', '11111111-1111-1111-1111-111111111111', 'Student A'),
  ('dddddddd-0000-0000-0000-00000000000b', '22222222-2222-2222-2222-222222222222', 'Student B');

INSERT INTO public.enrollments (student_id, batch_id, status) VALUES
  ('dddddddd-0000-0000-0000-00000000000a', 'cccccccc-0000-0000-0000-00000000000a', 'active'),
  ('dddddddd-0000-0000-0000-00000000000b', 'cccccccc-0000-0000-0000-00000000000b', 'active');

INSERT INTO public.practice_logs (student_id, song_id, duration_min) VALUES
  ('dddddddd-0000-0000-0000-00000000000a', 'sunshine', 30),
  ('dddddddd-0000-0000-0000-00000000000b', 'sunshine', 30);

-- ------------------------------------------------------------ as student A
SET LOCAL role authenticated;
SET LOCAL request.jwt.claims TO '{"sub":"11111111-1111-1111-1111-111111111111","role":"authenticated"}';

SELECT is(
  (SELECT count(*)::int FROM public.batches),
  1,
  'a student sees only the class they are enrolled in'
);

SELECT is(
  (SELECT count(*)::int FROM public.batches WHERE id = 'cccccccc-0000-0000-0000-00000000000b'),
  0,
  'a student cannot read another class'
);

SELECT is(
  (SELECT count(*)::int FROM public.enrollments),
  1,
  'a student sees only their own enrolment'
);

SELECT is(
  (SELECT count(*)::int FROM public.practice_logs),
  1,
  'a student sees only their own practice'
);

SELECT is(
  (SELECT count(*)::int FROM public.students WHERE id = 'dddddddd-0000-0000-0000-00000000000b'),
  0,
  'a student cannot read another student record'
);

SELECT throws_ok(
  $$ UPDATE public.batches SET day_of_week = 3 WHERE id = 'cccccccc-0000-0000-0000-00000000000a' $$,
  NULL,
  'a student cannot change their class'
);

-- ------------------------------------------------------------ as teacher A
SET LOCAL request.jwt.claims TO '{"sub":"33333333-3333-3333-3333-333333333333","role":"authenticated"}';

SELECT is(
  (SELECT count(*)::int FROM public.batches),
  1,
  'a teacher sees only the classes they teach'
);

SELECT is(
  (SELECT count(*)::int FROM public.practice_logs),
  1,
  'a teacher sees practice for their own students only'
);

SELECT is(
  (SELECT count(*)::int FROM public.enrollments),
  1,
  'a teacher sees enrolments for their own classes only'
);

-- ------------------------------------------------------------- as outsider
-- Signed in, but attached to nothing: the case a leak would show up in.
SET LOCAL request.jwt.claims TO '{"sub":"44444444-4444-4444-4444-444444444444","role":"authenticated"}';

SELECT is((SELECT count(*)::int FROM public.batches), 0, 'an unattached user sees no classes');
SELECT is((SELECT count(*)::int FROM public.practice_logs), 0, 'an unattached user sees no practice');
SELECT is((SELECT count(*)::int FROM public.students), 0, 'an unattached user sees no students');
SELECT is((SELECT count(*)::int FROM public.enrollments), 0, 'an unattached user sees no enrolments');

-- --------------------------------------------------------------- anonymous
SET LOCAL role anon;
SELECT is((SELECT count(*)::int FROM public.students), 0, 'a signed-out visitor sees no students');

SELECT * FROM finish();
ROLLBACK;
