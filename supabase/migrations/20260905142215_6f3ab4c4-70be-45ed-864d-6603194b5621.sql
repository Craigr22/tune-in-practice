-- Three workflows that were several independent writes, made atomic.
--
-- Each was a sequence of round trips from the browser with no transaction
-- around them, so a failure or a closed tab part-way through left the data
-- in a state the app can't represent:
--
--   * finishing practice   — a session marked complete with no practice log,
--                            so the teacher's roster shows no practice at all
--   * ending a class       — a completed session with only some of its
--                            attendance recorded
--   * changing a role      — the old role deleted and the new one never
--                            inserted, leaving a user with no role and no way
--                            back in
--
-- A function body is one transaction, so each of these now lands whole or not
-- at all. All three are SECURITY DEFINER, which bypasses RLS — so each checks
-- the caller itself, and pins search_path so the checks can't be shadowed.

-- ============================================================
-- 1. Finishing a practice segment
-- ============================================================
-- Idempotent on completed_at: ticking the last segment twice completes the
-- session once and writes one log, however many times it is called.
CREATE OR REPLACE FUNCTION public.complete_practice_segment(
  p_session_id UUID,
  p_segment    TEXT
)
RETURNS public.weekly_plan_sessions
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_session public.weekly_plan_sessions;
  v_owner   UUID;
BEGIN
  IF p_segment NOT IN ('warmup', 'focus', 'bonus') THEN
    RAISE EXCEPTION 'Unknown practice segment: %', p_segment;
  END IF;

  -- Lock the row: two quick taps must not both decide they finished it.
  SELECT * INTO v_session FROM public.weekly_plan_sessions
  WHERE id = p_session_id FOR UPDATE;

  IF NOT FOUND THEN
    RAISE EXCEPTION 'Practice session not found';
  END IF;

  -- This is the student's own practice, or nobody's business.
  SELECT s.user_id INTO v_owner FROM public.students s WHERE s.id = v_session.student_id;
  IF v_owner IS DISTINCT FROM auth.uid()
     AND NOT public.has_role(auth.uid(), 'admin'::public.app_role) THEN
    RAISE EXCEPTION 'Not your practice session';
  END IF;

  UPDATE public.weekly_plan_sessions
  SET warmup_completed = warmup_completed OR p_segment = 'warmup',
      focus_completed  = focus_completed  OR p_segment = 'focus',
      bonus_completed  = bonus_completed  OR p_segment = 'bonus'
  WHERE id = p_session_id
  RETURNING * INTO v_session;

  -- The log is what the teacher's roster reads, so it is written in the same
  -- breath as the completion rather than as a separate call that can fail.
  IF v_session.warmup_completed
     AND v_session.focus_completed
     AND v_session.bonus_completed
     AND v_session.completed_at IS NULL THEN

    UPDATE public.weekly_plan_sessions
    SET completed_at = now()
    WHERE id = p_session_id
    RETURNING * INTO v_session;

    INSERT INTO public.practice_logs (
      student_id, song_id, played_on, duration_min, shared_with_teacher
    )
    VALUES (
      v_session.student_id,
      v_session.focus_song_id,
      v_session.scheduled_date,
      COALESCE(v_session.warmup_target_min, 0)
        + COALESCE(v_session.focus_target_min, 0)
        + COALESCE(v_session.bonus_target_min, 0),
      TRUE
    );
  END IF;

  RETURN v_session;
END;
$$;

-- ============================================================
-- 2. Ending a class
-- ============================================================
-- Attendance and badges are passed as json arrays so the whole class lands in
-- one statement each, rather than a write per student.
CREATE OR REPLACE FUNCTION public.end_class(
  p_batch_id       UUID,
  p_scheduled_date DATE,
  p_teacher_notes  TEXT,
  p_attendance     JSONB DEFAULT '[]'::jsonb,
  p_badges         JSONB DEFAULT '[]'::jsonb,
  p_session_id     UUID DEFAULT NULL
)
RETURNS UUID
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_session_id UUID := p_session_id;
BEGIN
  -- Admins, or the teacher who actually takes this class.
  IF NOT public.has_role(auth.uid(), 'admin'::public.app_role)
     AND NOT EXISTS (
       SELECT 1 FROM public.batches b
       JOIN public.teachers t ON t.id = b.teacher_id
       WHERE b.id = p_batch_id AND t.user_id = auth.uid()
     ) THEN
    RAISE EXCEPTION 'Not your class';
  END IF;

  IF v_session_id IS NULL THEN
    -- Re-running after a failure shouldn't create a second session for the
    -- same day, so reuse the one already on the books.
    SELECT id INTO v_session_id FROM public.sessions
    WHERE batch_id = p_batch_id AND scheduled_date = p_scheduled_date
    LIMIT 1;
  END IF;

  IF v_session_id IS NULL THEN
    INSERT INTO public.sessions (batch_id, scheduled_date, status, teacher_notes, completed_at)
    VALUES (p_batch_id, p_scheduled_date, 'completed', p_teacher_notes, now())
    RETURNING id INTO v_session_id;
  ELSE
    UPDATE public.sessions
    SET status = 'completed', teacher_notes = p_teacher_notes, completed_at = now()
    WHERE id = v_session_id;
  END IF;

  INSERT INTO public.attendance (session_id, student_id, status)
  SELECT v_session_id,
         (a ->> 'student_id')::uuid,
         (a ->> 'status')::public.attendance_status
  FROM jsonb_array_elements(COALESCE(p_attendance, '[]'::jsonb)) AS a
  ON CONFLICT (session_id, student_id) DO UPDATE
    SET status = EXCLUDED.status;

  INSERT INTO public.song_progress (student_id, song_id, teacher_badge, last_updated)
  SELECT (b ->> 'student_id')::uuid,
         b ->> 'song_id',
         (b ->> 'teacher_badge')::smallint,
         now()
  FROM jsonb_array_elements(COALESCE(p_badges, '[]'::jsonb)) AS b
  ON CONFLICT (student_id, song_id) DO UPDATE
    SET teacher_badge = EXCLUDED.teacher_badge,
        last_updated  = now();

  RETURN v_session_id;
END;
$$;

-- ============================================================
-- 3. Changing a user's role
-- ============================================================
-- Delete-then-insert in one transaction, and the last-admin guard moves here
-- from the browser, where it could be bypassed by calling the table directly.
CREATE OR REPLACE FUNCTION public.set_user_role(
  p_user_id UUID,
  p_role    public.app_role
)
RETURNS VOID
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_was_admin  BOOLEAN;
  v_admin_left INTEGER;
BEGIN
  IF NOT public.has_role(auth.uid(), 'admin'::public.app_role) THEN
    RAISE EXCEPTION 'Only an admin can change roles';
  END IF;

  SELECT EXISTS (
    SELECT 1 FROM public.user_roles WHERE user_id = p_user_id AND role = 'admin'
  ) INTO v_was_admin;

  IF v_was_admin AND p_role <> 'admin' THEN
    SELECT count(*) INTO v_admin_left FROM public.user_roles WHERE role = 'admin';
    IF v_admin_left <= 1 THEN
      RAISE EXCEPTION 'Cannot remove the only admin';
    END IF;
  END IF;

  DELETE FROM public.user_roles WHERE user_id = p_user_id;
  INSERT INTO public.user_roles (user_id, role) VALUES (p_user_id, p_role);
END;
$$;

REVOKE ALL ON FUNCTION public.complete_practice_segment(UUID, TEXT) FROM PUBLIC;
REVOKE ALL ON FUNCTION public.end_class(UUID, DATE, TEXT, JSONB, JSONB, UUID) FROM PUBLIC;
REVOKE ALL ON FUNCTION public.set_user_role(UUID, public.app_role) FROM PUBLIC;

GRANT EXECUTE ON FUNCTION public.complete_practice_segment(UUID, TEXT) TO authenticated;
GRANT EXECUTE ON FUNCTION public.end_class(UUID, DATE, TEXT, JSONB, JSONB, UUID) TO authenticated;
GRANT EXECUTE ON FUNCTION public.set_user_role(UUID, public.app_role) TO authenticated;