REVOKE USAGE ON SCHEMA "platform" FROM PUBLIC;
GRANT USAGE ON SCHEMA "platform" TO ams_web, ams_worker;

DO $verify$
BEGIN
  IF EXISTS (
    SELECT 1
    FROM pg_namespace AS namespace
    CROSS JOIN LATERAL aclexplode(
      COALESCE(namespace.nspacl, acldefault('n', namespace.nspowner))
    ) AS privilege
    WHERE namespace.nspname = 'platform'
      AND privilege.grantee = 0
      AND privilege.privilege_type = 'USAGE'
  ) THEN
    RAISE EXCEPTION 'PUBLIC must not have USAGE on schema platform';
  END IF;

  IF NOT has_schema_privilege('ams_web', 'platform', 'USAGE')
    OR NOT has_schema_privilege('ams_worker', 'platform', 'USAGE')
  THEN
    RAISE EXCEPTION 'web and worker require explicit USAGE on schema platform';
  END IF;
END
$verify$;
