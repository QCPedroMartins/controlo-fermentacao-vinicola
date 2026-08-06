import { useAuth } from "@/_core/hooks/useAuth";
import { podeEditar } from "@shared/permissions";

/**
 * Devolve true se o utilizador autenticado tem permissão de edição.
 * Permissão: enologia1@castelares.com, laboratorio@castelares.com, ou proprietário do projecto.
 */
export function usePodeEditar(): boolean {
  const { user } = useAuth();
  if (!user) return false;
  // O proprietário do projecto (role=admin) tem sempre acesso total
  if (user.role === "admin") return true;
  return podeEditar(user.email);
}
