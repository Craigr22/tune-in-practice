ALTER TYPE public.expense_category ADD VALUE IF NOT EXISTS 'gst';
ALTER TYPE public.expense_category ADD VALUE IF NOT EXISTS 'subscriptions';
ALTER TYPE public.expense_category ADD VALUE IF NOT EXISTS 'salary';
ALTER TYPE public.expense_category ADD VALUE IF NOT EXISTS 'instrument_purchase';