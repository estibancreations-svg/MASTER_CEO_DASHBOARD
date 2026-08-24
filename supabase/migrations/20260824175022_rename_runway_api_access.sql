-- Standardize the Runway server credential name across the live provider registry.
-- Runtime functions read RUNWAY_API_ACCESS from Edge Function Secrets first,
-- with an exact-name Vault lookup retained for controlled fallback environments.

update public.ec_connectors
set required_secrets = array['RUNWAY_API_ACCESS']::text[],
    updated_at = now()
where connector_key = 'runway';

update public.ceo_integrations
set required_secrets = array['RUNWAY_API_ACCESS']::text[],
    updated_at = now()
where integration_key = 'runway';

update public.ceo_integrations
set required_secrets = array['ANTHROPIC_API_KEY', 'RUNWAY_API_ACCESS']::text[],
    updated_at = now()
where integration_key = 'visionweaver';
