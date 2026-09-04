import { describe, expect, it } from "vitest";
import { tipoCubaArquivo } from "../shared/arquivoBaume";

describe("tipo de cuba em fermentações arquivadas", () => {
  it("mantém o instantâneo VP guardado no fecho", () => {
    expect(tipoCubaArquivo("porto", [])).toBe("porto");
  });

  it("recupera arquivos antigos VP pela existência de leituras Baumé", () => {
    expect(tipoCubaArquivo(null, [{ baumeL1: "8.50" }])).toBe("porto");
  });

  it("não converte arquivos normais em VP quando não há leituras Baumé", () => {
    expect(tipoCubaArquivo(null, [{ baumeL1: null }])).toBe("vinho");
    expect(tipoCubaArquivo("vinho", [])).toBe("vinho");
  });
});
