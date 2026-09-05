CREATE TABLE IF NOT EXISTS public.batch_plan_shifts (
  id         UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  batch_id   UUID NOT NULL REFERENCES public.batches(id) ON DELETE CASCADE,
  weeks      INTEGER NOT NULL DEFAULT 1,
  reason     TEXT,
  created_by UUID REFERENCES auth.users(id) ON DELETE SET NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  CHECK (weeks <> 0 AND weeks BETWEEN -12 AND 12)
);

GRANT SELECT, INSERT, UPDATE, DELETE ON public.batch_plan_shifts TO authenticated;
GRANT ALL ON public.batch_plan_shifts TO service_role;

CREATE INDEX IF NOT EXISTS batch_plan_shifts_batch_idx
  ON public.batch_plan_shifts (batch_id, created_at);

ALTER TABLE public.batch_plan_shifts ENABLE ROW LEVEL SECURITY;

CREATE POLICY "admin writes batch_plan_shifts"
  ON public.batch_plan_shifts FOR ALL TO authenticated
  USING (public.has_role(auth.uid(), 'admin'::public.app_role))
  WITH CHECK (public.has_role(auth.uid(), 'admin'::public.app_role));

CREATE POLICY "teacher reads own batch shifts"
  ON public.batch_plan_shifts FOR SELECT TO authenticated
  USING (
    EXISTS (SELECT 1 FROM public.batches b JOIN public.teachers t ON t.id = b.teacher_id
                WHERE b.id = batch_plan_shifts.batch_id AND t.user_id = auth.uid()));

CREATE POLICY "student reads own batch shifts"
  ON public.batch_plan_shifts FOR SELECT TO authenticated
  USING (
    EXISTS (SELECT 1 FROM public.enrollments e JOIN public.students s ON s.id = e.student_id
                WHERE e.batch_id = batch_plan_shifts.batch_id AND s.user_id = auth.uid()));

CREATE POLICY "teacher shifts own batch"
  ON public.batch_plan_shifts FOR INSERT TO authenticated
  WITH CHECK (
    public.has_role(auth.uid(), 'teacher'::public.app_role)
    AND EXISTS (SELECT 1 FROM public.batches b JOIN public.teachers t ON t.id = b.teacher_id
                WHERE b.id = batch_plan_shifts.batch_id AND t.user_id = auth.uid()));

CREATE POLICY "teacher deletes own recent shift"
  ON public.batch_plan_shifts FOR DELETE TO authenticated
  USING (
    public.has_role(auth.uid(), 'teacher'::public.app_role)
    AND created_by = auth.uid()
    AND EXISTS (SELECT 1 FROM public.batches b JOIN public.teachers t ON t.id = b.teacher_id
                WHERE b.id = batch_plan_shifts.batch_id AND t.user_id = auth.uid()));