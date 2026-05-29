import { useState, useRef } from "react";
import { Upload, FileText, CheckCircle2, AlertTriangle, X, ChevronDown, ChevronUp } from "lucide-react";
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

interface Props {
  open: boolean;
  onClose: () => void;
  onImportado?: () => void;
}

export default function ImportacaoCsvModal({ open, onClose, onImportado }: Props) {
  const fileInputRef = useRef<HTMLInputElement>(null);
  const [etapa, setEtapa] = useState<"upload" | "preview" | "sucesso">("upload");
  const [preview, setPreview] = useState<ResultadoPreview | null>(null);
  const [linhasSelecionadas, setLinhasSelecionadas] = useState<Set<number>>(new Set());
  const [mostrarIgnoradas, setMostrarIgnoradas] = useState(false);
  const [resultadoFinal, setResultadoFinal] = useState<{ criadas: number; erros: string[] } | null>(null);

  const processarMutation = trpc.importacao.processarCsv.useMutation({
    onSuccess: (data) => {
      setPreview(data);
      // Seleccionar todas as linhas válidas por defeito
      setLinhasSelecionadas(new Set(data.linhasValidas.map((_, i) => i)));
      setEtapa("preview");
    },
    onError: (err) => {
      toast.error("Erro ao processar CSV: " + err.message);
    },
  });

  const confirmarMutation = trpc.importacao.confirmarCsv.useMutation({
    onSuccess: (data) => {
      setResultadoFinal(data);
      setEtapa("sucesso");
      if (data.criadas > 0) {
        onImportado?.();
      }
    },
    onError: (err) => {
      toast.error("Erro ao importar: " + err.message);
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
    if (linhasSelecionadas.size === preview.linhasValidas.length) {
      setLinhasSelecionadas(new Set());
    } else {
      setLinhasSelecionadas(new Set(preview.linhasValidas.map((_, i) => i)));
    }
  }

  function handleConfirmar() {
    if (!preview) return;
    const linhas = preview.linhasValidas
      .filter((_, i) => linhasSelecionadas.has(i))
      .map((l) => ({
        cubaId: l.cubaId,
        cubaCodigo: l.cubaCodigo,
        data: l.data,
        hora: l.hora,
        densidade: l.densidade,
        temperatura: l.temperatura,
      }));
    confirmarMutation.mutate({ linhas });
  }

  function handleFechar() {
    setEtapa("upload");
    setPreview(null);
    setLinhasSelecionadas(new Set());
    setResultadoFinal(null);
    setMostrarIgnoradas(false);
    if (fileInputRef.current) fileInputRef.current.value = "";
    onClose();
  }

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
                {preview.linhasValidas.length} leituras a importar
              </Badge>
              {preview.linhasIgnoradas.length > 0 && (
                <Badge variant="outline" className="text-amber-700 border-amber-300 bg-amber-50">
                  <AlertTriangle className="w-3 h-3 mr-1" />
                  {preview.linhasIgnoradas.length} linhas ignoradas
                </Badge>
              )}
              <Badge variant="outline" className="text-muted-foreground">
                Total: {preview.totalLinhas} linhas
              </Badge>
            </div>

            {/* Tabela de leituras válidas */}
            {preview.linhasValidas.length > 0 && (
              <div>
                <div className="flex items-center justify-between mb-2">
                  <h4 className="text-sm font-semibold">Leituras a criar</h4>
                  <Button variant="ghost" size="sm" onClick={toggleTodas} className="text-xs h-7">
                    {linhasSelecionadas.size === preview.linhasValidas.length ? "Desseleccionar todas" : "Seleccionar todas"}
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
                        <th className="p-2 text-right">Densidade</th>
                        <th className="p-2 text-right">Temp. (°C)</th>
                        <th className="p-2 text-right">Dia Ferm.</th>
                      </tr>
                    </thead>
                    <tbody>
                      {preview.linhasValidas.map((linha, i) => (
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
                          <td className="p-2 text-right text-muted-foreground">{linha.diaFermentacao ?? "—"}</td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
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
                      <thead className="bg-amber-50/50">
                        <tr>
                          <th className="p-2 text-left">Nº</th>
                          <th className="p-2 text-left">Motivo</th>
                        </tr>
                      </thead>
                      <tbody>
                        {preview.linhasIgnoradas.map((l, i) => (
                          <tr key={i} className="border-t">
                            <td className="p-2 text-muted-foreground">{l.measNo}</td>
                            <td className="p-2 text-amber-700">{l.motivo}</td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                )}
              </div>
            )}

            {preview.linhasValidas.length === 0 && (
              <div className="text-center py-6 text-muted-foreground">
                <AlertTriangle className="w-8 h-8 mx-auto mb-2 text-amber-500" />
                <p className="text-sm">Nenhuma leitura válida encontrada no ficheiro.</p>
              </div>
            )}
          </div>
        )}

        {/* ── Etapa 3: Sucesso ─────────────────────────────────────── */}
        {etapa === "sucesso" && resultadoFinal && (
          <div className="text-center py-6 space-y-3">
            <CheckCircle2 className="w-12 h-12 mx-auto text-green-500" />
            <h3 className="text-lg font-semibold">Importação concluída</h3>
            <p className="text-sm text-muted-foreground">
              <strong>{resultadoFinal.criadas}</strong> leitura{resultadoFinal.criadas !== 1 ? "s" : ""} criada{resultadoFinal.criadas !== 1 ? "s" : ""} com sucesso.
            </p>
            {resultadoFinal.erros.length > 0 && (
              <div className="text-left mt-3 p-3 bg-red-50 rounded-lg">
                <p className="text-xs font-semibold text-red-700 mb-1">Erros ({resultadoFinal.erros.length}):</p>
                {resultadoFinal.erros.map((e, i) => (
                  <p key={i} className="text-xs text-red-600">{e}</p>
                ))}
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
                onClick={handleConfirmar}
                disabled={linhasSelecionadas.size === 0 || confirmarMutation.isPending}
                className="bg-amber-600 hover:bg-amber-700 text-white"
              >
                {confirmarMutation.isPending ? (
                  <><div className="w-4 h-4 border-2 border-white border-t-transparent rounded-full animate-spin mr-2" />A importar…</>
                ) : (
                  <><CheckCircle2 className="w-4 h-4 mr-1" />Confirmar Importação ({linhasSelecionadas.size})</>
                )}
              </Button>
            </>
          )}
          {etapa === "sucesso" && (
            <Button onClick={handleFechar} className="bg-green-600 hover:bg-green-700 text-white">
              Fechar
            </Button>
          )}
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
