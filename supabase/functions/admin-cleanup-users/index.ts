import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const authHeader = req.headers.get("Authorization");
    if (!authHeader) throw new Error("Missing authorization");

    const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
    const supabaseAnonKey = Deno.env.get("SUPABASE_ANON_KEY")!;
    const serviceRoleKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;

    // Verify caller is admin
    const callerClient = createClient(supabaseUrl, supabaseAnonKey, {
      global: { headers: { Authorization: authHeader } },
    });
    const { data: { user: caller } } = await callerClient.auth.getUser();
    if (!caller) throw new Error("Unauthorized");

    const adminClient = createClient(supabaseUrl, serviceRoleKey);
    const { data: roleCheck } = await adminClient
      .from("user_roles")
      .select("role")
      .eq("user_id", caller.id)
      .eq("role", "admin")
      .maybeSingle();
    if (!roleCheck) throw new Error("Admin access required");

    // Get all auth users
    const allUsers: any[] = [];
    let page = 1;
    const perPage = 1000;
    while (true) {
      const { data: { users }, error } = await adminClient.auth.admin.listUsers({ page, perPage });
      if (error) throw error;
      if (!users || users.length === 0) break;
      allUsers.push(...users);
      if (users.length < perPage) break;
      page++;
    }

    // Get all organizer user_ids
    const { data: organizers } = await adminClient
      .from("organizer_profiles")
      .select("user_id");
    const orgIds = new Set((organizers || []).map((o: any) => o.user_id));

    // Get all explorer user_ids
    const { data: explorers } = await adminClient
      .from("attendee_accounts")
      .select("user_id");
    const expIds = new Set((explorers || []).map((e: any) => e.user_id));

    // Get admin user_ids
    const { data: admins } = await adminClient
      .from("user_roles")
      .select("user_id")
      .eq("role", "admin");
    const adminIds = new Set((admins || []).map((a: any) => a.user_id));

    // Find orphaned users (not organizer, not explorer, not admin)
    const orphaned = allUsers.filter(
      (u) => !orgIds.has(u.id) && !expIds.has(u.id) && !adminIds.has(u.id)
    );

    let deleted = 0;
    const errors: string[] = [];

    for (const user of orphaned) {
      const { error } = await adminClient.auth.admin.deleteUser(user.id);
      if (error) {
        errors.push(`${user.email || user.id}: ${error.message}`);
      } else {
        deleted++;
      }
    }

    // Also clean up orphaned user_roles
    for (const user of orphaned) {
      await adminClient.from("user_roles").delete().eq("user_id", user.id);
    }

    return new Response(
      JSON.stringify({
        success: true,
        total_auth_users: allUsers.length,
        orphaned_found: orphaned.length,
        deleted,
        errors: errors.length > 0 ? errors : undefined,
      }),
      { headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  } catch (err) {
    return new Response(
      JSON.stringify({ error: (err as Error).message }),
      { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  }
});
