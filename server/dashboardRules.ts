/** Devolve o registo que comprova a inoculação, se existir. */
export function encontrarInoculacaoLsa(valores: Array<string | null | undefined>) {
  return valores.find((valor) => !!valor && /(\blsa\b|levedura|levadura|inocula)/i.test(valor)) ?? null;
}
