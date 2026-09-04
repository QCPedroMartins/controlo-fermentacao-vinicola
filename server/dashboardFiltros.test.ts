import { describe, expect, it } from "vitest";
import { correspondeFiltrosDashboard, type FiltrosIndicadoresDashboard } from "../shared/dashboardFiltros";

const semLimites: FiltrosIndicadoresDashboard = {
  densidadeMin: "", densidadeMax: "", temperaturaMin: "", temperaturaMax: "", baumeMin: "", baumeMax: "",
};

describe("filtros avançados do Dashboard", () => {
  it("distingue branco, tinto, rosé, Porto e cubas sem classificação", () => {
    const branco = { tipoCuba: "vinho", tipoVinho: "branco", ultimaDensidade: "1.0120", ultimaTemperatura: "16.5", ultimoBaume: null };
    const porto = { tipoCuba: "porto", tipoVinho: null, ultimaDensidade: null, ultimaTemperatura: "15.0", ultimoBaume: "8.20" };
    const semTipo = { ...branco, tipoVinho: null };

    expect(correspondeFiltrosDashboard(branco, "branco", semLimites)).toBe(true);
    expect(correspondeFiltrosDashboard(branco, "tinto", semLimites)).toBe(false);
    expect(correspondeFiltrosDashboard(porto, "porto", semLimites)).toBe(true);
    expect(correspondeFiltrosDashboard(porto, "branco", semLimites)).toBe(false);
    expect(correspondeFiltrosDashboard(semTipo, "sem_classificacao", semLimites)).toBe(true);
  });

  it("aplica densidade às cubas normais, Baumé às VP e temperatura a ambas", () => {
    const normal = { tipoCuba: "vinho", tipoVinho: "tinto", ultimaDensidade: "1.0065", ultimaTemperatura: "21.3", ultimoBaume: null };
    const porto = { tipoCuba: "porto", tipoVinho: null, ultimaDensidade: null, ultimaTemperatura: "15.0", ultimoBaume: "8.20" };

    expect(correspondeFiltrosDashboard(normal, "todos", { ...semLimites, densidadeMin: "1,005", densidadeMax: "1.008", temperaturaMax: "22" })).toBe(true);
    expect(correspondeFiltrosDashboard(normal, "todos", { ...semLimites, densidadeMin: "1.010" })).toBe(false);
    expect(correspondeFiltrosDashboard(porto, "porto", { ...semLimites, baumeMin: "8", baumeMax: "8.5", temperaturaMin: "14" })).toBe(true);
    expect(correspondeFiltrosDashboard(porto, "porto", { ...semLimites, baumeMin: "9" })).toBe(false);
  });
});
