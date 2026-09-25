import { createClient } from "https://esm.sh/@supabase/supabase-js@2.49.1";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

type InviteBody = {
  email?: string;
  barbershop_id?: string;
  password?: string;
  full_name?: string;
  role?: "owner" | "partner" | "associate" | "employee";
  ownership_percent?: number;
  /** Quando true, cria/vincula gerente de conta (sem papel de equipe na loja). */
  as_account_manager?: boolean;
  can_view_dashboard?: boolean;
};

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response("ok", { headers: corsHeaders });
  }

  if (req.method !== "POST") {
    return json({ error: "Method not allowed" }, 405);
  }

  try {
    const supabaseUrl = Deno.env.get("SUPABASE_URL");
    const serviceKey =
      Deno.env.get("SUPABASE_SERVICE_ROLE_KEY") ?? Deno.env.get("SUPABASE_SERVICE_KEY");
    const anonKey = Deno.env.get("SUPABASE_ANON_KEY");

    if (!supabaseUrl || !serviceKey || !anonKey) {
      return json({ error: "Missing Supabase env on edge runtime" }, 500);
    }

    const authHeader = req.headers.get("Authorization");
    if (!authHeader?.startsWith("Bearer ")) {
      return json({ error: "Missing authorization" }, 401);
    }

    const userClient = createClient(supabaseUrl, anonKey, {
      global: { headers: { Authorization: authHeader } },
      auth: { persistSession: false, autoRefreshToken: false },
    });

    const {
      data: { user },
      error: userError,
    } = await userClient.auth.getUser();
    if (userError || !user) {
      return json({ error: "Invalid session" }, 401);
    }

    const admin = createClient(supabaseUrl, serviceKey, {
      auth: { persistSession: false, autoRefreshToken: false },
    });

    const body = (await req.json()) as InviteBody;
    const email = body.email?.trim().toLowerCase();
    const barbershopId = body.barbershop_id?.trim();
    const fullName = body.full_name?.trim() || null;
    const asAccountManager = body.as_account_manager === true;
    const roleRaw = body.role ?? "employee";
    // "partner" legado = co-dono (owner).
    const role = roleRaw === "partner" ? "owner" : roleRaw;
    const ownershipPercent = role === "owner" ? Number(body.ownership_percent) : null;
    const password =
      body.password?.trim() || crypto.randomUUID().replace(/-/g, "").slice(0, 16) + "Aa1!";

    if (!email || !barbershopId) {
      return json({ error: "email and barbershop_id are required" }, 400);
    }
    if (
      !asAccountManager &&
      role === "owner" &&
      (!Number.isFinite(ownershipPercent) || ownershipPercent! <= 0 || ownershipPercent! >= 100)
    ) {
      return json({ error: "ownership_percent must be between 0 and 100 for co-owners" }, 400);
    }

    const { data: shop, error: shopError } = await admin
      .from("barbershops")
      .select("id, name, slug")
      .eq("id", barbershopId)
      .maybeSingle();

    if (shopError) return json({ error: shopError.message }, 500);
    if (!shop) return json({ error: "Barbershop not found" }, 404);

    const { data: platformMembership, error: roleError } = await admin
      .from("memberships")
      .select("id")
      .eq("user_id", user.id)
      .eq("role", "platform_admin")
      .maybeSingle();
    if (roleError) return json({ error: roleError.message }, 500);
    const isPlatformAdmin = Boolean(platformMembership);

    const { data: isAccountManager, error: amError } = await admin.rpc("is_account_manager_of", {
      p_shop_id: barbershopId,
    });
    // rpc with service role won't have auth.uid() — check table instead
    const { data: amRow } = await admin
      .from("account_manager_shops")
      .select("user_id")
      .eq("user_id", user.id)
      .eq("barbershop_id", barbershopId)
      .maybeSingle();
    const isShopAccountManager = Boolean(amRow?.user_id);
    void isAccountManager;
    void amError;

    // Dono/co-dono: shop_add_member autentica via JWT do userClient.
    const { data: canApply, error: canApplyError } = await userClient.rpc(
      "can_apply_protected_change",
      { p_shop_id: barbershopId },
    );
    const { data: isOwnerMember } = await admin
      .from("shop_members")
      .select("id, role")
      .eq("barbershop_id", barbershopId)
      .eq("user_id", user.id)
      .eq("active", true)
      .in("role", ["owner", "partner"])
      .maybeSingle();

    const isShopSocietyActor = Boolean(isOwnerMember);
    const canInviteTeam =
      isPlatformAdmin || isShopAccountManager || isShopSocietyActor || canApply === true;
    void canApplyError;

    if (asAccountManager) {
      if (!isPlatformAdmin) {
        return json({ error: "Forbidden: only platform_admin assigns account managers" }, 403);
      }
    } else if (!canInviteTeam) {
      return json({
        error: "Forbidden: dono/co-dono, gerente da loja ou admin global necessários",
      }, 403);
    }

    let userId: string | null = null;
    let created = false;
    let tempPassword: string | null = null;

    const { data: listed, error: listError } = await admin.auth.admin.listUsers({
      page: 1,
      perPage: 1000,
    });
    if (listError) return json({ error: listError.message }, 500);

    const existing = listed.users.find((u) => u.email?.toLowerCase() === email);

    if (existing) {
      userId = existing.id;
    } else {
      const { data: createdUser, error: createError } = await admin.auth.admin.createUser({
        email,
        password,
        email_confirm: true,
        user_metadata: fullName ? { full_name: fullName } : undefined,
      });
      if (createError || !createdUser.user) {
        return json({ error: createError?.message ?? "Failed to create user" }, 400);
      }
      userId = createdUser.user.id;
      created = true;
      tempPassword = password;
    }

    if (fullName) {
      await admin.from("profiles").update({ full_name: fullName }).eq("id", userId);
    }

    if (asAccountManager) {
      const { data: amMembership } = await admin
        .from("memberships")
        .select("id")
        .eq("user_id", userId)
        .eq("role", "account_manager")
        .maybeSingle();
      if (!amMembership) {
        const { error: memError } = await admin.from("memberships").insert({
          user_id: userId,
          barbershop_id: null,
          role: "account_manager",
        });
        if (memError) {
          if (created) await admin.auth.admin.deleteUser(userId);
          return json({ error: memError.message }, 400);
        }
      }

      const { error: assignError } = await admin.from("account_manager_shops").upsert(
        {
          user_id: userId,
          barbershop_id: barbershopId,
          can_view_dashboard: body.can_view_dashboard === true,
          assigned_by: user.id,
        },
        { onConflict: "user_id,barbershop_id" },
      );
      if (assignError) {
        if (created) await admin.auth.admin.deleteUser(userId);
        return json({ error: assignError.message }, 400);
      }

      return json({
        ok: true,
        user_id: userId,
        email,
        barbershop: shop,
        created,
        temporary_password: tempPassword,
        role: "account_manager",
        can_view_dashboard: body.can_view_dashboard === true,
      });
    }

    // Admin/gerente aplicam direto; dono usa shop_add_member (pode ficar pending em sociedade igualitária).
    const rpcName =
      isPlatformAdmin || isShopAccountManager ? "platform_add_shop_member" : "shop_add_member";
    const { data: memberResult, error: memberError } = await userClient.rpc(rpcName, {
      p_shop_id: barbershopId,
      p_user_id: userId,
      p_role: role,
      p_ownership_percent: ownershipPercent,
      p_display_name: fullName,
    });
    if (memberError) {
      if (created) await admin.auth.admin.deleteUser(userId);
      return json({ error: memberError.message }, 400);
    }

    const status =
      typeof memberResult === "object" && memberResult && "status" in memberResult
        ? (memberResult as { status?: string }).status
        : "applied";

    return json({
      ok: true,
      user_id: userId,
      email,
      barbershop: shop,
      created,
      temporary_password: tempPassword,
      role,
      ownership_percent: ownershipPercent,
      status: status ?? "applied",
      member_result: memberResult,
    });
  } catch (err) {
    const message = err instanceof Error ? err.message : "Unexpected error";
    return json({ error: message }, 500);
  }
});

function json(body: unknown, status = 200) {
  return new Response(JSON.stringify(body), {
    status,
    headers: { ...corsHeaders, "Content-Type": "application/json" },
  });
}
