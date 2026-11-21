-- Recover support outbox rows when a worker process stops after claiming an item.
ALTER TABLE public.support_email_outbox
  ADD COLUMN IF NOT EXISTS processing_started_at timestamptz;

CREATE INDEX IF NOT EXISTS support_email_outbox_processing_started_idx
  ON public.support_email_outbox (processing_started_at)
  WHERE status = 'processing';
