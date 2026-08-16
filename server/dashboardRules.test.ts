import { describe, expect, it } from "vitest";
import { encontrarInoculacaoLsa } from "./dashboardRules";

describe("estado de inoculação LSA no Dashboard", () => {
  it("identifica uma adição de LSA ou levedura como inoculação registada", () => {
    expect(encontrarInoculacaoLsa(["Sulfuroso", "LSA 25 g/hL"])).toBe("LSA 25 g/hL");
    expect(encontrarInoculacaoLsa(["Inoculação de levedura", null])).toBe("Inoculação de levedura");
  });

  it("não marca a inoculação quando só existem produtos sem levedura", () => {
    expect(encontrarInoculacaoLsa(["Sulfuroso", "Nutriente orgânico", null])).toBeNull();
  });
});
