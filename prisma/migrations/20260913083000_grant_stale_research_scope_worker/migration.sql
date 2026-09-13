-- Restore the least-privilege worker grant after the function revoked PUBLIC.
GRANT EXECUTE ON FUNCTION "platform"."stale_research_run_scopes"(timestamptz)
  TO ams_worker;
