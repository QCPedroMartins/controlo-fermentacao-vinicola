import { describe, expect, it } from "vitest";
import { encontrarDestinosAdegaDuplicados, normalizarCodigoDestinoAdega } from "../shared/gestaoAdegaDestinos";

describe("destinos únicos na Gestão de Adega", () => {
  it("normaliza o código antes de o comparar", () => {
    expect(normalizarCodigoDestinoAdega(" c46 ")).toBe("C46");
  });

  it("detecta a mesma cuba mesmo com diferenças de maiúsculas ou espaços", () => {
    const duplicados = encontrarDestinosAdegaDuplicados([
      { cubaCodigo: "C45" },
      { cubaCodigo: " c46 " },
      { cubaCodigo: "c46" },
    ]);

    expect(duplicados).toEqual(["C46"]);
  });

  it("aceita vários destinos quando cada cuba é distinta", () => {
    expect(encontrarDestinosAdegaDuplicados([
      { cubaCodigo: "C45" },
      { cubaCodigo: "C46" },
    ])).toEqual([]);
  });
});
