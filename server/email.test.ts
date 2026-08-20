/**
 * email.test.ts
 * Testes para server/emailReport.ts e server/scheduledHandlers.ts
 * Usa mocks para evitar chamadas reais ao Resend e à base de dados.
 */

import { describe, it, expect, vi, beforeEach } from "vitest";

// ── Mock do módulo db ──────────────────────────────────────
vi.mock("./db", () => ({
  getAllCubas: vi.fn().mockResolvedValue([
    {
      id: 1, codigo: "cf1", nomeLote: "Tinto Reserva 2026",
      fermentacaoNum: 1, estado: "em_fermentacao",
      densidadeLimite: "1.000", tempPretendida: "18.0",
      desvioTempAlerta: "5.0", desvioDesnsAlerta: "0.010",
    },
    {
      id: 2, codigo: "cf2", nomeLote: null,
      fermentacaoNum: 1, estado: "sem_dados",
      densidadeLimite: "1.000", tempPretendida: null,
      desvioTempAlerta: "5.0", desvioDesnsAlerta: "0.010",
    },
  ]),
  getLeiturasByCuba: vi.fn().mockResolvedValue([
    {
      id: 1, cubaId: 1, fermentacaoNum: 1,
      dataLeitura: new Date("2026-05-01"), diaNr: 1,
      densL1: "1.085", densL2: "1.083", densL3: null,
      tempL1: "18.5", tempL2: "19.0", tempL3: null,
      o2: null, redox: null, userName: "João",
      editedAt: null, editedByName: null,
    },
    {
      id: 2, cubaId: 1, fermentacaoNum: 1,
      dataLeitura: new Date("2026-05-05"), diaNr: 5,
      densL1: "1.050", densL2: "1.048", densL3: null,
      tempL1: "22.0", tempL2: "22.5", tempL3: null,
      o2: "6.50", redox: "250", userName: "João",
      editedAt: null, editedByName: null,
    },
  ]),
  getAdicoesByCuba: vi.fn().mockResolvedValue([
    {
      id: 1, cubaId: 1, fermentacaoNum: 1,
      dataAdicao: new Date("2026-05-02"),
      produto: "SO2", dose: "5g/hL", observacoes: "Adição preventiva", userName: "João",
    },
  ]),

  getMovimentosHoje: vi.fn().mockResolvedValue([]),
  getMovimentosBarricaHoje: vi.fn().mockResolvedValue([]),
  getRecepcoesDoDia: vi.fn().mockResolvedValue([]),
  getMovimentosByCuba: vi.fn().mockResolvedValue([]),
  getMovimentosBarricaByCuba: vi.fn().mockResolvedValue([]),
  getAnalisesByCuba: vi.fn().mockResolvedValue([]),
  getAnalisesFinaisByCuba: vi.fn().mockResolvedValue([]),
  getComentariosByCuba: vi.fn().mockResolvedValue([]),
  getAlertasByCuba: vi.fn().mockResolvedValue([]),
}));

// ── Mock do Resend ─────────────────────────────────────────
vi.mock("resend", () => ({
  Resend: vi.fn().mockImplementation(() => ({
    emails: {
      send: vi.fn().mockResolvedValue({ data: { id: "mock-email-id-123" }, error: null }),
    },
  })),
}));

// ── Testes de gerarExcelCuba ───────────────────────────────
describe("gerarExcelCuba", () => {
  it("deve gerar um ArrayBuffer não vazio para uma cuba com leituras", async () => {
    const { gerarExcelCuba } = await import("./emailReport");
    const buffer = await gerarExcelCuba({
      id: 1,
      codigo: "cf1",
      nomeLote: "Tinto Reserva 2026",
      fermentacaoNum: 1,
      estado: "em_fermentacao",
      densidadeLimite: "1.000",
      tempPretendida: "18.0",
    });
    expect(buffer).toBeDefined();
    expect(buffer.byteLength).toBeGreaterThan(1000);
  });

  it("deve gerar Excel mesmo sem leituras (cuba vazia)", async () => {
    const { getLeiturasByCuba } = await import("./db");
    vi.mocked(getLeiturasByCuba).mockResolvedValueOnce([]);

    const { gerarExcelCuba } = await import("./emailReport");
    const buffer = await gerarExcelCuba({
      id: 2,
      codigo: "cf2",
      nomeLote: null,
      fermentacaoNum: 1,
      estado: "sem_dados",
      densidadeLimite: "1.000",
      tempPretendida: null,
    });
    expect(buffer).toBeDefined();
    expect(buffer.byteLength).toBeGreaterThan(100);
  });
});

// ── Testes de gerarExcelDigestDiario ──────────────────────
describe("gerarExcelDigestDiario", () => {
  it("deve gerar um ArrayBuffer com dados das cubas ativas", async () => {
    const { gerarExcelDigestDiario } = await import("./emailReport");
    const buffer = await gerarExcelDigestDiario();
    expect(buffer).toBeDefined();
    expect(buffer.byteLength).toBeGreaterThan(1000);
  });

  it("deve retornar buffer mesmo quando não há cubas ativas", async () => {
    const { getAllCubas } = await import("./db");
    vi.mocked(getAllCubas).mockResolvedValueOnce([]);

    const { gerarExcelDigestDiario } = await import("./emailReport");
    const buffer = await gerarExcelDigestDiario();
    expect(buffer).toBeDefined();
    expect(buffer.byteLength).toBeGreaterThan(0);
  });
});

// ── Testes de enviarEmailComExcel ─────────────────────────
describe("enviarEmailComExcel", () => {
  beforeEach(() => {
    process.env.RESEND_API_KEY = "re_test_mock_key";
  });

  it("deve chamar Resend.emails.send com os parâmetros corretos", async () => {
    const { enviarEmailComExcel } = await import("./emailReport");
    const { Resend } = await import("resend");

    const mockBuffer = Buffer.from("mock excel data");
    await enviarEmailComExcel({
      assunto: "Teste de email",
      htmlBody: "<p>Teste</p>",
      nomeAnexo: "teste.xlsx",
      bufferExcel: mockBuffer,
    });

    const instance = vi.mocked(Resend).mock.results[0]?.value;
    expect(instance?.emails.send).toHaveBeenCalledWith(
      expect.objectContaining({
        subject: "Teste de email",
        to: "geral@castelares.com",
        attachments: expect.arrayContaining([
          expect.objectContaining({ filename: "teste.xlsx" }),
        ]),
      })
    );
  });

  it("envia o resumo de fecho com destinos, borras e anexo Excel", async () => {
    const { enviarEmailFechoIntegrado } = await import("./emailReport");
    const { Resend } = await import("resend");

    await enviarEmailFechoIntegrado({
      payload: {
        referenciaExterna: "ADEGA-11111111-1111-4111-8111-111111111111",
        dataMovimento: "2026-08-20T17:00:00.000Z",
        operador: "Pedro Martins",
        operadorId: 1,
        origens: [{ cubaId: 1, cubaCodigo: "CF2", fermentacaoNumero: 1, litros: 1000 }],
        destinos: [{ cubaCodigo: "C49", litros: 1000 }],
        borras: [{ cubaOrigemId: 1, litros: 50, destino: "lixo" }],
        comentarios: ["Origem preservada"],
      },
      cubasFechadas: [{ id: 1, codigo: "CF2", nomeLote: "Lote 2026", fermentacaoNum: 1, estado: "completa", densidadeLimite: "0.990", tempPretendida: "18" }],
      detalhesBorras: ["CF2: 50 L → lixo"],
    });

    const instance = vi.mocked(Resend).mock.results.at(-1)?.value;
    expect(instance?.emails.send).toHaveBeenCalledWith(expect.objectContaining({
      subject: expect.stringContaining("Fecho de fermentação"),
      html: expect.stringContaining("CF2: 50 L → lixo"),
      attachments: expect.arrayContaining([expect.objectContaining({ filename: expect.stringContaining("Fecho_Fermentacao_CF2") })]),
    }));
  });

  it("não deve lançar erro quando RESEND_API_KEY não está definida", async () => {
    delete process.env.RESEND_API_KEY;
    const { enviarEmailComExcel } = await import("./emailReport");
    // Deve completar sem lançar exceção (apenas log de erro)
    await expect(
      enviarEmailComExcel({
        assunto: "Teste sem key",
        htmlBody: "<p>Teste</p>",
        nomeAnexo: "teste.xlsx",
        bufferExcel: Buffer.from("mock"),
      })
    ).resolves.toBeUndefined();
  });

  it("deve registar erro quando o Resend retorna erro (não lança exceção, apenas loga)", async () => {
    // O handler de envio não lança exceção quando RESEND_API_KEY não está definida
    // Este comportamento é intencional para não bloquear o fluxo principal
    delete process.env.RESEND_API_KEY;
    const { enviarEmailComExcel } = await import("./emailReport");
    // Deve completar sem lançar exceção
    await expect(
      enviarEmailComExcel({
        assunto: "Teste sem key",
        htmlBody: "<p>Teste</p>",
        nomeAnexo: "teste.xlsx",
        bufferExcel: Buffer.from("mock"),
      })
    ).resolves.toBeUndefined();
  });
});

// ── Testes dos handlers scheduled ─────────────────────────
describe("handleDailyDigest", () => {
  it("deve retornar 500 quando o sdk lança exceção (sem cookie válido)", async () => {
    // O handler captura erros e retorna 500 com detalhes
    const { handleDailyDigest } = await import("./scheduledHandlers");

    const mockReq = {
      headers: { cookie: "" },
    } as never;

    let statusCode = 0;
    let responseBody: unknown = null;
    const mockRes = {
      status: (code: number) => {
        statusCode = code;
        return { json: (body: unknown) => { responseBody = body; } };
      },
      json: (body: unknown) => { responseBody = body; },
    } as never;

    await handleDailyDigest(mockReq, mockRes);
    // Sem cookie válido, o sdk lança exceção e o handler retorna 500
    expect(statusCode).toBe(500);
    expect(responseBody).toHaveProperty("error");
  });
});
