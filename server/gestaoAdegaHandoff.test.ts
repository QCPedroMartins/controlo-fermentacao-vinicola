import { describe, expect, it } from "vitest";
import { criarTokenHandoff, lerTokenHandoff, normalizarDataAnaliseIso } from "./gestaoAdegaHandoff";

describe("handoff para Gestão de Adega", () => {
  it("assina e recupera uma junção parcial com vários destinos", async () => {
    const dados = {
      referenciaExterna: "ADEGA-550e8400-e29b-41d4-a716-446655440000",
      dataMovimento: "2026-08-20T17:00:00.000Z",
      operador: "Pedro Martins",
      operadorId: 1,
      origens: [
        { cubaId: 2, cubaCodigo: "CF2", fermentacaoNumero: 1, litros: 1200 },
        { cubaId: 5, cubaCodigo: "CF5", fermentacaoNumero: 1, litros: 800 },
      ],
      destinos: [
        { cubaCodigo: "C49", litros: 1500 },
        { cubaCodigo: "C50", litros: 500 },
      ],
      borras: [
        { cubaOrigemId: 2, litros: 40, destino: "cuba_borras" as const, cubaDestinoId: 11 },
        { cubaOrigemId: 5, litros: 20, destino: "lixo" as const },
      ],
      comentarios: ["Proveniência preservada"],
      observacoes: "Junção parcial para estágio",
    };
    const token = await criarTokenHandoff(dados, "segredo-de-teste-ci");
    const recuperado = await lerTokenHandoff(token, "segredo-de-teste-ci");

    expect(recuperado.referenciaExterna).toBe(dados.referenciaExterna);
    expect(recuperado.origens.reduce((total, origem) => total + origem.litros, 0)).toBe(2000);
    expect(recuperado.destinos.reduce((total, destino) => total + destino.litros, 0)).toBe(2000);
    expect(recuperado.borras).toEqual(dados.borras);
  });

  it("assume que não existem borras quando o envio é total", async () => {
    const token = await criarTokenHandoff({
      referenciaExterna: "ADEGA-11111111-1111-4111-8111-111111111111",
      dataMovimento: "2026-08-20T17:00:00.000Z",
      operador: "Pedro Martins",
      operadorId: 1,
      origens: [{ cubaId: 2, cubaCodigo: "CF2", fermentacaoNumero: 1, litros: 1000 }],
      destinos: [{ cubaCodigo: "C49", litros: 1000 }],
    }, "segredo-de-teste-ci");
    const recuperado = await lerTokenHandoff(token, "segredo-de-teste-ci");

    expect(recuperado.borras).toEqual([]);
  });

  it("converte datas de análise sem hora para o formato ISO exigido pela Gestão de Adega", () => {
    expect(normalizarDataAnaliseIso("2026-08-19")).toBe("2026-08-19T00:00:00.000Z");
    expect(normalizarDataAnaliseIso(new Date("2026-08-19T13:45:00.000Z"))).toBe("2026-08-19T13:45:00.000Z");
  });
});
