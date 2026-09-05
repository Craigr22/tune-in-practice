-- When a class doesn't happen, the course waits for it.
--
-- Everything a student sees is keyed off the class's start date: which
-- curriculum week they're on, which instructions, which clips. A cancelled
-- lesson used to leave no way to say so, so the plan marched on and the class
-- fell a week behind whatever the app was showing them.
--
-- A shift records that the course paused, without touching semester_start —
-- the class still began when it began, and past practice stays as it was.
-- Each row is one disruption; the effective shift is their sum, so entering
-- two cancellations pushes the course back two weeks.
--
-- Kept out of `batches` deliberately. Postgres row policies can't limit which
-- columns an update touches, so letting teachers write to their own batch row
-- would also let them change its day, time or teacher.

CREATE TABLE IF NOT EXISTS public.batch_plan_shifts (
  id         UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  batch_id   UUID NOT NULL REFERENCES public.batches(id) ON DELETE CASCADE,
  -- Weeks the course is pushed back. Negative pulls it forward again, which
  -- is how a shift entered by mistake is undone.
  weeks      INTEGER NOT NULL DEFAULT 1,
  -- Why, in the teacher's words: "Diwali", "I was unwell".
  reason     TEXT,
  created_by UUID REFERENCES auth.users(id) ON DELETE SET NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  CHECK (weeks <> 0 AND weeks BETWEEN -12 AND 12)
);

CREATE INDEX IF NOT EXISTS batch_plan_shifts_batch_idx
  ON public.batch_plan_shifts (batch_id, created_at);

ALTER TABLE public.batch_plan_shifts ENABLE ROW LEVEL SECURITY;

-- Students need to read it: it decides which week of the course they're on.
CREATE POLICY "auth read batch_plan_shifts"
  ON public.batch_plan_shifts FOR SELECT TO authenticated USING (true);

CREATE POLICY "admin writes batch_plan_shifts"
  ON public.batch_plan_shifts FOR ALL TO authenticated
  USING (public.has_role(auth.uid(), 'admin'::public.app_role))
  WITH CHECK (public.has_role(auth.uid(), 'admin'::public.app_role));

-- A teacher may pause and resume their own class, and nothing else.
CREATE POLICY "teacher shifts own batch"
  ON public.batch_plan_shifts FOR INSERT TO authenticated
  WITH CHECK (
    public.has_role(auth.uid(), 'teacher'::public.app_role)
    AND EXISTS (
      SELECT 1 FROM public.batches b
      JOIN public.teachers t ON t.id = b.teacher_id
      WHERE b.id = batch_plan_shifts.batch_id AND t.user_id = auth.uid()
    )
  );

CREATE POLICY "teacher deletes own recent shift"
  ON public.batch_plan_shifts FOR DELETE TO authenticated
  USING (
    public.has_role(auth.uid(), 'teacher'::public.app_role)
    AND created_by = auth.uid()
    AND EXISTS (
      SELECT 1 FROM public.batches b
      JOIN public.teachers t ON t.id = b.teacher_id
      WHERE b.id = batch_plan_shifts.batch_id AND t.user_id = auth.uid()
    )
  );
