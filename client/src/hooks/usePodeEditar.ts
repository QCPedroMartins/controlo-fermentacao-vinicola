import { useAuth } from "@/_core/hooks/useAuth";

/**
 * Qualquer utilizador autenticado tem permissão de edição.
 */
export function usePodeEditar(): boolean {
  const { user } = useAuth();
  return Boolean(user);
}
