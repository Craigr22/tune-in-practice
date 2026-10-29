-- Everyone who has asked about lessons, alongside the students.
--
-- An enquiry is a person who might join: who they are, what they asked
-- about, where they are in being followed up, and — once they join — which
-- student they became. Phone numbers are compared by their last ten digits,
-- so "+91 98200 12345" and "9820012345" are the same person.
--
-- Admins only: these are people who haven't signed up to anything, and their
-- numbers stay with the people who will call them.

CREATE TABLE IF NOT EXISTS public.enquiries (
  id              uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  created_at      timestamptz NOT NULL DEFAULT now(),
  updated_at      timestamptz NOT NULL DEFAULT now(),
  name            text NOT NULL,
  phone           text,
  phone_key       text GENERATED ALWAYS AS (
                    NULLIF(right(regexp_replace(coalesce(phone, ''), '\D', '', 'g'), 10), '')
                  ) STORED,
  course          text,
  category        text CHECK (category IS NULL OR category IN ('Kid', 'Adult - Female', 'Adult - Male')),
  kid_age         numeric(4,1),
  source          text,
  notes           text,
  status          text NOT NULL DEFAULT 'new'
                    CHECK (status IN ('new', 'contacted', 'trial', 'joined', 'not_interested')),
  follow_up_on    date,
  last_contact_at timestamptz,
  student_id      uuid REFERENCES public.students(id) ON DELETE SET NULL
);

-- One enquiry per phone number, which also makes the import safe to run twice.
CREATE UNIQUE INDEX IF NOT EXISTS enquiries_phone_key_idx ON public.enquiries (phone_key);
CREATE INDEX IF NOT EXISTS enquiries_status_idx ON public.enquiries (status);
CREATE INDEX IF NOT EXISTS enquiries_follow_up_idx ON public.enquiries (follow_up_on);

-- What happened with each one: calls, messages, notes, changes of status.
CREATE TABLE IF NOT EXISTS public.enquiry_activity (
  id          uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  enquiry_id  uuid NOT NULL REFERENCES public.enquiries(id) ON DELETE CASCADE,
  at          timestamptz NOT NULL DEFAULT now(),
  kind        text NOT NULL CHECK (kind IN ('note', 'call', 'whatsapp', 'status')),
  body        text,
  by_user     uuid DEFAULT auth.uid()
);

CREATE INDEX IF NOT EXISTS enquiry_activity_enquiry_idx ON public.enquiry_activity (enquiry_id, at DESC);

ALTER TABLE public.enquiries ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.enquiry_activity ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "admin manages enquiries" ON public.enquiries;
CREATE POLICY "admin manages enquiries" ON public.enquiries
  FOR ALL TO authenticated
  USING (public.has_role(auth.uid(), 'admin'::public.app_role))
  WITH CHECK (public.has_role(auth.uid(), 'admin'::public.app_role));

DROP POLICY IF EXISTS "admin manages enquiry activity" ON public.enquiry_activity;
CREATE POLICY "admin manages enquiry activity" ON public.enquiry_activity
  FOR ALL TO authenticated
  USING (public.has_role(auth.uid(), 'admin'::public.app_role))
  WITH CHECK (public.has_role(auth.uid(), 'admin'::public.app_role));

GRANT SELECT, INSERT, UPDATE, DELETE ON public.enquiries TO authenticated;
GRANT SELECT, INSERT, UPDATE, DELETE ON public.enquiry_activity TO authenticated;
