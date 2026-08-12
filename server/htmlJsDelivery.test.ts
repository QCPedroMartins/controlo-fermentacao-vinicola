import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import { describe, expect, it } from "vitest";

const deliveryDirectory = resolve(process.cwd(), "examples/html-js");

describe("entrega HTML/JavaScript autónoma", () => {
  it("inclui os ficheiros HTML, CSS e JavaScript necessários", () => {
    const html = readFileSync(resolve(deliveryDirectory, "index.html"), "utf8");
    const css = readFileSync(resolve(deliveryDirectory, "styles.css"), "utf8");
    const javascript = readFileSync(resolve(deliveryDirectory, "app.js"), "utf8");

    expect(html).toContain('href="styles.css"');
    expect(html).toContain('src="app.js"');
    expect(css).toContain("--wine-800");
    expect(javascript).toContain("const initialState");
  });

  it("documenta e implementa a apresentação distinta para origem e destino", () => {
    const javascript = readFileSync(resolve(deliveryDirectory, "app.js"), "utf8");
    const readme = readFileSync(resolve(deliveryDirectory, "README.md"), "utf8");

    expect(javascript).toContain("origem mostra todos os destinos; destino mostra somente a sua parcela");
    expect(javascript).toContain("Transferido para:");
    expect(javascript).toContain("Recebido de:");
    expect(readme).toContain("CF2 (2524 L), CF6 (476 L)");
    expect(readme).toContain("Recebido de: CF8 — 2524 L");
  });
});
