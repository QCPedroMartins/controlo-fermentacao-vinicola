/**
 * permissions.ts
 * Lista de emails com acesso total de edição.
 * Qualquer outro utilizador autenticado só pode ver.
 */
export const EMAILS_COM_EDICAO = [
  "enologia1@castelares.com",
  "laboratorio@castelares.com",
  // Proprietário do projecto tem sempre acesso total (adicionado dinamicamente no servidor)
];

export function podeEditar(email: string | null | undefined): boolean {
  if (!email) return false;
  return EMAILS_COM_EDICAO.includes(email.toLowerCase().trim());
}
