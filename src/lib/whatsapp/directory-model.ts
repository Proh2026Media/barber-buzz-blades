export type DirectoryNumber = {
  id: string;
  display_phone: string | null;
  status: string;
  delivery_mode?: string;
  instance_name?: string;
  backup_instance_name?: string | null;
};
export type DirectoryLink = {
  id: string;
  channel_id: string;
  barbershop_id: string;
  staff_id: string | null;
  enabled: boolean;
};

/** Espelha whatsapp_route_link: vínculo próprio prevalece, inclusive quando incompleto. */
export function whatsappCoverage<N extends DirectoryNumber, L extends DirectoryLink>(
  shop: string,
  staff: string | null,
  numbers: readonly N[],
  links: readonly L[],
) {
  const own = links.find((l) => l.barbershop_id === shop && l.staff_id === staff);
  const ownNumber = numbers.find((n) => n.id === own?.channel_id);
  if (own && ownNumber?.display_phone?.trim())
    return { kind: "own" as const, number: ownNumber, link: own, pending: undefined };
  if (own) return { kind: "none" as const, number: undefined, link: undefined, pending: own };
  const general = staff
    ? links.find((l) => l.barbershop_id === shop && l.staff_id === null)
    : undefined;
  const generalNumber = numbers.find((n) => n.id === general?.channel_id);
  if (general && generalNumber?.display_phone?.trim())
    return { kind: "shop" as const, number: generalNumber, link: general, pending: own };
  return { kind: "none" as const, number: undefined, link: undefined, pending: own };
}
