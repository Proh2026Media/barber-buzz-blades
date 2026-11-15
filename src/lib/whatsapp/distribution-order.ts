export type NumberRole = "primary" | "backup" | "backup2";
export type NumberOrder = Record<NumberRole, string | null>;
const roles: NumberRole[] = ["primary", "backup", "backup2"];

/** Move dentro do destino e conserva todos os números, sem duplicar ou deixar o principal vazio. */
export function reorderNumbers(order: NumberOrder, from: NumberRole, to: NumberRole): NumberOrder {
  if (!order[from] || from === to) return { ...order };
  const values = roles.map((role) => order[role]);
  const [moved] = values.splice(roles.indexOf(from), 1);
  values.splice(roles.indexOf(to), 0, moved);
  const compact = values.filter((value): value is string => Boolean(value));
  return { primary: compact[0] ?? null, backup: compact[1] ?? null, backup2: compact[2] ?? null };
}
