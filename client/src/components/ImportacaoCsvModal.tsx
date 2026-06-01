import { useRef, useState } from "react";
import { Upload, FileText, CheckCircle2, AlertTriangle, X, ChevronDown, ChevronUp, Copy, Database } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from "@/components/ui/dialog";
import { Badge } from "@/components/ui/badge";
import { trpc } from "@/lib/trpc";
import { toast } from "sonner";

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
  isPorto?: boolean;
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

/** Estrutura guardada no localStorage para pré-preencher o Registo Rápido (mantida para compatibilidade) */
export interface DadosCsvParaRegistoRapido {
  data: string;
  cubas: {
    cubaCodigo: string;
    densidade: string;
    temperatura: string;
    hora: string;
    isPorto: boolean;
  }[];
  importadoEm: string;
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

interface Props {
  open: boolean;
  onClose: () => void;
  onImportado?: () => void;
}

type EtapaRegistar = "idle" | "a_registar" | "concluido";

export default function ImportacaoCsvModal({ open, onClose, onImportado }: Props) {
  const fileInputRef = useRef<HTMLInputElement>(null);
  const [etapa, setEtapa] = useState<"upload" | "preview">("upload");
  const [preview, setPreview] = useState<ResultadoPreview | null>(null);
  const [linhasSelecionadas, setLinhasSelecionadas] = useState<Set<number>>(new Set());
  const [mostrarIgnoradas, setMostrarIgnoradas] = useState(false);
  const [mostrarDuplicadas, setMostrarDuplicadas] = useState(false);
  const [etapaRegistar, setEtapaRegistar] = useState<EtapaRegistar>("idle");
  const [resultadoRegisto, setResultadoRegisto] = useState<{ criadas: number; ignoradas: number; erros: string[] } | null>(null);
  const [alertasCubasLimite, setAlertasCubasLimite] = useState<{ cubaId: number; codigo: string; nomeLote: string | null; densidadeAtual: string; densidadeLimite: string }[]>([]);

  const utils = trpc.useUtils();

  const processarMutation = trpc.importacao.processarCsv.useMutation({
    onSuccess: (data) => {
      setPreview(data);
      const linhasNovasArr = data.linhasValidas.filter((l) => !l.duplicado);
      const novasSelecionadas = new Set(linhasNovasArr.map((_, i) => i));
      setLinhasSelecionadas(novasSelecionadas);
      setEtapa("preview");
    },
    onError: (err) => {
      toast.error("Erro ao processar CSV: " + err.message);
    },
  });

  const terminarFermentacaoMutation = trpc.arquivo.terminarFermentacao.useMutation({
    onSuccess: (data) => {
      toast.success(`Fermentação Nº${data.fermentacaoArquivadaNum} terminada e arquivada! Email enviado.`);
      setAlertasCubasLimite((prev) => prev.slice(1));
    },
    onError: (e: { message: string }) => { toast.error("Erro ao terminar: " + e.message); setAlertasCubasLimite((prev) => prev.slice(1)); },
  });

  const confirmarMutation = trpc.importacao.confirmarCsv.useMutation({
    onSuccess: (data) => {
      setResultadoRegisto({ criadas: data.criadas, ignoradas: data.ignoradas, erros: data.erros });
      setEtapaRegistar("concluido");
      utils.cubas.dashboard.invalidate();
      utils.leituras.listAllDashboard.invalidate();
      onImportado?.();
      if (data.criadas > 0) {
        toast.success(`${data.criadas} leitura${data.criadas !== 1 ? "s" : ""} registada${data.criadas !== 1 ? "s" : ""} com sucesso.`);
      }
      if (data.erros.length > 0) {
        toast.error(`${data.erros.length} erro${data.erros.length !== 1 ? "s" : ""} ao registar.`);
      }
      // Verificar alertas de limite de densidade
      if (data.alertasCubas && data.alertasCubas.length > 0) {
        setAlertasCubasLimite(data.alertasCubas);
      }
    },
    onError: (err) => {
      setEtapaRegistar("idle");
      toast.error("Erro ao registar leituras: " + err.message);
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

  function handleRegistarDirectamente() {
    if (!preview) return;
    const linhasSel = linhasNovas.filter((_, i) => linhasSelecionadas.has(i));
    if (linhasSel.length === 0) {
      toast.error("Seleccione pelo menos uma leitura para registar.");
      return;
    }
    setEtapaRegistar("a_registar");
    confirmarMutation.mutate({
      linhas: linhasSel.map((l) => ({
        cubaId: l.cubaId,
        cubaCodigo: l.cubaCodigo,
        data: l.data,
        hora: l.hora,
        densidade: l.densidade,
        temperatura: l.temperatura,
        isPorto: l.isPorto ?? false,
      })),
    });
  }

  function handleFechar() {
    setEtapa("upload");
    setPreview(null);
    setLinhasSelecionadas(new Set());
    setMostrarIgnoradas(false);
    setMostrarDuplicadas(false);
    setEtapaRegistar("idle");
    setResultadoRegisto(null);
    if (fileInputRef.current) fileInputRef.current.value = "";
    onClose();
  }

  const linhasNovas = preview?.linhasValidas.filter((l) => !l.duplicado) ?? [];
  const linhasDuplicadas = preview?.linhasValidas.filter((l) => l.duplicado) ?? [];

  return (
    <>
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
              Poderá rever todas as leituras antes de as registar directamente na base de dados.
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

            {/* Resultado do registo (após confirmar) */}
            {etapaRegistar === "concluido" && resultadoRegisto && (
              <div className="rounded-lg border border-green-300 bg-green-50 p-4 space-y-2">
                <div className="flex items-center gap-2 text-green-700 font-semibold">
                  <CheckCircle2 className="w-5 h-5" />
                  Registo concluído
                </div>
                <p className="text-sm text-green-700">
                  <strong>{resultadoRegisto.criadas}</strong> leitura{resultadoRegisto.criadas !== 1 ? "s" : ""} registada{resultadoRegisto.criadas !== 1 ? "s" : ""} com sucesso.
                  {resultadoRegisto.ignoradas > 0 && ` ${resultadoRegisto.ignoradas} ignorada${resultadoRegisto.ignoradas !== 1 ? "s" : ""} (duplicadas).`}
                </p>
                {resultadoRegisto.erros.length > 0 && (
                  <div className="text-xs text-red-700 bg-red-50 rounded p-2 space-y-1">
                    {resultadoRegisto.erros.map((e, i) => <p key={i}>• {e}</p>)}
                  </div>
                )}
              </div>
            )}

            {/* Resumo */}
            {etapaRegistar !== "concluido" && (
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
            )}

            {/* Tabela de leituras novas */}
            {linhasNovas.length > 0 && etapaRegistar !== "concluido" && (
              <div>
                <div className="flex items-center justify-between mb-2">
                  <h4 className="text-sm font-semibold text-green-700">
                    Leituras novas — reveja e seleccione as que pretende registar
                  </h4>
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
                        <th className="p-2 text-center">Tipo</th>
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
                          <td className="p-2 text-center">
                            {linha.isPorto
                              ? <span className="text-[9px] font-bold bg-amber-800 text-amber-100 px-1 rounded">VP</span>
                              : <span className="text-[9px] text-muted-foreground">CF</span>
                            }
                          </td>
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

            {linhasNovas.length === 0 && linhasDuplicadas.length > 0 && etapaRegistar !== "concluido" && (
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
          {etapa === "preview" && etapaRegistar !== "concluido" && (
            <>
              <Button variant="outline" onClick={() => { setEtapa("upload"); setPreview(null); if (fileInputRef.current) fileInputRef.current.value = ""; }}>
                <X className="w-4 h-4 mr-1" /> Voltar
              </Button>
              <Button
                onClick={handleRegistarDirectamente}
                disabled={linhasSelecionadas.size === 0 || etapaRegistar === "a_registar"}
                className="bg-green-700 hover:bg-green-800 text-white"
              >
                {etapaRegistar === "a_registar" ? (
                  <>
                    <div className="w-4 h-4 border-2 border-white border-t-transparent rounded-full animate-spin mr-2" />
                    A registar…
                  </>
                ) : (
                  <>
                    <Database className="w-4 h-4 mr-1" />
                    Registar seleccionadas ({linhasSelecionadas.size})
                  </>
                )}
              </Button>
            </>
          )}
          {etapa === "preview" && etapaRegistar === "concluido" && (
            <Button onClick={handleFechar} className="bg-green-700 hover:bg-green-800 text-white">
              <CheckCircle2 className="w-4 h-4 mr-1" />
              Fechar
            </Button>
          )}
        </DialogFooter>
      </DialogContent>
    </Dialog>

    {/* Diálogo: Limite de densidade atingido (fila sequencial) */}
    {alertasCubasLimite.length > 0 && (
      <div className="fixed inset-0 z-[70] flex items-center justify-center bg-black/60 px-4">
        <div className="bg-white rounded-2xl shadow-2xl p-6 w-full max-w-md">
          <div className="flex items-center gap-3 mb-4">
            <div className="w-10 h-10 rounded-full bg-green-100 flex items-center justify-center">
              <CheckCircle2 size={20} className="text-green-700" />
            </div>
            <div>
              <h2 className="text-lg font-bold text-green-800">Limite de Densidade Atingido</h2>
              <p className="text-xs text-gray-500">
                {alertasCubasLimite[0].codigo.toUpperCase()}
                {alertasCubasLimite[0].nomeLote ? ` — ${alertasCubasLimite[0].nomeLote}` : ""}
              </p>
            </div>
          </div>
          <p className="text-sm text-gray-700 mb-2">
            A densidade registada{" "}
            <strong>{parseFloat(alertasCubasLimite[0].densidadeAtual).toFixed(4)}</strong> atingiu o limite
            configurado de <strong>{alertasCubasLimite[0].densidadeLimite}</strong>.
          </p>
          <p className="text-sm text-gray-600 mb-5">
            Deseja <strong>terminar a fermentação</strong> desta cuba? Será arquivada e enviado o relatório por email.
          </p>
          {alertasCubasLimite.length > 1 && (
            <p className="text-xs text-amber-600 mb-4">
              ⚠️ Mais {alertasCubasLimite.length - 1} cuba(s) atingiram o limite. Serão apresentadas a seguir.
            </p>
          )}
          <div className="flex gap-3 justify-end">
            <button
              onClick={() => setAlertasCubasLimite((prev) => prev.slice(1))}
              className="px-4 py-2 rounded-lg border border-gray-200 text-sm text-gray-600 hover:bg-gray-50"
            >
              Não, continuar
            </button>
            <button
              onClick={() => terminarFermentacaoMutation.mutate({
                cubaId: alertasCubasLimite[0].cubaId,
                nomeLote: alertasCubasLimite[0].nomeLote || undefined,
              })}
              disabled={terminarFermentacaoMutation.isPending}
              className="flex items-center gap-2 px-5 py-2 bg-[var(--color-vinho)] text-white rounded-lg text-sm font-semibold hover:opacity-90 disabled:opacity-50"
            >
              <CheckCircle2 size={14} />
              {terminarFermentacaoMutation.isPending ? "A terminar..." : "Sim, terminar fermentação"}
            </button>
          </div>
        </div>
      </div>
    )}
    </>
  );
}
