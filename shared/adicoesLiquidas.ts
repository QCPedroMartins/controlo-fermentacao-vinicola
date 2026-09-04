export type AdicaoLiquidaInput = {
  isLiquido?: boolean;
  litrosAdicionados?: number | null;
};

export function validarAdicaoLiquida(input: AdicaoLiquidaInput): { ok: true; litros: number } | { ok: false; erro: string } {
  if (!input.isLiquido) return { ok: true, litros: 0 };
  const litros = input.litrosAdicionados;
  if (litros === null || litros === undefined || !Number.isFinite(litros) || litros <= 0) {
    return { ok: false, erro: "Indique os litros adicionados para uma adição líquida." };
  }
  return { ok: true, litros: Math.round(litros * 10) / 10 };
}

export function somarVolumeAdicaoLiquida(volumeActual: string | number | null | undefined, litrosAdicionados: number): number {
  const actual = Number(volumeActual ?? 0);
  const volumeValido = Number.isFinite(actual) && actual > 0 ? actual : 0;
  return Math.round((volumeValido + litrosAdicionados) * 10) / 10;
}

export function reverterVolumeAdicaoLiquida(volumeActual: string | number | null | undefined, litrosAdicionados: number): number {
  const actual = Number(volumeActual ?? 0);
  const volumeValido = Number.isFinite(actual) && actual > 0 ? actual : 0;
  return Math.max(0, Math.round((volumeValido - litrosAdicionados) * 10) / 10);
}
