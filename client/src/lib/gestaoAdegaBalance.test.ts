import { describe, expect, it } from "vitest";
import { distribuirVinhoPorOrigens } from "./gestaoAdegaBalance";

describe("balanço de vinho e borras para Gestão de Adega", () => {
  it("atribui 2225 L de vinho e deixa 75 L para borras na CF4", () => {
    expect(distribuirVinhoPorOrigens([{ cubaId: 4, limiteLitros: 2300, disponivelLitros: 2300 }], 2225)).toEqual([
      { cubaId: 4, disponivel: 2300, litros: 2225, restante: 75 },
    ]);
  });

  it("distribui os destinos por várias origens sem ultrapassar o limite de cada cuba", () => {
    expect(distribuirVinhoPorOrigens([
      { cubaId: 2, limiteLitros: 1200, disponivelLitros: 1300 },
      { cubaId: 5, limiteLitros: 800, disponivelLitros: 800 },
    ], 1700)).toEqual([
      { cubaId: 2, disponivel: 1300, litros: 1200, restante: 100 },
      { cubaId: 5, disponivel: 800, litros: 500, restante: 300 },
    ]);
  });
});
