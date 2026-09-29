-- Which class a payment is for.
--
-- A payment was tied to a student and nothing else, so no view could say what
-- a class earns: money had to be traced back through enrolments, which breaks
-- the moment a student changes class or is in two at once. A payment is for a
-- place in a particular class, and now it says so.
--
-- Nullable, because the history can't all be placed with certainty. Existing
-- payments are given the class of a student who is in exactly one; a student
-- in two is genuinely ambiguous, and those are left for the finance page to
-- report as unattributed rather than filed under a guess.

ALTER TABLE public.payments
  ADD COLUMN IF NOT EXISTS batch_id uuid REFERENCES public.batches(id) ON DELETE SET NULL;

CREATE INDEX IF NOT EXISTS payments_batch_id_idx ON public.payments (batch_id);

UPDATE public.payments p
SET batch_id = only_class.batch_id
FROM (
  SELECT student_id, (array_agg(batch_id))[1] AS batch_id
  FROM public.enrollments
  WHERE status = 'active'
  GROUP BY student_id
  HAVING count(DISTINCT batch_id) = 1
) only_class
WHERE p.batch_id IS NULL
  AND p.student_id = only_class.student_id;
