export const COOKIE_NAME = "app_session_id";
export const ONE_YEAR_MS = 1000 * 60 * 60 * 24 * 365;
export const AXIOS_TIMEOUT_MS = 30_000;
export const UNAUTHED_ERR_MSG = 'Please login (10001)';
export const NOT_ADMIN_ERR_MSG = 'You do not have required permission (10002)';

/**
 * Normaliza um valor de densidade para a escala decimal (0.900 - 1.200).
 * Aceita tanto 1.0876 como 1087.6 e devolve sempre 1.0876.
 */
export function normalizarDensidade(valor: string | number | null | undefined): number | null {
  if (valor === null || valor === undefined || valor === "") return null;
  const n = typeof valor === "string" ? parseFloat((valor as string).replace(",", ".")) : valor as number;
  if (isNaN(n) || n <= 0) return null;
  if (n > 2 && n < 1300) return Math.round((n / 1000) * 100000) / 100000;
  if (n > 0 && n <= 2) return Math.round(n * 100000) / 100000;
  return null;
}

/**
 * Formata uma densidade para exibição com 4 casas decimais.
 * Ex: 1.0876 → "1.0876", 1087.6 → "1.0876"
 */
export function formatarDensidade(valor: string | number | null | undefined): string {
  const n = normalizarDensidade(valor);
  if (n === null) return "—";
  return n.toFixed(4);
}
