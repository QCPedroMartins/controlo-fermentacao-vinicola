export type LeituraArquivoComBaume = { baumeL1?: string | null };

/**
 * Arquivos novos usam o instantâneo do tipo de cuba. Para arquivos antigos,
 * a presença de leituras Baumé recupera a classificação VP sem depender do
 * tipo actual da cuba, que pode já ter sido alterado para outra fermentação.
 */
export function tipoCubaArquivo(
  tipoGuardado: string | null | undefined,
  leituras: readonly LeituraArquivoComBaume[],
): "vinho" | "porto" {
  if (tipoGuardado === "porto") return "porto";
  return leituras.some((leitura) => leitura.baumeL1 !== null && leitura.baumeL1 !== undefined && leitura.baumeL1 !== "")
    ? "porto"
    : "vinho";
}
