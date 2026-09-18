-- Higgsfield adapter is implemented in VisionWeaver runtime.
-- Keep credential_status non-verified until Vault secrets are supplied and smoke-tested.

update public.ec_connectors
set
  connection_state = 'deferred',
  credential_status = case
    when credential_status in ('configured', 'verified') then credential_status
    else 'not_configured'
  end,
  notes = trim(
    concat_ws(
      ' ',
      nullif(notes, ''),
      'Adapter implemented in visionweaver-orchestrator; awaiting real Vault credential activation and authenticated production smoke test.'
    )
  ),
  updated_at = now()
where connector_key = 'higgsfield';

