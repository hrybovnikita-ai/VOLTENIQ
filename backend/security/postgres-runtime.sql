-- Run with psql as the schema owner against the intended VOLTENIQ database.
-- A name collision aborts the transaction; existing identities are never edited.
\set ON_ERROR_STOP on
BEGIN;
CREATE ROLE volteniq_runtime LOGIN NOSUPERUSER NOCREATEDB NOCREATEROLE
  NOREPLICATION NOBYPASSRLS NOINHERIT;
GRANT CONNECT ON DATABASE :"DBNAME" TO volteniq_runtime;
GRANT USAGE ON SCHEMA public TO volteniq_runtime;
GRANT SELECT ON public."User", public."Product", public."Favorite", public."Order",
  public."OrderItem", public."PriceAlert", public."PriceHistory", public."Notification",
  public."Session" TO volteniq_runtime;
GRANT INSERT (id, name, email, password, "googleId", "firebaseUid", "createdAt", "updatedAt"),
  UPDATE (name, password, "googleId", "firebaseUid", "updatedAt") ON public."User" TO volteniq_runtime;
GRANT INSERT, UPDATE, DELETE ON public."Product" TO volteniq_runtime;
GRANT INSERT, DELETE ON public."Favorite", public."PriceAlert", public."Session" TO volteniq_runtime;
GRANT INSERT ON public."Order", public."OrderItem", public."PriceHistory" TO volteniq_runtime;
GRANT UPDATE (status, "updatedAt") ON public."Order" TO volteniq_runtime;
DO $$
BEGIN
  IF has_schema_privilege('volteniq_runtime','public','CREATE')
     OR has_database_privilege('volteniq_runtime',current_database(),'CREATE') THEN
    RAISE EXCEPTION 'Unexpected inherited CREATE privilege; review existing PUBLIC grants before provisioning';
  END IF;
END $$;
COMMIT;
-- Set the new login password interactively with psql: \password volteniq_runtime
