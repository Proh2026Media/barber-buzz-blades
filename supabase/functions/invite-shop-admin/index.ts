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
  /** "Dar acesso ao painel" pelo cartão do profissional: liga a conta a esse cartão (P-08). */
  staff_id?: string;
};

const ROLE_LABEL: Record<string, string> = {
  owner: "Dono",
  partner: "Dono",
  associate: "Parceiro",
  employee: "Contratado",
};

/** Domínios reservados para teste (RFC 2606/6761): nunca recebem e-mail de verdade. */
function isTestAddress(email: string) {
  return /\.(invalid|test|example|localhost)$/i.test(email);
}

function newInviteToken() {
  const bytes = crypto.getRandomValues(new Uint8Array(32));
  return btoa(String.fromCharCode(...bytes))
    .replace(/\+/g, "-")
    .replace(/\//g, "_")
    .replace(/=+$/, "");
}

async function sha256Hex(value: string) {
  const digest = await crypto.subtle.digest("SHA-256", new TextEncoder().encode(value));
  return Array.from(new Uint8Array(digest))
    .map((b) => b.toString(16).padStart(2, "0"))
    .join("");
}

/** Endereço da loja: domínio próprio ativo ou o subdomínio na plataforma. */
function shopOrigin(shop: {
  slug: string;
  custom_domain?: string | null;
  custom_domain_status?: string | null;
}) {
  if (shop.custom_domain && shop.custom_domain_status === "active") {
    return `https://${shop.custom_domain}`;
  }
  // No servidor, PLATFORM_BASE_HOST aponta para o alvo dos domínios próprios
  // ("dominios.<base>"), que não atende as lojas pelo subdomínio.
  const base = (Deno.env.get("PLATFORM_BASE_HOST") ?? "beauty.contheiner.digital")
    .trim()
    .toLowerCase()
    .replace(/\.$/, "")
    .replace(/^dominios\./, "");
  return `https://${shop.slug}.${base}`;
}

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
    let ownershipPercent = role === "owner" ? Number(body.ownership_percent) : null;
    const staffId = body.staff_id?.trim() || null;
    const password =
      body.password?.trim() || crypto.randomUUID().replace(/-/g, "").slice(0, 16) + "Aa1!";

    if (!email || !barbershopId) {
      return json({ error: "email and barbershop_id are required" }, 400);
    }

    const { data: shop, error: shopError } = await admin
      .from("barbershops")
      .select("id, name, slug, custom_domain, custom_domain_status")
      .eq("id", barbershopId)
      .maybeSingle();

    if (shopError) return json({ error: shopError.message }, 500);
    if (!shop) return json({ error: "Barbershop not found" }, 404);

    if (!asAccountManager && role === "owner") {
      // Loja sem dono ativo (criada pela plataforma): o primeiro dono entra com 100% (P-06).
      const { count: activeOwners } = await admin
        .from("shop_members")
        .select("id", { count: "exact", head: true })
        .eq("barbershop_id", barbershopId)
        .eq("active", true)
        .in("role", ["owner", "partner"]);
      if (!activeOwners) {
        if (body.ownership_percent != null && ownershipPercent !== 100) {
          return json({ error: "O primeiro dono da barbearia entra com 100%." }, 400);
        }
        ownershipPercent = 100;
      } else if (
        !Number.isFinite(ownershipPercent) ||
        ownershipPercent! <= 0 ||
        ownershipPercent! >= 100
      ) {
        return json({ error: "ownership_percent must be between 0 and 100 for co-owners" }, 400);
      }
    }

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
      return json(
        {
          error: "Forbidden: dono/co-dono, gerente da loja ou admin global necessários",
        },
        403,
      );
    }

    let userId: string | null = null;
    let created = false;
    let tempPassword: string | null = null;
    // Conta de um convite anterior que ainda não trocou a senha temporária também recebe link.
    let stillTemporary = false;

    // Percorre todas as páginas do Auth: acima de 1000 contas o e-mail pode
    // não estar na primeira página.
    const perPage = 1000;
    let existing: { id: string; user_metadata?: Record<string, unknown> } | undefined;
    for (let page = 1; page <= 200; page++) {
      const { data: listed, error: listError } = await admin.auth.admin.listUsers({
        page,
        perPage,
      });
      if (listError) return json({ error: listError.message }, 500);
      existing = listed.users.find((u) => u.email?.toLowerCase() === email);
      if (existing || listed.users.length < perPage) break;
    }

    if (existing) {
      userId = existing.id;
      stillTemporary = existing.user_metadata?.must_change_password === true;
    } else {
      const { data: createdUser, error: createError } = await admin.auth.admin.createUser({
        email,
        password,
        email_confirm: true,
        // Senha temporária repassada à mão: o app pede uma senha própria no primeiro acesso
        // (src/lib/auth/password-change.ts).
        user_metadata: {
          ...(fullName ? { full_name: fullName } : {}),
          must_change_password: true,
        },
      });
      if (createError || !createdUser.user) {
        return json({ error: createError?.message ?? "Failed to create user" }, 400);
      }
      userId = createdUser.user.id;
      created = true;
      tempPassword = password;
    }

    // Só define o nome global do perfil em conta criada agora. Em conta que já
    // existia, o nome é do próprio usuário; o nome na loja vai em p_display_name.
    if (fullName && created) {
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
    const memberArgs: Record<string, unknown> = {
      p_shop_id: barbershopId,
      p_user_id: userId,
      p_role: role,
      p_ownership_percent: ownershipPercent,
      p_display_name: fullName,
    };
    let { data: memberResult, error: memberError } = await userClient.rpc(rpcName, {
      ...memberArgs,
      ...(staffId ? { p_staff_id: staffId } : {}),
    });
    // Banco ainda sem p_staff_id (migration 20261013210000): segue criando o cartão como antes.
    if (
      memberError &&
      staffId &&
      /p_staff_id|could not find the function/i.test(memberError.message)
    ) {
      ({ data: memberResult, error: memberError } = await userClient.rpc(rpcName, memberArgs));
    }
    if (memberError) {
      if (created) await admin.auth.admin.deleteUser(userId);
      return json({ error: memberError.message, hint: memberError.hint ?? undefined }, 400);
    }

    const status =
      typeof memberResult === "object" && memberResult && "status" in memberResult
        ? (memberResult as { status?: string }).status
        : "applied";
    const pending = status === "pending";

    // P-15: link de entrada no domínio da loja. Conta nova (ou que ainda usa a senha temporária)
    // recebe um link que entra sem senha e pede a senha nova; quem já tinha conta recebe o
    // endereço da loja para entrar com a senha de sempre.
    const origin = shopOrigin(shop);
    let inviteLink = `${origin}/auth?next=${encodeURIComponent("/shop")}`;
    let linkKind: "entry" | "login" = "login";
    if (created || stillTemporary) {
      const token = newInviteToken();
      const { error: linkError } = await admin.from("shop_invite_links").insert({
        token_hash: await sha256Hex(token),
        barbershop_id: barbershopId,
        user_id: userId,
        role,
        created_by: user.id,
      });
      if (!linkError) {
        inviteLink = `${origin}/convite?t=${token}`;
        linkKind = "entry";
      } else {
        console.error("invite-shop-admin: link de convite não gravado", linkError.message);
      }
    }

    let emailStatus: "queued" | "skipped_test" | "failed" = "failed";
    if (isTestAddress(email)) {
      emailStatus = "skipped_test";
    } else {
      const roleLabel = ROLE_LABEL[role] ?? "Equipe";
      const greeting = fullName ? `Olá, ${fullName}!` : "Olá!";
      const lines =
        linkKind === "entry"
          ? [
              greeting,
              "",
              `Você foi convidado para a equipe da ${shop.name} como ${roleLabel}.`,
              pending ? "O convite ainda espera a aprovação dos donos." : "",
              "Toque no link para entrar e criar sua senha (vale por 7 dias):",
              inviteLink,
            ]
          : [
              greeting,
              "",
              pending
                ? `Você foi convidado para a equipe da ${shop.name} como ${roleLabel}. O convite ainda espera a aprovação dos donos.`
                : `Você agora faz parte da equipe da ${shop.name} como ${roleLabel}.`,
              "Entre com o seu e-mail e a senha que você já usa:",
              inviteLink,
            ];
      const { data: queued, error: queueError } = await admin.rpc("enqueue_email_message", {
        p_shop_id: barbershopId,
        p_to_email: email,
        p_template_key: "team.invite",
        p_subject: `Convite para a equipe — ${shop.name}`,
        p_body: lines.filter((line, index) => line !== "" || index === 1).join("\n"),
        p_dedupe_key: `team.invite:${barbershopId}:${userId}:${Date.now()}`,
        p_payload: { role, link_kind: linkKind },
      });
      emailStatus = !queueError && queued ? "queued" : "failed";
      if (queueError)
        console.error("invite-shop-admin: e-mail não enfileirado", queueError.message);
    }

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
      invite_link: inviteLink,
      link_kind: linkKind,
      email_status: emailStatus,
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
