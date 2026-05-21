
DO $$ BEGIN
  CREATE TYPE public.bonus_type AS ENUM ('callback_song', 'mini_challenge', 'jam', 'foundation_refresh');
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

DO $$ BEGIN
  CREATE TYPE public.session_kind AS ENUM ('build', 'flow', 'stretch');
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

CREATE TABLE public.weekly_plan_sessions (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  student_id UUID NOT NULL,
  week_start DATE NOT NULL,
  session_index SMALLINT NOT NULL CHECK (session_index BETWEEN 0 AND 2),
  scheduled_date DATE NOT NULL,
  session_type public.session_kind NOT NULL DEFAULT 'build',

  focus_song_id TEXT NOT NULL,
  focus_instruction TEXT NOT NULL DEFAULT '',
  focus_target_min INTEGER NOT NULL DEFAULT 20,

  warmup_target_min INTEGER NOT NULL DEFAULT 5,
  warmup_song_id TEXT,
  warmup_instruction TEXT NOT NULL DEFAULT '',

  bonus_target_min INTEGER NOT NULL DEFAULT 5,
  bonus_type public.bonus_type NOT NULL DEFAULT 'callback_song',
  bonus_song_id TEXT,
  bonus_instruction TEXT NOT NULL DEFAULT '',

  warmup_completed BOOLEAN NOT NULL DEFAULT false,
  focus_completed BOOLEAN NOT NULL DEFAULT false,
  bonus_completed BOOLEAN NOT NULL DEFAULT false,

  generated_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  completed_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),

  UNIQUE (student_id, week_start, session_index)
);

CREATE INDEX idx_wps_student_week ON public.weekly_plan_sessions(student_id, week_start);
CREATE INDEX idx_wps_scheduled ON public.weekly_plan_sessions(student_id, scheduled_date);

ALTER TABLE public.weekly_plan_sessions ENABLE ROW LEVEL SECURITY;

CREATE POLICY "admin weekly_plan_sessions"
  ON public.weekly_plan_sessions FOR ALL
  TO authenticated
  USING (public.has_role(auth.uid(), 'admin'::public.app_role))
  WITH CHECK (public.has_role(auth.uid(), 'admin'::public.app_role));

CREATE POLICY "student own weekly_plan_sessions"
  ON public.weekly_plan_sessions FOR ALL
  TO authenticated
  USING (EXISTS (SELECT 1 FROM public.students st WHERE st.id = weekly_plan_sessions.student_id AND st.user_id = auth.uid()))
  WITH CHECK (EXISTS (SELECT 1 FROM public.students st WHERE st.id = weekly_plan_sessions.student_id AND st.user_id = auth.uid()));

CREATE POLICY "teacher reads weekly_plan_sessions"
  ON public.weekly_plan_sessions FOR SELECT
  TO authenticated
  USING (public.has_role(auth.uid(), 'teacher'::public.app_role) AND public.is_teacher_of_student(auth.uid(), student_id));

CREATE OR REPLACE FUNCTION public.touch_updated_at()
RETURNS TRIGGER
LANGUAGE plpgsql
SET search_path = public
AS $fn$
BEGIN
  NEW.updated_at = now();
  RETURN NEW;
END;
$fn$;

CREATE TRIGGER update_wps_updated_at
  BEFORE UPDATE ON public.weekly_plan_sessions
  FOR EACH ROW
  EXECUTE FUNCTION public.touch_updated_at();
