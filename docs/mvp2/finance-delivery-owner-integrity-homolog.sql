-- Staging-only integrity guard: delivery owner must match notification owner.
-- Run on an isolated branch after checking for inconsistent existing rows.
ALTER TABLE public.myryra_finance_notifications
  ADD CONSTRAINT myryra_finance_notifications_id_user_unique UNIQUE (id,user_id);
ALTER TABLE public.myryra_finance_delivery_log
  ADD CONSTRAINT finance_delivery_notification_owner_fk
  FOREIGN KEY (notification_id,user_id)
  REFERENCES public.myryra_finance_notifications(id,user_id)
  ON DELETE CASCADE;
