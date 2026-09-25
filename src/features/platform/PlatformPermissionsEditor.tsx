import { useEffect, useId, useState } from "react";
import { Shield, Building2 } from "lucide-react";
import type { Tables } from "@/integrations/supabase/types";
import { ShopPermissionsMatrix } from "@/features/shop/ShopPermissionsMatrix";

export function PlatformPermissionsEditor({ shops }: { shops: Tables<"barbershops">[] }) {
  const [shopId, setShopId] = useState("");
  const shopFieldId = useId();

  useEffect(() => {
    if (!shopId && shops.length > 0) setShopId(shops[0]!.id);
  }, [shopId, shops]);

  return (
    <div className="space-y-6">
      <div className="flex flex-col gap-2">
        <h2 className="flex items-center gap-2 text-xl font-bold">
          <Shield className="size-5 text-primary" />
          Hierarquia e Permissões
        </h2>
        <p className="text-sm text-muted-foreground">
          O <strong>Admin Global</strong> e o <strong>gerente de conta</strong> da unidade têm
          acesso total. O dono/co-dono também edita níveis e sociedade no painel da loja. Aqui você
          define o que cada perfil da equipe faz na barbearia escolhida.
        </p>
      </div>

      <div className="flex flex-wrap items-center gap-3 rounded-2xl border border-border bg-card p-4">
        <Building2 className="size-4 text-primary" />
        <label htmlFor={shopFieldId} className="text-sm font-semibold">
          Barbearia
        </label>
        <select
          id={shopFieldId}
          value={shopId}
          onChange={(event) => setShopId(event.target.value)}
          disabled={shops.length === 0}
          className="min-h-11 rounded-xl border border-input bg-background px-3 text-sm text-foreground"
        >
          {shops.length === 0 && <option value="">Nenhuma barbearia cadastrada</option>}
          {shops.map((shop) => (
            <option key={shop.id} value={shop.id}>
              {shop.name}
              {shop.status === "active" ? "" : " · suspensa"}
            </option>
          ))}
        </select>
      </div>

      {shopId ? <ShopPermissionsMatrix shopId={shopId} canEdit /> : null}
    </div>
  );
}
