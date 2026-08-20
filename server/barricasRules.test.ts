import { describe, expect, it } from "vitest";
import { validarDistribuicaoBarricas } from "./barricasRules";

describe("validarDistribuicaoBarricas", () => {
  it("aceita transferência parcial para barricas com capacidade suficiente", () => {
    expect(validarDistribuicaoBarricas(1_000, [
      { capacidadeLitros: 500, litros: 500 },
      { capacidadeLitros: 300, litros: 250 },
    ])).toEqual({ ok: true, litrosTotal: 750, litrosRestantes: 250 });
  });

  it("recusa volumes acima da capacidade de uma barrica ou da cuba", () => {
    expect(validarDistribuicaoBarricas(500, [{ capacidadeLitros: 225, litros: 250 }]).ok).toBe(false);
    expect(validarDistribuicaoBarricas(500, [{ capacidadeLitros: 600, litros: 550 }]).ok).toBe(false);
  });
});
