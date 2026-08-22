export type LeituraParaMarcador = {
  dataLeitura: Date | string;
  diaNr: number | null;
};

export type AdicaoParaMarcador = {
  dataAdicao: Date | string;
  produto?: string | null;
  dose?: string | null;
  observacoes?: string | null;
};

export type MarcadorAdicao = {
  numero: number;
  dia: number;
  label: string;
  full: string;
};

export type GrupoMarcadoresAdicao = {
  dia: number;
  numeros: number[];
};

function chaveData(valor: Date | string) {
  if (valor instanceof Date) return valor.toISOString().slice(0, 10);
  return valor.slice(0, 10);
}

function milissegundosData(valor: Date | string) {
  return Date.parse(`${chaveData(valor)}T00:00:00.000Z`);
}

export function criarMarcadoresAdicao(adicoes: AdicaoParaMarcador[], leituras: LeituraParaMarcador[]): MarcadorAdicao[] {
  if (leituras.length === 0) return [];
  return adicoes.map((adicao, indice) => {
    const dataAdicao = chaveData(adicao.dataAdicao);
    const leituraNoMesmoDia = leituras.find(leitura => chaveData(leitura.dataLeitura) === dataAdicao);
    let dia = leituraNoMesmoDia?.diaNr ?? 1;

    if (!leituraNoMesmoDia) {
      const momentoAdicao = milissegundosData(adicao.dataAdicao);
      const leituraMaisProxima = leituras.reduce((maisProxima, leitura) => {
        const diferenca = Math.abs(milissegundosData(leitura.dataLeitura) - momentoAdicao);
        return diferenca < maisProxima.diferenca ? { leitura, diferenca } : maisProxima;
      }, { leitura: leituras[0], diferenca: Infinity });
      dia = leituraMaisProxima.leitura.diaNr ?? 1;
    }

    const produto = adicao.produto?.trim();
    return {
      numero: indice + 1,
      dia,
      label: produto ? produto.slice(0, 12) : "Nota",
      full: produto ? `${produto}${adicao.dose ? ` ${adicao.dose}` : ""}` : (adicao.observacoes?.slice(0, 30) ?? "Nota"),
    };
  });
}

export function agruparMarcadoresPorDia(marcadores: MarcadorAdicao[]): GrupoMarcadoresAdicao[] {
  const grupos = new Map<number, number[]>();
  marcadores.forEach(marcador => grupos.set(marcador.dia, [...(grupos.get(marcador.dia) ?? []), marcador.numero]));
  return Array.from(grupos.entries())
    .map(([dia, numeros]) => ({ dia, numeros }))
    .sort((a, b) => a.dia - b.dia);
}
