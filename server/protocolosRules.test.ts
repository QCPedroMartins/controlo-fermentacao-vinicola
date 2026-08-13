import { describe, expect, it } from "vitest";
import { calcularDiaFermentacao, calcularDoseTotal, gatilhoFoiAtingido, unidadeTotal } from "./protocolosRules";

describe("regras de protocolos de fermentação", () => {
  it("activa um gatilho de densidade quando a leitura atinge ou fica abaixo do limite", () => {
    expect(gatilhoFoiAtingido("densidade", "menor_igual", 1.075, { densidade: 1.0748 })).toBe(true);
    expect(gatilhoFoiAtingido("densidade", "menor_igual", 1.075, { densidade: 1.076 })).toBe(false);
  });

  it("avalia os gatilhos de Baumé, temperatura e dia de fermentação", () => {
    expect(gatilhoFoiAtingido("baume", "menor_igual", 8, { baume: 7.9 })).toBe(true);
    expect(gatilhoFoiAtingido("temperatura", "maior_igual", 28, { temperatura: 28 })).toBe(true);
    expect(gatilhoFoiAtingido("dia", "maior_igual", 3, { dia: 2 })).toBe(false);
  });

  it("mantém as etapas manuais inactivas até confirmação do operador", () => {
    expect(gatilhoFoiAtingido("manual", null, null, {})).toBe(false);
  });

  it("calcula o dia de fermentação e a dose total a partir do volume", () => {
    expect(calcularDiaFermentacao("2026-08-01", "2026-08-03", null)).toBe(3);
    expect(calcularDiaFermentacao("2026-08-01", "2026-08-03", 7)).toBe(7);
    expect(calcularDoseTotal(20, 2700)).toBe(540);
    expect(unidadeTotal("g/hL")).toBe("g");
  });
});
