import { describe, expect, it } from "vitest";
import { criarTokenHandoff, lerTokenHandoff } from "./gestaoAdegaHandoff";

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
      comentarios: ["Proveniência preservada"],
      observacoes: "Junção parcial para estágio",
    };
    const token = await criarTokenHandoff(dados, "segredo-de-teste-ci");
    const recuperado = await lerTokenHandoff(token, "segredo-de-teste-ci");

    expect(recuperado.referenciaExterna).toBe(dados.referenciaExterna);
    expect(recuperado.origens.reduce((total, origem) => total + origem.litros, 0)).toBe(2000);
    expect(recuperado.destinos.reduce((total, destino) => total + destino.litros, 0)).toBe(2000);
  });
});
