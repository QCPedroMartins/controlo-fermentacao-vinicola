import { useState, useRef } from "react";
import { Upload, FileText, CheckCircle2, AlertTriangle, X, ChevronDown, ChevronUp, Copy, ArrowRight } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from "@/components/ui/dialog";
import { Badge } from "@/components/ui/badge";
import { trpc } from "@/lib/trpc";
import { toast } from "sonner";
import { useLocation } from "wouter";

interface LinhaPreview {
  measNo: string;
  data: string;
  hora: string;
  cubaCodigo: string;
  cubaId: number;
  cubaNome: string;
  densidade: number;
  temperatura: number;
  diaFermentacao?: number;
  duplicado?: boolean;
}

interface LinhaIgnorada {
  measNo: string;
  motivo: string;
  raw: string;
}

interface ResultadoPreview {
  linhasValidas: LinhaPreview[];
  linhasIgnoradas: LinhaIgnorada[];
  totalLinhas: number;
}

/** Estrutura guardada no localStorage para pré-preencher o Registo Rápido */
export interface DadosCsvParaRegistoRapido {
  data: string;           // YYYY-MM-DD
  cubas: {
    cubaCodigo: string;   // ex: CF1, VP01
    densidade: string;    // 4 casas decimais, ex: "1.0523"
    temperatura: string;  // 1 casa decimal, ex: "18.5"
    hora: string;         // HH:MM:SS da medição no CSV
    isPorto: boolean;
  }[];
  importadoEm: string;    // ISO timestamp
}

const LS_KEY = "csv_registo_rapido";

export function guardarDadosCsvNoStorage(dados: DadosCsvParaRegistoRapido) {
  localStorage.setItem(LS_KEY, JSON.stringify(dados));
}

export function lerDadosCsvDoStorage(): DadosCsvParaRegistoRapido | null {
  try {
    const raw = localStorage.getItem(LS_KEY);
    if (!raw) return null;
    return JSON.parse(raw) as DadosCsvParaRegistoRapido;
  } catch {
    return null;
  }
}

export function limparDadosCsvDoStorage() {
  localStorage.removeItem(LS_KEY);
}

const CUBAS_PORTO = new Set(["VP01", "VP02", "VP03", "VP04", "VP05"]);

/** Converte data DD.MM.YYYY → YYYY-MM-DD */
function ddmmyyyyParaIso(dataStr: string): string {
  const m = dataStr.match(/^(\d{2})\.(\d{2})\.(\d{4})$/);
  if (!m) return new Date().toISOString().split("T")[0];
  return `${m[3]}-${m[2]}-${m[1]}`;
}

interface Props {
  open: boolean;
  onClose: () => void;
  onImportado?: () => void;
}

export default function ImportacaoCsvModal({ open, onClose, onImportado }: Props) {
  const [, navigate] = useLocation();
  const fileInputRef = useRef<HTMLInputElement>(null);
  const [etapa, setEtapa] = useState<"upload" | "preview">("upload");
  const [preview, setPreview] = useState<ResultadoPreview | null>(null);
  const [linhasSelecionadas, setLinhasSelecionadas] = useState<Set<number>>(new Set());
  const [mostrarIgnoradas, setMostrarIgnoradas] = useState(false);
  const [mostrarDuplicadas, setMostrarDuplicadas] = useState(false);

  const processarMutation = trpc.importacao.processarCsv.useMutation({
    onSuccess: (data) => {
      setPreview(data);
        // Seleccionar todas as linhas novas por defeito (por índice dentro de linhasNovas)
      const linhasNovasArr = data.linhasValidas.filter((l) => !l.duplicado);
      const novasSelecionadas = new Set(linhasNovasArr.map((_, i) => i));
      setLinhasSelecionadas(novasSelecionadas);
      setEtapa("preview");
    },
    onError: (err) => {
      toast.error("Erro ao processar CSV: " + err.message);
    },
  });

  function handleFileChange(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0];
    if (!file) return;
    const reader = new FileReader();
    reader.onload = (ev) => {
      const content = ev.target?.result as string;
      processarMutation.mutate({ csvContent: content });
    };
    reader.readAsText(file, "utf-8");
  }

  function handleDrop(e: React.DragEvent) {
    e.preventDefault();
    const file = e.dataTransfer.files[0];
    if (!file) return;
    const reader = new FileReader();
    reader.onload = (ev) => {
      const content = ev.target?.result as string;
      processarMutation.mutate({ csvContent: content });
    };
    reader.readAsText(file, "utf-8");
  }

  function toggleLinha(idx: number) {
    // idx é o índice dentro de linhasNovas (não do array original)
    setLinhasSelecionadas((prev) => {
      const next = new Set(prev);
      if (next.has(idx)) next.delete(idx);
      else next.add(idx);
      return next;
    });
  }

  function toggleTodas() {
    if (!preview) return;
    const todosNovasIdx = linhasNovas.map((_, i) => i);
    if (linhasSelecionadas.size === todosNovasIdx.length) {
      setLinhasSelecionadas(new Set());
    } else {
      setLinhasSelecionadas(new Set(todosNovasIdx));
    }
  }

  function handleIrParaRegistoRapido() {
    if (!preview) return;

    // Recolher as linhas seleccionadas de linhasNovas (por índice dentro de linhasNovas)
    const linhasSel = linhasNovas.filter((_, i) => linhasSelecionadas.has(i));

    if (linhasSel.length === 0) {
      toast.error("Seleccione pelo menos uma leitura para continuar.");
      return;
    }

    // Determinar a data: usar a data da primeira linha seleccionada
    const dataIso = ddmmyyyyParaIso(linhasSel[0].data);

    // Construir payload para o Registo Rápido
    const dadosCsv: DadosCsvParaRegistoRapido = {
      data: dataIso,
      cubas: linhasSel.map((l) => ({
        cubaCodigo: l.cubaCodigo,
        // 4 casas decimais para densidade
        densidade: l.densidade.toFixed(4),
        // 1 casa decimal para temperatura
        temperatura: l.temperatura.toFixed(1),
        // hora HH:MM:SS da medição
        hora: l.hora ?? "",
        isPorto: CUBAS_PORTO.has(l.cubaCodigo.toUpperCase()),
      })),
      importadoEm: new Date().toISOString(),
    };

    guardarDadosCsvNoStorage(dadosCsv);
    onImportado?.();
    handleFechar();
    navigate("/registo-rapido");
    toast.success(`${linhasSel.length} leitura${linhasSel.length !== 1 ? "s" : ""} pré-preenchida${linhasSel.length !== 1 ? "s" : ""} no Registo Rápido.`);
  }

  function handleFechar() {
    setEtapa("upload");
    setPreview(null);
    setLinhasSelecionadas(new Set());
    setMostrarIgnoradas(false);
    setMostrarDuplicadas(false);
    if (fileInputRef.current) fileInputRef.current.value = "";
    onClose();
  }

  const linhasNovas = preview?.linhasValidas.filter((l) => !l.duplicado) ?? [];
  const linhasDuplicadas = preview?.linhasValidas.filter((l) => l.duplicado) ?? [];


  return (
    <Dialog open={open} onOpenChange={handleFechar}>
      <DialogContent className="max-w-3xl max-h-[85vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <FileText className="w-5 h-5 text-amber-600" />
            Importar CSV da Máquina
          </DialogTitle>
        </DialogHeader>

        {/* ── Etapa 1: Upload ─────────────────────────────────────── */}
        {etapa === "upload" && (
          <div className="space-y-4">
            <p className="text-sm text-muted-foreground">
              Seleccione o ficheiro <strong>measureLog_export.csv</strong> exportado pela máquina de densimetria.
              O sistema irá ler as colunas: <strong>Data (B)</strong>, <strong>Cuba (E)</strong>,{" "}
              <strong>Densidade SG 20/20 (L)</strong> e <strong>Temperatura (O)</strong>.
            </p>
            <p className="text-xs text-blue-700 bg-blue-50 border border-blue-200 rounded-lg px-3 py-2">
              Os dados serão pré-preenchidos no <strong>Registo Rápido</strong> para revisão antes de serem guardados.
            </p>

            <div
              className="border-2 border-dashed border-border rounded-lg p-10 text-center cursor-pointer hover:border-amber-500 hover:bg-amber-50/10 transition-colors"
              onClick={() => fileInputRef.current?.click()}
              onDrop={handleDrop}
              onDragOver={(e) => e.preventDefault()}
            >
              <Upload className="w-10 h-10 mx-auto mb-3 text-muted-foreground" />
              <p className="text-sm font-medium">Clique ou arraste o ficheiro CSV aqui</p>
              <p className="text-xs text-muted-foreground mt-1">Formato: measureLog_export.csv (separador ;)</p>
              <input
                ref={fileInputRef}
                type="file"
                accept=".csv,.txt"
                className="hidden"
                onChange={handleFileChange}
              />
            </div>

            {processarMutation.isPending && (
              <div className="flex items-center gap-2 text-sm text-muted-foreground">
                <div className="w-4 h-4 border-2 border-amber-500 border-t-transparent rounded-full animate-spin" />
                A processar ficheiro…
              </div>
            )}
          </div>
        )}

        {/* ── Etapa 2: Preview ─────────────────────────────────────── */}
        {etapa === "preview" && preview && (
          <div className="space-y-4">
            {/* Resumo */}
            <div className="flex gap-3 flex-wrap">
              <Badge variant="outline" className="text-green-700 border-green-300 bg-green-50">
                <CheckCircle2 className="w-3 h-3 mr-1" />
                {linhasNovas.length} leitura{linhasNovas.length !== 1 ? "s" : ""} nova{linhasNovas.length !== 1 ? "s" : ""}
              </Badge>
              {linhasDuplicadas.length > 0 && (
                <Badge variant="outline" className="text-amber-700 border-amber-300 bg-amber-50">
                  <Copy className="w-3 h-3 mr-1" />
                  {linhasDuplicadas.length} duplicada{linhasDuplicadas.length !== 1 ? "s" : ""} (já existe)
                </Badge>
              )}
              {preview.linhasIgnoradas.length > 0 && (
                <Badge variant="outline" className="text-red-700 border-red-300 bg-red-50">
                  <AlertTriangle className="w-3 h-3 mr-1" />
                  {preview.linhasIgnoradas.length} ignorada{preview.linhasIgnoradas.length !== 1 ? "s" : ""}
                </Badge>
              )}
              <Badge variant="outline" className="text-muted-foreground">
                Total: {preview.totalLinhas} linhas
              </Badge>
            </div>

            {/* Tabela de leituras novas */}
            {linhasNovas.length > 0 && (
              <div>
                <div className="flex items-center justify-between mb-2">
                  <h4 className="text-sm font-semibold text-green-700">Leituras a pré-preencher no Registo Rápido</h4>
                  <Button variant="ghost" size="sm" onClick={toggleTodas} className="text-xs h-7">
                    {linhasSelecionadas.size === linhasNovas.length ? "Desseleccionar todas" : "Seleccionar todas"}
                  </Button>
                </div>
                <div className="border rounded-lg overflow-hidden">
                  <table className="w-full text-xs">
                    <thead className="bg-muted/50">
                      <tr>
                        <th className="p-2 text-left w-8"></th>
                        <th className="p-2 text-left">Cuba</th>
                        <th className="p-2 text-left">Data</th>
                        <th className="p-2 text-left">Hora</th>
                        <th className="p-2 text-right">Densidade (4 dec.)</th>
                        <th className="p-2 text-right">Temp. (°C)</th>
                      </tr>
                    </thead>
                    <tbody>
                      {linhasNovas.map((linha, i) => (
                        <tr
                          key={i}
                          className={`border-t cursor-pointer hover:bg-muted/30 transition-colors ${
                            linhasSelecionadas.has(i) ? "" : "opacity-40"
                          }`}
                          onClick={() => toggleLinha(i)}
                        >
                          <td className="p-2">
                            <input
                              type="checkbox"
                              checked={linhasSelecionadas.has(i)}
                              onChange={() => toggleLinha(i)}
                              onClick={(e) => e.stopPropagation()}
                              className="rounded"
                            />
                          </td>
                          <td className="p-2 font-medium">{linha.cubaCodigo}</td>
                          <td className="p-2">{linha.data}</td>
                          <td className="p-2 text-muted-foreground">{linha.hora}</td>
                          <td className="p-2 text-right font-mono">{linha.densidade.toFixed(4)}</td>
                          <td className="p-2 text-right font-mono">{linha.temperatura.toFixed(1)}</td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              </div>
            )}

            {/* Leituras duplicadas (colapsável) */}
            {linhasDuplicadas.length > 0 && (
              <div>
                <button
                  className="flex items-center gap-1 text-xs text-amber-600 hover:text-amber-800 transition-colors"
                  onClick={() => setMostrarDuplicadas(!mostrarDuplicadas)}
                >
                  {mostrarDuplicadas ? <ChevronUp className="w-3 h-3" /> : <ChevronDown className="w-3 h-3" />}
                  <Copy className="w-3 h-3" />
                  {mostrarDuplicadas ? "Ocultar" : "Ver"} leituras duplicadas ({linhasDuplicadas.length}) — já existem na BD, serão ignoradas
                </button>
                {mostrarDuplicadas && (
                  <div className="mt-2 border border-amber-200 rounded-lg overflow-hidden">
                    <table className="w-full text-xs">
                      <thead className="bg-amber-50">
                        <tr>
                          <th className="p-2 text-left">Cuba</th>
                          <th className="p-2 text-left">Data</th>
                          <th className="p-2 text-left">Hora</th>
                          <th className="p-2 text-right">Densidade</th>
                          <th className="p-2 text-right">Temp. (°C)</th>
                          <th className="p-2 text-center">Estado</th>
                        </tr>
                      </thead>
                      <tbody>
                        {linhasDuplicadas.map((linha, i) => (
                          <tr key={i} className="border-t bg-amber-50/30">
                            <td className="p-2 font-medium text-amber-800">{linha.cubaCodigo}</td>
                            <td className="p-2 text-amber-700">{linha.data}</td>
                            <td className="p-2 text-amber-600">{linha.hora}</td>
                            <td className="p-2 text-right font-mono text-amber-700">{linha.densidade.toFixed(4)}</td>
                            <td className="p-2 text-right font-mono text-amber-700">{linha.temperatura.toFixed(1)}</td>
                            <td className="p-2 text-center">
                              <Badge variant="outline" className="text-amber-700 border-amber-400 bg-amber-100 text-[10px]">
                                Já existe
                              </Badge>
                            </td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                )}
              </div>
            )}

            {/* Linhas ignoradas (colapsável) */}
            {preview.linhasIgnoradas.length > 0 && (
              <div>
                <button
                  className="flex items-center gap-1 text-xs text-muted-foreground hover:text-foreground transition-colors"
                  onClick={() => setMostrarIgnoradas(!mostrarIgnoradas)}
                >
                  {mostrarIgnoradas ? <ChevronUp className="w-3 h-3" /> : <ChevronDown className="w-3 h-3" />}
                  {mostrarIgnoradas ? "Ocultar" : "Ver"} linhas ignoradas ({preview.linhasIgnoradas.length})
                </button>
                {mostrarIgnoradas && (
                  <div className="mt-2 border rounded-lg overflow-hidden">
                    <table className="w-full text-xs">
                      <thead className="bg-red-50/50">
                        <tr>
                          <th className="p-2 text-left">Nº</th>
                          <th className="p-2 text-left">Motivo</th>
                        </tr>
                      </thead>
                      <tbody>
                        {preview.linhasIgnoradas.map((l, i) => (
                          <tr key={i} className="border-t">
                            <td className="p-2 text-muted-foreground">{l.measNo}</td>
                            <td className="p-2 text-red-700">{l.motivo}</td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                )}
              </div>
            )}

            {linhasNovas.length === 0 && linhasDuplicadas.length === 0 && (
              <div className="text-center py-6 text-muted-foreground">
                <AlertTriangle className="w-8 h-8 mx-auto mb-2 text-amber-500" />
                <p className="text-sm">Nenhuma leitura válida encontrada no ficheiro.</p>
              </div>
            )}

            {linhasNovas.length === 0 && linhasDuplicadas.length > 0 && (
              <div className="text-center py-4 text-amber-700 bg-amber-50 rounded-lg">
                <Copy className="w-8 h-8 mx-auto mb-2 text-amber-500" />
                <p className="text-sm font-medium">Todas as leituras já existem na base de dados.</p>
                <p className="text-xs text-muted-foreground mt-1">Nenhuma leitura nova para importar.</p>
              </div>
            )}
          </div>
        )}

        <DialogFooter className="gap-2">
          {etapa === "upload" && (
            <Button variant="outline" onClick={handleFechar}>Cancelar</Button>
          )}
          {etapa === "preview" && (
            <>
              <Button variant="outline" onClick={() => { setEtapa("upload"); setPreview(null); if (fileInputRef.current) fileInputRef.current.value = ""; }}>
                <X className="w-4 h-4 mr-1" /> Voltar
              </Button>
              <Button
                onClick={handleIrParaRegistoRapido}
                disabled={linhasSelecionadas.size === 0}
                className="bg-amber-600 hover:bg-amber-700 text-white"
              >
                <ArrowRight className="w-4 h-4 mr-1" />
                Ir para Registo Rápido ({linhasSelecionadas.size})
              </Button>
            </>
          )}
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
