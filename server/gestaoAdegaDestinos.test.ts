import { describe, expect, it } from "vitest";
import { erroCapacidadeDestinos } from "./gestaoAdegaDestinos";

const cubas = [
  { id: 45, codigo: "C45", capacidadeLitros: 3000, litrosAtuais: 775, disponivelLitros: 2225, tipoVinho: "Tinto", lote: "Lote 2026" },
  { id: 50, codigo: "C50", capacidadeLitros: 2000, litrosAtuais: 0, disponivelLitros: 2000, tipoVinho: null, lote: null },
];

describe("capacidades de destinos da Gestão de Adega", () => {
  it("aceita o cenário CF4: 2225 L para C45", () => {
    expect(erroCapacidadeDestinos([{ cubaCodigo: "C45", litros: 2225 }], cubas)).toBeNull();
  });

  it("rejeita volumes superiores à disponibilidade actual", () => {
    expect(erroCapacidadeDestinos([{ cubaCodigo: "C45", litros: 2226 }], cubas)).toContain("C45 tem apenas 2225 L disponíveis");
  });

  it("soma linhas repetidas para a mesma cuba de destino", () => {
    expect(erroCapacidadeDestinos([{ cubaCodigo: "C50", litros: 1500 }, { cubaCodigo: "c50", litros: 501 }], cubas)).toContain("C50 tem apenas 2000 L disponíveis");
  });
});
