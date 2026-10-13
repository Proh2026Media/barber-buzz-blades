/**
 * Marca gravada pela função `invite-shop-admin` nos dados da conta que ela cria com senha
 * temporária. Enquanto estiver ligada, o app pede uma senha nova antes de qualquer outra coisa;
 * trocar a senha grava a marca desligada.
 */
export const MUST_CHANGE_PASSWORD_KEY = "must_change_password";

export function mustChangePassword(
  user: { user_metadata?: Record<string, unknown> | null } | null | undefined,
) {
  return user?.user_metadata?.[MUST_CHANGE_PASSWORD_KEY] === true;
}
