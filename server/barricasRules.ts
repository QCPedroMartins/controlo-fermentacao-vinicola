export type DestinoBarrica = {
  capacidadeLitros: number;
  litros: number;
};

export function validarDistribuicaoBarricas(litrosDisponiveis: number, destinos: DestinoBarrica[]) {
  if (!Number.isFinite(litrosDisponiveis) || litrosDisponiveis <= 0) {
    return { ok: false as const, erro: "A cuba de origem não tem litros disponíveis" };
  }
  if (destinos.length === 0) {
    return { ok: false as const, erro: "Adicione pelo menos uma barrica" };
  }
  for (const destino of destinos) {
    if (!Number.isFinite(destino.capacidadeLitros) || destino.capacidadeLitros <= 0) {
      return { ok: false as const, erro: "A capacidade da barrica tem de ser superior a zero" };
    }
    if (!Number.isFinite(destino.litros) || destino.litros <= 0) {
      return { ok: false as const, erro: "Indique os litros a colocar em cada barrica" };
    }
    if (destino.litros > destino.capacidadeLitros) {
      return { ok: false as const, erro: "Uma barrica não pode receber mais do que a sua capacidade" };
    }
  }
  const litrosTotal = destinos.reduce((total, destino) => total + destino.litros, 0);
  if (litrosTotal > litrosDisponiveis + 0.0001) {
    return { ok: false as const, erro: "Os litros para barricas excedem os litros disponíveis na cuba" };
  }
  return { ok: true as const, litrosTotal, litrosRestantes: Math.max(0, litrosDisponiveis - litrosTotal) };
}
