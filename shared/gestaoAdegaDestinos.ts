export type DestinoComCodigo = { cubaCodigo: string };

export function normalizarCodigoDestinoAdega(codigo: string): string {
  return codigo.trim().toUpperCase();
}

export function encontrarDestinosAdegaDuplicados(destinos: DestinoComCodigo[]): string[] {
  const codigosEncontrados = new Set<string>();
  const duplicados = new Set<string>();

  for (const destino of destinos) {
    const codigo = normalizarCodigoDestinoAdega(destino.cubaCodigo);
    if (!codigo) continue;
    if (codigosEncontrados.has(codigo)) duplicados.add(codigo);
    codigosEncontrados.add(codigo);
  }

  return Array.from(duplicados);
}
