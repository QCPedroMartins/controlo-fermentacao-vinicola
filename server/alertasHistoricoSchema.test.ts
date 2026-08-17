import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import { describe, expect, it } from "vitest";

describe("contrato do histórico de alertas", () => {
  it("aceita detalhes completos e mantém a classificação curta", () => {
    const raiz = process.cwd();
    const schema = readFileSync(resolve(raiz, "drizzle/schema.ts"), "utf8");
    const cubaPage = readFileSync(resolve(raiz, "client/src/pages/CubaPage.tsx"), "utf8");

    expect(schema).toContain('valorAlerta: text("valor_alerta")');
    expect(cubaPage).toContain('tipoAlerta: "alerta_leitura"');
    expect(cubaPage).toContain('valorAlerta: mensagens.join("; ")');
  });
});
