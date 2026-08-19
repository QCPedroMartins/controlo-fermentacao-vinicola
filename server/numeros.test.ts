import { describe, expect, it } from "vitest";
import { normalizarNumeroDecimal } from "./numeros";

describe("normalizarNumeroDecimal", () => {
  it("aceita vírgula decimal introduzida na ficha de análise", () => {
    expect(normalizarNumeroDecimal("3,16")).toBe("3.16");
    expect(normalizarNumeroDecimal("0,05")).toBe("0.05");
    expect(normalizarNumeroDecimal(" 11,48 ")).toBe("11.48");
  });

  it("preserva números com ponto e normaliza separadores de milhares", () => {
    expect(normalizarNumeroDecimal("6685.7")).toBe("6685.7");
    expect(normalizarNumeroDecimal("1.234,56")).toBe("1234.56");
    expect(normalizarNumeroDecimal("1,234.56")).toBe("1234.56");
    expect(normalizarNumeroDecimal("")).toBeNull();
  });
});
