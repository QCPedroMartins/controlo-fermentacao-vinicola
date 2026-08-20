import "dotenv/config";
import express from "express";
import { createServer } from "http";
import net from "net";
import { createExpressMiddleware } from "@trpc/server/adapters/express";
import { registerOAuthRoutes } from "./oauth";
import { registerStorageProxy } from "./storageProxy";
import { appRouter } from "../routers";
import { createContext } from "./context";
import { serveStatic, setupVite } from "./vite";
import { handleDailyDigest, handleFimFermentacao } from "../scheduledHandlers";
import { gerarPdfDashboard } from "../pdfReport";
import { gerarExcelDigestDiario } from "../emailReport";
import { COOKIE_NAME } from "@shared/const";
import { sdk } from "./sdk";
import { confirmarHandoffHandler } from "../gestaoAdegaHandoff";

function isPortAvailable(port: number): Promise<boolean> {
  return new Promise(resolve => {
    const server = net.createServer();
    server.listen(port, () => {
      server.close(() => resolve(true));
    });
    server.on("error", () => resolve(false));
  });
}

async function findAvailablePort(startPort: number = 3000): Promise<number> {
  for (let port = startPort; port < startPort + 20; port++) {
    if (await isPortAvailable(port)) {
      return port;
    }
  }
  throw new Error(`No available port found starting from ${startPort}`);
}

async function startServer() {
  const app = express();
  const server = createServer(app);
  // Configure body parser with larger size limit for file uploads
  app.use(express.json({ limit: "50mb" }));
  app.use(express.urlencoded({ limit: "50mb", extended: true }));
  registerStorageProxy(app);
  registerOAuthRoutes(app);
  // Confirmação do lado da fermentação após o utilizador validar a entrada na
  // Gestão de Adega. O token é assinado, expira em 15 minutos e é idempotente.
  app.get("/api/integracao/adega/confirmar", confirmarHandoffHandler);

  // Rota para limpar cookie inválido e ir para /login
  app.get("/clear-session-and-login", (_req, res) => {
    res.clearCookie(COOKIE_NAME, { path: "/" });
    res.redirect(302, "/login");
  });

  // Middleware: se o cookie existir mas for inválido (JWT de outra app/sessão Manus),
  // apagá-lo automaticamente para que o utilizador veja o formulário de login
  app.use(async (req, res, next) => {
    if (req.path.startsWith("/api") || req.path.startsWith("/manus-storage") || req.path.includes(".")) {
      return next();
    }
    const cookieHeader = req.headers.cookie ?? "";
    if (!cookieHeader.includes(COOKIE_NAME + "=")) {
      return next();
    }
    try {
      const rawCookie = cookieHeader.split(COOKIE_NAME + "=")[1]?.split(";")[0];
      const session = await sdk.verifySession(rawCookie);
      if (!session) {
        res.clearCookie(COOKIE_NAME, { path: "/" });
      }
    } catch {
      res.clearCookie(COOKIE_NAME, { path: "/" });
    }
    next();
  });

  // tRPC API
  app.use(
    "/api/trpc",
    createExpressMiddleware({
      router: appRouter,
      createContext,
    })
  );
  // Scheduled handlers — MUST be before Vite/static fallthrough
  app.post("/api/scheduled/daily-digest", handleDailyDigest);
  app.post("/api/scheduled/fermentacao-completa", handleFimFermentacao);

  // ── Exportação Dashboard ──────────────────────────────────
  app.get("/api/export/dashboard-pdf", async (_req, res) => {
    try {
      const buffer = await gerarPdfDashboard();
      const dataHoje = new Date().toLocaleDateString("pt-PT", { timeZone: "Europe/Lisbon" }).replace(/\//g, "-");
      res.setHeader("Content-Type", "application/pdf");
      res.setHeader("Content-Disposition", `attachment; filename="dashboard_fermentacao_${dataHoje}.pdf"`);
      res.send(buffer);
    } catch (err) {
      console.error("[Export Dashboard PDF]", err);
      res.status(500).json({ error: String(err) });
    }
  });

  app.get("/api/export/dashboard-excel", async (_req, res) => {
    try {
      const buffer = await gerarExcelDigestDiario();
      const dataHoje = new Date().toLocaleDateString("pt-PT", { timeZone: "Europe/Lisbon" }).replace(/\//g, "-");
      res.setHeader("Content-Type", "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet");
      res.setHeader("Content-Disposition", `attachment; filename="dashboard_fermentacao_${dataHoje}.xlsx"`);
      res.send(Buffer.from(buffer as ArrayBuffer));
    } catch (err) {
      console.error("[Export Dashboard Excel]", err);
      res.status(500).json({ error: String(err) });
    }
  });

  // development mode uses Vite, production mode uses static files
  if (process.env.NODE_ENV === "development") {
    await setupVite(app, server);
  } else {
    serveStatic(app);
  }

  const preferredPort = parseInt(process.env.PORT || "3000");
  const port = await findAvailablePort(preferredPort);

  if (port !== preferredPort) {
    console.log(`Port ${preferredPort} is busy, using port ${port} instead`);
  }

  server.listen(port, () => {
    console.log(`Server running on http://localhost:${port}/`);
  });
}

startServer().catch(console.error);
