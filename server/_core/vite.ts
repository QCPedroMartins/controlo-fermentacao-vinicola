import express, { type Express } from "express";
import fs from "fs";
import { type Server } from "http";
import { nanoid } from "nanoid";
import path from "path";
import { pathToFileURL } from "url";

export async function setupVite(app: Express, server: Server) {
  // Vite e a respectiva configuração são dependências exclusivas do ambiente
  // de desenvolvimento. Carregá-los dinamicamente evita que o bundle de
  // produção exija o pacote `vite`, que não é instalado no contentor final.
  // Os identificadores são construídos em tempo de execução para que o esbuild
  // não siga estas importações quando gera `dist/index.js` para produção.
  const viteModuleId = ["vi", "te"].join("");
  const viteConfigUrl = pathToFileURL(path.resolve(import.meta.dirname, "../..", "vite.config.ts")).href;
  const [viteModule, viteConfigModule] = await Promise.all([
    import(viteModuleId),
    import(viteConfigUrl),
  ]);
  const createViteServer = viteModule.createServer;
  const viteConfig = viteConfigModule.default;
  const serverOptions = {
    middlewareMode: true,
    hmr: { server },
    allowedHosts: true as const,
  };

  const vite = await createViteServer({
    ...viteConfig,
    configFile: false,
    server: serverOptions,
    appType: "custom",
  });

  app.use(vite.middlewares);
  app.use("*", async (req, res, next) => {
    const url = req.originalUrl;

    try {
      const clientTemplate = path.resolve(
        import.meta.dirname,
        "../..",
        "client",
        "index.html"
      );

      // always reload the index.html file from disk incase it changes
      let template = await fs.promises.readFile(clientTemplate, "utf-8");
      template = template.replace(
        `src="/src/main.tsx"`,
        `src="/src/main.tsx?v=${nanoid()}"`
      );
      const page = await vite.transformIndexHtml(url, template);
      res.status(200).set({ "Content-Type": "text/html" }).end(page);
    } catch (e) {
      vite.ssrFixStacktrace(e as Error);
      next(e);
    }
  });
}

export function serveStatic(app: Express) {
  const distPath =
    process.env.NODE_ENV === "development"
      ? path.resolve(import.meta.dirname, "../..", "dist", "public")
      : path.resolve(import.meta.dirname, "public");
  if (!fs.existsSync(distPath)) {
    console.error(
      `Could not find the build directory: ${distPath}, make sure to build the client first`
    );
  }

  app.use(express.static(distPath));

  // fall through to index.html if the file doesn't exist
  app.use("*", (_req, res) => {
    res.sendFile(path.resolve(distPath, "index.html"));
  });
}
