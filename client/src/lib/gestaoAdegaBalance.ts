export type OrigemParaDistribuicao = {
  cubaId: number;
  limiteLitros: number;
  disponivelLitros: number;
};

export function distribuirVinhoPorOrigens(origens: OrigemParaDistribuicao[], litrosDestino: number) {
  let porDistribuir = Math.max(0, litrosDestino);
  return origens.map(origem => {
    const disponivel = Math.max(0, Number(origem.disponivelLitros) || 0);
    const limite = Math.min(Math.max(0, Number(origem.limiteLitros) || 0), disponivel);
    const litros = Math.min(limite, porDistribuir);
    porDistribuir -= litros;
    return { cubaId: origem.cubaId, disponivel, litros, restante: Math.max(0, disponivel - litros) };
  });
}
