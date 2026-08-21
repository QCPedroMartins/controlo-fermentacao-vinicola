import { z } from "zod";

export const cubaDestinoAdegaSchema = z.object({
  id: z.number().int().positive(),
  codigo: z.string().trim().min(1).max(32),
  capacidadeLitros: z.number().finite().nonnegative(),
  litrosAtuais: z.number().finite().nonnegative(),
  disponivelLitros: z.number().finite().nonnegative(),
  tipoVinho: z.string().nullable(),
  lote: z.string().nullable(),
});

export type CubaDestinoAdega = z.infer<typeof cubaDestinoAdegaSchema>;

const respostaDestinosSchema = z.object({ cubas: z.array(cubaDestinoAdegaSchema) });

export async function listarDestinosAdega(adegaUrl: string): Promise<CubaDestinoAdega[]> {
  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), 7000);
  try {
    const url = new URL("/api/integracao/fermentacao/destinos", adegaUrl);
    const resposta = await fetch(url, { headers: { Accept: "application/json" }, signal: controller.signal });
    if (!resposta.ok) throw new Error(`Gestão de Adega indisponível (${resposta.status}).`);
    return respostaDestinosSchema.parse(await resposta.json()).cubas
      .filter(cuba => cuba.disponivelLitros > 0)
      .sort((a, b) => a.codigo.localeCompare(b.codigo, "pt-PT", { numeric: true }));
  } catch (error) {
    const mensagem = error instanceof Error && error.name === "AbortError"
      ? "A Gestão de Adega não respondeu a tempo."
      : error instanceof Error ? error.message : "A Gestão de Adega está indisponível.";
    throw new Error(`Não foi possível consultar as capacidades na Gestão de Adega: ${mensagem}`);
  } finally {
    clearTimeout(timeout);
  }
}

export function erroCapacidadeDestinos(
  destinos: Array<{ cubaCodigo: string; litros: number }>,
  cubas: CubaDestinoAdega[],
): string | null {
  const porCodigo = new Map(cubas.map(cuba => [cuba.codigo.trim().toUpperCase(), cuba]));
  const porDestino = destinos.reduce((mapa, destino) => {
    const codigo = destino.cubaCodigo.trim().toUpperCase();
    mapa.set(codigo, (mapa.get(codigo) ?? 0) + destino.litros);
    return mapa;
  }, new Map<string, number>());

  for (const [codigo, litros] of Array.from(porDestino.entries())) {
    const cuba = porCodigo.get(codigo);
    if (!cuba) return `${codigo} não está disponível na Gestão de Adega.`;
    if (litros > cuba.disponivelLitros + 0.001) {
      return `${cuba.codigo} tem apenas ${cuba.disponivelLitros.toLocaleString("pt-PT")} L disponíveis (ocupação: ${cuba.litrosAtuais.toLocaleString("pt-PT")} / ${cuba.capacidadeLitros.toLocaleString("pt-PT")} L).`;
    }
  }
  return null;
}
