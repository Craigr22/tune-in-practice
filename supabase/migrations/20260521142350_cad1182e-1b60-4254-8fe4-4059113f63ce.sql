
-- =============== ENUMS ===============
CREATE TYPE public.app_role AS ENUM ('admin','teacher','student');
CREATE TYPE public.payment_type AS ENUM ('per_hour','per_session','fixed_monthly');
CREATE TYPE public.fee_cycle AS ENUM ('monthly','quarterly','semester');
CREATE TYPE public.enrollment_status AS ENUM ('active','paused','dropped');
CREATE TYPE public.session_status AS ENUM ('upcoming','completed','cancelled');
CREATE TYPE public.attendance_status AS ENUM ('present','late','absent');
CREATE TYPE public.payment_method AS ENUM ('cash','upi','card','bank');
CREATE TYPE public.payment_status AS ENUM ('paid','pending','overdue');
CREATE TYPE public.expense_category AS ENUM ('rent','utilities','equipment','marketing','misc');

-- =============== USER ROLES ===============
CREATE TABLE public.user_roles (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  role public.app_role NOT NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  UNIQUE (user_id, role)
);
ALTER TABLE public.user_roles ENABLE ROW LEVEL SECURITY;

CREATE OR REPLACE FUNCTION public.has_role(_user_id UUID, _role public.app_role)
RETURNS BOOLEAN
LANGUAGE SQL STABLE SECURITY DEFINER SET search_path = public
AS $$
  SELECT EXISTS (SELECT 1 FROM public.user_roles WHERE user_id = _user_id AND role = _role)
$$;

CREATE OR REPLACE FUNCTION public.current_user_role()
RETURNS public.app_role
LANGUAGE SQL STABLE SECURITY DEFINER SET search_path = public
AS $$
  SELECT role FROM public.user_roles WHERE user_id = auth.uid()
  ORDER BY CASE role WHEN 'admin' THEN 1 WHEN 'teacher' THEN 2 ELSE 3 END
  LIMIT 1
$$;

CREATE POLICY "users read own roles" ON public.user_roles
  FOR SELECT TO authenticated USING (user_id = auth.uid() OR public.has_role(auth.uid(),'admin'));
CREATE POLICY "admins manage roles" ON public.user_roles
  FOR ALL TO authenticated USING (public.has_role(auth.uid(),'admin')) WITH CHECK (public.has_role(auth.uid(),'admin'));

-- =============== LOCATIONS ===============
CREATE TABLE public.locations (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  name TEXT NOT NULL,
  address TEXT,
  city TEXT,
  is_active BOOLEAN NOT NULL DEFAULT true,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
ALTER TABLE public.locations ENABLE ROW LEVEL SECURITY;
CREATE POLICY "auth read locations" ON public.locations FOR SELECT TO authenticated USING (true);
CREATE POLICY "admin write locations" ON public.locations FOR ALL TO authenticated
  USING (public.has_role(auth.uid(),'admin')) WITH CHECK (public.has_role(auth.uid(),'admin'));

-- =============== INSTRUMENTS ===============
CREATE TABLE public.instruments (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  name TEXT NOT NULL UNIQUE,
  is_active BOOLEAN NOT NULL DEFAULT true
);
ALTER TABLE public.instruments ENABLE ROW LEVEL SECURITY;
CREATE POLICY "auth read instruments" ON public.instruments FOR SELECT TO authenticated USING (true);
CREATE POLICY "admin write instruments" ON public.instruments FOR ALL TO authenticated
  USING (public.has_role(auth.uid(),'admin')) WITH CHECK (public.has_role(auth.uid(),'admin'));

-- =============== TEACHERS ===============
CREATE TABLE public.teachers (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID UNIQUE REFERENCES auth.users(id) ON DELETE SET NULL,
  name TEXT NOT NULL,
  email TEXT,
  phone TEXT,
  instruments UUID[] NOT NULL DEFAULT '{}',
  payment_type public.payment_type NOT NULL DEFAULT 'per_session',
  rate NUMERIC(10,2) NOT NULL DEFAULT 0,
  payout_cycle TEXT NOT NULL DEFAULT 'monthly',
  is_active BOOLEAN NOT NULL DEFAULT true,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
ALTER TABLE public.teachers ENABLE ROW LEVEL SECURITY;
CREATE POLICY "admin all teachers" ON public.teachers FOR ALL TO authenticated
  USING (public.has_role(auth.uid(),'admin')) WITH CHECK (public.has_role(auth.uid(),'admin'));
CREATE POLICY "teacher reads self" ON public.teachers FOR SELECT TO authenticated
  USING (user_id = auth.uid());
CREATE POLICY "any auth read teachers basic" ON public.teachers FOR SELECT TO authenticated USING (true);

-- =============== STUDENTS ===============
CREATE TABLE public.students (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID UNIQUE REFERENCES auth.users(id) ON DELETE SET NULL,
  name TEXT NOT NULL,
  parent_name TEXT,
  phone TEXT,
  email TEXT,
  joined_on DATE NOT NULL DEFAULT CURRENT_DATE,
  fee_amount NUMERIC(10,2) NOT NULL DEFAULT 0,
  fee_cycle public.fee_cycle NOT NULL DEFAULT 'monthly',
  fee_start_date DATE,
  is_active BOOLEAN NOT NULL DEFAULT true,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
ALTER TABLE public.students ENABLE ROW LEVEL SECURITY;

-- =============== BATCHES ===============
CREATE TABLE public.batches (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  location_id UUID NOT NULL REFERENCES public.locations(id) ON DELETE RESTRICT,
  instrument_id UUID NOT NULL REFERENCES public.instruments(id) ON DELETE RESTRICT,
  teacher_id UUID REFERENCES public.teachers(id) ON DELETE SET NULL,
  day_of_week SMALLINT NOT NULL,
  start_time TIME NOT NULL,
  duration_min INT NOT NULL DEFAULT 60,
  max_students INT NOT NULL DEFAULT 10,
  semester_start DATE,
  semester_end DATE,
  is_active BOOLEAN NOT NULL DEFAULT true
);
ALTER TABLE public.batches ENABLE ROW LEVEL SECURITY;

-- =============== ENROLLMENTS ===============
CREATE TABLE public.enrollments (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  student_id UUID NOT NULL REFERENCES public.students(id) ON DELETE CASCADE,
  batch_id UUID NOT NULL REFERENCES public.batches(id) ON DELETE CASCADE,
  enrolled_on DATE NOT NULL DEFAULT CURRENT_DATE,
  status public.enrollment_status NOT NULL DEFAULT 'active',
  UNIQUE (student_id, batch_id)
);
ALTER TABLE public.enrollments ENABLE ROW LEVEL SECURITY;

-- =============== SESSIONS ===============
CREATE TABLE public.sessions (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  batch_id UUID NOT NULL REFERENCES public.batches(id) ON DELETE CASCADE,
  scheduled_date DATE NOT NULL,
  status public.session_status NOT NULL DEFAULT 'upcoming',
  teacher_notes TEXT,
  completed_at TIMESTAMPTZ
);
ALTER TABLE public.sessions ENABLE ROW LEVEL SECURITY;

-- =============== ATTENDANCE ===============
CREATE TABLE public.attendance (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  session_id UUID NOT NULL REFERENCES public.sessions(id) ON DELETE CASCADE,
  student_id UUID NOT NULL REFERENCES public.students(id) ON DELETE CASCADE,
  status public.attendance_status NOT NULL DEFAULT 'present',
  recording_url TEXT,
  UNIQUE (session_id, student_id)
);
ALTER TABLE public.attendance ENABLE ROW LEVEL SECURITY;

-- =============== PRACTICE LOGS ===============
CREATE TABLE public.practice_logs (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  student_id UUID NOT NULL REFERENCES public.students(id) ON DELETE CASCADE,
  song_id TEXT NOT NULL,
  played_on DATE NOT NULL DEFAULT CURRENT_DATE,
  duration_min INT NOT NULL DEFAULT 0,
  self_rated_badge SMALLINT CHECK (self_rated_badge BETWEEN 1 AND 5),
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
ALTER TABLE public.practice_logs ENABLE ROW LEVEL SECURITY;

-- =============== SONG PROGRESS ===============
CREATE TABLE public.song_progress (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  student_id UUID NOT NULL REFERENCES public.students(id) ON DELETE CASCADE,
  song_id TEXT NOT NULL,
  self_badge SMALLINT CHECK (self_badge BETWEEN 1 AND 5),
  teacher_badge SMALLINT CHECK (teacher_badge BETWEEN 1 AND 5),
  last_practiced DATE,
  last_updated TIMESTAMPTZ NOT NULL DEFAULT now(),
  UNIQUE (student_id, song_id)
);
ALTER TABLE public.song_progress ENABLE ROW LEVEL SECURITY;

-- =============== PAYMENTS ===============
CREATE TABLE public.payments (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  student_id UUID NOT NULL REFERENCES public.students(id) ON DELETE CASCADE,
  amount NUMERIC(10,2) NOT NULL,
  paid_on DATE,
  period_start DATE,
  period_end DATE,
  method public.payment_method,
  status public.payment_status NOT NULL DEFAULT 'pending',
  notes TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
ALTER TABLE public.payments ENABLE ROW LEVEL SECURITY;
CREATE POLICY "admin payments" ON public.payments FOR ALL TO authenticated
  USING (public.has_role(auth.uid(),'admin')) WITH CHECK (public.has_role(auth.uid(),'admin'));

-- =============== EXPENSES ===============
CREATE TABLE public.expenses (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  location_id UUID REFERENCES public.locations(id) ON DELETE SET NULL,
  category public.expense_category NOT NULL DEFAULT 'misc',
  amount NUMERIC(10,2) NOT NULL,
  incurred_on DATE NOT NULL DEFAULT CURRENT_DATE,
  notes TEXT
);
ALTER TABLE public.expenses ENABLE ROW LEVEL SECURITY;
CREATE POLICY "admin expenses" ON public.expenses FOR ALL TO authenticated
  USING (public.has_role(auth.uid(),'admin')) WITH CHECK (public.has_role(auth.uid(),'admin'));

-- =============== HELPER FUNCTIONS ===============
CREATE OR REPLACE FUNCTION public.is_teacher_of_batch(_user_id UUID, _batch_id UUID)
RETURNS BOOLEAN LANGUAGE SQL STABLE SECURITY DEFINER SET search_path = public AS $$
  SELECT EXISTS (
    SELECT 1 FROM public.batches b
    JOIN public.teachers t ON t.id = b.teacher_id
    WHERE b.id = _batch_id AND t.user_id = _user_id
  )
$$;

CREATE OR REPLACE FUNCTION public.is_teacher_of_session(_user_id UUID, _session_id UUID)
RETURNS BOOLEAN LANGUAGE SQL STABLE SECURITY DEFINER SET search_path = public AS $$
  SELECT EXISTS (
    SELECT 1 FROM public.sessions s
    JOIN public.batches b ON b.id = s.batch_id
    JOIN public.teachers t ON t.id = b.teacher_id
    WHERE s.id = _session_id AND t.user_id = _user_id
  )
$$;

CREATE OR REPLACE FUNCTION public.is_teacher_of_student(_user_id UUID, _student_id UUID)
RETURNS BOOLEAN LANGUAGE SQL STABLE SECURITY DEFINER SET search_path = public AS $$
  SELECT EXISTS (
    SELECT 1 FROM public.enrollments e
    JOIN public.batches b ON b.id = e.batch_id
    JOIN public.teachers t ON t.id = b.teacher_id
    WHERE e.student_id = _student_id AND t.user_id = _user_id AND e.status = 'active'
  )
$$;

CREATE OR REPLACE FUNCTION public.is_student_in_batch(_user_id UUID, _batch_id UUID)
RETURNS BOOLEAN LANGUAGE SQL STABLE SECURITY DEFINER SET search_path = public AS $$
  SELECT EXISTS (
    SELECT 1 FROM public.enrollments e
    JOIN public.students st ON st.id = e.student_id
    WHERE e.batch_id = _batch_id AND st.user_id = _user_id
  )
$$;

CREATE OR REPLACE FUNCTION public.is_student_in_session(_user_id UUID, _session_id UUID)
RETURNS BOOLEAN LANGUAGE SQL STABLE SECURITY DEFINER SET search_path = public AS $$
  SELECT EXISTS (
    SELECT 1 FROM public.sessions s
    JOIN public.enrollments e ON e.batch_id = s.batch_id
    JOIN public.students st ON st.id = e.student_id
    WHERE s.id = _session_id AND st.user_id = _user_id
  )
$$;

-- =============== STUDENTS POLICIES ===============
CREATE POLICY "admin students" ON public.students FOR ALL TO authenticated
  USING (public.has_role(auth.uid(),'admin')) WITH CHECK (public.has_role(auth.uid(),'admin'));
CREATE POLICY "student reads self" ON public.students FOR SELECT TO authenticated
  USING (user_id = auth.uid());
CREATE POLICY "teacher reads enrolled students" ON public.students FOR SELECT TO authenticated
  USING (public.has_role(auth.uid(),'teacher') AND public.is_teacher_of_student(auth.uid(), id));

-- =============== BATCHES POLICIES ===============
CREATE POLICY "admin batches" ON public.batches FOR ALL TO authenticated
  USING (public.has_role(auth.uid(),'admin')) WITH CHECK (public.has_role(auth.uid(),'admin'));
CREATE POLICY "teacher reads own batches" ON public.batches FOR SELECT TO authenticated
  USING (public.is_teacher_of_batch(auth.uid(), id));
CREATE POLICY "teacher updates own batches" ON public.batches FOR UPDATE TO authenticated
  USING (public.is_teacher_of_batch(auth.uid(), id)) WITH CHECK (public.is_teacher_of_batch(auth.uid(), id));
CREATE POLICY "student reads own batches" ON public.batches FOR SELECT TO authenticated
  USING (public.is_student_in_batch(auth.uid(), id));

-- =============== ENROLLMENTS POLICIES ===============
CREATE POLICY "admin enrollments" ON public.enrollments FOR ALL TO authenticated
  USING (public.has_role(auth.uid(),'admin')) WITH CHECK (public.has_role(auth.uid(),'admin'));
CREATE POLICY "teacher reads enrollments" ON public.enrollments FOR SELECT TO authenticated
  USING (public.is_teacher_of_batch(auth.uid(), batch_id));
CREATE POLICY "student reads own enrollments" ON public.enrollments FOR SELECT TO authenticated
  USING (EXISTS (SELECT 1 FROM public.students st WHERE st.id = student_id AND st.user_id = auth.uid()));

-- =============== SESSIONS POLICIES ===============
CREATE POLICY "admin sessions" ON public.sessions FOR ALL TO authenticated
  USING (public.has_role(auth.uid(),'admin')) WITH CHECK (public.has_role(auth.uid(),'admin'));
CREATE POLICY "teacher reads sessions" ON public.sessions FOR SELECT TO authenticated
  USING (public.is_teacher_of_batch(auth.uid(), batch_id));
CREATE POLICY "teacher writes sessions" ON public.sessions FOR INSERT TO authenticated
  WITH CHECK (public.is_teacher_of_batch(auth.uid(), batch_id));
CREATE POLICY "teacher updates sessions" ON public.sessions FOR UPDATE TO authenticated
  USING (public.is_teacher_of_batch(auth.uid(), batch_id)) WITH CHECK (public.is_teacher_of_batch(auth.uid(), batch_id));
CREATE POLICY "student reads sessions" ON public.sessions FOR SELECT TO authenticated
  USING (public.is_student_in_batch(auth.uid(), batch_id));

-- =============== ATTENDANCE POLICIES ===============
CREATE POLICY "admin attendance" ON public.attendance FOR ALL TO authenticated
  USING (public.has_role(auth.uid(),'admin')) WITH CHECK (public.has_role(auth.uid(),'admin'));
CREATE POLICY "teacher manages attendance" ON public.attendance FOR ALL TO authenticated
  USING (public.is_teacher_of_session(auth.uid(), session_id))
  WITH CHECK (public.is_teacher_of_session(auth.uid(), session_id));
CREATE POLICY "student reads own attendance" ON public.attendance FOR SELECT TO authenticated
  USING (EXISTS (SELECT 1 FROM public.students st WHERE st.id = student_id AND st.user_id = auth.uid()));
CREATE POLICY "student writes own attendance" ON public.attendance FOR INSERT TO authenticated
  WITH CHECK (EXISTS (SELECT 1 FROM public.students st WHERE st.id = student_id AND st.user_id = auth.uid()));
CREATE POLICY "student updates own attendance" ON public.attendance FOR UPDATE TO authenticated
  USING (EXISTS (SELECT 1 FROM public.students st WHERE st.id = student_id AND st.user_id = auth.uid()))
  WITH CHECK (EXISTS (SELECT 1 FROM public.students st WHERE st.id = student_id AND st.user_id = auth.uid()));

-- =============== PRACTICE LOGS POLICIES ===============
CREATE POLICY "admin practice_logs" ON public.practice_logs FOR ALL TO authenticated
  USING (public.has_role(auth.uid(),'admin')) WITH CHECK (public.has_role(auth.uid(),'admin'));
CREATE POLICY "student own practice_logs" ON public.practice_logs FOR ALL TO authenticated
  USING (EXISTS (SELECT 1 FROM public.students st WHERE st.id = student_id AND st.user_id = auth.uid()))
  WITH CHECK (EXISTS (SELECT 1 FROM public.students st WHERE st.id = student_id AND st.user_id = auth.uid()));
CREATE POLICY "teacher reads practice_logs" ON public.practice_logs FOR SELECT TO authenticated
  USING (public.has_role(auth.uid(),'teacher') AND public.is_teacher_of_student(auth.uid(), student_id));

-- =============== SONG PROGRESS POLICIES ===============
CREATE POLICY "admin song_progress" ON public.song_progress FOR ALL TO authenticated
  USING (public.has_role(auth.uid(),'admin')) WITH CHECK (public.has_role(auth.uid(),'admin'));
CREATE POLICY "student own song_progress" ON public.song_progress FOR ALL TO authenticated
  USING (EXISTS (SELECT 1 FROM public.students st WHERE st.id = student_id AND st.user_id = auth.uid()))
  WITH CHECK (EXISTS (SELECT 1 FROM public.students st WHERE st.id = student_id AND st.user_id = auth.uid()));
CREATE POLICY "teacher manages song_progress" ON public.song_progress FOR ALL TO authenticated
  USING (public.has_role(auth.uid(),'teacher') AND public.is_teacher_of_student(auth.uid(), student_id))
  WITH CHECK (public.has_role(auth.uid(),'teacher') AND public.is_teacher_of_student(auth.uid(), student_id));

-- =============== SIGNUP TRIGGER ===============
CREATE OR REPLACE FUNCTION public.handle_new_user()
RETURNS TRIGGER LANGUAGE PLPGSQL SECURITY DEFINER SET search_path = public AS $$
DECLARE
  default_role public.app_role;
BEGIN
  -- First user becomes admin (bootstrap); subsequent signups default to student
  IF NOT EXISTS (SELECT 1 FROM public.user_roles WHERE role = 'admin') THEN
    default_role := 'admin';
  ELSE
    default_role := 'student';
  END IF;
  INSERT INTO public.user_roles (user_id, role) VALUES (NEW.id, default_role)
  ON CONFLICT DO NOTHING;
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS on_auth_user_created ON auth.users;
CREATE TRIGGER on_auth_user_created
  AFTER INSERT ON auth.users
  FOR EACH ROW EXECUTE FUNCTION public.handle_new_user();

-- =============== SEEDS ===============
INSERT INTO public.locations (name, address, city) VALUES
  ('Andheri Room 1', 'Andheri West, Building A', 'Mumbai'),
  ('Andheri Room 2', 'Andheri West, Building A', 'Mumbai');

INSERT INTO public.instruments (name, is_active) VALUES
  ('ukulele', true), ('guitar', false), ('violin', false);

INSERT INTO public.students (name, joined_on, fee_amount, fee_cycle) VALUES
  ('Aarav Mehta', '2025-11-12', 4500, 'monthly'),
  ('Priya Sharma', '2025-11-12', 4500, 'monthly'),
  ('Vikram Iyer', '2025-11-12', 4500, 'monthly'),
  ('Nisha Reddy', '2025-11-19', 4500, 'monthly'),
  ('Karan Joshi', '2025-11-12', 4500, 'monthly'),
  ('Aditi Bose', '2025-11-12', 4500, 'monthly'),
  ('Rahul Kumar', '2025-11-19', 4500, 'monthly'),
  ('Sara Khan', '2025-11-12', 4500, 'monthly');
