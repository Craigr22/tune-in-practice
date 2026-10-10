-- When a student leaves a class, keep the fact that they were in it.
--
-- Removing a student used to delete their enrolment, so a class that had lost
-- four of its twelve looked like a class of eight that had always been eight.
-- De-registering now marks the enrolment as dropped (the status already
-- exists) and records the day they left and why — which is what attrition is
-- counted from. Nothing about who can read or write an enrolment changes.

ALTER TABLE public.enrollments
  ADD COLUMN IF NOT EXISTS left_on date,
  ADD COLUMN IF NOT EXISTS leave_reason text;

-- Anyone already marked as dropped left at some point nobody wrote down;
-- leave their date empty rather than inventing one.
