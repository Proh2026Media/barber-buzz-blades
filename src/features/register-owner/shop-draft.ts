/** Só dados da loja na aba atual; nunca senha, código ou token de sessão. */
export type ShopDraft = {
  name: string;
  timezone: string;
  society: "single" | "majority" | "equal" | "minority";
  request: { userId: string; id: string } | null;
};
const KEY = "bc:cadastro-loja:v1";
export function readShopDraft(): ShopDraft | null {
  try {
    const value = JSON.parse(sessionStorage.getItem(KEY) || "null");
    if (
      !value ||
      Date.now() - value.savedAt > 86400000 ||
      typeof value.savedAt !== "number" ||
      typeof value.name !== "string" ||
      value.name.length > 120 ||
      typeof value.timezone !== "string" ||
      value.timezone.length > 64 ||
      !["single", "majority", "equal", "minority"].includes(value.society)
    )
      return null;
    const uuid = /^[0-9a-f-]{36}$/i;
    if (value.request && (!uuid.test(value.request.userId) || !uuid.test(value.request.id)))
      return null;
    return value;
  } catch {
    return null;
  }
}
export function saveShopDraft(value: ShopDraft) {
  try {
    sessionStorage.setItem(KEY, JSON.stringify({ ...value, savedAt: Date.now() }));
  } catch {
    /* Aba sem armazenamento: formulário continua disponível. */
  }
}
export function clearShopDraft() {
  try {
    sessionStorage.removeItem(KEY);
  } catch {
    /* Sem armazenamento. */
  }
}
