\set ON_ERROR_STOP on

DO $roles$
DECLARE
  role_name text;
BEGIN
  FOREACH role_name IN ARRAY ARRAY['ams_web', 'ams_worker', 'ams_migrator', 'ams_backup'] LOOP
    IF NOT EXISTS (SELECT 1 FROM pg_roles WHERE rolname = role_name) THEN
      RAISE EXCEPTION 'required database role % does not exist', role_name;
    END IF;
  END LOOP;

  IF EXISTS (
    SELECT 1
    FROM pg_roles
    WHERE rolname IN ('ams_web', 'ams_worker')
      AND (NOT rolcanlogin OR rolsuper OR rolcreatedb OR rolcreaterole OR rolbypassrls)
  ) THEN
    RAISE EXCEPTION 'runtime database role attributes are unsafe';
  END IF;

  IF EXISTS (
    SELECT 1
    FROM pg_roles
    WHERE rolname = 'ams_backup'
      AND (NOT rolcanlogin OR rolsuper OR rolcreatedb OR rolcreaterole)
  ) THEN
    RAISE EXCEPTION 'backup database role attributes are unsafe';
  END IF;

  IF EXISTS (
    SELECT 1
    FROM pg_roles
    WHERE rolname = 'ams_migrator'
      AND (NOT rolcanlogin OR rolsuper OR rolbypassrls)
  ) THEN
    RAISE EXCEPTION 'migrator database role attributes are unsafe';
  END IF;

  IF EXISTS (
    SELECT 1
    FROM pg_auth_members membership
    JOIN pg_roles member_role ON member_role.oid = membership.member
    WHERE member_role.rolname IN ('ams_web', 'ams_worker', 'ams_backup')
  ) THEN
    RAISE EXCEPTION 'managed runtime roles must not inherit membership from another role';
  END IF;

  IF EXISTS (
    SELECT 1
    FROM pg_class relation
    JOIN pg_namespace namespace ON namespace.oid = relation.relnamespace
    JOIN pg_roles owner_role ON owner_role.oid = relation.relowner
    WHERE owner_role.rolname IN ('ams_web', 'ams_worker', 'ams_backup')
      AND namespace.nspname NOT IN ('pg_catalog', 'information_schema')
  ) OR EXISTS (
    SELECT 1
    FROM pg_namespace namespace
    JOIN pg_roles owner_role ON owner_role.oid = namespace.nspowner
    WHERE owner_role.rolname IN ('ams_web', 'ams_worker', 'ams_backup')
  ) THEN
    RAISE EXCEPTION 'managed runtime roles must not own schemas or relations';
  END IF;
END
$roles$;

DO $grants$
DECLARE
  schema_name text;
BEGIN
  FOREACH schema_name IN ARRAY ARRAY[
    'public', 'platform', 'seo', 'leads', 'tools', 'research',
    'contracts', 'invoices', 'presentations', 'site_clone', 'ops', 'pgboss'
  ] LOOP
    IF EXISTS (SELECT 1 FROM pg_namespace WHERE nspname = schema_name) THEN
      IF schema_name = 'pgboss' THEN
        EXECUTE format('REVOKE USAGE ON SCHEMA %I FROM ams_web', schema_name);
        EXECUTE format('REVOKE ALL PRIVILEGES ON ALL TABLES IN SCHEMA %I FROM ams_web', schema_name);
        EXECUTE format('REVOKE ALL PRIVILEGES ON ALL SEQUENCES IN SCHEMA %I FROM ams_web', schema_name);
        EXECUTE format(
          'ALTER DEFAULT PRIVILEGES FOR ROLE %I IN SCHEMA %I REVOKE ALL PRIVILEGES ON TABLES FROM ams_web',
          current_user,
          schema_name
        );
        EXECUTE format(
          'ALTER DEFAULT PRIVILEGES FOR ROLE %I IN SCHEMA %I REVOKE ALL PRIVILEGES ON SEQUENCES FROM ams_web',
          current_user,
          schema_name
        );
        EXECUTE format('GRANT USAGE ON SCHEMA %I TO ams_worker, ams_backup', schema_name);
        EXECUTE format(
          'GRANT SELECT, INSERT, UPDATE, DELETE ON ALL TABLES IN SCHEMA %I TO ams_worker',
          schema_name
        );
        EXECUTE format('GRANT USAGE, SELECT ON ALL SEQUENCES IN SCHEMA %I TO ams_worker', schema_name);
      ELSE
        EXECUTE format('GRANT USAGE ON SCHEMA %I TO ams_web, ams_worker, ams_backup', schema_name);
        EXECUTE format(
          'GRANT SELECT, INSERT, UPDATE, DELETE ON ALL TABLES IN SCHEMA %I TO ams_web, ams_worker',
          schema_name
        );
        EXECUTE format('GRANT USAGE, SELECT ON ALL SEQUENCES IN SCHEMA %I TO ams_web, ams_worker', schema_name);
      END IF;
      EXECUTE format('GRANT SELECT ON ALL TABLES IN SCHEMA %I TO ams_backup', schema_name);
      IF schema_name = 'pgboss' THEN
        EXECUTE format(
          'ALTER DEFAULT PRIVILEGES FOR ROLE %I IN SCHEMA %I GRANT SELECT, INSERT, UPDATE, DELETE ON TABLES TO ams_worker',
          current_user,
          schema_name
        );
        EXECUTE format(
          'ALTER DEFAULT PRIVILEGES FOR ROLE %I IN SCHEMA %I GRANT USAGE, SELECT ON SEQUENCES TO ams_worker',
          current_user,
          schema_name
        );
      ELSE
        EXECUTE format(
          'ALTER DEFAULT PRIVILEGES FOR ROLE %I IN SCHEMA %I GRANT SELECT, INSERT, UPDATE, DELETE ON TABLES TO ams_web, ams_worker',
          current_user,
          schema_name
        );
        EXECUTE format(
          'ALTER DEFAULT PRIVILEGES FOR ROLE %I IN SCHEMA %I GRANT USAGE, SELECT ON SEQUENCES TO ams_web, ams_worker',
          current_user,
          schema_name
        );
      END IF;
      EXECUTE format(
        'ALTER DEFAULT PRIVILEGES FOR ROLE %I IN SCHEMA %I GRANT SELECT ON TABLES TO ams_backup',
        current_user,
        schema_name
      );
    END IF;
  END LOOP;
END
$grants$;

REVOKE ALL ON FUNCTION "platform"."stale_research_run_scopes"(timestamptz)
  FROM PUBLIC, ams_web, ams_backup;
GRANT EXECUTE ON FUNCTION "platform"."stale_research_run_scopes"(timestamptz)
  TO ams_worker;

DO $verify$
BEGIN
  IF to_regclass('pgboss.job') IS NOT NULL AND (
    has_table_privilege('ams_web', 'pgboss.job', 'SELECT')
    OR NOT has_table_privilege('ams_worker', 'pgboss.job', 'SELECT,INSERT,UPDATE,DELETE')
  ) THEN
    RAISE EXCEPTION 'pgboss privileges must deny web and allow worker DML';
  END IF;
END
$verify$;

-- PostgreSQL must reject an incomplete logical dump when FORCE RLS exists and
-- the managed provider cannot grant BYPASSRLS. backup.sh enforces this before
-- creating or uploading an artifact; Timeweb physical backups remain complete.
