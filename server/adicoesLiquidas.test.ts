import { describe, expect, it } from "vitest";
import { reverterVolumeAdicaoLiquida, somarVolumeAdicaoLiquida, validarAdicaoLiquida } from "../shared/adicoesLiquidas";

describe("adições líquidas", () => {
  it("exige litros positivos apenas quando a adição é líquida", () => {
    expect(validarAdicaoLiquida({ isLiquido: false })).toEqual({ ok: true, litros: 0 });
    expect(validarAdicaoLiquida({ isLiquido: true, litrosAdicionados: null })).toEqual({ ok: false, erro: "Indique os litros adicionados para uma adição líquida." });
    expect(validarAdicaoLiquida({ isLiquido: true, litrosAdicionados: 75.26 })).toEqual({ ok: true, litros: 75.3 });
  });

  it("soma e repõe litros da cuba sem permitir volume negativo", () => {
    expect(somarVolumeAdicaoLiquida("2225", 75.5)).toBe(2300.5);
    expect(somarVolumeAdicaoLiquida(null, 50)).toBe(50);
    expect(reverterVolumeAdicaoLiquida("2300.5", 75.5)).toBe(2225);
    expect(reverterVolumeAdicaoLiquida("10", 75)).toBe(0);
  });
});
