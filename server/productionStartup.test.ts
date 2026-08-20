import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import { describe, expect, it } from "vitest";

describe("arranque de produção", () => {
  it("carrega o Vite apenas de forma dinâmica para não o exigir no contentor final", () => {
    const viteCore = readFileSync(resolve(process.cwd(), "server/_core/vite.ts"), "utf8");

    expect(viteCore).toContain('const viteModuleId = ["vi", "te"].join("")');
    expect(viteCore).not.toContain('from "vite"');
    expect(viteCore).not.toContain('import("vite")');
    expect(viteCore).not.toContain('import("../../vite.config")');
    expect(viteCore).toContain("pathToFileURL");
  });
});
