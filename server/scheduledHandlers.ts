/**
 * scheduledHandlers.ts
 * Handlers Express para os endpoints /api/scheduled/*
 * Autenticados via sdk.authenticateRequest (user.isCron === true)
 */

import type { Request, Response } from "express";
import { sdk } from "./_core/sdk";
import {
  gerarExcelDigestDiario,
  gerarExcelCuba,
  enviarEmailComExcel,
} from "./emailReport";
import { getAllCubas, getLeiturasByCuba, getAdicoesByCuba } from "./db";

// ── Helpers de HTML para o corpo do email ─────────────────
function htmlDigestDiario(nCubas: number, data: string): string {
  return `
<!DOCTYPE html>
<html lang="pt">
<head><meta charset="UTF-8"><style>
  body { font-family: Georgia, serif; color: #333; max-width: 600px; margin: 0 auto; padding: 20px; }
  h1 { color: #5d1a2e; font-size: 22px; border-bottom: 2px solid #5d1a2e; padding-bottom: 8px; }
  p { font-size: 14px; line-height: 1.6; }
  .badge { display: inline-block; background: #5d1a2e; color: white; padding: 4px 12px; border-radius: 20px; font-size: 13px; }
  .footer { margin-top: 30px; font-size: 11px; color: #999; border-top: 1px solid #eee; padding-top: 12px; }
</style></head>
<body>
  <h1>🍷 Digest Diário — Controlo de Fermentação</h1>
  <p>Bom dia,</p>
  <p>Segue em anexo o relatório diário de fermentação referente a <strong>${data}</strong>.</p>
  <p>O ficheiro Excel contém:</p>
  <ul>
    <li>Resumo geral com <span class="badge">${nCubas} cuba(s) em fermentação</span></li>
    <li>Histórico completo de leituras por cuba</li>
    <li>Gráficos de densidade e temperatura</li>
    <li>Adições e notas registadas</li>
  </ul>
  <p>Aceda à aplicação para consultar alertas e registar novas leituras:</p>
  <p><a href="https://fermenta84-csbhypgs.manus.space" style="color:#5d1a2e;">fermenta84-csbhypgs.manus.space</a></p>
  <div class="footer">
    Este email foi gerado automaticamente pelo sistema de Controlo de Fermentação Vinícola — Castelares.<br>
    Enviado às 21h00 (hora de Lisboa).
  </div>
</body>
</html>`;
}

function htmlFimFermentacao(cuba: { codigo: string; nomeLote: string | null; fermentacaoNum: number }, nLeituras: number, nAdicoes: number): string {
  return `
<!DOCTYPE html>
<html lang="pt">
<head><meta charset="UTF-8"><style>
  body { font-family: Georgia, serif; color: #333; max-width: 600px; margin: 0 auto; padding: 20px; }
  h1 { color: #5d1a2e; font-size: 22px; border-bottom: 2px solid #5d1a2e; padding-bottom: 8px; }
  .highlight { background: #fdf6f8; border-left: 4px solid #5d1a2e; padding: 12px 16px; margin: 16px 0; border-radius: 4px; }
  p { font-size: 14px; line-height: 1.6; }
  .stat { display: inline-block; margin-right: 20px; }
  .stat strong { font-size: 22px; color: #5d1a2e; display: block; }
  .stat span { font-size: 11px; color: #888; }
  .footer { margin-top: 30px; font-size: 11px; color: #999; border-top: 1px solid #eee; padding-top: 12px; }
</style></head>
<body>
  <h1>✅ Fermentação Concluída — ${cuba.codigo.toUpperCase()}</h1>
  <p>A fermentação da cuba <strong>${cuba.codigo.toUpperCase()}</strong> foi concluída e arquivada.</p>
  <div class="highlight">
    <strong style="font-size:16px;color:#5d1a2e;">${cuba.nomeLote ?? "Sem nome"}</strong><br>
    <span style="font-size:12px;color:#888;">Fermentação Nº ${cuba.fermentacaoNum}</span>
  </div>
  <div style="margin: 20px 0;">
    <div class="stat">
      <strong>${nLeituras}</strong>
      <span>leituras registadas</span>
    </div>
    <div class="stat">
      <strong>${nAdicoes}</strong>
      <span>adições / notas</span>
    </div>
  </div>
  <p>O relatório completo com gráficos de densidade, temperatura e todas as adições segue em anexo.</p>
  <p><a href="https://fermenta84-csbhypgs.manus.space/cuba/${cuba.codigo}" style="color:#5d1a2e;">Ver cuba na aplicação →</a></p>
  <div class="footer">
    Este email foi gerado automaticamente ao arquivar a fermentação no sistema de Controlo de Fermentação Vinícola — Castelares.
  </div>
</body>
</html>`;
}

// ── Handler: Digest Diário ─────────────────────────────────
export async function handleDailyDigest(req: Request, res: Response) {
  try {
    const user = await sdk.authenticateRequest(req);
    if (!user.isCron) {
      return res.status(403).json({ error: "cron-only" });
    }

    console.log(`[Digest Diário] Iniciado — taskUid: ${user.taskUid}`);

    const todasCubas = await getAllCubas();
    const cubasAtivas = todasCubas.filter((c) => c.estado === "em_fermentacao");

    if (cubasAtivas.length === 0) {
      console.log("[Digest Diário] Sem cubas em fermentação — email não enviado");
      return res.json({ ok: true, skipped: "no_active_cubas" });
    }

    const bufferExcel = await gerarExcelDigestDiario();
    const dataHoje = new Date().toLocaleDateString("pt-PT", { timeZone: "Europe/Lisbon" });
    const nomeFicheiro = `digest_fermentacao_${dataHoje.replace(/\//g, "-")}.xlsx`;

    await enviarEmailComExcel({
      assunto: `🍷 Digest Diário Fermentação — ${dataHoje} — ${cubasAtivas.length} cuba(s) ativa(s)`,
      htmlBody: htmlDigestDiario(cubasAtivas.length, dataHoje),
      nomeAnexo: nomeFicheiro,
      bufferExcel: Buffer.from(bufferExcel as ArrayBuffer),
    });

    console.log(`[Digest Diário] Concluído — ${cubasAtivas.length} cubas, email enviado`);
    return res.json({ ok: true, cubasAtivas: cubasAtivas.length, ficheiro: nomeFicheiro });

  } catch (err: unknown) {
    const error = err instanceof Error ? err.message : String(err);
    const stack = err instanceof Error ? err.stack : undefined;
    console.error("[Digest Diário] Erro:", error);
    return res.status(500).json({
      error,
      stack,
      context: { url: req.url, taskUid: "daily-digest" },
      timestamp: new Date().toISOString(),
    });
  }
}

// ── Handler: Fim de Fermentação ────────────────────────────
// Este handler é chamado internamente (não por cron) quando uma fermentação
// é arquivada via novaFermentacao. Recebe cubaId e fermentacaoNum no body.
export async function handleFimFermentacao(req: Request, res: Response) {
  try {
    const user = await sdk.authenticateRequest(req);
    if (!user.isCron) {
      return res.status(403).json({ error: "cron-only" });
    }

    const { cubaId, fermentacaoNum } = req.body as { cubaId?: number; fermentacaoNum?: number };
    if (!cubaId || !fermentacaoNum) {
      return res.status(400).json({ error: "cubaId e fermentacaoNum são obrigatórios" });
    }

    const todasCubas = await getAllCubas();
    const cuba = todasCubas.find((c) => c.id === cubaId);
    if (!cuba) {
      return res.status(404).json({ error: "Cuba não encontrada" });
    }

    console.log(`[Fim Fermentação] Cuba ${cuba.codigo} Nº${fermentacaoNum} — a gerar relatório`);

    // Buscar leituras e adições da fermentação que acabou de ser arquivada
    const leituras = await getLeiturasByCuba(cubaId, fermentacaoNum);
    const adicoes = await getAdicoesByCuba(cubaId, fermentacaoNum);

    // Gerar Excel para esta cuba/fermentação específica
    const cubaParaRelatorio = { ...cuba, fermentacaoNum };
    const bufferExcel = Buffer.from(await gerarExcelCuba(cubaParaRelatorio));

    const dataHoje = new Date().toLocaleDateString("pt-PT", { timeZone: "Europe/Lisbon" });
    const nomeLoteSafe = (cuba.nomeLote ?? "sem_nome").replace(/\s+/g, "_").replace(/[^a-zA-Z0-9_-]/g, "");
    const nomeFicheiro = `${cuba.codigo}_ferm${fermentacaoNum}_${nomeLoteSafe}_${dataHoje.replace(/\//g, "-")}.xlsx`;

    await enviarEmailComExcel({
      assunto: `✅ Fermentação Concluída — ${cuba.codigo.toUpperCase()} — ${cuba.nomeLote ?? "Sem nome"} (Nº${fermentacaoNum})`,
      htmlBody: htmlFimFermentacao(
        { codigo: cuba.codigo, nomeLote: cuba.nomeLote, fermentacaoNum },
        leituras.length,
        adicoes.length
      ),
      nomeAnexo: nomeFicheiro,
      bufferExcel: bufferExcel as Buffer,
    });

    console.log(`[Fim Fermentação] Email enviado — ${cuba.codigo} Nº${fermentacaoNum}`);
    return res.json({ ok: true, cuba: cuba.codigo, fermentacaoNum, ficheiro: nomeFicheiro });

  } catch (err: unknown) {
    const error = err instanceof Error ? err.message : String(err);
    const stack = err instanceof Error ? err.stack : undefined;
    console.error("[Fim Fermentação] Erro:", error);
    return res.status(500).json({
      error,
      stack,
      context: { url: req.url },
      timestamp: new Date().toISOString(),
    });
  }
}
