-- Apply only after reviewing the target environment.
-- Journey writes are performed by the server after authentication,
-- authorization and owner checks. Do not grant UPDATE to authenticated.
grant update on table public.myryra_journeys to service_role;
