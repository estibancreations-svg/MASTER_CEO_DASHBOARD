import "jsr:@supabase/functions-js/edge-runtime.d.ts";
import { createClient } from "jsr:@supabase/supabase-js@2";

// Custom OAuth callback handler — TikTok, Pinterest, Threads, Snapchat
// Exchanges auth code for tokens using PKCE verifier stored in oauth_flow_state,
// then upserts social_connections. Token values go to Vault via secure RPC pattern;
// this function stores vault refs only.

const TOKEN_ENDPOINTS: Record<string, string> = {
  tiktok: "https://open.tiktokapis.com/v2/oauth/token/",
  pinterest: "https://api.pinterest.com/v5/oauth/token",
  threads: "https://graph.threads.net/oauth/access_token",
  snapchat: "https://accounts.snapchat.com/login/oauth2/access_token",
};

Deno.serve(async (req: Request) => {
  const url = new URL(req.url);
  const platform = url.searchParams.get("platform") ?? "";
  const code = url.searchParams.get("code") ?? "";
  const state = url.searchParams.get("state") ?? "";

  const headers = { "Content-Type": "application/json" };

  if (!platform || !code || !state || !(platform in TOKEN_ENDPOINTS)) {
    return new Response(JSON.stringify({ error: "Missing or invalid platform/code/state" }), { status: 400, headers });
  }

  const supabase = createClient(
    Deno.env.get("SUPABASE_URL")!,
    Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!,
  );

  // 1. Validate CSRF state + retrieve PKCE verifier
  const { data: flow, error: flowErr } = await supabase
    .from("oauth_flow_state")
    .select("*")
    .eq("state_token", state)
    .eq("platform", platform)
    .eq("consumed", false)
    .gt("expires_at", new Date().toISOString())
    .single();

  if (flowErr || !flow) {
    return new Response(JSON.stringify({ error: "Invalid, expired, or consumed state token" }), { status: 403, headers });
  }

  // 2. Atomically consume the one-time state before any external token exchange.\n  // A concurrent callback using the same state now loses this compare-and-set.\n  const { data: claimed, error: claimErr } = await supabase\n    .from("oauth_flow_state")\n    .update({ consumed: true, consumed_at: new Date().toISOString() })\n    .eq("id", flow.id)\n    .eq("consumed", false)\n    .select("id")\n    .single();\n\n  if (claimErr || !claimed) {\n    return new Response(JSON.stringify({ error: "State token already consumed" }), {\n      status: 409,\n      headers: { ...headers, "Cache-Control": "no-store" },\n    });\n  }\n\n  // 3. Exchange code for tokens\n  const clientId = Deno.env.get(`${platform.toUpperCase()}_CLIENT_ID`) ?? "";
  const clientSecret = Deno.env.get(`${platform.toUpperCase()}_CLIENT_SECRET`) ?? "";

  if (!clientId) {
    return new Response(JSON.stringify({ error: `${platform} developer app not configured. Set ${platform.toUpperCase()}_CLIENT_ID secret.` }), { status: 503, headers });
  }

  const body = new URLSearchParams({
    grant_type: "authorization_code",
    code,
    client_id: clientId,
    client_secret: clientSecret,
    redirect_uri: flow.redirect_uri,
    code_verifier: flow.code_verifier ?? "",
  });

  const tokenRes = await fetch(TOKEN_ENDPOINTS[platform], {
    method: "POST",
    headers: { "Content-Type": "application/x-www-form-urlencoded" },
    body,
  });

  if (!tokenRes.ok) {
    const detail = await tokenRes.text();
    await supabase.from("social_connections").upsert(
      { platform, account_id: `err_${Date.now()}`, status: "error", error_detail: { stage: "token_exchange", detail: detail.slice(0, 500) } },
      { onConflict: "platform,account_id" },
    );
    return new Response(JSON.stringify({ error: "Token exchange failed", detail: detail.slice(0, 300) }), { status: 502, headers });
  }

  const tokens = await tokenRes.json();

  // 3. Store tokens in Vault, keep only refs in the table
  const accessRef = `vault:${platform}:access:${crypto.randomUUID()}`;
  const refreshRef = `vault:${platform}:refresh:${crypto.randomUUID()}`;
  await supabase.rpc("vault_store", { ref: accessRef, secret: tokens.access_token ?? "" }).then(() => {}, () => {});
  if (tokens.refresh_token) {
    await supabase.rpc("vault_store", { ref: refreshRef, secret: tokens.refresh_token }).then(() => {}, () => {});
  }

  const expiresAt = tokens.expires_in
    ? new Date(Date.now() + tokens.expires_in * 1000).toISOString()
    : null;

  // 5. Upsert the connection. The flow state was consumed before exchange.
  await supabase.from("social_connections").upsert(
    {
      platform,
      auth_method: "oauth2",
      account_id: tokens.open_id ?? tokens.user_id ?? `acct_${Date.now()}`,
      access_token_ref: accessRef,
      refresh_token_ref: tokens.refresh_token ? refreshRef : null,
      token_expires_at: expiresAt,
      status: "connected",
      last_sync_at: new Date().toISOString(),
      error_detail: {},
    },
    { onConflict: "platform,account_id" },
  );

  // 6. Bounce back to dashboard
  return new Response(null, {
    status: 302,
    headers: { Location: `${new URL(flow.redirect_uri).origin}?connected=${platform}` },
  });
});
