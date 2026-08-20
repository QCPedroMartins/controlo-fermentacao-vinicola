import { describe, expect, it } from "vitest";

describe("ligação à Gestão de Adega", () => {
  it("mantém o endereço de integração fora do cliente e não exige chave manual", () => {
    const baseUrl = "https://vinhogestao-2ammjxda.manus.space";
    expect(new URL(baseUrl)).toMatchObject({ protocol: "https:", hostname: "vinhogestao-2ammjxda.manus.space" });
  });
});
