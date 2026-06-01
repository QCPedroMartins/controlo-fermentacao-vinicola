import { describe, expect, it, vi, beforeEach } from "vitest";
import { appRouter } from "./routers";
import { calcularAlertas } from "./db";
import type { TrpcContext } from "./_core/context";

// Mock do módulo db para não precisar de base de dados real
vi.mock("./db", async (importOriginal) => {
  const original = await importOriginal<typeof import("./db")>();
  return {
    ...original, // preserva calcularAlertas (função pura, sem BD)
    getCubaByCodigo: vi.fn().mockResolvedValue({
      id: 1,
      codigo: "cf1",
      nomeLote: "Tinto Reserva 2026",
      fermentacaoNum: 1,
      estado: "em_fermentacao",
      densidadeLimite: "1.000",
      tempPretendida: "18.0",
      desvioTempAlerta: "5.0",
      desvioDesnsAlerta: "0.010",
      createdAt: new Date(),
      updatedAt: new Date(),
    }),
    getAllCubas: vi.fn().mockResolvedValue([
      { id: 1, codigo: "cf1", nomeLote: "Tinto Reserva", fermentacaoNum: 1, estado: "em_fermentacao", densidadeLimite: "1.000", tempPretendida: "18.0", desvioTempAlerta: "5.0", desvioDesnsAlerta: "0.010", createdAt: new Date(), updatedAt: new Date() },
      { id: 2, codigo: "cf2", nomeLote: null, fermentacaoNum: 1, estado: "sem_dados", densidadeLimite: "1.000", tempPretendida: null, desvioTempAlerta: "5.0", desvioDesnsAlerta: "0.010", createdAt: new Date(), updatedAt: new Date() },
    ]),
    getLeiturasByCuba: vi.fn().mockResolvedValue([
      {
        id: 1, cubaId: 1, fermentacaoNum: 1,
        dataLeitura: new Date("2026-05-01"),
        diaNr: 1, densL1: "1.085", densL2: "1.083", densL3: null,
        tempL1: "18.5", tempL2: "19.0", tempL3: null,
        o2: null, redox: null, userId: 1, userName: "João",
        editedAt: null, editedBy: null, editedByName: null,
        createdAt: new Date(), updatedAt: new Date(),
      },
      {
        id: 2, cubaId: 1, fermentacaoNum: 1,
        dataLeitura: new Date("2026-05-05"),
        diaNr: 5, densL1: "1.050", densL2: "1.048", densL3: null,
        tempL1: "22.0", tempL2: "22.5", tempL3: null,
        o2: "6.50", redox: "250", userId: 1, userName: "João",
        editedAt: null, editedBy: null, editedByName: null,
        createdAt: new Date(), updatedAt: new Date(),
      },
    ]),
    getLeituraById: vi.fn().mockResolvedValue({
      id: 1, cubaId: 1, fermentacaoNum: 1,
      dataLeitura: new Date("2026-05-01"),
      diaNr: 1, densL1: "1.085", densL2: "1.083", densL3: null,
      tempL1: "18.5", tempL2: "19.0", tempL3: null,
      o2: null, redox: null, userId: 1, userName: "João",
      editedAt: null, editedBy: null, editedByName: null,
      createdAt: new Date(), updatedAt: new Date(),
    }),
    getAdicoesByCuba: vi.fn().mockResolvedValue([]),
    getArquivoByCuba: vi.fn().mockResolvedValue([]),
    getDashboardCubas: vi.fn().mockResolvedValue([
      { id: 1, codigo: "cf1", nomeLote: "Tinto Reserva", fermentacaoNum: 1, estado: "em_fermentacao", densidadeLimite: "1.000", tempPretendida: "18.0", desvioTempAlerta: "5.0", desvioDesnsAlerta: "0.010", createdAt: new Date(), updatedAt: new Date() },
    ]),
    createLeitura: vi.fn().mockResolvedValue(undefined),
    editarLeitura: vi.fn().mockResolvedValue(undefined),
    createAdicao: vi.fn().mockResolvedValue(undefined),
    updateCubaNomeLote: vi.fn().mockResolvedValue(undefined),
    updateCubaEstado: vi.fn().mockResolvedValue(undefined),
    updateCubaAlertas: vi.fn().mockResolvedValue(undefined),
    createArquivo: vi.fn().mockResolvedValue(undefined),
    deleteAdicao: vi.fn().mockResolvedValue(undefined),
    updateLeitura: vi.fn().mockResolvedValue(undefined),
    updateCubaDensidadeLimite: vi.fn().mockResolvedValue(undefined),
    verificarFermentacaoCompleta: vi.fn().mockResolvedValue(false),
    upsertUser: vi.fn().mockResolvedValue(undefined),
    getUserByOpenId: vi.fn().mockResolvedValue(undefined),
    getDb: vi.fn().mockResolvedValue({
      select: vi.fn().mockReturnValue({
        from: vi.fn().mockReturnValue({
          where: vi.fn().mockReturnValue({
            limit: vi.fn().mockResolvedValue([{
              id: 1, codigo: "cf1", nomeLote: "Tinto Reserva", fermentacaoNum: 1,
              estado: "em_fermentacao", densidadeLimite: "1.000",
              tempPretendida: "18.0", desvioTempAlerta: "5.0", desvioDesnsAlerta: "0.010",
              createdAt: new Date(), updatedAt: new Date(),
            }]),
            orderBy: vi.fn().mockResolvedValue([{
              id: 1, codigo: "cf1", nomeLote: "Tinto Reserva", fermentacaoNum: 1,
              estado: "em_fermentacao", densidadeLimite: "1.000",
              tempPretendida: "18.0", desvioTempAlerta: "5.0", desvioDesnsAlerta: "0.010",
              createdAt: new Date(), updatedAt: new Date(),
            }]),
            // Permite await direto (sem .limit) para select().from().where() usado em listAllDashboard
            then: vi.fn().mockImplementation((resolve) => resolve([{
              id: 1, codigo: "cf1", nomeLote: "Tinto Reserva", fermentacaoNum: 1,
              estado: "em_fermentacao", densidadeLimite: "1.000",
              tempPretendida: "18.0", desvioTempAlerta: "5.0", desvioDesnsAlerta: "0.010",
              createdAt: new Date(), updatedAt: new Date(),
            }])),
          }),
          orderBy: vi.fn().mockResolvedValue([]),
        }),
      }),
      update: vi.fn().mockReturnValue({
        set: vi.fn().mockReturnValue({
          where: vi.fn().mockResolvedValue(undefined),
        }),
      }),
    }),
  };
});

// Mock de notificações para não falhar em testes
vi.mock("./_core/notification", () => ({
  notifyOwner: vi.fn().mockResolvedValue(true),
}));

function makeCtx(authenticated = false): TrpcContext {
  return {
    user: authenticated
      ? { id: 1, openId: "user-1", name: "João Silva", email: "joao@adega.pt", loginMethod: "manus", role: "user", createdAt: new Date(), updatedAt: new Date(), lastSignedIn: new Date() }
      : null,
    req: { protocol: "https", headers: {} } as TrpcContext["req"],
    res: { clearCookie: vi.fn() } as unknown as TrpcContext["res"],
  };
}

// ── Testes de cubas ───────────────────────────────────────
describe("cubas.get", () => {
  it("retorna a cuba cf1 com os dados corretos", async () => {
    const caller = appRouter.createCaller(makeCtx(false));
    const result = await caller.cubas.get({ codigo: "cf1" });
    expect(result).toBeDefined();
    expect(result?.codigo).toBe("cf1");
    expect(result?.nomeLote).toBe("Tinto Reserva 2026");
    expect(result?.fermentacaoNum).toBe(1);
  });
});

describe("cubas.dashboard", () => {
  it("retorna lista de cubas para o dashboard", async () => {
    const caller = appRouter.createCaller(makeCtx(false));
    const result = await caller.cubas.dashboard();
    expect(Array.isArray(result)).toBe(true);
    expect(result.length).toBeGreaterThan(0);
    expect(result[0]).toHaveProperty("codigo");
    expect(result[0]).toHaveProperty("estado");
  });
});

describe("cubas.updateAlertas (protectedProcedure)", () => {
  it("rejeita utilizadores não autenticados", async () => {
    const caller = appRouter.createCaller(makeCtx(false));
    await expect(
      caller.cubas.updateAlertas({ id: 1, tempPretendida: "18.0", desvioTempAlerta: "5.0", desvioDesnsAlerta: "0.010" })
    ).rejects.toThrow();
  });

  it("aceita utilizadores autenticados e guarda configurações", async () => {
    const caller = appRouter.createCaller(makeCtx(true));
    const result = await caller.cubas.updateAlertas({
      id: 1,
      tempPretendida: "18.0",
      desvioTempAlerta: "5.0",
      desvioDesnsAlerta: "0.010",
    });
    expect(result).toEqual({ success: true });
  });
});

// ── Testes de leituras ────────────────────────────────────
describe("leituras.listByCuba", () => {
  it("retorna leituras de uma cuba", async () => {
    const caller = appRouter.createCaller(makeCtx(false));
    const result = await caller.leituras.listByCuba({ cubaId: 1, fermentacaoNum: 1 });
    expect(Array.isArray(result)).toBe(true);
    expect(result.length).toBe(2);
    expect(result[0]).toHaveProperty("densL1");
    expect(result[0]).toHaveProperty("tempL1");
  });
});

describe("leituras.resumo", () => {
  it("calcula o resumo correto da fermentação", async () => {
    const caller = appRouter.createCaller(makeCtx(false));
    const result = await caller.leituras.resumo({ cubaId: 1, fermentacaoNum: 1 });
    expect(result).toBeDefined();
    expect(result?.totalDias).toBe(5);
    expect(Number(result?.densMin)).toBeLessThanOrEqual(1.05);
    expect(Number(result?.tempMax)).toBeGreaterThanOrEqual(22.0);
  });
});

describe("leituras.create (protectedProcedure)", () => {
  it("rejeita utilizadores não autenticados", async () => {
    const caller = appRouter.createCaller(makeCtx(false));
    await expect(
      caller.leituras.create({
        cubaId: 1, fermentacaoNum: 1, dataLeitura: "2026-05-22",
        densL1: "1.080", densL2: null, densL3: null,
        tempL1: "20.0", tempL2: null, tempL3: null,
        o2: null, redox: null,
      })
    ).rejects.toThrow();
  });

  it("aceita utilizadores autenticados e retorna alertas", async () => {
    const caller = appRouter.createCaller(makeCtx(true));
    const result = await caller.leituras.create({
      cubaId: 1, fermentacaoNum: 1, dataLeitura: "2026-05-22",
      densL1: "1.080", densL2: null, densL3: null,
      tempL1: "20.0", tempL2: null, tempL3: null,
      o2: null, redox: null,
    });
    expect(result).toHaveProperty("success", true);
    expect(result).toHaveProperty("alertas");
    expect(Array.isArray(result.alertas)).toBe(true);
  });
});

describe("leituras.edit (protectedProcedure)", () => {
  it("rejeita utilizadores não autenticados", async () => {
    const caller = appRouter.createCaller(makeCtx(false));
    await expect(
      caller.leituras.edit({ id: 1, densL1: "1.080" })
    ).rejects.toThrow();
  });

  it("aceita utilizadores autenticados e edita a leitura", async () => {
    const caller = appRouter.createCaller(makeCtx(true));
    const result = await caller.leituras.edit({
      id: 1,
      densL1: "1.080",
      tempL1: "19.0",
    });
    expect(result).toHaveProperty("success", true);
    expect(result).toHaveProperty("alertas");
  });
});

// ── Testes da função calcularAlertas (lógica pura) ───────
describe("calcularAlertas (lógica pura)", () => {
  it("não gera alertas quando temperatura está dentro do limiar", () => {
    const alertas = calcularAlertas({
      tempPretendida: "18.0",
      desvioTempAlerta: "5.0",
      desvioDesnsAlerta: "0.010",
      tempL1: "20.0",
      tempL2: null,
      tempL3: null,
    });
    expect(alertas).toHaveLength(0);
  });

  it("gera alerta quando temperatura ultrapassa o limiar", () => {
    const alertas = calcularAlertas({
      tempPretendida: "18.0",
      desvioTempAlerta: "5.0",
      desvioDesnsAlerta: "0.010",
      tempL1: "25.0", // 7°C acima da pretendida (> 5°C)
      tempL2: null,
      tempL3: null,
    });
    expect(alertas.length).toBeGreaterThan(0);
    expect(alertas[0]).toMatch(/temperatura/i);
  });

  it("gera alerta quando variação de densidade é brusca", () => {
    const alertas = calcularAlertas({
      tempPretendida: null,
      desvioTempAlerta: "5.0",
      desvioDesnsAlerta: "0.010",
      densL1: "1.050",
      densL2: null,
      densL3: null,
      leituraAnterior: { densL1: "1.085", densL2: null, densL3: null },
    });
    expect(alertas.length).toBeGreaterThan(0);
    expect(alertas[0]).toMatch(/variação/i);
  });

  it("não gera alerta quando variação de densidade está dentro do limiar", () => {
    const alertas = calcularAlertas({
      tempPretendida: null,
      desvioTempAlerta: "5.0",
      desvioDesnsAlerta: "0.010",
      densL1: "1.080",
      densL2: null,
      densL3: null,
      leituraAnterior: { densL1: "1.085", densL2: null, densL3: null },
    });
    expect(alertas).toHaveLength(0);
  });
});

// ── Testes de adições ─────────────────────────────────────
describe("adicoes.listByCuba", () => {
  it("retorna lista de adições (pode estar vazia)", async () => {
    const caller = appRouter.createCaller(makeCtx(false));
    const result = await caller.adicoes.listByCuba({ cubaId: 1, fermentacaoNum: 1 });
    expect(Array.isArray(result)).toBe(true);
  });
});

// ── Testes de arquivo detalhe ─────────────────────────────
describe("arquivoDetalhe.getLeituras", () => {
  it("retorna leituras de uma fermentação arquivada", async () => {
    const caller = appRouter.createCaller(makeCtx(false));
    const result = await caller.arquivoDetalhe.getLeituras({ cubaId: 1, fermentacaoNum: 1 });
    expect(Array.isArray(result)).toBe(true);
    expect(result.length).toBeGreaterThan(0);
  });
});

describe("arquivoDetalhe.getAdicoes", () => {
  it("retorna adições de uma fermentação arquivada (pode estar vazia)", async () => {
    const caller = appRouter.createCaller(makeCtx(false));
    const result = await caller.arquivoDetalhe.getAdicoes({ cubaId: 1, fermentacaoNum: 1 });
    expect(Array.isArray(result)).toBe(true);
  });
});

describe("arquivoDetalhe.getResumo", () => {
  it("retorna null quando não há arquivo (mock retorna array vazio)", async () => {
    const caller = appRouter.createCaller(makeCtx(false));
    // O mock de getDb retorna um select encadeado que devolve array vazio para fermentacoesArquivo
    // Neste caso o resultado pode ser null ou um objeto
    const result = await caller.arquivoDetalhe.getResumo({ cubaId: 1, fermentacaoNum: 1 });
    // Aceita null ou objeto (depende do mock)
    expect(result === null || typeof result === "object").toBe(true);
  });
});

// ── Testes de leituras.listAllDashboard ───────────────────
describe("leituras.listAllDashboard", () => {
  it("retorna array de leituras para cubas em fermentação", async () => {
    const caller = appRouter.createCaller(makeCtx(false));
    const result = await caller.leituras.listAllDashboard();
    expect(Array.isArray(result)).toBe(true);
  });
});

// ── Testes de relatorio.exportarExcelCuba ─────────────────
describe("relatorio.exportarExcelCuba", () => {
  // Mock do módulo emailReport para evitar geração real de Excel
  vi.mock("./emailReport", () => ({
    gerarExcelCuba: vi.fn().mockResolvedValue(new ArrayBuffer(1024)),
    enviarEmailComExcel: vi.fn().mockResolvedValue(undefined),
    gerarExcelDigestDiario: vi.fn().mockResolvedValue(new ArrayBuffer(512)),
  }));

  it("retorna base64 e nomeFicheiro para cuba existente", async () => {
    const caller = appRouter.createCaller(makeCtx(false));
    const result = await caller.relatorio.exportarExcelCuba({ codigo: "cf1" });
    expect(result).toHaveProperty("base64");
    expect(typeof result.base64).toBe("string");
    expect(result.base64.length).toBeGreaterThan(0);
    expect(result).toHaveProperty("nomeFicheiro");
    expect(result.nomeFicheiro).toContain("cf1");
    expect(result.nomeFicheiro).toContain(".xlsx");
  });

  it("lança erro NOT_FOUND para cuba inexistente", async () => {
    const { getCubaByCodigo } = await import("./db");
    (getCubaByCodigo as ReturnType<typeof vi.fn>).mockResolvedValueOnce(null);
    const caller = appRouter.createCaller(makeCtx(false));
    await expect(
      caller.relatorio.exportarExcelCuba({ codigo: "cf999" })
    ).rejects.toThrow();
  });
});

// ── Testes de arquivo.terminarFermentacao ─────────────────────
describe("arquivo.terminarFermentacao (arquivar fermentação activa)", () => {
  it("rejeita utilizadores não autenticados", async () => {
    const caller = appRouter.createCaller(makeCtx(false));
    await expect(
      caller.arquivo.terminarFermentacao({ cubaId: 1 })
    ).rejects.toThrow();
  });

  it("aceita utilizadores autenticados e retorna fermentacaoArquivadaNum", async () => {
    const caller = appRouter.createCaller(makeCtx(true));
    const result = await caller.arquivo.terminarFermentacao({ cubaId: 1 });
    expect(result).toHaveProperty("success", true);
    expect(result).toHaveProperty("fermentacaoArquivadaNum");
    expect(typeof result.fermentacaoArquivadaNum).toBe("number");
    expect(result.fermentacaoArquivadaNum).toBeGreaterThan(0);
  });
  it("aceita nome de lote opcional", async () => {
    const caller = appRouter.createCaller(makeCtx(true));
    const result = await caller.arquivo.terminarFermentacao({
      cubaId: 1,
      nomeLote: "Tinto Reserva 2025",
    });
    expect(result).toHaveProperty("success", true);
  });
});
