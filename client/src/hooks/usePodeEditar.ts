import { useAuth } from "@/_core/hooks/useAuth";

/**
 * Devolve true se o utilizador autenticado tem permissão de edição.
 * O campo canEdit é calculado no servidor (auth.me) para evitar inconsistências.
 */
export function usePodeEditar(): boolean {
  const { user } = useAuth();
  if (!user) return false;
  // O servidor inclui canEdit na resposta do auth.me
  return (user as any).canEdit === true;
}
