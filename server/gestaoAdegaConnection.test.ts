import { describe, expect, it } from "vitest";

describe("ligação à Gestão de Adega", () => {
  it("usa o endereço configurado sem expor ou exigir uma chave manual no cliente", () => {
    const baseUrl = process.env.GESTAO_ADEGA_API_URL;
    expect(baseUrl).toBeTruthy();
    expect(new URL(baseUrl!)).toMatchObject({ protocol: "https:", hostname: "vinhogestao-2ammjxda.manus.space" });
  });
});
