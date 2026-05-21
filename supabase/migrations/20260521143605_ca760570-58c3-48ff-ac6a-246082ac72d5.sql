-- 1) tuning flag on practice_logs
ALTER TABLE public.practice_logs
  ADD COLUMN IF NOT EXISTS tuning_check_completed boolean NOT NULL DEFAULT false;

-- 2) foundation_progress table
CREATE TABLE IF NOT EXISTS public.foundation_progress (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  student_id uuid NOT NULL,
  foundation_id text NOT NULL,
  completed_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (student_id, foundation_id)
);

ALTER TABLE public.foundation_progress ENABLE ROW LEVEL SECURITY;

CREATE POLICY "admin foundation_progress"
  ON public.foundation_progress
  FOR ALL TO authenticated
  USING (public.has_role(auth.uid(), 'admin'::public.app_role))
  WITH CHECK (public.has_role(auth.uid(), 'admin'::public.app_role));

CREATE POLICY "student own foundation_progress"
  ON public.foundation_progress
  FOR ALL TO authenticated
  USING (EXISTS (SELECT 1 FROM public.students st WHERE st.id = foundation_progress.student_id AND st.user_id = auth.uid()))
  WITH CHECK (EXISTS (SELECT 1 FROM public.students st WHERE st.id = foundation_progress.student_id AND st.user_id = auth.uid()));

CREATE POLICY "teacher reads foundation_progress"
  ON public.foundation_progress
  FOR SELECT TO authenticated
  USING (public.has_role(auth.uid(), 'teacher'::public.app_role)
         AND public.is_teacher_of_student(auth.uid(), student_id));
