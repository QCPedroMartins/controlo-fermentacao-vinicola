import { describe, expect, it } from "vitest";
import { getTableColumns } from "drizzle-orm";
import { analisesFinaisFermentacao, analisesBarrica, barricas, movimentosBarrica } from "../drizzle/schema";

describe("modelo de análises finais e barricas", () => {
  it("guarda os parâmetros de fim de fermentação e mantém o histórico por cuba", () => {
    const colunas = getTableColumns(analisesFinaisFermentacao);
    expect(colunas).toMatchObject({
      cubaId: expect.anything(),
      fermentacaoNum: expect.anything(),
      dataAnalise: expect.anything(),
      fichaPh: expect.anything(),
      fichaAt: expect.anything(),
      fichaAv: expect.anything(),
      fichaNfa: expect.anything(),
      fichaNtu: expect.anything(),
      fichaGluconico: expect.anything(),
      fichaAlcoolProvavel: expect.anything(),
      acucaresResiduais: expect.anything(),
      acidoMalico: expect.anything(),
      userName: expect.anything(),
    });
  });

  it("mantém capacidade, volume, movimento e análise copiada para cada barrica", () => {
    expect(getTableColumns(barricas)).toMatchObject({
      codigo: expect.anything(),
      capacidadeLitros: expect.anything(),
      litrosAtual: expect.anything(),
      cubaOrigemId: expect.anything(),
    });
    expect(getTableColumns(movimentosBarrica)).toMatchObject({
      cubaOrigemId: expect.anything(),
      barricasJson: expect.anything(),
      litrosTotal: expect.anything(),
    });
    expect(getTableColumns(analisesBarrica)).toMatchObject({
      barricaId: expect.anything(),
      origemCubaId: expect.anything(),
      acucaresResiduais: expect.anything(),
      acidoMalico: expect.anything(),
    });
  });
});
