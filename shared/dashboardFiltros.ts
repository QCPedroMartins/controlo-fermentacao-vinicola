export type TipoVinhoFiltro = "todos" | "branco" | "tinto" | "rose" | "porto" | "sem_classificacao";

export type FiltrosIndicadoresDashboard = {
  densidadeMin: string;
  densidadeMax: string;
  temperaturaMin: string;
  temperaturaMax: string;
  baumeMin: string;
  baumeMax: string;
};

export type CubaParaFiltroDashboard = {
  tipoCuba: string | null | undefined;
  tipoVinho: string | null | undefined;
  ultimaDensidade: string | null | undefined;
  ultimaTemperatura: string | null | undefined;
  ultimoBaume: string | null | undefined;
};

function numero(valor: string | null | undefined): number | null {
  if (valor === null || valor === undefined || valor.trim() === "") return null;
  const resultado = Number(valor.trim().replace(/,/g, "."));
  return Number.isFinite(resultado) ? resultado : null;
}

function dentroDoIntervalo(valor: string | null | undefined, minimo: string, maximo: string): boolean {
  const limiteMinimo = numero(minimo);
  const limiteMaximo = numero(maximo);
  if (limiteMinimo === null && limiteMaximo === null) return true;

  const valorNumerico = numero(valor);
  if (valorNumerico === null) return false;
  return (limiteMinimo === null || valorNumerico >= limiteMinimo)
    && (limiteMaximo === null || valorNumerico <= limiteMaximo);
}

export function correspondeFiltrosDashboard(
  cuba: CubaParaFiltroDashboard,
  tipoFiltro: TipoVinhoFiltro,
  filtros: FiltrosIndicadoresDashboard,
): boolean {
  const ePorto = cuba.tipoCuba === "porto";
  const correspondeTipo = tipoFiltro === "todos"
    || (tipoFiltro === "porto" && ePorto)
    || (tipoFiltro === "sem_classificacao" && !ePorto && !cuba.tipoVinho)
    || (!ePorto && cuba.tipoVinho === tipoFiltro);

  if (!correspondeTipo) return false;
  if (!ePorto && !dentroDoIntervalo(cuba.ultimaDensidade, filtros.densidadeMin, filtros.densidadeMax)) return false;
  if (!dentroDoIntervalo(cuba.ultimaTemperatura, filtros.temperaturaMin, filtros.temperaturaMax)) return false;
  if (ePorto && !dentroDoIntervalo(cuba.ultimoBaume, filtros.baumeMin, filtros.baumeMax)) return false;
  return true;
}
