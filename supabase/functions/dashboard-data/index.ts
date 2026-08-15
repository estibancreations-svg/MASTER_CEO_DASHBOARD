import "jsr:@supabase/functions-js/edge-runtime.d.ts";
import { createClient } from "jsr:@supabase/supabase-js@2";

const cors = {
  "Access-Control-Allow-Origin": Deno.env.get("CEO_DASHBOARD_ORIGIN") ?? "https://estibancreations-ceo-dashboard.vercel.app",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
  "Vary": "Origin",
};

Deno.serve(async (req: Request) => {
  if (req.method === "OPTIONS") return new Response(null, { headers: cors });
  if (req.method !== "GET") return Response.json({ error: "Method not allowed" }, { status: 405, headers: cors });
  const authorization = req.headers.get("Authorization");
  if (!authorization) return Response.json({ error: "Authentication required" }, { status: 401, headers: cors });

  const url = Deno.env.get("SUPABASE_URL")!;
  const publishable = Deno.env.get("SUPABASE_ANON_KEY")!;
  const userClient = createClient(url, publishable, { global: { headers: { Authorization: authorization } } });
  const { data: { user }, error: userError } = await userClient.auth.getUser();
  const role = user?.app_metadata?.role;
  if (userError || !user || !["ceo", "architect"].includes(role)) {
    return Response.json({ error: "Executive authorization required" }, { status: 403, headers: cors });
  }

  const admin = createClient(url, Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!, { auth: { persistSession: false } });
  const [systems, decisions, integrations, audit] = await Promise.all([
    admin.from("ceo_system_status").select("system_id,system_name,lifecycle_state,health_state,progress_percent,blocker_count,qc_state,summary,source_updated_at,updated_at").order("progress_percent", { ascending: false }),
    admin.from("ceo_decisions").select("id,title,owner_system,priority,status,due_at,recommendation,updated_at").eq("status", "pending").order("due_at").limit(25),
    admin.from("ceo_integrations").select("integration_key,display_name,owning_system,connection_type,endpoint_class,status,last_health_at,capabilities,updated_at").order("display_name"),
    admin.from("ceo_audit_events").select("id,actor_label,action,target_type,target_id,source_system,evidence,created_at").order("created_at", { ascending: false }).limit(50),
  ]);
  const errors = [systems.error, decisions.error, integrations.error, audit.error].filter(Boolean).map(e => e!.message);
  if (errors.length) return Response.json({ error: "Read model incomplete", details: errors }, { status: 500, headers: cors });
  return Response.json({
    generated_at: new Date().toISOString(),
    systems: systems.data ?? [], decisions: decisions.data ?? [],
    integrations: integrations.data ?? [], audit_events: audit.data ?? [],
  }, { headers: { ...cors, "Cache-Control": "private, no-store" } });
});