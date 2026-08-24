-- EC Integration Fabric durable queue backbone
-- Replaces n8n as required production orchestration infrastructure.

create extension if not exists pgmq;

select pgmq.create('ec_orchestration');
select pgmq.create('ec_vision');
select pgmq.create('ec_agents');
select pgmq.create('ec_connectors');
select pgmq.create('ec_qc');
select pgmq.create('ec_monitoring');
select pgmq.create('ec_dead_letter');
