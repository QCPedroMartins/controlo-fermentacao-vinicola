import { describe, expect, it, vi, beforeEach } from "vitest";
import { appRouter } from "./routers";
import type { TrpcContext } from "./_core/context";

// Mock do módulo db para não precisar de base de dados real
vi.mock("./db", () => ({
  getCubaByCodigo: vi.fn().mockResolvedValue({
    id: 1,
    codigo: "cf1",
    nomeLote: "Tinto Reserva 2026",
    fermentacaoNum: 1,
    estado: "em_fermentacao",
    createdAt: new Date(),
    updatedAt: new Date(),
  }),
  getAllCubas: vi.fn().mockResolvedValue([
    { id: 1, codigo: "cf1", nomeLote: "Tinto Reserva", fermentacaoNum: 1, estado: "em_fermentacao", createdAt: new Date(), updatedAt: new Date() },
    { id: 2, codigo: "cf2", nomeLote: null, fermentacaoNum: 1, estado: "sem_dados", createdAt: new Date(), updatedAt: new Date() },
  ]),
  getLeiturasByCuba: vi.fn().mockResolvedValue([
    {
      id: 1, cubaId: 1, fermentacaoNum: 1,
      dataLeitura: new Date("2026-05-01"),
      diaNr: 1, densL1: "1.085", densL2: "1.083", densL3: null,
      tempL1: "18.5", tempL2: "19.0", tempL3: null,
      o2: null, redox: null, userId: 1, userName: "João",
      createdAt: new Date(), updatedAt: new Date(),
    },
    {
      id: 2, cubaId: 1, fermentacaoNum: 1,
      dataLeitura: new Date("2026-05-05"),
      diaNr: 5, densL1: "1.050", densL2: "1.048", densL3: null,
      tempL1: "22.0", tempL2: "22.5", tempL3: null,
      o2: "6.50", redox: "250", userId: 1, userName: "João",
      createdAt: new Date(), updatedAt: new Date(),
    },
  ]),
  getAdicoesByCuba: vi.fn().mockResolvedValue([]),
  getArquivoByCuba: vi.fn().mockResolvedValue([]),
  getDashboardCubas: vi.fn().mockResolvedValue([
    { id: 1, codigo: "cf1", nomeLote: "Tinto Reserva", fermentacaoNum: 1, estado: "em_fermentacao", createdAt: new Date(), updatedAt: new Date() },
  ]),
  createLeitura: vi.fn().mockResolvedValue(undefined),
  createAdicao: vi.fn().mockResolvedValue(undefined),
  updateCubaNomeLote: vi.fn().mockResolvedValue(undefined),
  updateCubaEstado: vi.fn().mockResolvedValue(undefined),
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
            createdAt: new Date(), updatedAt: new Date(),
          }]),
        }),
      }),
    }),
    update: vi.fn().mockReturnValue({
      set: vi.fn().mockReturnValue({
        where: vi.fn().mockResolvedValue(undefined),
      }),
    }),
  }),
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
    // Densidade mínima deve ser 1.048 (menor de todos os valores)
    expect(Number(result?.densMin)).toBeLessThanOrEqual(1.05);
    // Temperatura máxima deve ser 22.5
    expect(Number(result?.tempMax)).toBeGreaterThanOrEqual(22.0);
  });
});

describe("leituras.create (protectedProcedure)", () => {
  it("rejeita utilizadores não autenticados", async () => {
    const caller = appRouter.createCaller(makeCtx(false));
    await expect(
      caller.leituras.create({
        cubaId: 1,
        fermentacaoNum: 1,
        dataLeitura: "2026-05-22",
        densL1: "1.080",
        densL2: null,
        densL3: null,
        tempL1: "20.0",
        tempL2: null,
        tempL3: null,
        o2: null,
        redox: null,
      })
    ).rejects.toThrow();
  });

  it("aceita utilizadores autenticados", async () => {
    const caller = appRouter.createCaller(makeCtx(true));
    await expect(
      caller.leituras.create({
        cubaId: 1,
        fermentacaoNum: 1,
        dataLeitura: "2026-05-22",
        densL1: "1.080",
        densL2: null,
        densL3: null,
        tempL1: "20.0",
        tempL2: null,
        tempL3: null,
        o2: null,
        redox: null,
      })
    ).resolves.not.toThrow();
  });
});

describe("adicoes.listByCuba", () => {
  it("retorna lista de adições (pode estar vazia)", async () => {
    const caller = appRouter.createCaller(makeCtx(false));
    const result = await caller.adicoes.listByCuba({ cubaId: 1, fermentacaoNum: 1 });
    expect(Array.isArray(result)).toBe(true);
  });
});
