/** Determina se o cartão do Dashboard deve apresentar Baumé em vez de densidade. */
export function deveMostrarBaumeNoDashboard(tipoCuba: string | null | undefined): boolean {
  return tipoCuba === "porto";
}
