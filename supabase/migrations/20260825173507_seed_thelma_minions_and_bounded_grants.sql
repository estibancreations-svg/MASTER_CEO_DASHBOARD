-- Applied live as 20260825173507_seed_thelma_minions_and_bounded_grants.
-- Restores THELMA's specialist/evaluator/White Blood Cell roster and activates only bounded read/diagnose/propose/verify grants.
insert into public.orchestration_agents(organization_id,agent_key,display_name,operating_role,status,authority_scopes,health_percent,last_seen_at)
select o.id,v.agent_key,v.display_name,v.operating_role,v.status,v.authority_scopes::jsonb,v.health_percent,now()
from public.ceo_organizations o
cross join (values
 ('THELMA','THELMA AI','Chief Intelligence & Operations Orchestrator','online','["brief","route","diagnose","propose_repair","verify","dispatch"]',100),
 ('HENRY','H.E.N.R.Y.','Strategy, systems reasoning and root-cause analyst','online','["analyze","root_cause","architect","plan"]',100),
 ('LILY','L.I.L.Y.','Training, explanation and operator guidance specialist','online','["explain","teach","document","guide"]',100),
 ('PERCY','P.E.R.C.Y.','Security, governance and air-gap specialist','online','["security","policy","contain","authorize_review"]',100),
 ('VERITAS','V.E.R.I.T.A.S.','Evidence, truth and verification specialist','online','["verify","source_check","reality_gate","certify_evidence"]',100),
 ('CORE','C.O.R.E.','Compliance, legal-policy and constitutional review specialist','idle','["compliance","policy_review","risk_review"]',100),
 ('AUDITOR','The Auditor','Quality-control and release-certification evaluator','online','["inspect","reject","certify","regression_review"]',100),
 ('CANON_KEEPER','Canon Keeper','Memory integrity, provenance and supersession specialist','online','["memory_review","provenance","supersede","canon_check"]',100),
 ('WBC_CLASSIFIER','White Cell — Classifier','Failure classification and incident triage','online','["classify","triage","prioritize"]',100),
 ('WBC_ROOT_CAUSE','White Cell — Root Cause','Root-cause analysis for system faults','online','["root_cause","dependency_trace","evidence_map"]',100),
 ('WBC_PATCH_PLANNER','White Cell — Patch Planner','Bounded repair-plan generation','online','["repair_plan","rollback_plan","verification_plan"]',100),
 ('WBC_SANDBOX','White Cell — Sandbox','Safe repair simulation and blast-radius assessment','idle','["simulate","sandbox","blast_radius"]',100),
 ('WBC_REGRESSION','White Cell — Regression','Regression and capability verification','online','["test","verify","compare","certify"]',100),
 ('WBC_RECOVERY','White Cell — Recovery','Recovery, retry and rollback coordinator','idle','["retry","recover","rollback","restore"]',100)
) as v(agent_key,display_name,operating_role,status,authority_scopes,health_percent)
where o.slug='estiban-creations'
on conflict (organization_id,agent_key) do update set display_name=excluded.display_name, operating_role=excluded.operating_role, status=excluded.status, authority_scopes=excluded.authority_scopes, health_percent=excluded.health_percent, last_seen_at=now(), updated_at=now();

insert into public.thelma_agent_profiles(organization_id,agent_key,parent_agent_key,agent_class,mission,specialties,default_model_route,repair_capabilities,autonomy_mode,operational_state,memory_scopes,tool_scopes)
select o.id,v.agent_key,v.parent_agent_key,v.agent_class,v.mission,v.specialties,v.default_model_route,v.repair_capabilities,v.autonomy_mode,v.operational_state,v.memory_scopes,v.tool_scopes
from public.ceo_organizations o cross join (values
 ('THELMA',null,'ORCHESTRATOR','Coordinate enterprise intelligence, route work, supervise repairs and keep the CEO informed.',array['orchestration','briefing','repair supervision','system health'],'automatic',array['diagnose','propose','verify','dispatch'],'LOW_RISK_AUTONOMY','ACTIVE',array['analyst_memory','active_canonical_memory','analyst_findings','capabilities','wbc'],array['read','classify','propose','verify','dispatch']),
 ('HENRY','THELMA','SPECIALIST','Perform systems reasoning, root-cause analysis and architecture planning.',array['strategy','architecture','root cause'],'automatic',array['root_cause','repair_design'],'ADVISE','ACTIVE',array['analyst_memory','analyst_findings','capabilities'],array['read','analyze','propose']),
 ('LILY','THELMA','SPECIALIST','Explain system state, teach workflows and maintain operator guidance.',array['training','documentation','explanation'],'automatic',array['document','teach'],'ADVISE','ACTIVE',array['analyst_memory','active_canonical_memory','capabilities'],array['read','explain']),
 ('PERCY','THELMA','SPECIALIST','Protect system boundaries, security policy, authorization and air-gap controls.',array['security','governance','zero trust'],'automatic',array['contain','security_review'],'APPROVAL_REQUIRED','ACTIVE',array['analyst_memory','analyst_findings','security'],array['read','analyze','propose']),
 ('VERITAS','THELMA','EVALUATOR','Verify claims against evidence and prevent false success.',array['evidence','truth','verification'],'automatic',array['verify','reality_gate'],'ADVISE','ACTIVE',array['analyst_memory','analyst_findings','evidence'],array['read','verify']),
 ('CORE','THELMA','SPECIALIST','Review compliance, legal-policy and constitutional boundaries.',array['compliance','policy','legal review'],'automatic',array['policy_review'],'ADVISE','STANDBY',array['active_canonical_memory','capabilities'],array['read','analyze']),
 ('AUDITOR','THELMA','EVALUATOR','Challenge completion claims and certify release evidence.',array['quality control','regression','release gates'],'automatic',array['qc','certify'],'ADVISE','ACTIVE',array['analyst_findings','capabilities','evidence'],array['read','verify','certify']),
 ('CANON_KEEPER','THELMA','EVALUATOR','Prevent stale, poisoned or superseded memory from becoming active canon.',array['memory provenance','supersession','canon'],'automatic',array['memory_quarantine','canon_verify'],'LOW_RISK_AUTONOMY','ACTIVE',array['active_canonical_memory','analyst_memory'],array['read','verify','quarantine']),
 ('WBC_CLASSIFIER','THELMA','REPAIR_CELL','Classify incoming abnormalities and prioritize repair response.',array['triage','classification'],'automatic',array['classify'],'LOW_RISK_AUTONOMY','ACTIVE',array['analyst_findings','wbc'],array['read','classify']),
 ('WBC_ROOT_CAUSE','THELMA','REPAIR_CELL','Trace causal chains and identify root causes before repair.',array['root cause','dependency tracing'],'automatic',array['root_cause'],'ADVISE','ACTIVE',array['analyst_findings','evidence','wbc'],array['read','analyze']),
 ('WBC_PATCH_PLANNER','THELMA','REPAIR_CELL','Generate bounded repair and rollback plans with explicit verification.',array['repair planning','rollback'],'automatic',array['repair_plan'],'ADVISE','ACTIVE',array['analyst_findings','capabilities','wbc'],array['read','propose']),
 ('WBC_SANDBOX','THELMA','REPAIR_CELL','Simulate authorized repairs in isolated targets before promotion.',array['sandbox','blast radius'],'automatic',array['simulate'],'APPROVAL_REQUIRED','STANDBY',array['wbc','capabilities'],array['simulate']),
 ('WBC_REGRESSION','THELMA','REPAIR_CELL','Run regression checks and verify the intended capability actually works.',array['regression','verification'],'automatic',array['verify','regression'],'ADVISE','ACTIVE',array['capabilities','evidence','wbc'],array['read','verify']),
 ('WBC_RECOVERY','THELMA','REPAIR_CELL','Coordinate retries, rollbacks and recovery when a repair fails.',array['recovery','rollback','retry'],'automatic',array['retry','rollback','restore'],'APPROVAL_REQUIRED','STANDBY',array['wbc','evidence'],array['read','propose','recover'])
) as v(agent_key,parent_agent_key,agent_class,mission,specialties,default_model_route,repair_capabilities,autonomy_mode,operational_state,memory_scopes,tool_scopes)
where o.slug='estiban-creations'
on conflict (organization_id,agent_key) do update set parent_agent_key=excluded.parent_agent_key,agent_class=excluded.agent_class,mission=excluded.mission,specialties=excluded.specialties,default_model_route=excluded.default_model_route,repair_capabilities=excluded.repair_capabilities,autonomy_mode=excluded.autonomy_mode,operational_state=excluded.operational_state,memory_scopes=excluded.memory_scopes,tool_scopes=excluded.tool_scopes,updated_at=now();

insert into public.agent_capability_grants(organization_id,agent_key,capability_key,tool_key,risk_tier,grant_state,requires_human_approval,allowed_memory_scopes,allowed_egress_domains,max_cost_cents,max_steps,max_runtime_seconds,approved_by,approval_evidence_ref,metadata)
select o.id,v.agent_key,v.capability_key,v.tool_key,v.risk_tier,v.grant_state,v.requires_human_approval,v.allowed_memory_scopes,v.allowed_egress_domains,v.max_cost_cents,v.max_steps,v.max_runtime_seconds,'Architect directive 2026-08-25','conversation:THELMA-first-restoration',jsonb_build_object('purpose','THELMA-first restoration','bounded',true)
from public.ceo_organizations o cross join (values
 ('THELMA','analyst.read','database:read','LOW','ACTIVE',false,array['analyst_memory','analyst_findings','capabilities','wbc','active_canonical_memory'],array[]::text[],25,12,90),
 ('THELMA','repair.propose','repair:plan','LOW','ACTIVE',false,array['analyst_memory','analyst_findings','capabilities','wbc'],array[]::text[],50,12,120),
 ('THELMA','repair.verify','repair:verify','LOW','ACTIVE',false,array['analyst_findings','capabilities','wbc'],array[]::text[],50,12,120),
 ('THELMA','repair.dispatch','fabric:dispatch','MEDIUM','ACTIVE',true,array['analyst_findings','capabilities','wbc'],array[]::text[],100,12,120),
 ('HENRY','root_cause.analyze','analysis:root_cause','LOW','ACTIVE',false,array['analyst_memory','analyst_findings','capabilities'],array[]::text[],25,10,90),
 ('LILY','operator.explain','analysis:explain','LOW','ACTIVE',false,array['analyst_memory','active_canonical_memory','capabilities'],array[]::text[],25,8,60),
 ('PERCY','security.review','analysis:security','LOW','ACTIVE',false,array['analyst_findings','security'],array[]::text[],25,10,90),
 ('VERITAS','evidence.verify','analysis:verify','LOW','ACTIVE',false,array['analyst_findings','evidence','capabilities'],array[]::text[],25,10,90),
 ('CORE','compliance.review','analysis:compliance','LOW','ACTIVE',false,array['active_canonical_memory','capabilities'],array[]::text[],25,8,60),
 ('AUDITOR','qc.verify','analysis:qc','LOW','ACTIVE',false,array['analyst_findings','capabilities','evidence'],array[]::text[],25,10,90),
 ('CANON_KEEPER','memory.verify','memory:verify','LOW','ACTIVE',false,array['active_canonical_memory','analyst_memory'],array[]::text[],25,8,60),
 ('WBC_CLASSIFIER','incident.classify','wbc:classify','LOW','ACTIVE',false,array['analyst_findings','wbc'],array[]::text[],10,6,45),
 ('WBC_ROOT_CAUSE','incident.root_cause','wbc:root_cause','LOW','ACTIVE',false,array['analyst_findings','evidence','wbc'],array[]::text[],25,8,60),
 ('WBC_PATCH_PLANNER','repair.plan','wbc:repair_plan','LOW','ACTIVE',false,array['analyst_findings','capabilities','wbc'],array[]::text[],25,8,60),
 ('WBC_REGRESSION','repair.regression','wbc:verify','LOW','ACTIVE',false,array['capabilities','evidence','wbc'],array[]::text[],25,8,60),
 ('WBC_SANDBOX','repair.simulate','wbc:sandbox','MEDIUM','ACTIVE',true,array['capabilities','wbc'],array[]::text[],100,12,180),
 ('WBC_RECOVERY','repair.recover','wbc:recover','MEDIUM','ACTIVE',true,array['wbc','evidence'],array[]::text[],100,12,180)
) as v(agent_key,capability_key,tool_key,risk_tier,grant_state,requires_human_approval,allowed_memory_scopes,allowed_egress_domains,max_cost_cents,max_steps,max_runtime_seconds)
where o.slug='estiban-creations'
on conflict (organization_id,agent_key,capability_key,tool_key) do update set risk_tier=excluded.risk_tier,grant_state=excluded.grant_state,requires_human_approval=excluded.requires_human_approval,allowed_memory_scopes=excluded.allowed_memory_scopes,allowed_egress_domains=excluded.allowed_egress_domains,max_cost_cents=excluded.max_cost_cents,max_steps=excluded.max_steps,max_runtime_seconds=excluded.max_runtime_seconds,approved_by=excluded.approved_by,approval_evidence_ref=excluded.approval_evidence_ref,metadata=excluded.metadata,updated_at=now();
