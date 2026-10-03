-- Pin the search path on the class-photo helper.
--
-- class_photo_batch only splits a string and casts it, and touches no tables,
-- so there was nothing for a changed search path to redirect. But a function
-- without one set is flagged by the database linter, and a warning that is
-- always there teaches people to stop reading warnings.

CREATE OR REPLACE FUNCTION public.class_photo_batch(_name text)
RETURNS uuid
LANGUAGE sql
IMMUTABLE
SET search_path = public
AS $$
  SELECT CASE
    WHEN split_part(_name, '/', 1) ~ '^[0-9a-fA-F]{8}-[0-9a-fA-F]{4}-[0-9a-fA-F]{4}-[0-9a-fA-F]{4}-[0-9a-fA-F]{12}$'
      THEN split_part(_name, '/', 1)::uuid
  END;
$$;
