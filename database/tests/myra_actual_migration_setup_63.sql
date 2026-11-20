-- Disposable PostgreSQL only. Mimics the relevant pre-migration PROD shape with synthetic IDs.
CREATE TABLE public.myryra_journeys (
  id uuid PRIMARY KEY, owner_id uuid NOT NULL
);
CREATE TABLE public.myryra_journey_missions (
  id uuid PRIMARY KEY, journey_id uuid NOT NULL REFERENCES public.myryra_journeys(id) ON DELETE CASCADE,
  status text NOT NULL DEFAULT 'pending'
);
CREATE TABLE public.myryra_journey_myra_ledger (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  owner_id uuid NOT NULL,
  journey_id uuid NOT NULL,
  mission_id uuid NOT NULL,
  amount integer NOT NULL DEFAULT 10,
  reason text NOT NULL DEFAULT 'mission_completed',
  created_at timestamptz NOT NULL DEFAULT now(),
  CONSTRAINT myryra_journey_myra_ledger_journey_id_fkey FOREIGN KEY(journey_id) REFERENCES public.myryra_journeys(id) ON DELETE CASCADE,
  CONSTRAINT myryra_journey_myra_ledger_mission_id_fkey FOREIGN KEY(mission_id) REFERENCES public.myryra_journey_missions(id) ON DELETE CASCADE,
  CONSTRAINT myryra_journey_myra_ledger_mission_id_key UNIQUE(mission_id)
);
INSERT INTO public.myryra_journeys VALUES
('00000000-0000-4000-8000-000000000101','00000000-0000-4000-8000-000000000901');
INSERT INTO public.myryra_journey_missions(id,journey_id,status) VALUES
('00000000-0000-4000-8000-000000000201','00000000-0000-4000-8000-000000000101','completed'),
('00000000-0000-4000-8000-000000000202','00000000-0000-4000-8000-000000000101','pending');
INSERT INTO public.myryra_journey_myra_ledger(owner_id,journey_id,mission_id) VALUES
('00000000-0000-4000-8000-000000000901','00000000-0000-4000-8000-000000000101','00000000-0000-4000-8000-000000000201');
