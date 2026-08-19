/**
 * Converte números introduzidos em formato português ou internacional para o
 * formato decimal aceite pela base de dados, sem perder valores já correctos.
 */
export function normalizarNumeroDecimal(valor: string | null | undefined) {
  if (valor === null || valor === undefined) return valor;
  const limpo = valor.trim().replace(/\s/g, "");
  if (!limpo) return null;

  const ultimaVirgula = limpo.lastIndexOf(",");
  const ultimoPonto = limpo.lastIndexOf(".");
  if (ultimaVirgula >= 0 && ultimoPonto >= 0) {
    // O separador mais à direita é tratado como separador decimal.
    return ultimaVirgula > ultimoPonto
      ? limpo.replace(/\./g, "").replace(",", ".")
      : limpo.replace(/,/g, "");
  }
  return limpo.replace(",", ".");
}
