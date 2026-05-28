import { useAuth } from "@/_core/hooks/useAuth";
import { getLoginUrl } from "@/const";
import { trpc } from "@/lib/trpc";
import { useState, useMemo } from "react";
import { useParams } from "wouter";
import { toast } from "sonner";
import * as XLSX from "xlsx";
import {
  Archive,
  AlertTriangle,
  Bell,
  CheckCircle2,
  ChevronLeft,
  ChevronRight,
  Download,
  Edit2,
  FlaskConical,
  Pencil,
  Plus,
  RefreshCw,
  Save,
  Settings,
  Thermometer,
  Trash2,
  TrendingDown,
  Droplets,
  X,
  Zap,
} from "lucide-react";
import {
  LineChart,
  Line,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  Legend,
  ResponsiveContainer,
} from "recharts";
import { Link } from "wouter";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogFooter,
} from "@/components/ui/dialog";

// ── Cores fixas dos gráficos ──────────────────────────────
const CORES = {
  densL1: "#2e7d32",
  densL2: "#1565c0",
  densL3: "#c62828",
  o2: "#00838f",
  redox: "#6a1b9a",
  tempL1: "#2e7d32",
  tempL2: "#1565c0",
  tempL3: "#c62828",
};

// ── Tipos ─────────────────────────────────────────────────
type LeituraRow = {
  id: number;
  dataLeitura: Date | string;
  diaNr: number | null;
  densL1: string | null;
  densL2: string | null;
  densL3: string | null;
  tempL1: string | null;
  tempL2: string | null;
  tempL3: string | null;
  o2: string | null;
  redox: string | null;
  userName: string | null;
  editedAt: Date | null;
  editedByName: string | null;
};

// ── Helpers ───────────────────────────────────────────────
function calcularAlertasClient(params: {
  tempPretendida: string | null | undefined;
  desvioTempAlerta: string;
  desvioDesnsAlerta: string;
  leituras: LeituraRow[];
}): { leituraId: number; mensagens: string[] }[] {
  const desvioTemp = parseFloat(params.desvioTempAlerta) || 5;
  const desvioDesns = parseFloat(params.desvioDesnsAlerta) || 0.010;
  const resultado: { leituraId: number; mensagens: string[] }[] = [];

  for (let i = 0; i < params.leituras.length; i++) {
    const l = params.leituras[i];
    const mensagens: string[] = [];

    // Alerta de temperatura
    if (params.tempPretendida) {
      const pretendida = parseFloat(params.tempPretendida);
      const temps = [l.tempL1, l.tempL2, l.tempL3]
        .filter((t): t is string => t !== null && t !== undefined && t !== "")
        .map(parseFloat);
      for (const t of temps) {
        if (Math.abs(t - pretendida) > desvioTemp) {
          mensagens.push(
            `Temp. ${t.toFixed(1)}°C desvia ${Math.abs(t - pretendida).toFixed(1)}°C da pretendida (${pretendida.toFixed(1)}°C ± ${desvioTemp}°C)`
          );
          break;
        }
      }
    }

    // Alerta de variação brusca de densidade
    if (i > 0) {
      const anterior = params.leituras[i - 1];
      const pares: [string | null, string | null][] = [
        [anterior.densL1, l.densL1],
        [anterior.densL2, l.densL2],
        [anterior.densL3, l.densL3],
      ];
      for (const [ant, atual] of pares) {
        if (ant && atual && ant !== "" && atual !== "") {
          const diff = Math.abs(parseFloat(ant) - parseFloat(atual));
          if (diff > desvioDesns) {
            mensagens.push(
              `Variação brusca de densidade: ${diff.toFixed(3)} (limiar: ${desvioDesns.toFixed(3)})`
            );
            break;
          }
        }
      }
    }

    if (mensagens.length > 0) {
      resultado.push({ leituraId: l.id, mensagens });
    }
  }

  return resultado;
}

export default function CubaPage() {
  const params = useParams<{ codigo: string }>();
  const codigo = params.codigo;
  const { user, isAuthenticated } = useAuth();
  const utils = trpc.useUtils();

  // Estado do formulário de leitura
  const [form, setForm] = useState({
    dataLeitura: new Date().toISOString().split("T")[0],
    densL1: "", densL2: "", densL3: "",
    tempL1: "", tempL2: "", tempL3: "",
    o2: "", redox: "",
  });

  // Estado edição do nome
  const [editingNome, setEditingNome] = useState(false);
  const [nomeTemp, setNomeTemp] = useState("");

  // Estado modal Nova Fermentação
  const [showNovaFerm, setShowNovaFerm] = useState(false);
  const [nomeLoteNovo, setNomeLoteNovo] = useState("");

  // Estado modal Terminar Fermentação
  const [showTerminarFerm, setShowTerminarFerm] = useState(false);
  const [nomeLoteTerminar, setNomeLoteTerminar] = useState("");

  // Estado edição densidade limite
  const [editingLimite, setEditingLimite] = useState(false);
  const [limiteTemp, setLimiteTemp] = useState("");

  // Estado tab activa
  const [activeTab, setActiveTab] = useState<"leituras" | "graficos" | "adicoes" | "arquivo">("leituras");

  // Estado formulário de adição
  const [formAdicao, setFormAdicao] = useState({
    dataAdicao: new Date().toISOString().split("T")[0],
    produto: "", dose: "", observacoes: "",
  });

  // ── Estado: modal de edição de leitura ───────────────────
  const [editLeitura, setEditLeitura] = useState<LeituraRow | null>(null);
  const [editForm, setEditForm] = useState({
    densL1: "", densL2: "", densL3: "",
    tempL1: "", tempL2: "", tempL3: "",
    o2: "", redox: "",
  });

  // ── Estado: configurações de alerta ──────────────────────
  const [showAlertas, setShowAlertas] = useState(false);
  const [alertaForm, setAlertaForm] = useState({
    tempPretendida: "",
    desvioTempAlerta: "5.0",
    desvioDesnsAlerta: "0.010",
  });

  // ── Queries ───────────────────────────────────────────
  const { data: cuba, isLoading: loadingCuba } = trpc.cubas.get.useQuery(
    { codigo },
    { enabled: !!codigo }
  );

  const { data: leituras, isLoading: loadingLeituras } = trpc.leituras.listByCuba.useQuery(
    { cubaId: cuba?.id ?? 0, fermentacaoNum: cuba?.fermentacaoNum },
    { enabled: !!cuba?.id }
  );

  const { data: resumo } = trpc.leituras.resumo.useQuery(
    { cubaId: cuba?.id ?? 0, fermentacaoNum: cuba?.fermentacaoNum },
    { enabled: !!cuba?.id }
  );

  const { data: adicoes, isLoading: loadingAdicoes } = trpc.adicoes.listByCuba.useQuery(
    { cubaId: cuba?.id ?? 0, fermentacaoNum: cuba?.fermentacaoNum },
    { enabled: !!cuba?.id }
  );

  const { data: arquivo } = trpc.arquivo.listByCuba.useQuery(
    { cubaId: cuba?.id ?? 0 },
    { enabled: !!cuba?.id }
  );

  // Campanhas para filtro no arquivo
  const { data: todasCampanhas } = trpc.campanhas.list.useQuery();
  const { data: campanhaAtiva } = trpc.campanhas.ativa.useQuery();
  const [filtroCampanhaId, setFiltroCampanhaId] = useState<number | undefined>(undefined);
  const { data: arquivoCampanha } = trpc.campanhas.arquivoByCuba.useQuery(
    { cubaId: cuba?.id ?? 0, campanhaId: filtroCampanhaId },
    { enabled: !!cuba?.id }
  );
  const arquivoExibido = filtroCampanhaId !== undefined ? arquivoCampanha : arquivo;

  // ── Mutations ─────────────────────────────────────────
  const criarLeitura = trpc.leituras.create.useMutation({
    onSuccess: (data) => {
      let msg = "Leitura registada com sucesso!";
      if (data.fermentacaoCompleta) msg += " 🍷 Fermentação completa!";
      toast.success(msg);
      if (data.alertas && data.alertas.length > 0) {
        data.alertas.forEach((a) => toast.warning("⚠️ " + a));
      }
      setForm({ dataLeitura: new Date().toISOString().split("T")[0], densL1: "", densL2: "", densL3: "", tempL1: "", tempL2: "", tempL3: "", o2: "", redox: "" });
      utils.leituras.listByCuba.invalidate();
      utils.leituras.resumo.invalidate();
      utils.cubas.dashboard.invalidate();
      utils.cubas.get.invalidate();
    },
    onError: (e) => toast.error("Erro ao registar: " + e.message),
  });

  const editarLeitura = trpc.leituras.edit.useMutation({
    onSuccess: (data) => {
      toast.success("Leitura editada com sucesso!");
      if (data.alertas && data.alertas.length > 0) {
        data.alertas.forEach((a) => toast.warning("⚠️ " + a));
      }
      setEditLeitura(null);
      utils.leituras.listByCuba.invalidate();
      utils.leituras.resumo.invalidate();
      utils.cubas.get.invalidate();
    },
    onError: (e) => toast.error("Erro ao editar: " + e.message),
  });

  const updateNome = trpc.cubas.updateNome.useMutation({
    onSuccess: () => {
      toast.success("Nome atualizado!");
      setEditingNome(false);
      utils.cubas.get.invalidate();
      utils.cubas.dashboard.invalidate();
    },
  });

  const criarAdicao = trpc.adicoes.create.useMutation({
    onSuccess: () => {
      toast.success("Adição registada!");
      setFormAdicao({ dataAdicao: new Date().toISOString().split("T")[0], produto: "", dose: "", observacoes: "" });
      utils.adicoes.listByCuba.invalidate();
    },
    onError: (e) => toast.error("Erro: " + e.message),
  });

  const eliminarAdicao = trpc.adicoes.delete.useMutation({
    onSuccess: () => {
      toast.success("Adição eliminada.");
      utils.adicoes.listByCuba.invalidate();
    },
  });

  const updateDensidadeLimite = trpc.cubas.updateDensidadeLimite.useMutation({
    onSuccess: () => {
      toast.success("Densidade limite atualizada!");
      setEditingLimite(false);
      utils.cubas.get.invalidate();
    },
    onError: (e) => toast.error("Erro: " + e.message),
  });

  const updateAlertas = trpc.cubas.updateAlertas.useMutation({
    onSuccess: () => {
      toast.success("Configurações de alerta guardadas!");
      setShowAlertas(false);
      utils.cubas.get.invalidate();
    },
    onError: (e) => toast.error("Erro: " + e.message),
  });

  // ── Envio de relatório por email ────────────────────────────────────
  const enviarRelatorio = trpc.relatorio.enviarCuba.useMutation({
    onSuccess: (data) => {
      toast.success(`Relatório enviado para ${data.destinatario}!`);
    },
    onError: (e) => toast.error("Erro ao enviar relatório: " + e.message),
  });

  // Exportar Excel com gráficos via servidor
  const exportarExcelServidor = trpc.relatorio.exportarExcelCuba.useMutation({
    onSuccess: (data) => {
      const bytes = Uint8Array.from(atob(data.base64), (c) => c.charCodeAt(0));
      const blob = new Blob([bytes], { type: "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet" });
      const url = URL.createObjectURL(blob);
      const a = document.createElement("a");
      a.href = url;
      a.download = data.nomeFicheiro;
      a.click();
      URL.revokeObjectURL(url);
      toast.success("Excel com gráficos exportado!");
    },
    onError: (e) => toast.error("Erro ao exportar Excel: " + e.message),
  });

  // Terminar fermentação (arquivar + email automático)
  const terminarFermentacao = trpc.arquivo.novaFermentacao.useMutation({
    onSuccess: (data) => {
      toast.success(`Fermentação terminada e arquivada! Email enviado para geral@castelares.com. Nova fermentação Nº ${data.novaFermentacaoNum} iniciada.`);
      setShowTerminarFerm(false);
      setNomeLoteTerminar("");
      utils.cubas.get.invalidate();
      utils.leituras.listByCuba.invalidate();
      utils.leituras.resumo.invalidate();
      utils.arquivo.listByCuba.invalidate();
      utils.cubas.dashboard.invalidate();
    },
    onError: (e) => toast.error("Erro: " + e.message),
  });

  const novaFermentacao = trpc.arquivo.novaFermentacao.useMutation({
    onSuccess: (data) => {
      toast.success(`Fermentação arquivada! Nova fermentação Nº ${data.novaFermentacaoNum} iniciada.`);
      setShowNovaFerm(false);
      setNomeLoteNovo("");
      utils.cubas.get.invalidate();
      utils.leituras.listByCuba.invalidate();
      utils.leituras.resumo.invalidate();
      utils.arquivo.listByCuba.invalidate();
      utils.cubas.dashboard.invalidate();
    },
    onError: (e) => toast.error("Erro: " + e.message),
  });

  // ── Alertas calculados no cliente ─────────────────────
  const alertasAtivos = useMemo(() => {
    if (!leituras || !cuba) return [];
    return calcularAlertasClient({
      tempPretendida: cuba.tempPretendida,
      desvioTempAlerta: cuba.desvioTempAlerta ?? "5.0",
      desvioDesnsAlerta: cuba.desvioDesnsAlerta ?? "0.010",
      leituras: leituras as LeituraRow[],
    });
  }, [leituras, cuba]);

  // ── Dados para gráficos ───────────────────────────────
  const chartData = useMemo(() => {
    if (!leituras) return [];
    return leituras.map((l) => ({
      dia: l.diaNr ?? 0,
      densL1: l.densL1 ? parseFloat(l.densL1) : null,
      densL2: l.densL2 ? parseFloat(l.densL2) : null,
      densL3: l.densL3 ? parseFloat(l.densL3) : null,
      tempL1: l.tempL1 ? parseFloat(l.tempL1) : null,
      tempL2: l.tempL2 ? parseFloat(l.tempL2) : null,
      tempL3: l.tempL3 ? parseFloat(l.tempL3) : null,
      o2: l.o2 ? parseFloat(l.o2) : null,
      redox: l.redox ? parseFloat(l.redox) : null,
    }));
  }, [leituras]);

  const handleSubmitLeitura = () => {
    if (!cuba) return;
    if (!form.dataLeitura) { toast.error("Insira a data"); return; }
    const hasData = form.densL1 || form.densL2 || form.densL3 || form.o2 || form.redox;
    if (!hasData) { toast.error("Insira pelo menos um valor"); return; }

    criarLeitura.mutate({
      cubaId: cuba.id,
      fermentacaoNum: cuba.fermentacaoNum,
      dataLeitura: form.dataLeitura,
      densL1: form.densL1 || null,
      densL2: form.densL2 || null,
      densL3: form.densL3 || null,
      tempL1: form.tempL1 || null,
      tempL2: form.tempL2 || null,
      tempL3: form.tempL3 || null,
      o2: form.o2 || null,
      redox: form.redox || null,
    });
  };

  const abrirEdicaoLeitura = (l: LeituraRow) => {
    setEditLeitura(l);
    setEditForm({
      densL1: l.densL1 ?? "",
      densL2: l.densL2 ?? "",
      densL3: l.densL3 ?? "",
      tempL1: l.tempL1 ?? "",
      tempL2: l.tempL2 ?? "",
      tempL3: l.tempL3 ?? "",
      o2: l.o2 ?? "",
      redox: l.redox ?? "",
    });
  };

  const confirmarEdicaoLeitura = () => {
    if (!editLeitura) return;
    editarLeitura.mutate({
      id: editLeitura.id,
      densL1: editForm.densL1 || null,
      densL2: editForm.densL2 || null,
      densL3: editForm.densL3 || null,
      tempL1: editForm.tempL1 || null,
      tempL2: editForm.tempL2 || null,
      tempL3: editForm.tempL3 || null,
      o2: editForm.o2 || null,
      redox: editForm.redox || null,
    });
  };

  const abrirConfiguracaoAlertas = () => {
    if (!cuba) return;
    setAlertaForm({
      tempPretendida: cuba.tempPretendida ?? "",
      desvioTempAlerta: cuba.desvioTempAlerta ?? "5.0",
      desvioDesnsAlerta: cuba.desvioDesnsAlerta ?? "0.010",
    });
    setShowAlertas(true);
  };

  if (loadingCuba) {
    return (
      <div className="p-8 flex items-center justify-center">
        <div className="animate-spin w-8 h-8 border-2 border-[var(--color-vinho)] border-t-transparent rounded-full" />
      </div>
    );
  }

  if (!cuba) {
    return (
      <div className="p-8 text-center text-gray-500">
        <FlaskConical size={40} className="mx-auto mb-3 opacity-30" />
        <p>Cuba não encontrada</p>
      </div>
    );
  }

  // Navegação entre cubas (suporta cf, lf)
  const numCuba = parseInt(codigo.replace(/^[a-z]+/i, ""));
  const prefixo = codigo.replace(/\d+$/, "");
  const prevCuba = numCuba > 1 ? `${prefixo}${numCuba - 1}` : null;
  const nextCuba = `${prefixo}${numCuba + 1}`;

  // ── Exportação ────────────────────────────────────────
  const exportarExcel = () => {
    if (!leituras || !cuba) return;
    const nomeFicheiro = `${cuba.codigo}${cuba.nomeLote ? "_" + cuba.nomeLote.replace(/\s+/g, "_") : ""}_ferm${cuba.fermentacaoNum}`;

    const leiturasData = leituras.map((l) => ({
      "Data": new Date(l.dataLeitura).toLocaleDateString("pt-PT"),
      "Dia Nº": l.diaNr ?? "",
      "Dens. L1": l.densL1 ?? "",
      "Temp. L1 (°C)": l.tempL1 ?? "",
      "Dens. L2": l.densL2 ?? "",
      "Temp. L2 (°C)": l.tempL2 ?? "",
      "Dens. L3": l.densL3 ?? "",
      "Temp. L3 (°C)": l.tempL3 ?? "",
      "O₂ (mg/L)": l.o2 ?? "",
      "Redox (mV)": l.redox ?? "",
      "Registado por": l.userName ?? "",
      "Editado em": (l as LeituraRow).editedAt ? new Date((l as LeituraRow).editedAt!).toLocaleString("pt-PT") : "",
      "Editado por": (l as LeituraRow).editedByName ?? "",
    }));

    const wb = XLSX.utils.book_new();
    const wsLeituras = XLSX.utils.json_to_sheet(leiturasData);
    XLSX.utils.book_append_sheet(wb, wsLeituras, "Leituras");

    if (adicoes && adicoes.length > 0) {
      const adicoesData = adicoes.map((a) => ({
        "Data": new Date(a.dataAdicao).toLocaleDateString("pt-PT"),
        "Produto / Adição": a.produto ?? "",
        "Dose / Quantidade": a.dose ?? "",
        "Observações": a.observacoes ?? "",
        "Registado por": a.userName ?? "",
      }));
      const wsAdicoes = XLSX.utils.json_to_sheet(adicoesData);
      XLSX.utils.book_append_sheet(wb, wsAdicoes, "Adições e Notas");
    }

    XLSX.writeFile(wb, `${nomeFicheiro}.xlsx`);
    toast.success("Ficheiro Excel exportado!");
  };

  const exportarCSV = () => {
    if (!leituras || !cuba) return;
    const nomeFicheiro = `${cuba.codigo}${cuba.nomeLote ? "_" + cuba.nomeLote.replace(/\s+/g, "_") : ""}_ferm${cuba.fermentacaoNum}`;
    const leiturasData = leituras.map((l) => ({
      "Data": new Date(l.dataLeitura).toLocaleDateString("pt-PT"),
      "Dia Nº": l.diaNr ?? "",
      "Dens. L1": l.densL1 ?? "",
      "Temp. L1 (°C)": l.tempL1 ?? "",
      "Dens. L2": l.densL2 ?? "",
      "Temp. L2 (°C)": l.tempL2 ?? "",
      "Dens. L3": l.densL3 ?? "",
      "Temp. L3 (°C)": l.tempL3 ?? "",
      "O₂ (mg/L)": l.o2 ?? "",
      "Redox (mV)": l.redox ?? "",
      "Registado por": l.userName ?? "",
    }));
    const ws = XLSX.utils.json_to_sheet(leiturasData);
    const csv = XLSX.utils.sheet_to_csv(ws);
    const blob = new Blob(["\uFEFF" + csv], { type: "text/csv;charset=utf-8;" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = `${nomeFicheiro}.csv`;
    a.click();
    URL.revokeObjectURL(url);
    toast.success("Ficheiro CSV exportado!");
  };

  const totalAlertas = alertasAtivos.length;

  return (
    <div className="p-4 sm:p-6 lg:p-8 animate-fade-in">
      {/* Cabeçalho da cuba */}
      <div className="mb-6">
        {/* Navegação entre cubas */}
        <div className="flex items-center gap-2 mb-3">
          {prevCuba && (
            <Link href={`/cuba/${prevCuba}`}>
              <button className="flex items-center gap-1 text-xs text-gray-400 hover:text-[var(--color-vinho)] transition-colors">
                <ChevronLeft size={14} /> {prevCuba}
              </button>
            </Link>
          )}
          <span className="text-xs text-gray-300">|</span>
          <Link href={`/cuba/${nextCuba}`}>
            <button className="flex items-center gap-1 text-xs text-gray-400 hover:text-[var(--color-vinho)] transition-colors">
              {nextCuba} <ChevronRight size={14} />
            </button>
          </Link>
        </div>

        <div className="flex flex-col sm:flex-row sm:items-start gap-4">
          <div className="flex-1">
            <div className="flex items-center gap-3 mb-1">
              <div className="w-10 h-10 rounded-xl bg-[var(--color-vinho)] flex items-center justify-center">
                <FlaskConical size={20} className="text-[var(--color-dourado)]" />
              </div>
              <div>
                <p className="text-xs text-gray-400 font-mono uppercase tracking-widest">{cuba.codigo}</p>
                {editingNome ? (
                  <div className="flex items-center gap-2 mt-0.5">
                    <input
                      value={nomeTemp}
                      onChange={(e) => setNomeTemp(e.target.value)}
                      className="text-lg font-bold border-b-2 border-[var(--color-vinho)] outline-none bg-transparent text-[var(--color-vinho)] w-48"
                      autoFocus
                      onKeyDown={(e) => {
                        if (e.key === "Enter") updateNome.mutate({ id: cuba.id, nomeLote: nomeTemp });
                        if (e.key === "Escape") setEditingNome(false);
                      }}
                    />
                    <button onClick={() => updateNome.mutate({ id: cuba.id, nomeLote: nomeTemp })} className="text-green-600 hover:text-green-700">
                      <Save size={16} />
                    </button>
                  </div>
                ) : (
                  <div className="flex items-center gap-2">
                    <h1 className="text-xl font-bold text-[var(--color-vinho)]" style={{ fontFamily: "var(--font-serif)" }}>
                      {cuba.nomeLote || "Sem nome"}
                    </h1>
                    {isAuthenticated && (
                      <button
                        onClick={() => { setNomeTemp(cuba.nomeLote ?? ""); setEditingNome(true); }}
                        className="text-gray-300 hover:text-[var(--color-vinho)] transition-colors"
                      >
                        <Edit2 size={14} />
                      </button>
                    )}
                  </div>
                )}
              </div>
            </div>
            <div className="flex items-center gap-2 ml-13">
              <span className={`inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-xs font-medium border ${
                cuba.estado === "sem_dados" ? "bg-gray-100 text-gray-500 border-gray-200" :
                cuba.estado === "em_fermentacao" ? "bg-amber-50 text-amber-700 border-amber-200" :
                "bg-green-50 text-green-700 border-green-200"
              }`}>
                <span className={`w-1.5 h-1.5 rounded-full ${
                  cuba.estado === "sem_dados" ? "bg-gray-300" :
                  cuba.estado === "em_fermentacao" ? "bg-amber-400 animate-pulse" :
                  "bg-green-400"
                }`} />
                {cuba.estado === "sem_dados" ? "Sem dados" : cuba.estado === "em_fermentacao" ? "Em fermentação" : "Fermentação completa"}
              </span>
              <span className="text-xs text-gray-400">Fermentação Nº {cuba.fermentacaoNum}</span>
              {/* Badge de campanha ativa */}
              {campanhaAtiva && (
                <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-xs font-medium bg-[var(--color-vinho)]/10 text-[var(--color-vinho)] border border-[var(--color-vinho)]/20">
                  <span className="w-1.5 h-1.5 rounded-full bg-amber-400 animate-pulse" />
                  {campanhaAtiva.nome}
                </span>
              )}
              {/* Badge de alertas */}
              {totalAlertas > 0 && (
                <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-xs font-semibold bg-red-100 text-red-700 border border-red-200">
                  <AlertTriangle size={11} /> {totalAlertas} alerta{totalAlertas > 1 ? "s" : ""}
                </span>
              )}
            </div>
          </div>

          {/* Resumo + Ações */}
          <div className="flex flex-col gap-3 items-end">
            <div className="flex gap-3">
              <ResumoCard icon={<TrendingDown size={14} />} label="Dias" value={resumo?.totalDias ? `${resumo.totalDias}` : "—"} color="text-[var(--color-vinho)]" />
              <ResumoCard icon={<FlaskConical size={14} />} label="Dens. mín." value={resumo?.densMin ? resumo.densMin.toFixed(3) : "—"} color="text-green-700" />
              <ResumoCard icon={<Thermometer size={14} />} label="Temp. máx." value={resumo?.tempMax ? `${resumo.tempMax.toFixed(1)}°` : "—"} color="text-red-600" />
            </div>
            {/* Botões de exportação */}
            <div className="flex gap-2 flex-wrap justify-end">
              <button
                onClick={() => cuba && exportarExcelServidor.mutate({ codigo: cuba.codigo })}
                disabled={!leituras || leituras.length === 0 || exportarExcelServidor.isPending}
                title="Exporta Excel completo com gráficos (gerado no servidor)"
                className="flex items-center gap-1.5 px-3 py-1.5 bg-green-700 text-white rounded-lg text-xs font-medium hover:bg-green-800 transition-colors disabled:opacity-40"
              >
                {exportarExcelServidor.isPending ? <RefreshCw size={12} className="animate-spin" /> : <Download size={12} />}
                Excel
              </button>
              <button
                onClick={exportarCSV}
                disabled={!leituras || leituras.length === 0}
                className="flex items-center gap-1.5 px-3 py-1.5 bg-blue-700 text-white rounded-lg text-xs font-medium hover:bg-blue-800 transition-colors disabled:opacity-40"
              >
                <Download size={12} /> CSV
              </button>
              {isAuthenticated && (
                <button
                  onClick={() => enviarRelatorio.mutate({ codigo: cuba.codigo })}
                  disabled={enviarRelatorio.isPending || !leituras || leituras.length === 0}
                  title="Envia o relatório Excel com gráficos para geral@castelares.com"
                  className="flex items-center gap-1.5 px-3 py-1.5 bg-[var(--color-vinho)] text-white rounded-lg text-xs font-medium hover:opacity-90 transition-opacity disabled:opacity-40"
                >
                  {enviarRelatorio.isPending ? (
                    <><RefreshCw size={12} className="animate-spin" /> A enviar...</>
                  ) : (
                    <><Zap size={12} /> Enviar relatório</>
                  )}
                </button>
              )}
            </div>
            {/* Configurações: limite de densidade + alertas */}
            {isAuthenticated && (
              <div className="flex items-center gap-2 flex-wrap justify-end">
                <span className="text-xs text-gray-400">Limite de densidade:</span>
                {editingLimite ? (
                  <div className="flex items-center gap-1">
                    <input
                      type="number"
                      step="0.001"
                      value={limiteTemp}
                      onChange={(e) => setLimiteTemp(e.target.value)}
                      className="w-24 border border-[var(--color-vinho)] rounded-lg px-2 py-1 text-xs focus:outline-none"
                      autoFocus
                      onKeyDown={(e) => {
                        if (e.key === "Enter") updateDensidadeLimite.mutate({ id: cuba.id, densidadeLimite: limiteTemp });
                        if (e.key === "Escape") setEditingLimite(false);
                      }}
                    />
                    <button onClick={() => updateDensidadeLimite.mutate({ id: cuba.id, densidadeLimite: limiteTemp })} className="text-green-600 hover:text-green-700">
                      <Save size={14} />
                    </button>
                    <button onClick={() => setEditingLimite(false)} className="text-gray-400 hover:text-gray-600 text-xs">✕</button>
                  </div>
                ) : (
                  <button
                    onClick={() => { setLimiteTemp(cuba.densidadeLimite ?? "1.000"); setEditingLimite(true); }}
                    className="flex items-center gap-1 px-2.5 py-1 rounded-lg border border-gray-200 text-xs text-gray-600 hover:border-[var(--color-vinho)] hover:text-[var(--color-vinho)] transition-colors"
                  >
                    <Settings size={11} /> {cuba.densidadeLimite ?? "1.000"}
                  </button>
                )}
                {/* Botão de configuração de alertas */}
                <button
                  onClick={abrirConfiguracaoAlertas}
                  className={`flex items-center gap-1 px-2.5 py-1 rounded-lg border text-xs font-medium transition-colors ${
                    cuba.tempPretendida
                      ? "border-amber-300 text-amber-700 bg-amber-50 hover:bg-amber-100"
                      : "border-gray-200 text-gray-600 hover:border-amber-400 hover:text-amber-700"
                  }`}
                >
                  <Bell size={11} />
                  {cuba.tempPretendida ? `${parseFloat(cuba.tempPretendida).toFixed(1)}°C` : "Alertas"}
                </button>
              </div>
            )}
          </div>
        </div>
      </div>

      {/* Painel de alertas ativos */}
      {totalAlertas > 0 && (
        <div className="mb-5 bg-red-50 border border-red-200 rounded-2xl p-4 animate-fade-in">
          <div className="flex items-center gap-2 mb-3">
            <AlertTriangle size={16} className="text-red-600" />
            <h3 className="text-sm font-semibold text-red-700">
              {totalAlertas} alerta{totalAlertas > 1 ? "s" : ""} ativo{totalAlertas > 1 ? "s" : ""} nesta fermentação
            </h3>
          </div>
          <div className="space-y-2">
            {alertasAtivos.map(({ leituraId, mensagens }) => {
              const l = leituras?.find((x) => x.id === leituraId);
              const dataStr = l ? new Date(l.dataLeitura).toLocaleDateString("pt-PT") : "—";
              return (
                <div key={leituraId} className="bg-white border border-red-100 rounded-xl px-3 py-2">
                  <p className="text-xs font-medium text-red-600 mb-0.5">
                    Dia {l?.diaNr ?? "—"} — {dataStr}
                  </p>
                  {mensagens.map((m, i) => (
                    <p key={i} className="text-xs text-red-700">• {m}</p>
                  ))}
                </div>
              );
            })}
          </div>
        </div>
      )}

      {/* Formulário de entrada (só para autenticados) */}
      {isAuthenticated ? (
        <div className="bg-white rounded-2xl border border-gray-100 shadow-sm p-5 mb-6">
          <h2 className="text-sm font-semibold text-[var(--color-vinho)] mb-4 flex items-center gap-2">
            <Plus size={16} /> Registar leitura do dia
          </h2>
          <div className="grid grid-cols-2 sm:grid-cols-4 lg:grid-cols-6 gap-3">
            <div className="col-span-2 sm:col-span-1">
              <label className="block text-xs text-gray-500 mb-1">Data</label>
              <input type="date" value={form.dataLeitura}
                onChange={(e) => setForm({ ...form, dataLeitura: e.target.value })}
                className="w-full border border-gray-200 rounded-lg px-3 py-2 text-sm focus:outline-none focus:border-[var(--color-vinho)] focus:ring-1 focus:ring-[var(--color-vinho)]/20"
              />
            </div>
            <div>
              <label className="block text-xs font-medium mb-1" style={{ color: CORES.densL1 }}>Dens. L1</label>
              <input type="number" step="0.001" placeholder="1.085" value={form.densL1}
                onChange={(e) => setForm({ ...form, densL1: e.target.value })}
                className="w-full border border-gray-200 rounded-lg px-3 py-2 text-sm focus:outline-none focus:border-green-500"
              />
            </div>
            <div>
              <label className="block text-xs font-medium mb-1" style={{ color: CORES.tempL1 }}>Temp. L1 (°C)</label>
              <input type="number" step="0.1" placeholder="18.5" value={form.tempL1}
                onChange={(e) => setForm({ ...form, tempL1: e.target.value })}
                className="w-full border border-gray-200 rounded-lg px-3 py-2 text-sm focus:outline-none focus:border-green-500"
              />
            </div>
            <div>
              <label className="block text-xs font-medium mb-1" style={{ color: CORES.densL2 }}>Dens. L2</label>
              <input type="number" step="0.001" placeholder="1.082" value={form.densL2}
                onChange={(e) => setForm({ ...form, densL2: e.target.value })}
                className="w-full border border-gray-200 rounded-lg px-3 py-2 text-sm focus:outline-none focus:border-blue-500"
              />
            </div>
            <div>
              <label className="block text-xs font-medium mb-1" style={{ color: CORES.tempL2 }}>Temp. L2 (°C)</label>
              <input type="number" step="0.1" placeholder="19.0" value={form.tempL2}
                onChange={(e) => setForm({ ...form, tempL2: e.target.value })}
                className="w-full border border-gray-200 rounded-lg px-3 py-2 text-sm focus:outline-none focus:border-blue-500"
              />
            </div>
            <div>
              <label className="block text-xs font-medium mb-1" style={{ color: CORES.densL3 }}>Dens. L3</label>
              <input type="number" step="0.001" placeholder="1.080" value={form.densL3}
                onChange={(e) => setForm({ ...form, densL3: e.target.value })}
                className="w-full border border-gray-200 rounded-lg px-3 py-2 text-sm focus:outline-none focus:border-red-500"
              />
            </div>
            <div>
              <label className="block text-xs font-medium mb-1" style={{ color: CORES.tempL3 }}>Temp. L3 (°C)</label>
              <input type="number" step="0.1" placeholder="19.5" value={form.tempL3}
                onChange={(e) => setForm({ ...form, tempL3: e.target.value })}
                className="w-full border border-gray-200 rounded-lg px-3 py-2 text-sm focus:outline-none focus:border-red-500"
              />
            </div>
            <div>
              <label className="block text-xs font-medium mb-1" style={{ color: CORES.o2 }}>O₂ (mg/L)</label>
              <input type="number" step="0.01" placeholder="6.50" value={form.o2}
                onChange={(e) => setForm({ ...form, o2: e.target.value })}
                className="w-full border border-gray-200 rounded-lg px-3 py-2 text-sm focus:outline-none focus:border-cyan-500"
              />
            </div>
            <div>
              <label className="block text-xs font-medium mb-1" style={{ color: CORES.redox }}>Redox (mV)</label>
              <input type="number" step="1" placeholder="250" value={form.redox}
                onChange={(e) => setForm({ ...form, redox: e.target.value })}
                className="w-full border border-gray-200 rounded-lg px-3 py-2 text-sm focus:outline-none focus:border-purple-500"
              />
            </div>
          </div>
          <div className="flex items-center justify-between mt-4">
            <p className="text-xs text-gray-400">Registado por: <span className="font-medium">{user?.name ?? "—"}</span></p>
            <button
              onClick={handleSubmitLeitura}
              disabled={criarLeitura.isPending}
              className="flex items-center gap-2 px-5 py-2.5 bg-[var(--color-vinho)] text-white rounded-xl text-sm font-semibold hover:bg-[var(--color-vinho-light)] transition-colors disabled:opacity-50"
            >
              {criarLeitura.isPending ? <RefreshCw size={14} className="animate-spin" /> : <Save size={14} />}
              Guardar leitura
            </button>
          </div>
        </div>
      ) : (
        <div className="bg-amber-50 border border-amber-200 rounded-xl p-4 mb-6 text-sm text-amber-700 flex items-center gap-3">
          <FlaskConical size={16} />
          <span>Inicie sessão para registar leituras.</span>
          <a href={getLoginUrl()} className="ml-auto font-semibold underline">Entrar</a>
        </div>
      )}

      {/* Botão Terminar Fermentação — só visível quando em fermentação */}
      {isAuthenticated && cuba.estado === "em_fermentacao" && (
        <div className="mb-5 flex justify-end">
          <button
            onClick={() => { setNomeLoteTerminar(cuba.nomeLote ?? ""); setShowTerminarFerm(true); }}
            className="flex items-center gap-2 px-5 py-2.5 bg-green-700 text-white rounded-xl text-sm font-semibold hover:bg-green-800 transition-colors shadow-sm"
          >
            <CheckCircle2 size={16} /> Terminar Fermentação
          </button>
        </div>
      )}

      {/* Tabs */}
      <div className="flex gap-1 mb-4 bg-gray-100 rounded-xl p-1 w-fit">
        {(["leituras", "graficos", "adicoes", "arquivo"] as const).map((tab) => (
          <button
            key={tab}
            onClick={() => setActiveTab(tab)}
            className={`px-4 py-2 rounded-lg text-sm font-medium transition-all ${
              activeTab === tab
                ? "bg-white text-[var(--color-vinho)] shadow-sm"
                : "text-gray-500 hover:text-gray-700"
            }`}
          >
            {tab === "leituras" ? "Histórico" : tab === "graficos" ? "Gráficos" : tab === "adicoes" ? "Adições" : "Arquivo"}
          </button>
        ))}
      </div>

      {/* Tab: Histórico de leituras */}
      {activeTab === "leituras" && (
        <div className="bg-white rounded-2xl border border-gray-100 shadow-sm overflow-hidden animate-fade-in">
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="bg-[var(--color-vinho)] text-white">
                  <th className="px-3 py-3 text-left text-xs font-semibold">Data</th>
                  <th className="px-3 py-3 text-center text-xs font-semibold">Dia</th>
                  <th className="px-3 py-3 text-center text-xs font-semibold" style={{ color: "#a5d6a7" }}>Dens. L1</th>
                  <th className="px-3 py-3 text-center text-xs font-semibold" style={{ color: "#a5d6a7" }}>Temp. L1</th>
                  <th className="px-3 py-3 text-center text-xs font-semibold" style={{ color: "#90caf9" }}>Dens. L2</th>
                  <th className="px-3 py-3 text-center text-xs font-semibold" style={{ color: "#90caf9" }}>Temp. L2</th>
                  <th className="px-3 py-3 text-center text-xs font-semibold" style={{ color: "#ef9a9a" }}>Dens. L3</th>
                  <th className="px-3 py-3 text-center text-xs font-semibold" style={{ color: "#ef9a9a" }}>Temp. L3</th>
                  <th className="px-3 py-3 text-center text-xs font-semibold" style={{ color: "#80deea" }}>O₂</th>
                  <th className="px-3 py-3 text-center text-xs font-semibold" style={{ color: "#ce93d8" }}>Redox</th>
                  <th className="px-3 py-3 text-center text-xs font-semibold">Utilizador</th>
                  {isAuthenticated && <th className="px-3 py-3 text-center text-xs font-semibold">Editar</th>}
                </tr>
              </thead>
              <tbody>
                {loadingLeituras ? (
                  <tr><td colSpan={12} className="text-center py-8 text-gray-400">A carregar...</td></tr>
                ) : leituras?.length === 0 ? (
                  <tr><td colSpan={12} className="text-center py-8 text-gray-400">Sem leituras registadas</td></tr>
                ) : (
                  leituras?.map((l, idx) => {
                    const temAlerta = alertasAtivos.some((a) => a.leituraId === l.id);
                    const foiEditada = !!(l as LeituraRow).editedAt;
                    return (
                      <tr
                        key={l.id}
                        className={`${idx % 2 === 0 ? "bg-white" : "bg-gray-50"} ${temAlerta ? "border-l-4 border-red-400" : ""}`}
                      >
                        <td className="px-3 py-2.5 text-xs text-gray-600 whitespace-nowrap">
                          <div className="flex items-center gap-1">
                            {temAlerta && <AlertTriangle size={11} className="text-red-500 shrink-0" />}
                            {new Date(l.dataLeitura).toLocaleDateString("pt-PT")}
                          </div>
                        </td>
                        <td className="px-3 py-2.5 text-center text-xs font-bold text-[var(--color-vinho)]">{l.diaNr ?? "—"}</td>
                        <td className="px-3 py-2.5 text-center text-xs font-mono">{l.densL1 ? parseFloat(l.densL1).toFixed(3) : "—"}</td>
                        <td className="px-3 py-2.5 text-center text-xs font-mono">{l.tempL1 ? `${parseFloat(l.tempL1).toFixed(1)}°` : "—"}</td>
                        <td className="px-3 py-2.5 text-center text-xs font-mono">{l.densL2 ? parseFloat(l.densL2).toFixed(3) : "—"}</td>
                        <td className="px-3 py-2.5 text-center text-xs font-mono">{l.tempL2 ? `${parseFloat(l.tempL2).toFixed(1)}°` : "—"}</td>
                        <td className="px-3 py-2.5 text-center text-xs font-mono">{l.densL3 ? parseFloat(l.densL3).toFixed(3) : "—"}</td>
                        <td className="px-3 py-2.5 text-center text-xs font-mono">{l.tempL3 ? `${parseFloat(l.tempL3).toFixed(1)}°` : "—"}</td>
                        <td className="px-3 py-2.5 text-center text-xs font-mono" style={{ color: CORES.o2 }}>{l.o2 ? parseFloat(l.o2).toFixed(2) : "—"}</td>
                        <td className="px-3 py-2.5 text-center text-xs font-mono" style={{ color: CORES.redox }}>{l.redox ? parseFloat(l.redox).toFixed(0) : "—"}</td>
                        <td className="px-3 py-2.5 text-center text-xs text-gray-400">
                          <div className="flex flex-col items-center gap-0.5">
                            <span>{l.userName ?? "—"}</span>
                            {foiEditada && (
                              <span
                                className="text-[10px] text-amber-600 font-medium cursor-help"
                                title={`Editado por ${(l as LeituraRow).editedByName ?? "—"} em ${new Date((l as LeituraRow).editedAt!).toLocaleString("pt-PT")}`}
                              >
                                ✏ editado
                              </span>
                            )}
                          </div>
                        </td>
                        {isAuthenticated && (
                          <td className="px-3 py-2.5 text-center">
                            <button
                              onClick={() => abrirEdicaoLeitura(l as LeituraRow)}
                              className="text-gray-300 hover:text-[var(--color-vinho)] transition-colors"
                              title="Editar leitura"
                            >
                              <Pencil size={13} />
                            </button>
                          </td>
                        )}
                      </tr>
                    );
                  })
                )}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {/* Tab: Gráficos */}
      {activeTab === "graficos" && (
        <div className="space-y-6 animate-fade-in">
          {chartData.length === 0 ? (
            <div className="bg-white rounded-2xl border border-gray-100 p-12 text-center text-gray-400">
              <BarChart3 size={40} className="mx-auto mb-3 opacity-30" />
              <p className="text-sm">Sem dados para mostrar gráficos</p>
            </div>
          ) : (
            <>
              <ChartCard title="Densidade (g/L)">
                <ResponsiveContainer width="100%" height={280}>
                  <LineChart data={chartData} margin={{ top: 5, right: 20, left: 0, bottom: 5 }}>
                    <CartesianGrid strokeDasharray="3 3" stroke="#f0f0f0" />
                    <XAxis dataKey="dia" label={{ value: "Dia de fermentação", position: "insideBottom", offset: -2, fontSize: 11 }} tick={{ fontSize: 11 }} />
                    <YAxis tick={{ fontSize: 11 }} domain={["auto", "auto"]} />
                    <Tooltip formatter={(v: number) => v?.toFixed(3)} labelFormatter={(l) => `Dia ${l}`} />
                    <Legend />
                    <Line type="monotone" dataKey="densL1" name="L1" stroke={CORES.densL1} strokeWidth={2} dot={{ r: 4 }} connectNulls={false} />
                    <Line type="monotone" dataKey="densL2" name="L2" stroke={CORES.densL2} strokeWidth={2} dot={{ r: 4 }} connectNulls={false} />
                    <Line type="monotone" dataKey="densL3" name="L3" stroke={CORES.densL3} strokeWidth={2} dot={{ r: 4 }} connectNulls={false} />
                  </LineChart>
                </ResponsiveContainer>
              </ChartCard>

              <ChartCard title="Temperatura (°C)">
                <ResponsiveContainer width="100%" height={280}>
                  <LineChart data={chartData} margin={{ top: 5, right: 20, left: 0, bottom: 5 }}>
                    <CartesianGrid strokeDasharray="3 3" stroke="#f0f0f0" />
                    <XAxis dataKey="dia" label={{ value: "Dia de fermentação", position: "insideBottom", offset: -2, fontSize: 11 }} tick={{ fontSize: 11 }} />
                    <YAxis tick={{ fontSize: 11 }} domain={["auto", "auto"]} />
                    <Tooltip formatter={(v: number) => `${v?.toFixed(1)}°C`} labelFormatter={(l) => `Dia ${l}`} />
                    <Legend />
                    {cuba.tempPretendida && (
                      <Line type="monotone" dataKey={() => parseFloat(cuba.tempPretendida!)} name="Pretendida" stroke="#f59e0b" strokeWidth={1.5} strokeDasharray="6 3" dot={false} />
                    )}
                    <Line type="monotone" dataKey="tempL1" name="L1" stroke={CORES.tempL1} strokeWidth={2} dot={{ r: 4 }} connectNulls={false} />
                    <Line type="monotone" dataKey="tempL2" name="L2" stroke={CORES.tempL2} strokeWidth={2} dot={{ r: 4 }} connectNulls={false} />
                    <Line type="monotone" dataKey="tempL3" name="L3" stroke={CORES.tempL3} strokeWidth={2} dot={{ r: 4 }} connectNulls={false} />
                  </LineChart>
                </ResponsiveContainer>
              </ChartCard>

              <ChartCard title="O₂ Dissolvido (mg/L)">
                <ResponsiveContainer width="100%" height={220}>
                  <LineChart data={chartData} margin={{ top: 5, right: 20, left: 0, bottom: 5 }}>
                    <CartesianGrid strokeDasharray="3 3" stroke="#f0f0f0" />
                    <XAxis dataKey="dia" label={{ value: "Dia de fermentação", position: "insideBottom", offset: -2, fontSize: 11 }} tick={{ fontSize: 11 }} />
                    <YAxis tick={{ fontSize: 11 }} />
                    <Tooltip formatter={(v: number) => `${v?.toFixed(2)} mg/L`} labelFormatter={(l) => `Dia ${l}`} />
                    <Line type="monotone" dataKey="o2" name="O₂ Dissolvido" stroke={CORES.o2} strokeWidth={2.5} dot={{ r: 5, fill: CORES.o2 }} connectNulls={false} />
                  </LineChart>
                </ResponsiveContainer>
              </ChartCard>

              <ChartCard title="Potencial Redox (mV)">
                <ResponsiveContainer width="100%" height={220}>
                  <LineChart data={chartData} margin={{ top: 5, right: 20, left: 0, bottom: 5 }}>
                    <CartesianGrid strokeDasharray="3 3" stroke="#f0f0f0" />
                    <XAxis dataKey="dia" label={{ value: "Dia de fermentação", position: "insideBottom", offset: -2, fontSize: 11 }} tick={{ fontSize: 11 }} />
                    <YAxis tick={{ fontSize: 11 }} />
                    <Tooltip formatter={(v: number) => `${v?.toFixed(0)} mV`} labelFormatter={(l) => `Dia ${l}`} />
                    <Line type="monotone" dataKey="redox" name="Potencial Redox" stroke={CORES.redox} strokeWidth={2.5} dot={{ r: 5, fill: CORES.redox }} connectNulls={false} />
                  </LineChart>
                </ResponsiveContainer>
              </ChartCard>
            </>
          )}
        </div>
      )}

      {/* Tab: Adições e Notas */}
      {activeTab === "adicoes" && (
        <div className="space-y-4 animate-fade-in">
          {isAuthenticated && (
            <div className="bg-white rounded-2xl border border-gray-100 shadow-sm p-5">
              <h3 className="text-sm font-semibold text-[var(--color-vinho)] mb-4 flex items-center gap-2">
                <Plus size={16} /> Registar adição / nota
              </h3>
              <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
                <div>
                  <label className="block text-xs text-gray-500 mb-1">Data</label>
                  <input type="date" value={formAdicao.dataAdicao}
                    onChange={(e) => setFormAdicao({ ...formAdicao, dataAdicao: e.target.value })}
                    className="w-full border border-gray-200 rounded-lg px-3 py-2 text-sm focus:outline-none focus:border-[var(--color-vinho)]"
                  />
                </div>
                <div>
                  <label className="block text-xs text-gray-500 mb-1">Produto / Adição</label>
                  <input type="text" placeholder="ex: SO₂, Leveduras..." value={formAdicao.produto}
                    onChange={(e) => setFormAdicao({ ...formAdicao, produto: e.target.value })}
                    className="w-full border border-gray-200 rounded-lg px-3 py-2 text-sm focus:outline-none focus:border-[var(--color-vinho)]"
                  />
                </div>
                <div>
                  <label className="block text-xs text-gray-500 mb-1">Dose / Quantidade</label>
                  <input type="text" placeholder="ex: 5 g/hL" value={formAdicao.dose}
                    onChange={(e) => setFormAdicao({ ...formAdicao, dose: e.target.value })}
                    className="w-full border border-gray-200 rounded-lg px-3 py-2 text-sm focus:outline-none focus:border-[var(--color-vinho)]"
                  />
                </div>
                <div>
                  <label className="block text-xs text-gray-500 mb-1">Observações</label>
                  <input type="text" placeholder="Notas adicionais..." value={formAdicao.observacoes}
                    onChange={(e) => setFormAdicao({ ...formAdicao, observacoes: e.target.value })}
                    className="w-full border border-gray-200 rounded-lg px-3 py-2 text-sm focus:outline-none focus:border-[var(--color-vinho)]"
                  />
                </div>
              </div>
              <div className="flex justify-end mt-3">
                <button
                  onClick={() => {
                    if (!cuba || !formAdicao.dataAdicao) { toast.error("Insira a data"); return; }
                    criarAdicao.mutate({ cubaId: cuba.id, fermentacaoNum: cuba.fermentacaoNum, ...formAdicao });
                  }}
                  disabled={criarAdicao.isPending}
                  className="flex items-center gap-2 px-5 py-2.5 bg-[var(--color-vinho)] text-white rounded-xl text-sm font-semibold hover:bg-[var(--color-vinho-light)] transition-colors disabled:opacity-50"
                >
                  <Save size={14} /> Guardar
                </button>
              </div>
            </div>
          )}

          <div className="bg-white rounded-2xl border border-gray-100 shadow-sm overflow-hidden">
            <table className="w-full text-sm">
              <thead>
                <tr className="bg-[var(--color-vinho)] text-white">
                  <th className="px-4 py-3 text-left text-xs font-semibold">Data</th>
                  <th className="px-4 py-3 text-left text-xs font-semibold">Produto / Adição</th>
                  <th className="px-4 py-3 text-left text-xs font-semibold">Dose</th>
                  <th className="px-4 py-3 text-left text-xs font-semibold">Observações</th>
                  <th className="px-4 py-3 text-center text-xs font-semibold">Por</th>
                  {isAuthenticated && <th className="px-4 py-3" />}
                </tr>
              </thead>
              <tbody>
                {loadingAdicoes ? (
                  <tr><td colSpan={6} className="text-center py-8 text-gray-400">A carregar...</td></tr>
                ) : adicoes?.length === 0 ? (
                  <tr><td colSpan={6} className="text-center py-8 text-gray-400">Sem adições registadas</td></tr>
                ) : (
                  adicoes?.map((a, idx) => (
                    <tr key={a.id} className={idx % 2 === 0 ? "bg-white" : "bg-gray-50"}>
                      <td className="px-4 py-2.5 text-xs text-gray-600 whitespace-nowrap">
                        {new Date(a.dataAdicao).toLocaleDateString("pt-PT")}
                      </td>
                      <td className="px-4 py-2.5 text-xs font-medium text-gray-800">{a.produto ?? "—"}</td>
                      <td className="px-4 py-2.5 text-xs text-gray-600">{a.dose ?? "—"}</td>
                      <td className="px-4 py-2.5 text-xs text-gray-600">{a.observacoes ?? "—"}</td>
                      <td className="px-4 py-2.5 text-center text-xs text-gray-400">{a.userName ?? "—"}</td>
                      {isAuthenticated && (
                        <td className="px-4 py-2.5 text-center">
                          <button
                            onClick={() => {
                              if (confirm("Eliminar esta adição?")) eliminarAdicao.mutate({ id: a.id });
                            }}
                            className="text-gray-300 hover:text-red-500 transition-colors"
                          >
                            <Trash2 size={14} />
                          </button>
                        </td>
                      )}
                    </tr>
                  ))
                )}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {/* Tab: Arquivo */}
      {activeTab === "arquivo" && (
        <div className="space-y-4 animate-fade-in">
          <div className="flex flex-wrap items-center justify-between gap-3">
            {/* Filtro por campanha */}
            <div className="flex flex-wrap gap-2 items-center">
              <span className="text-xs text-gray-500 font-medium">Campanha:</span>
              <button
                onClick={() => setFiltroCampanhaId(undefined)}
                className={`px-3 py-1 rounded-lg text-xs font-medium border transition-all ${
                  filtroCampanhaId === undefined
                    ? "bg-[var(--color-vinho)] text-white border-[var(--color-vinho)]"
                    : "bg-white text-gray-600 border-gray-200 hover:border-gray-300"
                }`}
              >
                Todas
              </button>
              {todasCampanhas?.map((c) => (
                <button
                  key={c.id}
                  onClick={() => setFiltroCampanhaId(c.id)}
                  className={`px-3 py-1 rounded-lg text-xs font-medium border transition-all ${
                    filtroCampanhaId === c.id
                      ? "bg-[var(--color-vinho)] text-white border-[var(--color-vinho)]"
                      : "bg-white text-gray-600 border-gray-200 hover:border-gray-300"
                  }`}
                >
                  {c.nome}{c.ativa ? " ★" : ""}
                </button>
              ))}
            </div>
            {isAuthenticated && (
              <button
                onClick={() => setShowNovaFerm(true)}
                className="flex items-center gap-2 px-5 py-2.5 bg-amber-600 text-white rounded-xl text-sm font-semibold hover:bg-amber-700 transition-colors"
              >
                <RefreshCw size={14} /> Nova Fermentação
              </button>
            )}
          </div>

          {arquivoExibido?.length === 0 ? (
            <div className="bg-white rounded-2xl border border-gray-100 p-12 text-center text-gray-400">
              <Archive size={40} className="mx-auto mb-3 opacity-30" />
              <p className="text-sm">Sem fermentações arquivadas</p>
            </div>
          ) : (
            <div className="space-y-3">
              {arquivoExibido?.map((arq) => (
                <div key={arq.id} className="bg-white rounded-2xl border border-gray-100 shadow-sm p-5">
                  <div className="flex items-start justify-between mb-3">
                    <div>
                      <p className="text-xs text-gray-400 font-mono">Fermentação Nº {arq.fermentacaoNum}</p>
                      <h3 className="font-semibold text-[var(--color-vinho)]" style={{ fontFamily: "var(--font-serif)" }}>
                        {arq.nomeLote ?? "Sem nome"}
                      </h3>
                    </div>
                    <div className="flex flex-col items-end gap-2">
                      <span className="text-xs text-gray-400">
                        {arq.dataInicio ? new Date(arq.dataInicio).toLocaleDateString("pt-PT") : "—"} →{" "}
                        {arq.dataFim ? new Date(arq.dataFim).toLocaleDateString("pt-PT") : "—"}
                      </span>
                      <Link href={`/cuba/${codigo}/arquivo/${arq.fermentacaoNum}`}>
                        <button className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-[var(--color-vinho)] text-white text-xs font-semibold hover:bg-[var(--color-vinho-light)] transition-colors">
                          <Archive size={12} /> Ver detalhe completo
                        </button>
                      </Link>
                    </div>
                  </div>
                  <div className="flex gap-4">
                    <div className="text-center">
                      <p className="text-xl font-bold text-[var(--color-vinho)]">{arq.totalDias ?? "—"}</p>
                      <p className="text-xs text-gray-400">dias</p>
                    </div>
                    <div className="text-center">
                      <p className="text-xl font-bold text-green-700">{arq.densMin ? parseFloat(arq.densMin).toFixed(3) : "—"}</p>
                      <p className="text-xs text-gray-400">dens. mín.</p>
                    </div>
                    <div className="text-center">
                      <p className="text-xl font-bold text-red-600">{arq.tempMax ? `${parseFloat(arq.tempMax).toFixed(1)}°` : "—"}</p>
                      <p className="text-xs text-gray-400">temp. máx.</p>
                    </div>
                  </div>
                  <div className="flex items-center justify-between mt-2">
                    {arq.archivedBy && (
                      <p className="text-xs text-gray-400">Arquivado por: {arq.archivedBy}</p>
                    )}
                    {arq.campanhaId && todasCampanhas && (
                      <span className="text-xs bg-[var(--color-vinho)]/10 text-[var(--color-vinho)] px-2 py-0.5 rounded-full font-medium">
                        {todasCampanhas.find((c) => c.id === arq.campanhaId)?.nome ?? `Campanha #${arq.campanhaId}`}
                      </span>
                    )}
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>
      )}

      {/* Modal Terminar Fermentação */}
      {showTerminarFerm && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 px-4">
          <div className="bg-white rounded-2xl shadow-2xl p-6 w-full max-w-md animate-fade-in">
            <div className="flex items-center gap-3 mb-3">
              <div className="w-10 h-10 rounded-full bg-green-100 flex items-center justify-center">
                <CheckCircle2 size={20} className="text-green-700" />
              </div>
              <div>
                <h2 className="text-lg font-bold text-green-800" style={{ fontFamily: "var(--font-serif)" }}>
                  Terminar Fermentação
                </h2>
                <p className="text-xs text-gray-500">{cuba.codigo.toUpperCase()}</p>
              </div>
            </div>
            <p className="text-sm text-gray-600 mb-4">
              A fermentação será <strong>arquivada permanentemente</strong> e um email com o relatório completo (gráficos, leituras e adições) será enviado automaticamente para <strong>geral@castelares.com</strong>.
            </p>
            <div className="mb-4">
              <label className="block text-xs text-gray-500 mb-1">Nome / Lote desta fermentação (para o arquivo)</label>
              <input
                type="text"
                placeholder="ex: Tinto Reserva 2025"
                value={nomeLoteTerminar}
                onChange={(e) => setNomeLoteTerminar(e.target.value)}
                className="w-full border border-gray-200 rounded-lg px-3 py-2 text-sm focus:outline-none focus:border-green-600"
              />
            </div>
            <div className="bg-amber-50 border border-amber-200 rounded-lg p-3 mb-4">
              <p className="text-xs text-amber-700">⚠️ Esta ação não pode ser revertida. Certifique-se de que todos os dados estão registados.</p>
            </div>
            <div className="flex gap-3 justify-end">
              <button
                onClick={() => setShowTerminarFerm(false)}
                className="px-4 py-2 rounded-lg border border-gray-200 text-sm text-gray-600 hover:bg-gray-50"
              >
                Cancelar
              </button>
              <button
                onClick={() => terminarFermentacao.mutate({ cubaId: cuba.id, nomeLoteNovo: nomeLoteTerminar || undefined })}
                disabled={terminarFermentacao.isPending}
                className="flex items-center gap-2 px-5 py-2 bg-green-700 text-white rounded-lg text-sm font-semibold hover:bg-green-800 disabled:opacity-50"
              >
                {terminarFermentacao.isPending ? <RefreshCw size={14} className="animate-spin" /> : <CheckCircle2 size={14} />}
                Confirmar e terminar
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Modal Nova Fermentação */}
      {showNovaFerm && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 px-4">
          <div className="bg-white rounded-2xl shadow-2xl p-6 w-full max-w-md animate-fade-in">
            <h2 className="text-lg font-bold text-[var(--color-vinho)] mb-2" style={{ fontFamily: "var(--font-serif)" }}>
              Nova Fermentação — {cuba.codigo}
            </h2>
            <p className="text-sm text-gray-500 mb-4">
              O histórico atual será <strong>arquivado permanentemente</strong>. A cuba ficará pronta para uma nova fermentação. Esta ação não pode ser revertida.
            </p>
            <div className="mb-4">
              <label className="block text-xs text-gray-500 mb-1">Nome / Lote da nova fermentação (opcional)</label>
              <input
                type="text"
                placeholder="ex: Tinto Reserva 2026"
                value={nomeLoteNovo}
                onChange={(e) => setNomeLoteNovo(e.target.value)}
                className="w-full border border-gray-200 rounded-lg px-3 py-2 text-sm focus:outline-none focus:border-[var(--color-vinho)]"
              />
            </div>
            <div className="flex gap-3 justify-end">
              <button
                onClick={() => setShowNovaFerm(false)}
                className="px-4 py-2 rounded-lg border border-gray-200 text-sm text-gray-600 hover:bg-gray-50"
              >
                Cancelar
              </button>
              <button
                onClick={() => novaFermentacao.mutate({ cubaId: cuba.id, nomeLoteNovo: nomeLoteNovo || undefined })}
                disabled={novaFermentacao.isPending}
                className="flex items-center gap-2 px-5 py-2 bg-amber-600 text-white rounded-lg text-sm font-semibold hover:bg-amber-700 disabled:opacity-50"
              >
                {novaFermentacao.isPending ? <RefreshCw size={14} className="animate-spin" /> : <Archive size={14} />}
                Arquivar e reiniciar
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Modal: Edição de leitura */}
      <Dialog open={!!editLeitura} onOpenChange={(open) => { if (!open) setEditLeitura(null); }}>
        <DialogContent className="max-w-lg">
          <DialogHeader>
            <DialogTitle className="text-[var(--color-vinho)]" style={{ fontFamily: "var(--font-serif)" }}>
              Editar leitura — {editLeitura ? new Date(editLeitura.dataLeitura).toLocaleDateString("pt-PT") : ""}
            </DialogTitle>
          </DialogHeader>
          <div className="py-2">
            <p className="text-xs text-gray-500 mb-4">
              A edição fica registada com o seu nome e a data/hora da alteração.
            </p>
            <div className="grid grid-cols-2 gap-3">
              <div>
                <label className="block text-xs font-medium mb-1" style={{ color: CORES.densL1 }}>Dens. L1</label>
                <input type="number" step="0.001" value={editForm.densL1}
                  onChange={(e) => setEditForm({ ...editForm, densL1: e.target.value })}
                  className="w-full border border-gray-200 rounded-lg px-3 py-2 text-sm focus:outline-none focus:border-green-500"
                />
              </div>
              <div>
                <label className="block text-xs font-medium mb-1" style={{ color: CORES.tempL1 }}>Temp. L1 (°C)</label>
                <input type="number" step="0.1" value={editForm.tempL1}
                  onChange={(e) => setEditForm({ ...editForm, tempL1: e.target.value })}
                  className="w-full border border-gray-200 rounded-lg px-3 py-2 text-sm focus:outline-none focus:border-green-500"
                />
              </div>
              <div>
                <label className="block text-xs font-medium mb-1" style={{ color: CORES.densL2 }}>Dens. L2</label>
                <input type="number" step="0.001" value={editForm.densL2}
                  onChange={(e) => setEditForm({ ...editForm, densL2: e.target.value })}
                  className="w-full border border-gray-200 rounded-lg px-3 py-2 text-sm focus:outline-none focus:border-blue-500"
                />
              </div>
              <div>
                <label className="block text-xs font-medium mb-1" style={{ color: CORES.tempL2 }}>Temp. L2 (°C)</label>
                <input type="number" step="0.1" value={editForm.tempL2}
                  onChange={(e) => setEditForm({ ...editForm, tempL2: e.target.value })}
                  className="w-full border border-gray-200 rounded-lg px-3 py-2 text-sm focus:outline-none focus:border-blue-500"
                />
              </div>
              <div>
                <label className="block text-xs font-medium mb-1" style={{ color: CORES.densL3 }}>Dens. L3</label>
                <input type="number" step="0.001" value={editForm.densL3}
                  onChange={(e) => setEditForm({ ...editForm, densL3: e.target.value })}
                  className="w-full border border-gray-200 rounded-lg px-3 py-2 text-sm focus:outline-none focus:border-red-500"
                />
              </div>
              <div>
                <label className="block text-xs font-medium mb-1" style={{ color: CORES.tempL3 }}>Temp. L3 (°C)</label>
                <input type="number" step="0.1" value={editForm.tempL3}
                  onChange={(e) => setEditForm({ ...editForm, tempL3: e.target.value })}
                  className="w-full border border-gray-200 rounded-lg px-3 py-2 text-sm focus:outline-none focus:border-red-500"
                />
              </div>
              <div>
                <label className="block text-xs font-medium mb-1" style={{ color: CORES.o2 }}>O₂ (mg/L)</label>
                <input type="number" step="0.01" value={editForm.o2}
                  onChange={(e) => setEditForm({ ...editForm, o2: e.target.value })}
                  className="w-full border border-gray-200 rounded-lg px-3 py-2 text-sm focus:outline-none focus:border-cyan-500"
                />
              </div>
              <div>
                <label className="block text-xs font-medium mb-1" style={{ color: CORES.redox }}>Redox (mV)</label>
                <input type="number" step="1" value={editForm.redox}
                  onChange={(e) => setEditForm({ ...editForm, redox: e.target.value })}
                  className="w-full border border-gray-200 rounded-lg px-3 py-2 text-sm focus:outline-none focus:border-purple-500"
                />
              </div>
            </div>
          </div>
          <DialogFooter>
            <button
              onClick={() => setEditLeitura(null)}
              className="px-4 py-2 rounded-lg border border-gray-200 text-sm text-gray-600 hover:bg-gray-50"
            >
              Cancelar
            </button>
            <button
              onClick={confirmarEdicaoLeitura}
              disabled={editarLeitura.isPending}
              className="flex items-center gap-2 px-5 py-2 bg-[var(--color-vinho)] text-white rounded-lg text-sm font-semibold hover:bg-[var(--color-vinho-light)] disabled:opacity-50"
            >
              {editarLeitura.isPending ? <RefreshCw size={14} className="animate-spin" /> : <Save size={14} />}
              Guardar alterações
            </button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Modal: Configurações de alertas */}
      <Dialog open={showAlertas} onOpenChange={setShowAlertas}>
        <DialogContent className="max-w-md">
          <DialogHeader>
            <DialogTitle className="text-[var(--color-vinho)] flex items-center gap-2" style={{ fontFamily: "var(--font-serif)" }}>
              <Bell size={18} /> Configurações de Alertas — {cuba.codigo}
            </DialogTitle>
          </DialogHeader>
          <div className="py-2 space-y-5">
            {/* Temperatura pretendida */}
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">
                Temperatura de fermentação pretendida (°C)
              </label>
              <input
                type="number"
                step="0.1"
                placeholder="ex: 18.0"
                value={alertaForm.tempPretendida}
                onChange={(e) => setAlertaForm({ ...alertaForm, tempPretendida: e.target.value })}
                className="w-full border border-gray-200 rounded-lg px-3 py-2 text-sm focus:outline-none focus:border-amber-500"
              />
              <p className="text-xs text-gray-400 mt-1">Deixe em branco para desativar o alerta de temperatura.</p>
            </div>

            {/* Desvio de temperatura */}
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">
                Desvio máximo de temperatura (°C)
              </label>
              <input
                type="number"
                step="0.5"
                min="0.5"
                value={alertaForm.desvioTempAlerta}
                onChange={(e) => setAlertaForm({ ...alertaForm, desvioTempAlerta: e.target.value })}
                className="w-full border border-gray-200 rounded-lg px-3 py-2 text-sm focus:outline-none focus:border-amber-500"
              />
              <p className="text-xs text-gray-400 mt-1">
                Alerta quando a temperatura registada se afastar mais de {alertaForm.desvioTempAlerta}°C da pretendida.
              </p>
            </div>

            {/* Desvio de densidade */}
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">
                Variação máxima de densidade entre leituras consecutivas
              </label>
              <input
                type="number"
                step="0.001"
                min="0.001"
                value={alertaForm.desvioDesnsAlerta}
                onChange={(e) => setAlertaForm({ ...alertaForm, desvioDesnsAlerta: e.target.value })}
                className="w-full border border-gray-200 rounded-lg px-3 py-2 text-sm focus:outline-none focus:border-amber-500"
              />
              <p className="text-xs text-gray-400 mt-1">
                Alerta quando a densidade variar mais de {alertaForm.desvioDesnsAlerta} entre dois dias consecutivos (ex: 0.010 = 10 pontos).
              </p>
            </div>
          </div>
          <DialogFooter>
            <button
              onClick={() => setShowAlertas(false)}
              className="px-4 py-2 rounded-lg border border-gray-200 text-sm text-gray-600 hover:bg-gray-50"
            >
              Cancelar
            </button>
            <button
              onClick={() => {
                if (!cuba) return;
                updateAlertas.mutate({
                  id: cuba.id,
                  tempPretendida: alertaForm.tempPretendida || null,
                  desvioTempAlerta: alertaForm.desvioTempAlerta,
                  desvioDesnsAlerta: alertaForm.desvioDesnsAlerta,
                });
              }}
              disabled={updateAlertas.isPending}
              className="flex items-center gap-2 px-5 py-2 bg-amber-600 text-white rounded-lg text-sm font-semibold hover:bg-amber-700 disabled:opacity-50"
            >
              {updateAlertas.isPending ? <RefreshCw size={14} className="animate-spin" /> : <Bell size={14} />}
              Guardar configurações
            </button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}

// ── Componentes auxiliares ────────────────────────────────
function ResumoCard({ icon, label, value, color }: { icon: React.ReactNode; label: string; value: string; color: string }) {
  return (
    <div className="bg-white rounded-xl border border-gray-100 shadow-sm px-4 py-3 text-center min-w-[72px]">
      <div className={`flex items-center justify-center gap-1 text-xs text-gray-400 mb-1`}>{icon} {label}</div>
      <p className={`text-lg font-bold ${color}`}>{value}</p>
    </div>
  );
}

function ChartCard({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <div className="bg-white rounded-2xl border border-gray-100 shadow-sm p-5">
      <h3 className="text-sm font-semibold text-[var(--color-vinho)] mb-4">{title}</h3>
      {children}
    </div>
  );
}

function BarChart3({ size, className }: { size: number; className?: string }) {
  return <svg xmlns="http://www.w3.org/2000/svg" width={size} height={size} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className={className}><line x1="18" y1="20" x2="18" y2="10"/><line x1="12" y1="20" x2="12" y2="4"/><line x1="6" y1="20" x2="6" y2="14"/><line x1="2" y1="20" x2="22" y2="20"/></svg>;
}
