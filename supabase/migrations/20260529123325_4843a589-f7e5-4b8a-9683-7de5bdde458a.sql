CREATE POLICY "teacher manages weekly_plan_sessions"
ON public.weekly_plan_sessions
FOR ALL
TO authenticated
USING (has_role(auth.uid(), 'teacher'::app_role) AND is_teacher_of_student(auth.uid(), student_id))
WITH CHECK (has_role(auth.uid(), 'teacher'::app_role) AND is_teacher_of_student(auth.uid(), student_id));