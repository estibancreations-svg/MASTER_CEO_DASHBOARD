-- ============================================================================
-- MASTER CEO DASHBOARD  -  FRESH INSTALL  (blank slate)
-- Target: Supabase project "Master Dashboard" (ref yqealeekngxooyoemfba)
-- Written: 2026-10-05.  NOT RUN.  Nothing has been changed by this file yet.
--
-- WHAT THIS DOES (plain English)
--   Think of the system like a new phone. The apps (tables, rules, security)
--   stay installed. This file only clears out the "demo photos": sample
--   records and old test history, so every page starts empty and fills in
--   as the real user works.
--
-- WHAT IT KEEPS (the "operating system")
--   Table structure, row-level security, org + membership, system registry,
--   integrations list, model catalog/pricing, agents, connectors, workflows,
--   templates, settings, policies, governance. Anything the system needs to
--   boot is NOT touched.
--
-- HOW TO USE
--   1. Run as-is. It ends with ROLLBACK, so it only PRINTS what it would
--      delete (a dry run). Nothing is changed.
--   2. If the counts look right, change the last line ROLLBACK -> COMMIT
--      and run again.
--   3. Tier B (old history) is optional: delete that block to keep history.
--
-- ASSUMPTIONS TO CONFIRM (I could read row counts and a few sample rows only):
--   * The tables listed below hold demo/test data, not real client data.
--   * No table below is referenced by a foreign key you want kept. If a
--     DELETE fails on a foreign key, the whole run stops safely.
-- ============================================================================

BEGIN;

-- ---- TIER A: sample / demo content (rows seen: placeholder modules,
--      "QA Book/Movie" test projects, mock Tampa land parcels) --------------
DELETE FROM public.ceo_module_records;        -- placeholder module cards (24)
DELETE FROM public.land_demo_properties;      -- mock properties (15)
DELETE FROM public.vw_generations;            -- QA test generations (15)
DELETE FROM public.vw_assets;                 -- QA test assets (12)
DELETE FROM public.vw_characters;             -- test character (1)
DELETE FROM public.vw_projects;               -- QA test projects (15)
DELETE FROM public.production_log;            -- test log (2)
DELETE FROM public.grant_applications;        -- sample grant data (3)
DELETE FROM public.grant_requirements;        -- (15)
DELETE FROM public.grant_opportunities;       -- (3)
DELETE FROM public.marketing_signals;         -- (3)
DELETE FROM public.marketing_campaigns;       -- (3)
DELETE FROM public.social_weekly_reports;     -- (6)
DELETE FROM public.thelma_conversations;      -- test chats (2); messages cascade or clear below
DELETE FROM public.thelma_messages;           -- (4)

-- ---- TIER B (OPTIONAL): old operating history / test noise ----------------
DELETE FROM public.thelma_alerts;             -- (86)
DELETE FROM public.thelma_approval_requests;  -- (14)
DELETE FROM public.white_blood_cell_signals;  -- (73)
DELETE FROM public.ec_dead_letters;           -- (2)
DELETE FROM public.ec_job_events;             -- (33)
DELETE FROM public.ec_integration_jobs;       -- (4)
DELETE FROM public.orchestration_runs;        -- (3)
DELETE FROM public.orchestration_commands;    -- (2)
DELETE FROM public.ceo_governed_actions;      -- (4)
DELETE FROM public.analyst_findings;          -- (91)
DELETE FROM public.analyst_evidence;          -- (52)
DELETE FROM public.analyst_actions;           -- (18)
DELETE FROM public.ecosystem_scan_runs;       -- (96)
DELETE FROM public.resource_daily_reports;    -- (680)
DELETE FROM public.resource_balance_snapshots;-- (200)
DELETE FROM public.resource_sync_runs;        -- (40)
DELETE FROM public.resource_usage_events;     -- (15)
DELETE FROM public.intelligence_research_runs;-- (68)

-- ---- NOT TOUCHED ON PURPOSE ------------------------------------------------
-- ceo_organizations, ceo_organization_memberships (your login/org)
-- ceo_system_status, ceo_integrations, ec_connectors, ec_workflows,
-- ec_module_bindings, orchestration_agents, thelma_agent_profiles,
-- model_catalog, model_pricing_history, routing_strategy, credit_pools,
-- system_settings, system_memory, vw_templates, land_markets,
-- land_data_providers, agent_capability_grants, governance/policy tables.

-- ---- DRY-RUN REPORT: remaining rows in the tables we cleared ---------------
SELECT 'ceo_module_records' AS tbl, count(*) FROM public.ceo_module_records
UNION ALL SELECT 'vw_projects', count(*) FROM public.vw_projects
UNION ALL SELECT 'land_demo_properties', count(*) FROM public.land_demo_properties
UNION ALL SELECT 'thelma_alerts', count(*) FROM public.thelma_alerts;

ROLLBACK;   -- <-- change to COMMIT only when you are ready to go blank
