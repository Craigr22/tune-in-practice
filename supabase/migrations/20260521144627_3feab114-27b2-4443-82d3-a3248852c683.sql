CREATE TABLE public.teacher_payouts (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  teacher_id uuid NOT NULL,
  month date NOT NULL,
  sessions integer NOT NULL DEFAULT 0,
  hours numeric NOT NULL DEFAULT 0,
  calculated numeric NOT NULL DEFAULT 0,
  adjustment numeric NOT NULL DEFAULT 0,
  final numeric NOT NULL DEFAULT 0,
  paid_on date,
  marked_paid_by uuid,
  created_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (teacher_id, month)
);

ALTER TABLE public.teacher_payouts ENABLE ROW LEVEL SECURITY;

CREATE POLICY "admin teacher_payouts"
  ON public.teacher_payouts
  FOR ALL
  TO authenticated
  USING (has_role(auth.uid(), 'admin'::app_role))
  WITH CHECK (has_role(auth.uid(), 'admin'::app_role));

CREATE POLICY "teacher reads own payouts"
  ON public.teacher_payouts
  FOR SELECT
  TO authenticated
  USING (EXISTS (SELECT 1 FROM public.teachers t WHERE t.id = teacher_payouts.teacher_id AND t.user_id = auth.uid()));