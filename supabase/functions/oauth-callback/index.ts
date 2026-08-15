import "jsr:@supabase/functions-js/edge-runtime.d.ts";
import { createClient } from "jsr:@supabase/supabase-js@2";

const TOKEN_ENDPOINTS: Record<string, string> = {
  tiktok: "https://open.tiktokapis.com/v2/oauth/token/",
  pinterest: "https://api.pinterest.com/v5/oauth/token",
  threads: "https://graph.threads.net/oauth/access_token",
  snapchat: "https://accounts.snapchat.com/login/oauth2/access_token",
};

const jsonHeaders = {
  "Content-Type": "application/json",
  "Cache-Control": "no-store",
  "X-Content-Type-Options": "nosniff",
};

Deno.serve(async (req: Request) => {
  if (req.method !== "GET") {
    return Response.json({ error: "Method not allowed" }, {
      status: 405,
      headers: { ...jsonHeaders, Allow: "GET" },
    });
  }

  const url = new URL(req.url);
  const platform = url.searchParams.get("platform") ?? "";
  const code = url.searchParams.get("code") ?? "";
  const state = url.searchParams.get("state") ?? "";

  if (!platform || !code || state.length < 32 || !(platform in TOKEN_ENDPOINTS)) {
    return Response.json({ error: "Missing or invalid OAuth callback parameters" }, {
      status: 400,
      headers: jsonHeaders,
    });
  }

  const supabaseUrl = Deno.env.get("SUPABASE_URL");
  const serviceKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY");
  if (!supabaseUrl || !serviceKey) {
    return Response.json({ error: "Callback service unavailable" }, {
      status: 503,
      headers: jsonHeaders,
    });
  }
  const supabase = createClient(supabaseUrl, serviceKey, {
    auth: { persistSession: false },
  });

  const { data: flow, error: flowError } = await supabase
    .from("oauth_flow_state")
    .select("id,platform,redirect_uri,code_verifier")
    .eq("state_token", state)
    .eq("platform", platform)
    .eq("consumed", false)
    .gt("expires_at", new Date().toISOString())
    .single();

  if (flowError || !flow) {
    return Response.json({ error: "Invalid, expired, or consumed state token" }, {
      status: 403,
      headers: jsonHeaders,
    });
  }

  const { data: claimed, error: claimError } = await supabase
    .from("oauth_flow_state")
    .update({ consumed: true, consumed_at: new Date().toISOString() })
    .eq("id", flow.id)
    .eq("consumed", false)
    .select("id")
    .single();

  if (claimError || !claimed) {
    return Response.json({ error: "State token already consumed" }, {
      status: 409,
      headers: jsonHeaders,
    });
  }

  const prefix = platform.toUpperCase();
  const clientId = Deno.env.get(`${prefix}_CLIENT_ID`) ?? "";
  const clientSecret = Deno.env.get(`${prefix}_CLIENT_SECRET`) ?? "";
  if (!clientId || !clientSecret) {
    return Response.json({ error: `${platform} developer application is not configured` }, {
      status: 503,
      headers: jsonHeaders,
    });
  }

  const body = new URLSearchParams({
    grant_type: "authorization_code",
    code,
    client_id: clientId,
    client_secret: clientSecret,
    redirect_uri: flow.redirect_uri,
    code_verifier: flow.code_verifier ?? "",
  });

  const tokenResponse = await fetch(TOKEN_ENDPOINTS[platform], {
    method: "POST",
    headers: { "Content-Type": "application/x-www-form-urlencoded" },
    body,
  });

  if (!tokenResponse.ok) {
    const detail = (await tokenResponse.text()).slice(0, 500);
    await supabase.from("social_connections").upsert(
      {
        platform,
        account_id: `err_${Date.now()}`,
        status: "error",
        error_detail: { stage: "token_exchange", provider_status: tokenResponse.status, detail },
      },
      { onConflict: "platform,account_id" },
    );
    return Response.json({ error: "Token exchange failed" }, {
      status: 502,
      headers: jsonHeaders,
    });
  }

  const tokens = await tokenResponse.json();
  if (!tokens.access_token) {
    return Response.json({ error: "Provider returned no access token" }, {
      status: 502,
      headers: jsonHeaders,
    });
  }

  const accessRef = `vault:${platform}:access:${crypto.randomUUID()}`;
  const refreshRef = `vault:${platform}:refresh:${crypto.randomUUID()}`;
  const { error: accessStoreError } = await supabase.rpc("vault_store", {
    ref: accessRef,
    secret: tokens.access_token,
  });
  if (accessStoreError) {
    return Response.json({ error: "Secure token storage failed" }, {
      status: 500,
      headers: jsonHeaders,
    });
  }

  if (tokens.refresh_token) {
    const { error: refreshStoreError } = await supabase.rpc("vault_store", {
      ref: refreshRef,
      secret: tokens.refresh_token,
    });
    if (refreshStoreError) {
      return Response.json({ error: "Secure refresh-token storage failed" }, {
        status: 500,
        headers: jsonHeaders,
      });
    }
  }

  const expiresAt = tokens.expires_in
    ? new Date(Date.now() + Number(tokens.expires_in) * 1000).toISOString()
    : null;

  const { error: connectionError } = await supabase.from("social_connections").upsert(
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

  if (connectionError) {
    return Response.json({ error: "Connection record update failed" }, {
      status: 500,
      headers: jsonHeaders,
    });
  }

  const returnOrigin = new URL(flow.redirect_uri).origin;
  return new Response(null, {
    status: 302,
    headers: {
      Location: `${returnOrigin}?connected=${encodeURIComponent(platform)}`,
      "Cache-Control": "no-store",
    },
  });
});
