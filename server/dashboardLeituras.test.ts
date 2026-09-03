import { describe, expect, it } from "vitest";
import { deveMostrarBaumeNoDashboard } from "../shared/dashboardLeituras";

describe("apresentação de leituras no Dashboard", () => {
  it("apresenta Baumé apenas para cubas configuradas como Vinho do Porto", () => {
    expect(deveMostrarBaumeNoDashboard("porto")).toBe(true);
  });

  it("não apresenta Baumé para cubas de vinho normal, mesmo que exista valor histórico", () => {
    expect(deveMostrarBaumeNoDashboard("vinho")).toBe(false);
    expect(deveMostrarBaumeNoDashboard(null)).toBe(false);
    expect(deveMostrarBaumeNoDashboard(undefined)).toBe(false);
  });
});
