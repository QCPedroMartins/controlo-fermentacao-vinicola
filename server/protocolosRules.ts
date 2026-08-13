export type TipoGatilho = "densidade" | "baume" | "temperatura" | "dia" | "manual";
export type OperadorGatilho = "menor_igual" | "maior_igual" | "igual" | null;

export function calcularDiaFermentacao(dataInicial?: string | null, dataLeitura?: string | null, diaRegistado?: number | null) {
  if (diaRegistado && diaRegistado > 0) return diaRegistado;
  if (!dataInicial || !dataLeitura) return null;

  const inicio = Date.parse(`${dataInicial}T00:00:00Z`);
  const leitura = Date.parse(`${dataLeitura}T00:00:00Z`);
  if (Number.isNaN(inicio) || Number.isNaN(leitura)) return null;
  return Math.max(1, Math.floor((leitura - inicio) / 86_400_000) + 1);
}

export function gatilhoFoiAtingido(
  tipo: TipoGatilho,
  operador: OperadorGatilho,
  valorGatilho: number | null | undefined,
  valores: { densidade?: number | null; baume?: number | null; temperatura?: number | null; dia?: number | null }
) {
  if (tipo === "manual") return false;
  if (valorGatilho === null || valorGatilho === undefined || !operador) return false;

  const valorAtual = tipo === "densidade"
    ? valores.densidade
    : tipo === "baume"
      ? valores.baume
      : tipo === "temperatura"
        ? valores.temperatura
        : valores.dia;

  if (valorAtual === null || valorAtual === undefined || Number.isNaN(valorAtual)) return false;
  if (operador === "menor_igual") return valorAtual <= valorGatilho;
  if (operador === "maior_igual") return valorAtual >= valorGatilho;
  return Math.abs(valorAtual - valorGatilho) < 0.0001;
}

export function calcularDoseTotal(dosePorHl?: number | null, litros?: number | null) {
  if (dosePorHl === null || dosePorHl === undefined || litros === null || litros === undefined) return null;
  return Number((dosePorHl * litros / 100).toFixed(3));
}

export function unidadeTotal(unidade?: string | null) {
  if (!unidade) return "";
  return unidade.includes("/") ? unidade.split("/")[0] : unidade;
}
