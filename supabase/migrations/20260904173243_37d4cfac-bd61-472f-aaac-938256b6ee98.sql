-- =============== A SHORT CODE FOR EVERY CLASS ===============
-- Classes were only identifiable by room + instrument + time, which is a
-- mouthful and ambiguous once two run in the same room. Each class now gets a
-- short unique code — BAMUK01, BAMUK02, BAMGT01 — that people can say aloud.
--
-- BAM + a two-letter instrument code + a number that counts up per instrument.

ALTER TABLE public.batches
  ADD COLUMN IF NOT EXISTS code TEXT;

CREATE UNIQUE INDEX IF NOT EXISTS batches_code_key
  ON public.batches (code) WHERE code IS NOT NULL;

CREATE OR REPLACE FUNCTION public.set_batch_code()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_instrument TEXT;
  v_prefix     TEXT;
  v_next       INTEGER;
BEGIN
  -- Respect a code that was set deliberately.
  IF NEW.code IS NOT NULL AND NEW.code <> '' THEN
    RETURN NEW;
  END IF;

  SELECT lower(name) INTO v_instrument
  FROM public.instruments WHERE id = NEW.instrument_id;

  v_prefix := 'BAM' || CASE
    WHEN v_instrument LIKE 'ukulele%' THEN 'UK'
    WHEN v_instrument LIKE 'guitar%'  THEN 'GT'
    WHEN v_instrument LIKE 'violin%'  THEN 'VN'
    ELSE upper(substr(regexp_replace(coalesce(v_instrument, 'xx'), '[^a-z]', '', 'g') || 'xx', 1, 2))
  END;

  -- Continue the run for this instrument, ignoring any gaps from deletions.
  SELECT coalesce(max((substring(code from '[0-9]+$'))::integer), 0) + 1
    INTO v_next
  FROM public.batches
  WHERE code LIKE v_prefix || '%';

  NEW.code := v_prefix || lpad(v_next::text, 2, '0');
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS batches_set_code ON public.batches;
CREATE TRIGGER batches_set_code
  BEFORE INSERT ON public.batches
  FOR EACH ROW EXECUTE FUNCTION public.set_batch_code();

-- Give any class that already exists a code, numbered oldest first.
WITH prefixed AS (
  SELECT
    b.id,
    'BAM' || CASE
      WHEN lower(i.name) LIKE 'ukulele%' THEN 'UK'
      WHEN lower(i.name) LIKE 'guitar%'  THEN 'GT'
      WHEN lower(i.name) LIKE 'violin%'  THEN 'VN'
      ELSE upper(substr(regexp_replace(coalesce(lower(i.name), 'xx'), '[^a-z]', '', 'g') || 'xx', 1, 2))
    END AS prefix,
    b.semester_start
  FROM public.batches b
  LEFT JOIN public.instruments i ON i.id = b.instrument_id
  WHERE b.code IS NULL
),
numbered AS (
  SELECT id, prefix,
         row_number() OVER (PARTITION BY prefix ORDER BY semester_start NULLS LAST, id) AS n
  FROM prefixed
)
UPDATE public.batches b
   SET code = numbered.prefix || lpad(numbered.n::text, 2, '0')
  FROM numbered
 WHERE numbered.id = b.id;