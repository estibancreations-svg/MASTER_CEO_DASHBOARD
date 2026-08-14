-- Restore the schema used by the authenticated dashboard Data API.
alter role authenticator set pgrst.db_schemas = 'public';
alter role authenticator set pgrst.db_extra_search_path = 'public,extensions';
notify pgrst, 'reload config';
