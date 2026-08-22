import { describe, expect, it } from "vitest";
import { agruparMarcadoresPorDia, criarMarcadoresAdicao } from "./adicaoMarkers";

describe("marcações de adições nos gráficos", () => {
  const leituras = [
    { dataLeitura: "2026-08-07", diaNr: 1 },
    { dataLeitura: "2026-08-13", diaNr: 7 },
    { dataLeitura: "2026-08-18", diaNr: 12 },
  ];

  it("usa o dia real da leitura no mesmo dia da adição", () => {
    const marcadores = criarMarcadoresAdicao([
      { dataAdicao: "2026-08-07", produto: "LSA" },
      { dataAdicao: "2026-08-13", produto: "Oenocell" },
      { dataAdicao: "2026-08-18", produto: "Oxigénio" },
    ], leituras);

    expect(marcadores.map(marcador => marcador.dia)).toEqual([1, 7, 12]);
  });

  it("agrupa várias adições no mesmo dia numa única linha vertical", () => {
    const marcadores = criarMarcadoresAdicao([
      { dataAdicao: "2026-08-07", produto: "LSA" },
      { dataAdicao: "2026-08-07", produto: "Fermalid" },
      { dataAdicao: "2026-08-13", produto: "Oenocell" },
    ], leituras);

    expect(agruparMarcadoresPorDia(marcadores)).toEqual([
      { dia: 1, numeros: [1, 2] },
      { dia: 7, numeros: [3] },
    ]);
  });
});
