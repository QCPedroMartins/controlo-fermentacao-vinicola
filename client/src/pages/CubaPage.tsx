import { useAuth } from "@/_core/hooks/useAuth";
import { usePodeEditar } from "@/hooks/usePodeEditar";
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
  ClipboardList,
} from "lucide-react";
import { ArrowRightLeft, GitMerge } from "lucide-react";
import {
  LineChart,
  Line,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  Legend,
  ResponsiveContainer,
  ReferenceLine,
} from "recharts";
import { Link } from "wouter";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogFooter,
} from "@/components/ui/dialog";

import CalculadoraCorrecao from "@/components/CalculadoraCorrecao";
import CalculadoraBaumeEnvasilhamento from "@/components/CalculadoraBaumeEnvasilhamento";

// ── Cores fixas dos gráficos ──────────────────────────────
const CORES = {
  densL1: "#2e7d32",
  o2: "#00838f",
  redox: "#6a1b9a",
  tempL1: "#2e7d32",
};

// ── Tipos ─────────────────────────────────────────────────
type LeituraRow = {
  id: number;
  dataLeitura: Date | string;
  hora?: string | null;
  diaNr: number | null;
  densL1: string | null;
  baumeL1?: string | null;
  tempL1: string | null;
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
  alertasDensidade?: string | null;
  pontoAguardentacao?: string | null;
  desvioAguardentacaoAlerta?: string | null;
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
      const temps = [l.tempL1]
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
      ];
      for (const [ant, atual] of pares) {
        if (ant && atual && ant !== "" && atual !== "") {
          const diff = Math.abs(parseFloat(ant) - parseFloat(atual));
          if (diff > desvioDesns) {
            mensagens.push(
              `Variação brusca de densidade: ${diff.toFixed(4)} (limiar: ${desvioDesns.toFixed(4)})`
            );
            break;
          }
        }
      }
    }

    // Alertas de densidade por valor específico
    if (params.alertasDensidade) {
      try {
        const valoresAlerta: number[] = JSON.parse(params.alertasDensidade);
        const densidades = [l.densL1]
          .filter((d): d is string => !!d && d !== "").map(parseFloat);
        const anteriores = i > 0
          ? [params.leituras[i-1].densL1]
              .filter((d): d is string => !!d && d !== "").map(parseFloat)
          : [];
        for (const limiar of valoresAlerta) {
          const cruzou = densidades.some((d) => d <= limiar);
          const jaCruzado = anteriores.some((d) => d <= limiar);
          if (cruzou && !jaCruzado) {
            mensagens.push(`Densidade atingiu o valor de alerta: ${limiar.toFixed(4)}`);
          }
        }
      } catch { /* JSON inválido */ }
    }

    // Alerta de aguardentação (Baumé — cubas VP)
    if (params.pontoAguardentacao) {
      const ponto = parseFloat(params.pontoAguardentacao);
      const desvioAg = parseFloat(params.desvioAguardentacaoAlerta ?? "0.50") || 0.5;
      const baumes = [l.baumeL1]
        .filter((b): b is string => !!b && b !== "").map(parseFloat);
      for (const b of baumes) {
        if (Math.abs(b - ponto) <= desvioAg) {
          mensagens.push(`⚠️ AGUARDENTAÇÃO: Baumé ${b.toFixed(2)}° está no ponto de aguardentação (${ponto.toFixed(2)}° ± ${desvioAg.toFixed(2)}°) — adicionar aguardente!`);
          break;
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
  const canEdit = usePodeEditar();
  const utils = trpc.useUtils();

  // Estado do formulário de leitura
  const [form, setForm] = useState({
    dataLeitura: new Date().toISOString().split("T")[0],
    densL1: "",
    tempL1: "",
    o2: "", redox: "",
    baumeL1: "",
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


  // Estado modal Transferência/Junção
  const [showTransferir, setShowTransferir] = useState(false);
  const [tipoMovimento, setTipoMovimento] = useState<"transferencia" | "juncao">("transferencia");
  const [cubaDestinoId, setCubaDestinoId] = useState<number>(0);
  const [cubasJuncaoIds, setCubasJuncaoIds] = useState<number[]>([]);
  const [dataMovimento, setDataMovimento] = useState(() => new Date().toISOString().slice(0, 10));
  // Estado para N destinos na transferência
  const [destinosTransferencia, setDestinosTransferencia] = useState<{ cubaId: number; cubaCodigo: string; litros: string }[]>([
    { cubaId: 0, cubaCodigo: "", litros: "" },
  ]);
  const [restaOrigem, setRestaOrigem] = useState(false);
  const [motivoMovimento, setMotivoMovimento] = useState("");
  // Litros por cuba de origem na junção
  const [litrosPorOrigem, setLitrosPorOrigem] = useState<Record<number, string>>({});
  // Aviso de sobras após junção
  const [sobrasAviso, setSobrasAviso] = useState<{ cubaId: number; codigo: string; litrosDisponiveis: number; litrosTransferidos: number; litrosSobrantes: number }[]>([]);
  // Estado alerta de limite de densidade atingido
  const [alertaLimiteDens, setAlertaLimiteDens] = useState<{ densidadeAtual: string; densidadeLimite: string } | null>(null);

  // Estado edição densidade limite
  const [editingLimite, setEditingLimite] = useState(false);
  const [limiteTemp, setLimiteTemp] = useState("");

  // Estado tab activa
  const [activeTab, setActiveTab] = useState<"leituras" | "graficos" | "adicoes" | "movimentos" | "arquivo">("leituras");

  // Estado formulário de adição
  const [formAdicao, setFormAdicao] = useState({
    dataAdicao: new Date().toISOString().split("T")[0],
    produto: "", dose: "", observacoes: "",
  });

  // ── Estado: modal de edição de leitura ───────────────────
  const [editLeitura, setEditLeitura] = useState<LeituraRow | null>(null);
  const [editForm, setEditForm] = useState({
    densL1: "",
    tempL1: "",
    o2: "", redox: "",
    baumeL1: "",
  });

  // ── Estado: ficha inicial ─────────────────────────────────
  const [showFichaInicial, setShowFichaInicial] = useState(false);
  const [fichaForm, setFichaForm] = useState({
    fichaKilos: "", fichaLitros: "",
    fichaPh: "", fichaAt: "", fichaAv: "",
    fichaNfa: "", fichaNtu: "",
    fichaGluconico: "", fichaAlcoolProvavel: "",
  });

  // ── Estado: configurações de alerta ──────────────────────
  const [showAlertas, setShowAlertas] = useState(false);
  const [alertaForm, setAlertaForm] = useState({
    tempPretendida: "",
    desvioTempAlerta: "5.0",
    desvioDesnsAlerta: "0.010",
    alertasDensidadeStr: "",
    pontoAguardentacao: "",
    desvioAguardentacaoAlerta: "0.50",
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
      toast.success(msg);
      if (data.alertas && data.alertas.length > 0) {
        data.alertas.forEach((a) => toast.warning("⚠️ " + a));
      }
      // Verificar se atingiu o limite de densidade
      if (data.fermentacaoCompleta && cuba && cuba.estado !== "completa") {
        setAlertaLimiteDens({
          densidadeAtual: form.densL1 || form.baumeL1 || "",
          densidadeLimite: cuba.densidadeLimite ?? "0.990",
        });
      }
      setForm({ dataLeitura: new Date().toISOString().split("T")[0], densL1: "", tempL1: "", o2: "", redox: "", baumeL1: "" });
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

  const updateFichaInicial = trpc.cubas.updateFichaInicial.useMutation({
    onSuccess: () => {
      toast.success("Ficha inicial guardada!");
      setShowFichaInicial(false);
      utils.cubas.get.invalidate();
    },
    onError: (e) => toast.error("Erro: " + e.message),
  });

  const abrirFichaInicial = () => {
    if (!cuba) return;
    setFichaForm({
      fichaKilos: cuba.fichaKilos ?? "",
      fichaLitros: cuba.fichaLitros ?? "",
      fichaPh: cuba.fichaPh ?? "",
      fichaAt: cuba.fichaAt ?? "",
      fichaAv: cuba.fichaAv ?? "",
      fichaNfa: cuba.fichaNfa ?? "",
      fichaNtu: cuba.fichaNtu ?? "",
      fichaGluconico: cuba.fichaGluconico ?? "",
      fichaAlcoolProvavel: cuba.fichaAlcoolProvavel ?? "",
    });
    setShowFichaInicial(true);
  };

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

  // Exportar PDF via servidor
  const exportarPdfServidor = trpc.relatorio.exportarPdfCuba.useMutation({
    onSuccess: (data) => {
      const bytes = Uint8Array.from(atob(data.base64), (c) => c.charCodeAt(0));
      const blob = new Blob([bytes], { type: "application/pdf" });
      const url = URL.createObjectURL(blob);
      const a = document.createElement("a");
      a.href = url;
      a.download = data.nomeFicheiro;
      a.click();
      URL.revokeObjectURL(url);
      toast.success("PDF exportado!");
    },
    onError: (e) => toast.error("Erro ao exportar PDF: " + e.message),
  });

  const { data: todasCubasLista } = trpc.cubas.list.useQuery();
  const { data: movimentosCuba } = trpc.movimentos.byCuba.useQuery({ cubaId: cuba?.id ?? 0 }, { enabled: !!cuba?.id });
  const { data: historicoAnalises } = trpc.cubas.getAnalises.useQuery({ cubaId: cuba?.id ?? 0 }, { enabled: !!cuba?.id });

  const transferirMutation = trpc.movimentos.transferir.useMutation({
    onSuccess: (data) => {
      const destStr = data.destinos.map((d: string) => d.toUpperCase()).join(", ");
      toast.success(`Transferência concluída: ${data.origemCodigo.toUpperCase()} → ${destStr}`);
      utils.cubas.get.invalidate({ codigo });
      utils.leituras.listByCuba.invalidate();
      utils.cubas.dashboard.invalidate();
      setShowTransferir(false);
      setDestinosTransferencia([{ cubaId: 0, cubaCodigo: "", litros: "" }]);
      setRestaOrigem(false);
    },
    onError: (err) => toast.error(`Erro na transferência: ${err.message}`),
  });

  const juntarMutation = trpc.movimentos.juntar.useMutation({
    onSuccess: (data) => {
      if (data.sobras && data.sobras.length > 0) {
        setSobrasAviso(data.sobras);
        toast.warning(`Junção concluída com sobras! Verifique o aviso abaixo.`);
      } else {
        toast.success(`Junção concluída → ${data.destinoCodigo.toUpperCase()} (${data.litrosTotal ? data.litrosTotal.toLocaleString("pt-PT") + " L" : data.kgTotal.toLocaleString("pt-PT") + " kg"})`);
        setShowTransferir(false);
      }
      utils.cubas.get.invalidate({ codigo });
      utils.leituras.listByCuba.invalidate();
      utils.cubas.dashboard.invalidate();
    },
    onError: (err) => toast.error(`Erro na junção: ${err.message}`),
  });

  // Terminar fermentação: arquiva, envia email, estado=completa (fermentacaoNum não muda)
  const terminarFermentacao = trpc.arquivo.terminarFermentacao.useMutation({
    onSuccess: (data) => {
      toast.success(`Fermentação Nº${data.fermentacaoArquivadaNum} terminada e arquivada! Email enviado para geral@castelares.com.`);
      setShowTerminarFerm(false);
      setNomeLoteTerminar("");
      utils.cubas.get.invalidate();
      utils.leituras.listByCuba.invalidate();
      utils.leituras.resumo.invalidate();
      utils.arquivo.listByCuba.invalidate();
      utils.cubas.dashboard.invalidate();
    },
    onError: (e: { message: string }) => toast.error("Erro: " + e.message),
  });

  // Iniciar nova fermentação: só disponível quando estado=completa, incrementa num, estado=em_fermentacao
  const novaFermentacao = trpc.arquivo.novaFermentacao.useMutation({
    onSuccess: (data) => {
      toast.success(`Nova fermentação Nº${data.novaFermentacaoNum} iniciada!`);
      setShowNovaFerm(false);
      setNomeLoteNovo("");
      utils.cubas.get.invalidate();
      utils.leituras.listByCuba.invalidate();
      utils.leituras.resumo.invalidate();
      utils.arquivo.listByCuba.invalidate();
      utils.cubas.dashboard.invalidate();
    },
    onError: (e: { message: string }) => toast.error("Erro: " + e.message),
  });

  // ── Alertas calculados no cliente ─────────────────────
  const alertasAtivos = useMemo(() => {
    if (!leituras || !cuba) return [];
    return calcularAlertasClient({
      tempPretendida: cuba.tempPretendida,
      desvioTempAlerta: cuba.desvioTempAlerta ?? "5.0",
      desvioDesnsAlerta: cuba.desvioDesnsAlerta ?? "0.010",
      alertasDensidade: cuba.alertasDensidade,
      pontoAguardentacao: cuba.pontoAguardentacao,
      desvioAguardentacaoAlerta: cuba.desvioAguardentacaoAlerta,
      leituras: leituras as LeituraRow[],
    });
  }, [leituras, cuba]);

  // ── Marcadores de adições nos gráficos ────────────────────────
  const adicaoMarkers = useMemo(() => {
    if (!adicoes || !leituras) return [];
    // Para cada adição, encontrar o dia mais próximo nas leituras
    return adicoes.map((a) => {
      const dataAdicao = new Date(a.dataAdicao).getTime();
      let closestDia = 1;
      let minDiff = Infinity;
      for (const l of leituras) {
        const diff = Math.abs(new Date(l.dataLeitura).getTime() - dataAdicao);
        if (diff < minDiff) {
          minDiff = diff;
          closestDia = l.diaNr ?? 1;
        }
      }
      return {
        dia: closestDia,
        label: a.produto ? a.produto.substring(0, 12) : "Nota",
        full: a.produto ? `${a.produto}${a.dose ? " " + a.dose : ""}` : (a.observacoes?.substring(0, 30) ?? "Nota"),
      };
    });
  }, [adicoes, leituras]);

  // ── Dados para gráficos ───────────────────────────────
  const chartData = useMemo(() => {
    if (!leituras) return [];
    return leituras.map((l) => ({
      dia: l.diaNr ?? 0,
      densL1: l.densL1 ? parseFloat(l.densL1) : null,
      tempL1: l.tempL1 ? parseFloat(l.tempL1) : null,
      o2: l.o2 ? parseFloat(l.o2) : null,
      redox: l.redox ? parseFloat(l.redox) : null,
      baumeL1: (l as LeituraRow).baumeL1 ? parseFloat((l as LeituraRow).baumeL1!) : null,
    }));
  }, [leituras]);

  const handleSubmitLeitura = () => {
    if (!cuba) return;
    if (!form.dataLeitura) { toast.error("Insira a data"); return; }
    const isPorto = cuba.tipoCuba === "porto";
    const hasData = isPorto
      ? form.baumeL1
      : (form.densL1 || form.o2 || form.redox);
    if (!hasData) { toast.error("Insira pelo menos um valor"); return; }

    criarLeitura.mutate({
      cubaId: cuba.id,
      fermentacaoNum: cuba.fermentacaoNum,
      dataLeitura: form.dataLeitura,
      densL1: form.densL1 || null,
      tempL1: form.tempL1 || null,
      o2: form.o2 || null,
      redox: form.redox || null,
      baumeL1: form.baumeL1 || null,
    });
  };

  const abrirEdicaoLeitura = (l: LeituraRow) => {
    setEditLeitura(l);
    setEditForm({
      densL1: l.densL1 ?? "",
      tempL1: l.tempL1 ?? "",
      o2: l.o2 ?? "",
      redox: l.redox ?? "",
      baumeL1: l.baumeL1 ?? "",
    });
  };

  const confirmarEdicaoLeitura = () => {
    if (!editLeitura) return;
    editarLeitura.mutate({
      id: editLeitura.id,
      densL1: editForm.densL1 || null,
      tempL1: editForm.tempL1 || null,
      o2: editForm.o2 || null,
      redox: editForm.redox || null,
      baumeL1: editForm.baumeL1 || null,
    });
  };

  const abrirConfiguracaoAlertas = () => {
    if (!cuba) return;
    let alertasDensidadeStr = "";
    if (cuba.alertasDensidade) {
      try {
        const arr: number[] = JSON.parse(cuba.alertasDensidade);
        alertasDensidadeStr = arr.join(", ");
      } catch { /* ignore */ }
    }
    setAlertaForm({
      tempPretendida: cuba.tempPretendida ?? "",
      desvioTempAlerta: cuba.desvioTempAlerta ?? "5.0",
      desvioDesnsAlerta: cuba.desvioDesnsAlerta ?? "0.010",
      alertasDensidadeStr,
      pontoAguardentacao: cuba.pontoAguardentacao ?? "",
      desvioAguardentacaoAlerta: cuba.desvioAguardentacaoAlerta ?? "0.50",
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
      "Densidade": l.densL1 ?? "",
      "Temperatura (°C)": l.tempL1 ?? "",
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
      "Densidade": l.densL1 ?? "",
      "Temperatura (°C)": l.tempL1 ?? "",
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
                    {canEdit && (
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
                cuba.estado === "em_fermentacao" ? "bg-amber-50 text-amber-700 border-amber-200" :
                "bg-gray-100 text-gray-500 border-gray-200"
              }`}>
                <span className={`w-1.5 h-1.5 rounded-full ${
                  cuba.estado === "em_fermentacao" ? "bg-amber-400 animate-pulse" :
                  "bg-gray-300"
                }`} />
                {cuba.estado === "em_fermentacao" ? "Em fermentação" : "Vazia"}
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
              <ResumoCard icon={<FlaskConical size={14} />} label="Dens. mín." value={resumo?.densMin ? resumo.densMin.toFixed(4) : "—"} color="text-green-700" />
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
                onClick={() => cuba && exportarPdfServidor.mutate({ codigo: cuba.codigo })}
                disabled={!leituras || leituras.length === 0 || exportarPdfServidor.isPending}
                title="Exporta PDF com ficha inicial, leituras e adições"
                className="flex items-center gap-1.5 px-3 py-1.5 bg-red-700 text-white rounded-lg text-xs font-medium hover:bg-red-800 transition-colors disabled:opacity-40"
              >
                {exportarPdfServidor.isPending ? <RefreshCw size={12} className="animate-spin" /> : <Download size={12} />}
                PDF
              </button>
              <button
                onClick={exportarCSV}
                disabled={!leituras || leituras.length === 0}
                className="flex items-center gap-1.5 px-3 py-1.5 bg-blue-700 text-white rounded-lg text-xs font-medium hover:bg-blue-800 transition-colors disabled:opacity-40"
              >
                <Download size={12} /> CSV
              </button>
              {canEdit && (
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
            {canEdit && (
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
                    onClick={() => { setLimiteTemp(cuba.densidadeLimite ?? "0.990"); setEditingLimite(true); }}
                    className="flex items-center gap-1 px-2.5 py-1 rounded-lg border border-gray-200 text-xs text-gray-600 hover:border-[var(--color-vinho)] hover:text-[var(--color-vinho)] transition-colors"
                  >
                    <Settings size={11} /> {cuba.densidadeLimite ?? "0.990"}
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
                {/* Botão de ficha inicial */}
                <button
                  onClick={abrirFichaInicial}
                  className={`flex items-center gap-1 px-2.5 py-1 rounded-lg border text-xs font-medium transition-colors ${
                    cuba.fichaKilos || cuba.fichaLitros || cuba.fichaPh
                      ? "border-[var(--color-vinho)]/40 text-[var(--color-vinho)] bg-[var(--color-vinho)]/5 hover:bg-[var(--color-vinho)]/10"
                      : "border-gray-200 text-gray-600 hover:border-[var(--color-vinho)] hover:text-[var(--color-vinho)]"
                  }`}
                >
                  <ClipboardList size={11} /> Ficha inicial
                </button>
              </div>
            )}
          </div>
        </div>
      </div>

      {/* Painel de ficha inicial (mostra quando há dados preenchidos) */}
      {(cuba.fichaKilos || cuba.fichaLitros || cuba.fichaPh || cuba.fichaAt || cuba.fichaAv || cuba.fichaNfa || cuba.fichaNtu || cuba.fichaGluconico || cuba.fichaAlcoolProvavel) && (
        <div className="mb-5 bg-[var(--color-vinho)]/5 border border-[var(--color-vinho)]/20 rounded-2xl p-4 animate-fade-in">
          <div className="flex items-center justify-between mb-3">
            <h3 className="text-sm font-semibold text-[var(--color-vinho)] flex items-center gap-2">
              <ClipboardList size={15} /> Ficha Inicial da Fermentação
            </h3>
            {canEdit && (
              <button onClick={abrirFichaInicial} className="text-xs text-[var(--color-vinho)] hover:underline flex items-center gap-1">
                <Pencil size={11} /> Editar
              </button>
            )}
          </div>
          <div className="grid grid-cols-3 sm:grid-cols-5 lg:grid-cols-9 gap-3">
            {[
              { label: "Kg", value: cuba.fichaKilos },
              { label: "Litros", value: cuba.fichaLitros },
              { label: "pH", value: cuba.fichaPh },
              { label: "AT (g/L)", value: cuba.fichaAt },
              { label: "AV (g/L)", value: cuba.fichaAv },
              { label: "NFA", value: cuba.fichaNfa },
              { label: "NTU", value: cuba.fichaNtu },
              { label: "Glucónico", value: cuba.fichaGluconico },
              { label: "Alc. Prov.", value: cuba.fichaAlcoolProvavel },
            ].map(({ label, value }) =>
              value ? (
                <div key={label} className="bg-white rounded-xl border border-[var(--color-vinho)]/10 px-3 py-2 text-center">
                  <p className="text-[10px] text-gray-400 mb-0.5">{label}</p>
                  <p className="text-sm font-bold text-[var(--color-vinho)]">{value}</p>
                </div>
              ) : null
            )}
          </div>
        </div>
      )}

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
          {cuba.tipoCuba === "porto" ? (
            /* Formulário VP — Baumé + Temperatura */
            <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
              <div>
                <label className="block text-xs text-gray-500 mb-1">Data</label>
                <input type="date" value={form.dataLeitura}
                  onChange={(e) => setForm({ ...form, dataLeitura: e.target.value })}
                  className="w-full border border-gray-200 rounded-lg px-3 py-2 text-sm focus:outline-none focus:border-[var(--color-vinho)] focus:ring-1 focus:ring-[var(--color-vinho)]/20"
                />
              </div>
              <div>
                <label className="block text-xs font-medium mb-1" style={{ color: CORES.densL1 }}>Baumé (°)</label>
                <input type="number" step="0.01" placeholder="6.50" value={form.baumeL1}
                  onChange={(e) => setForm({ ...form, baumeL1: e.target.value })}
                  className="w-full border border-gray-200 rounded-lg px-3 py-2 text-sm focus:outline-none focus:border-green-500"
                />
              </div>
              <div>
                <label className="block text-xs font-medium mb-1" style={{ color: CORES.tempL1 }}>Temperatura (°C)</label>
                <input type="number" step="0.1" placeholder="18.5" value={form.tempL1}
                  onChange={(e) => setForm({ ...form, tempL1: e.target.value })}
                  className="w-full border border-gray-200 rounded-lg px-3 py-2 text-sm focus:outline-none focus:border-green-500"
                />
              </div>
            </div>
          ) : (
            /* Formulário normal — Densidade + Baumé + Temperatura + O₂ + Redox */
            <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-6 gap-3">
              <div>
                <label className="block text-xs text-gray-500 mb-1">Data</label>
                <input type="date" value={form.dataLeitura}
                  onChange={(e) => setForm({ ...form, dataLeitura: e.target.value })}
                  className="w-full border border-gray-200 rounded-lg px-3 py-2 text-sm focus:outline-none focus:border-[var(--color-vinho)] focus:ring-1 focus:ring-[var(--color-vinho)]/20"
                />
              </div>
              <div>
                <label className="block text-xs font-medium mb-1" style={{ color: CORES.densL1 }}>Densidade</label>
                <input type="number" step="0.0001" placeholder="1.0850" value={form.densL1}
                  onChange={(e) => setForm({ ...form, densL1: e.target.value })}
                  className="w-full border border-gray-200 rounded-lg px-3 py-2 text-sm focus:outline-none focus:border-green-500"
                />
              </div>
              <div>
                <label className="block text-xs font-medium mb-1" style={{ color: "#f59e0b" }}>Baumé (°Bé)</label>
                <input type="number" step="0.1" placeholder="12.5" value={form.baumeL1}
                  onChange={(e) => setForm({ ...form, baumeL1: e.target.value })}
                  className="w-full border border-gray-200 rounded-lg px-3 py-2 text-sm focus:outline-none focus:border-amber-500"
                />
              </div>
              <div>
                <label className="block text-xs font-medium mb-1" style={{ color: CORES.tempL1 }}>Temperatura (°C)</label>
                <input type="number" step="0.1" placeholder="18.5" value={form.tempL1}
                  onChange={(e) => setForm({ ...form, tempL1: e.target.value })}
                  className="w-full border border-gray-200 rounded-lg px-3 py-2 text-sm focus:outline-none focus:border-green-500"
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
          )}
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
          <a href="/login" className="ml-auto font-semibold underline">Entrar</a>
        </div>
      )}

      {/* Botão Terminar Fermentação — visível quando em_fermentacao OU quando completa mas há leituras activas */}
      {canEdit && (cuba.estado === "em_fermentacao" || (cuba.estado === "completa" && leituras && leituras.length > 0)) && (
        <div className="mb-5 flex justify-end">
          <button
            onClick={() => { setNomeLoteTerminar(cuba.nomeLote ?? ""); setShowTerminarFerm(true); }}
            className="flex items-center gap-2 px-5 py-2.5 bg-green-700 text-white rounded-xl text-sm font-semibold hover:bg-green-800 transition-colors shadow-sm"
          >
            <CheckCircle2 size={16} /> Terminar Fermentação
          </button>
        </div>
      )}

      {/* Botões Transferir/Juntar — visíveis quando em fermentação */}
      {canEdit && cuba.estado === "em_fermentacao" && (
        <div className="mb-3 flex justify-end gap-2">
          <button
            onClick={() => { setTipoMovimento("transferencia"); setCubaDestinoId(0); setMotivoMovimento(""); setShowTransferir(true); }}
            className="flex items-center gap-2 px-4 py-2 border border-blue-500 text-blue-600 rounded-xl text-sm font-semibold hover:bg-blue-50 transition-colors"
          >
            <ArrowRightLeft size={15} /> Transferir para outra cuba
          </button>
          <button
            onClick={() => { setTipoMovimento("juncao"); setCubasJuncaoIds([]); setMotivoMovimento(""); setShowTransferir(true); }}
            className="flex items-center gap-2 px-4 py-2 border border-purple-500 text-purple-600 rounded-xl text-sm font-semibold hover:bg-purple-50 transition-colors"
          >
            <GitMerge size={15} /> Juntar com outra(s) cuba(s)
          </button>
        </div>
      )}

      {/* Aviso persistente: análises pendentes após junção/blend */}
      {cuba.analisesPendentes && (
        <div className="mb-5 flex items-center justify-between gap-4 bg-amber-50 border border-amber-300 rounded-xl px-5 py-3">
          <div className="flex items-center gap-2 text-amber-800">
            <span className="text-lg">⚠️</span>
            <div>
              <p className="text-sm font-semibold">Análises pendentes após junção de vinhos</p>
              <p className="text-xs text-amber-700">Este vinho resultou de uma junção ou blend. Actualize a ficha de análises (pH, AT, AV, NFA, etc.) para remover este aviso.</p>
            </div>
          </div>
          <button
            onClick={() => setActiveTab("leituras")}
            className="flex items-center gap-2 px-4 py-2 bg-amber-600 text-white rounded-lg text-sm font-semibold hover:bg-amber-700 transition-colors whitespace-nowrap"
          >
            Actualizar análises
          </button>
        </div>
      )}

      {/* Banner — visível quando estado = completa E não há leituras activas (cuba realmente vazia) */}
      {canEdit && cuba.estado === "completa" && (!leituras || leituras.length === 0) && (
        <div className="mb-5 flex items-center justify-between gap-4 bg-gray-50 border border-gray-200 rounded-xl px-5 py-3">
          <div className="flex items-center gap-2 text-gray-600">
            <Archive size={18} className="text-gray-400" />
            <span className="text-sm font-medium">Cuba vazia — fermentação arquivada. Pode iniciar uma nova fermentação quando entrar vinho novo.</span>
          </div>
          <button
            onClick={() => { setNomeLoteNovo(""); setShowNovaFerm(true); }}
            className="flex items-center gap-2 px-5 py-2.5 bg-[var(--color-vinho)] text-white rounded-xl text-sm font-semibold hover:bg-[var(--color-vinho-light)] transition-colors shadow-sm whitespace-nowrap"
          >
            <Plus size={15} /> Iniciar Nova Fermentação
          </button>
        </div>
      )}

      {/* Tabs */}
      <div className="flex gap-1 mb-4 bg-gray-100 rounded-xl p-1 w-fit">
        {(["leituras", "graficos", "adicoes", "movimentos", "arquivo"] as const).map((tab) => (
          <button
            key={tab}
            onClick={() => setActiveTab(tab)}
            className={`px-4 py-2 rounded-lg text-sm font-medium transition-all ${
              activeTab === tab
                ? "bg-white text-[var(--color-vinho)] shadow-sm"
                : "text-gray-500 hover:text-gray-700"
            }`}
          >
            {tab === "leituras" ? "Histórico" : tab === "graficos" ? "Gráficos" : tab === "adicoes" ? "Adições" : tab === "movimentos" ? "Movimentos" : "Arquivo"}
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
                  <th className="px-3 py-3 text-center text-xs font-semibold">Hora</th>
                  <th className="px-3 py-3 text-center text-xs font-semibold">Dia</th>
                  <th className="px-3 py-3 text-center text-xs font-semibold" style={{ color: "#a5d6a7" }}>Densidade</th>
                  <th className="px-3 py-3 text-center text-xs font-semibold" style={{ color: "#fcd34d" }}>Baumé (°Bé)</th>
                  <th className="px-3 py-3 text-center text-xs font-semibold" style={{ color: "#a5d6a7" }}>Temperatura</th>
                  <th className="px-3 py-3 text-center text-xs font-semibold" style={{ color: "#80deea" }}>O₂</th>
                  <th className="px-3 py-3 text-center text-xs font-semibold" style={{ color: "#ce93d8" }}>Redox</th>
                  <th className="px-3 py-3 text-center text-xs font-semibold">Utilizador</th>
                  {canEdit && <th className="px-3 py-3 text-center text-xs font-semibold">Editar</th>}
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
                        <td className="px-3 py-2.5 text-center text-xs font-mono text-gray-500">{(l as LeituraRow).hora ?? "—"}</td>
                        <td className="px-3 py-2.5 text-center text-xs font-bold text-[var(--color-vinho)]">{l.diaNr ?? "—"}</td>
                        <td className="px-3 py-2.5 text-center text-xs font-mono">{l.densL1 ? parseFloat(l.densL1).toFixed(4) : "—"}</td>
                        <td className="px-3 py-2.5 text-center text-xs font-mono" style={{ color: "#f59e0b" }}>{(l as LeituraRow).baumeL1 ? `${parseFloat((l as LeituraRow).baumeL1!).toFixed(2)}°` : "—"}</td>
                        <td className="px-3 py-2.5 text-center text-xs font-mono">{l.tempL1 ? `${parseFloat(l.tempL1).toFixed(1)}°` : "—"}</td>
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
                        {canEdit && (
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
              <ChartCard title="Densidade (g/cm³)">
                <ResponsiveContainer width="100%" height={280}>
                  <LineChart data={chartData} margin={{ top: 5, right: 120, left: 0, bottom: 20 }}>
                    <CartesianGrid strokeDasharray="3 3" stroke="#f0f0f0" />
                    <XAxis dataKey="dia" label={{ value: "Dia de fermentação", position: "insideBottom", offset: -2, fontSize: 11 }} tick={{ fontSize: 11 }} />
                    <YAxis tick={{ fontSize: 11 }} domain={["auto", "auto"]} />
                    <Tooltip formatter={(v: number) => v?.toFixed(4)} labelFormatter={(l) => `Dia ${l}`} />
                    <Legend layout="vertical" align="right" verticalAlign="middle" wrapperStyle={{ paddingLeft: 16, fontSize: 12 }} />
                    {adicaoMarkers.map((m, i) => (
                      <ReferenceLine key={i} x={m.dia} stroke="#7c3aed" strokeDasharray="4 2" strokeWidth={1.5}
                        label={{ value: `▼${i + 1}`, position: "insideTopRight", fontSize: 10, fill: "#7c3aed", fontWeight: "bold" }}
                      />
                    ))}
                    <Line type="monotone" dataKey="densL1" name="Densidade" stroke={CORES.densL1} strokeWidth={2.5} dot={{ r: 4 }} connectNulls={false} />
                  </LineChart>
                </ResponsiveContainer>
              </ChartCard>

              {chartData.some(d => d.baumeL1 != null) && (
                <ChartCard title="Baumé (°Bé)">
                  <ResponsiveContainer width="100%" height={280}>
                    <LineChart data={chartData} margin={{ top: 5, right: 120, left: 0, bottom: 20 }}>
                      <CartesianGrid strokeDasharray="3 3" stroke="#f0f0f0" />
                      <XAxis dataKey="dia" label={{ value: "Dia de fermentação", position: "insideBottom", offset: -2, fontSize: 11 }} tick={{ fontSize: 11 }} />
                      <YAxis tick={{ fontSize: 11 }} domain={["auto", "auto"]} />
                      <Tooltip formatter={(v: number) => `${v?.toFixed(2)}°Bé`} labelFormatter={(l) => `Dia ${l}`} />
                      <Legend layout="vertical" align="right" verticalAlign="middle" wrapperStyle={{ paddingLeft: 16, fontSize: 12 }} />
                      {adicaoMarkers.map((m, i) => (
                        <ReferenceLine key={i} x={m.dia} stroke="#7c3aed" strokeDasharray="4 2" strokeWidth={1.5}
                          label={{ value: `▼${i + 1}`, position: "insideTopRight", fontSize: 10, fill: "#7c3aed", fontWeight: "bold" }}
                        />
                      ))}
                      {cuba.pontoAguardentacao && (
                        <ReferenceLine y={parseFloat(cuba.pontoAguardentacao)} stroke="#dc2626" strokeDasharray="6 3" strokeWidth={2}
                          label={{ value: `Aguardentação ${cuba.pontoAguardentacao}°`, position: "insideTopLeft", fontSize: 10, fill: "#dc2626" }}
                        />
                      )}
                      <Line type="monotone" dataKey="baumeL1" name="Baumé" stroke="#f59e0b" strokeWidth={2.5} dot={{ r: 4 }} connectNulls={false} />
                    </LineChart>
                  </ResponsiveContainer>
                </ChartCard>
              )}

              <ChartCard title="Temperatura (°C)">
                <ResponsiveContainer width="100%" height={280}>
                  <LineChart data={chartData} margin={{ top: 5, right: 120, left: 0, bottom: 20 }}>
                    <CartesianGrid strokeDasharray="3 3" stroke="#f0f0f0" />
                    <XAxis dataKey="dia" label={{ value: "Dia de fermentação", position: "insideBottom", offset: -2, fontSize: 11 }} tick={{ fontSize: 11 }} />
                    <YAxis tick={{ fontSize: 11 }} domain={["auto", "auto"]} />
                    <Tooltip formatter={(v: number) => `${v?.toFixed(1)}°C`} labelFormatter={(l) => `Dia ${l}`} />
                    <Legend layout="vertical" align="right" verticalAlign="middle" wrapperStyle={{ paddingLeft: 16, fontSize: 12 }} />
                    {adicaoMarkers.map((m, i) => (
                      <ReferenceLine key={i} x={m.dia} stroke="#7c3aed" strokeDasharray="4 2" strokeWidth={1.5}
                        label={{ value: `▼${i + 1}`, position: "insideTopRight", fontSize: 10, fill: "#7c3aed", fontWeight: "bold" }}
                      />
                    ))}
                    {cuba.tempPretendida && (
                      <Line type="monotone" dataKey={() => parseFloat(cuba.tempPretendida!)} name="Pretendida" stroke="#f59e0b" strokeWidth={1.5} strokeDasharray="6 3" dot={false} />
                    )}
                    <Line type="monotone" dataKey="tempL1" name="Temperatura" stroke={CORES.tempL1} strokeWidth={2.5} dot={{ r: 4 }} connectNulls={false} />
                  </LineChart>
                </ResponsiveContainer>
              </ChartCard>

              <ChartCard title="O₂ Dissolvido (mg/L)">
                <ResponsiveContainer width="100%" height={220}>
                  <LineChart data={chartData} margin={{ top: 5, right: 20, left: 0, bottom: 20 }}>
                    <CartesianGrid strokeDasharray="3 3" stroke="#f0f0f0" />
                    <XAxis dataKey="dia" label={{ value: "Dia de fermentação", position: "insideBottom", offset: -2, fontSize: 11 }} tick={{ fontSize: 11 }} />
                    <YAxis tick={{ fontSize: 11 }} />
                    <Tooltip formatter={(v: number) => `${v?.toFixed(2)} mg/L`} labelFormatter={(l) => `Dia ${l}`} />
                    {adicaoMarkers.map((m, i) => (
                      <ReferenceLine key={i} x={m.dia} stroke="#7c3aed" strokeDasharray="4 2" strokeWidth={1.5}
                        label={{ value: `▼${i + 1}`, position: "insideTopRight", fontSize: 10, fill: "#7c3aed", fontWeight: "bold" }}
                      />
                    ))}
                    <Line type="monotone" dataKey="o2" name="O₂ Dissolvido" stroke={CORES.o2} strokeWidth={2.5} dot={{ r: 5, fill: CORES.o2 }} connectNulls={false} />
                  </LineChart>
                </ResponsiveContainer>
              </ChartCard>

              <ChartCard title="Potencial Redox (mV)">
                <ResponsiveContainer width="100%" height={220}>
                  <LineChart data={chartData} margin={{ top: 5, right: 20, left: 0, bottom: 20 }}>
                    <CartesianGrid strokeDasharray="3 3" stroke="#f0f0f0" />
                    <XAxis dataKey="dia" label={{ value: "Dia de fermentação", position: "insideBottom", offset: -2, fontSize: 11 }} tick={{ fontSize: 11 }} />
                    <YAxis tick={{ fontSize: 11 }} />
                    <Tooltip formatter={(v: number) => `${v?.toFixed(0)} mV`} labelFormatter={(l) => `Dia ${l}`} />
                    {adicaoMarkers.map((m, i) => (
                      <ReferenceLine key={i} x={m.dia} stroke="#7c3aed" strokeDasharray="4 2" strokeWidth={1.5}
                        label={{ value: `▼${i + 1}`, position: "insideTopRight", fontSize: 10, fill: "#7c3aed", fontWeight: "bold" }}
                      />
                    ))}
                    <Line type="monotone" dataKey="redox" name="Potencial Redox" stroke={CORES.redox} strokeWidth={2.5} dot={{ r: 5, fill: CORES.redox }} connectNulls={false} />
                  </LineChart>
                </ResponsiveContainer>
              </ChartCard>
              {/* Legenda de adições */}
              {adicaoMarkers.length > 0 && (
                <div className="bg-purple-50 border border-purple-100 rounded-xl p-4 mt-2">
                  <p className="text-xs font-semibold text-purple-700 mb-2 flex items-center gap-1">
                    <span className="text-purple-500">&#9660;</span> Adições / Notas registadas
                  </p>
                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
                    {adicaoMarkers.map((m, i) => (
                      <div key={i} className="flex items-start gap-2 text-xs text-purple-800">
                        <span className="font-bold text-purple-600 min-w-[20px]">▼{i + 1}</span>
                        <span>
                          <span className="font-medium">Dia {m.dia}</span>
                          {" — "}
                          <span>{m.full}</span>
                        </span>
                      </div>
                    ))}
                  </div>
                </div>
              )}
            </>
          )}
        </div>
      )}

      {/* Calculadoras de Correcção de Álcool — visíveis em todas as tabs */}
      <CalculadoraCorrecao volumeCuba={cuba?.fichaLitros ? Number(cuba.fichaLitros) : undefined} />

      {/* Calculadora de Baumé de Envasilhamento — apenas cubas VP (Vinho do Porto) */}
      {cuba?.tipoCuba === "porto" && cuba?.id && (
        <CalculadoraBaumeEnvasilhamento
          key={cuba.id}
          cubaId={cuba.id}
          volumeCuba={cuba?.fichaLitros ? Number(cuba.fichaLitros) : undefined}
        />
      )}

      {/* Tab: Adições e Notas */}
      {activeTab === "adicoes" && (
        <div className="space-y-4 animate-fade-in">
          {canEdit && (
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
                  {canEdit && <th className="px-4 py-3" />}
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
                      {canEdit && (
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

      {/* Tab: Movimentos (rastreabilidade) */}
      {activeTab === "movimentos" && (
        <div className="space-y-4 animate-fade-in">
          <h3 className="text-sm font-semibold text-gray-700">Histórico de Movimentos</h3>
          {!movimentosCuba || movimentosCuba.length === 0 ? (
            <div className="text-center py-12 text-gray-400">
              <p className="text-sm">Sem movimentos registados para esta cuba.</p>
            </div>
          ) : (
            <div className="space-y-3">
              {movimentosCuba.map((m) => {
                let origens: number[] = [];
                try { origens = JSON.parse(m.cubasOrigemIds); } catch { /* */ }
                let destinos: { cubaId: number; litros: number; cubaCodigo: string }[] = [];
                try { destinos = m.destinosJson ? JSON.parse(m.destinosJson) : []; } catch { /* */ }
                const eOrigem = origens.includes(cuba.id);
                const eDestino = m.cubaDestinoId === cuba.id || destinos.some((d) => d.cubaId === cuba.id);
                const litrosDest = destinos.find((d) => d.cubaId === cuba.id)?.litros;
                return (
                  <div key={m.id} className={`rounded-xl border px-4 py-3 ${m.tipo === "transferencia" ? "border-blue-200 bg-blue-50" : "border-purple-200 bg-purple-50"}`}>
                    <div className="flex items-start justify-between gap-2">
                      <div className="flex items-center gap-2">
                        <span className={`text-xs font-bold px-2 py-0.5 rounded-full ${m.tipo === "transferencia" ? "bg-blue-100 text-blue-700" : "bg-purple-100 text-purple-700"}`}>
                          {m.tipo === "transferencia" ? "Transferência" : "Junção"}
                        </span>
                        <span className={`text-xs font-semibold ${eOrigem ? "text-red-600" : "text-green-600"}`}>
                          {eOrigem ? "↑ Saída" : "↓ Entrada"}
                        </span>
                      </div>
                      <span className="text-xs text-gray-500">{m.dataMovimento}</span>
                    </div>
                    <div className="mt-2 text-sm text-gray-700">
                      {m.tipo === "transferencia" && destinos.length > 0 && (
                        <p>
                          {eOrigem
                            ? <>Transferido para: <strong>{destinos.map((d) => `${d.cubaCodigo.toUpperCase()} (${d.litros.toLocaleString("pt-PT")} L)`).join(", ")}</strong></>
                            : <>Recebido de: <strong>{origens.map((id) => `#${id}`).join(", ")}</strong>{litrosDest ? ` — ${litrosDest.toLocaleString("pt-PT")} L` : ""}</>
                          }
                        </p>
                      )}
                      {m.tipo === "juncao" && (
                        <p>
                          {eOrigem
                            ? <>Juntado em: <strong>{m.cubaDestinoId ? `Cuba #${m.cubaDestinoId}` : "—"}</strong></>
                            : <>Junção de: <strong>{origens.map((id) => `Cuba #${id}`).join(" + ")}</strong></>
                          }
                        </p>
                      )}
                      {m.motivo && <p className="text-xs text-gray-500 mt-1">Nota: {m.motivo}</p>}
                      {m.userName && <p className="text-xs text-gray-400 mt-0.5">Por: {m.userName}</p>}
                    </div>
                  </div>
                );
              })}
            </div>
          )}

          {/* Histórico de Análises */}
          <h3 className="text-sm font-semibold text-gray-700 mt-6 pt-4 border-t border-gray-100">Histórico de Análises</h3>
          {!historicoAnalises || historicoAnalises.length === 0 ? (
            <div className="text-center py-6 text-gray-400">
              <p className="text-sm">Sem análises registadas. As análises são guardadas automaticamente ao actualizar a ficha inicial.</p>
            </div>
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full text-xs border-collapse">
                <thead>
                  <tr className="bg-gray-50 text-gray-600">
                    <th className="px-3 py-2 text-left font-medium border border-gray-200">Data</th>
                    <th className="px-3 py-2 text-right font-medium border border-gray-200">Litros</th>
                    <th className="px-3 py-2 text-right font-medium border border-gray-200">pH</th>
                    <th className="px-3 py-2 text-right font-medium border border-gray-200">AT (g/L)</th>
                    <th className="px-3 py-2 text-right font-medium border border-gray-200">AV (g/L)</th>
                    <th className="px-3 py-2 text-right font-medium border border-gray-200">NFA (mg/L)</th>
                    <th className="px-3 py-2 text-right font-medium border border-gray-200">NTU</th>
                    <th className="px-3 py-2 text-right font-medium border border-gray-200">Glucónico</th>
                    <th className="px-3 py-2 text-right font-medium border border-gray-200">Álcool (%)</th>
                    <th className="px-3 py-2 text-left font-medium border border-gray-200">Por</th>
                  </tr>
                </thead>
                <tbody>
                  {historicoAnalises.map((a) => (
                    <tr key={a.id} className="hover:bg-gray-50">
                      <td className="px-3 py-2 border border-gray-200 font-medium text-gray-700">{a.dataAnalise}</td>
                      <td className="px-3 py-2 border border-gray-200 text-right">{a.fichaLitros ?? "—"}</td>
                      <td className="px-3 py-2 border border-gray-200 text-right">{a.fichaPh ?? "—"}</td>
                      <td className="px-3 py-2 border border-gray-200 text-right">{a.fichaAt ?? "—"}</td>
                      <td className="px-3 py-2 border border-gray-200 text-right">{a.fichaAv ?? "—"}</td>
                      <td className="px-3 py-2 border border-gray-200 text-right">{a.fichaNfa ?? "—"}</td>
                      <td className="px-3 py-2 border border-gray-200 text-right">{a.fichaNtu ?? "—"}</td>
                      <td className="px-3 py-2 border border-gray-200 text-right">{a.fichaGluconico ?? "—"}</td>
                      <td className="px-3 py-2 border border-gray-200 text-right">{a.fichaAlcoolProvavel ?? "—"}</td>
                      <td className="px-3 py-2 border border-gray-200 text-gray-500">{a.userName ?? "—"}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
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
            {canEdit && (
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
                      <p className="text-xl font-bold text-green-700">{arq.densMin ? parseFloat(arq.densMin).toFixed(4) : "—"}</p>
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
                onClick={() => terminarFermentacao.mutate({ cubaId: cuba.id, nomeLote: nomeLoteTerminar || undefined })}
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

      {/* Modal Transferência / Junção */}
      <Dialog open={showTransferir} onOpenChange={setShowTransferir}>
        <DialogContent className="max-w-lg">
          <DialogHeader>
            <DialogTitle className={`flex items-center gap-2 ${tipoMovimento === "transferencia" ? "text-blue-700" : "text-purple-700"}`}>
              {tipoMovimento === "transferencia" ? <ArrowRightLeft size={18} /> : <GitMerge size={18} />}
              {tipoMovimento === "transferencia" ? "Transferir Cuba" : "Juntar Cubas"}
            </DialogTitle>
          </DialogHeader>
          <div className="space-y-4 py-2">
            <div>
              <label className="block text-xs font-medium text-gray-600 mb-1">Data do movimento *</label>
              <input
                type="date"
                value={dataMovimento}
                onChange={(e) => setDataMovimento(e.target.value)}
                className="w-full px-3 py-2 border border-gray-200 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-blue-300"
              />
            </div>

            {tipoMovimento === "transferencia" ? (
              <div className="space-y-3">
                <div className="flex items-center justify-between">
                  <label className="block text-xs font-medium text-gray-600">Destinos *</label>
                  <button
                    type="button"
                    onClick={() => setDestinosTransferencia((prev) => [...prev, { cubaId: 0, cubaCodigo: "", litros: "" }])}
                    className="text-xs text-blue-600 hover:text-blue-800 font-medium"
                  >
                    + Adicionar destino
                  </button>
                </div>
                {destinosTransferencia.map((dest, idx) => (
                  <div key={idx} className="flex gap-2 items-center">
                    <select
                      value={dest.cubaId || ""}
                      onChange={(e) => {
                        const c = todasCubasLista?.find((x) => x.id === Number(e.target.value));
                        setDestinosTransferencia((prev) => prev.map((d, i) => i === idx ? { ...d, cubaId: Number(e.target.value), cubaCodigo: c?.codigo ?? "" } : d));
                      }}
                      className="flex-1 px-3 py-2 border border-gray-200 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-blue-300 bg-white"
                    >
                      <option value="">Cuba destino...</option>
                      {todasCubasLista?.filter((c) => c.codigo !== cuba.codigo && !destinosTransferencia.some((d, i) => i !== idx && d.cubaId === c.id)).map((c) => (
                        <option key={c.id} value={c.id}>
                          {c.codigo.toUpperCase()}{c.nomeLote ? ` — ${c.nomeLote}` : ""}
                        </option>
                      ))}
                    </select>
                    <input
                      type="number"
                      min="1"
                      placeholder="Litros"
                      value={dest.litros}
                      onChange={(e) => setDestinosTransferencia((prev) => prev.map((d, i) => i === idx ? { ...d, litros: e.target.value } : d))}
                      className="w-24 px-3 py-2 border border-gray-200 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-blue-300"
                    />
                    {destinosTransferencia.length > 1 && (
                      <button type="button" onClick={() => setDestinosTransferencia((prev) => prev.filter((_, i) => i !== idx))} className="text-gray-400 hover:text-red-500 text-lg leading-none">✕</button>
                    )}
                  </div>
                ))}
                {/* Balanço */}
                {(() => {
                  const litrosOrigem = cuba.fichaLitros ? parseFloat(cuba.fichaLitros) : null;
                  const litrosTotal = destinosTransferencia.reduce((s, d) => s + (parseFloat(d.litros) || 0), 0);
                  const sobra = litrosOrigem != null ? litrosOrigem - litrosTotal : null;
                  return (
                    <div className={`text-xs rounded-lg px-3 py-2 ${sobra != null && sobra < 0 ? "bg-red-50 text-red-700" : sobra != null && sobra > 0 ? "bg-amber-50 text-amber-700" : "bg-green-50 text-green-700"}`}>
                      {litrosOrigem != null ? (
                        <>
                          <span className="font-medium">Disponível: {litrosOrigem.toLocaleString("pt-PT")} L</span>
                          {" · "}
                          <span>Transferir: {litrosTotal.toLocaleString("pt-PT")} L</span>
                          {sobra != null && sobra !== 0 && (
                            <span className="font-semibold"> · {sobra > 0 ? `Sobra: ${sobra.toLocaleString("pt-PT")} L (registar nas observações)` : `Excede em ${Math.abs(sobra).toLocaleString("pt-PT")} L!`}</span>
                          )}
                          {sobra === 0 && <span className="font-semibold"> · Transferência total ✓</span>}
                        </>
                      ) : (
                        <span>Litros a transferir: {litrosTotal.toLocaleString("pt-PT")} L</span>
                      )}
                    </div>
                  );
                })()}
                {/* Opção: o resto fica na origem */}
                {(() => {
                  const litrosOrigem = cuba.fichaLitros ? parseFloat(cuba.fichaLitros) : null;
                  const litrosTotal = destinosTransferencia.reduce((s, d) => s + (parseFloat(d.litros) || 0), 0);
                  const sobra = litrosOrigem != null ? litrosOrigem - litrosTotal : null;
                  return sobra != null && sobra > 0 ? (
                    <label className="flex items-center gap-2 cursor-pointer select-none">
                      <input
                        type="checkbox"
                        checked={restaOrigem}
                        onChange={(e) => setRestaOrigem(e.target.checked)}
                        className="rounded border-gray-300 text-blue-600"
                      />
                      <span className="text-xs text-gray-600">
                        O restante <strong>{sobra.toLocaleString("pt-PT")} L</strong> fica em {cuba.codigo.toUpperCase()} (transferência parcial)
                      </span>
                    </label>
                  ) : null;
                })()}
                <p className="text-xs text-gray-400">
                  {restaOrigem ? `A cuba ${cuba.codigo.toUpperCase()} manterá o volume restante.` : `A cuba ${cuba.codigo.toUpperCase()} ficará vazia.`}
                  {" "}As leituras e adições serão copiadas para cada destino.
                </p>
              </div>
            ) : (
              <div>
                <label className="block text-xs font-medium text-gray-600 mb-1">Cuba de destino (onde vai juntar tudo) *</label>
                <select
                  value={cubaDestinoId || ""}
                  onChange={(e) => setCubaDestinoId(Number(e.target.value))}
                  className="w-full px-3 py-2 border border-gray-200 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-purple-300 bg-white"
                >
                  <option value="">Seleccionar cuba de destino...</option>
                  {todasCubasLista?.filter((c) => c.codigo !== cuba.codigo && !cubasJuncaoIds.includes(c.id)).map((c) => (
                    <option key={c.id} value={c.id}>
                      {c.codigo.toUpperCase()}{c.nomeLote ? ` — ${c.nomeLote}` : ""}
                    </option>
                  ))}
                </select>
                <div className="mt-3">
                  <label className="block text-xs font-medium text-gray-600 mb-1">Outras cubas a juntar (além desta) *</label>
                  <div className="space-y-1">
                    {cubasJuncaoIds.map((id) => {
                      const c = todasCubasLista?.find((x) => x.id === id);
                      return (
                        <div key={id} className="flex items-center justify-between bg-purple-50 px-3 py-1.5 rounded-lg text-sm">
                          <span className="font-medium text-purple-700">{c?.codigo.toUpperCase()}{c?.nomeLote ? ` — ${c.nomeLote}` : ""}</span>
                          <button onClick={() => setCubasJuncaoIds((prev) => prev.filter((x) => x !== id))} className="text-gray-400 hover:text-red-500">✕</button>
                        </div>
                      );
                    })}
                    <select
                      value=""
                      onChange={(e) => { if (e.target.value) setCubasJuncaoIds((prev) => [...prev, Number(e.target.value)]); }}
                      className="w-full px-3 py-2 border border-gray-200 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-purple-300 bg-white"
                    >
                      <option value="">+ Adicionar cuba à junção...</option>
                      {todasCubasLista?.filter((c) => c.codigo !== cuba.codigo && c.id !== cubaDestinoId && !cubasJuncaoIds.includes(c.id)).map((c) => (
                        <option key={c.id} value={c.id}>
                          {c.codigo.toUpperCase()}{c.nomeLote ? ` — ${c.nomeLote}` : ""}
                        </option>
                      ))}
                    </select>
                  </div>
                  <p className="text-xs text-gray-400 mt-1">Esta cuba ({cuba.codigo.toUpperCase()}) + as cubas seleccionadas serão esvaziadas. Os kg somam-se no destino.</p>
                </div>
              </div>
            )}
            {/* Campos de litros por cuba de origem */}
            {tipoMovimento === "juncao" && [cuba.id, ...cubasJuncaoIds].length > 0 && (
              <div className="space-y-2">
                <label className="block text-xs font-medium text-gray-600">Litros a transferir de cada cuba (opcional)</label>
                {[cuba.id, ...cubasJuncaoIds].map((cId) => {
                  const c = cId === cuba.id ? cuba : todasCubasLista?.find((x) => x.id === cId);
                  const disponiveis = (c as any)?.fichaLitros ? parseFloat((c as any).fichaLitros) : null;
                  const val = litrosPorOrigem[cId] ?? "";
                  const sobra = disponiveis && val ? disponiveis - parseFloat(val) : null;
                  return (
                    <div key={cId} className="flex items-center gap-2">
                      <span className="text-xs font-medium text-purple-700 w-16 shrink-0">{(c as any)?.codigo?.toUpperCase() ?? "?"}</span>
                      <input
                        type="number"
                        min="1"
                        step="1"
                        placeholder={disponiveis ? `Disp: ${disponiveis.toLocaleString("pt-PT")} L` : "Litros..."}
                        value={val}
                        onChange={(e) => setLitrosPorOrigem((prev) => ({ ...prev, [cId]: e.target.value }))}
                        className="flex-1 px-3 py-1.5 border border-gray-200 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-purple-300"
                      />
                      {sobra !== null && (
                        <span className={`text-xs font-medium shrink-0 ${sobra < 0 ? "text-red-500" : sobra > 0 ? "text-amber-600" : "text-green-600"}`}>
                          {sobra > 0.1 ? `Sobram ${sobra.toFixed(0)} L` : sobra < -0.1 ? "Excede!" : "✓ Tudo"}
                        </span>
                      )}
                    </div>
                  );
                })}
                <p className="text-xs text-amber-600 mt-1">⚠️ Se sobrar volume, a cuba de origem mantém os litros sobrantes.</p>
              </div>
            )}
            {/* Aviso de sobras após junção */}
            {sobrasAviso.length > 0 && (
              <div className="bg-amber-50 border border-amber-200 rounded-xl p-3 space-y-1">
                <p className="text-xs font-semibold text-amber-700">⚠️ Sobras detectadas após junção:</p>
                {sobrasAviso.map((s) => (
                  <p key={s.cubaId} className="text-xs text-amber-600">
                    {s.codigo.toUpperCase()}: {s.litrosTransferidos.toLocaleString("pt-PT")} L transferidos, <strong>{s.litrosSobrantes.toFixed(0)} L sobraram</strong> e ficaram na cuba.
                  </p>
                ))}
                <button onClick={() => { setSobrasAviso([]); setShowTransferir(false); }} className="mt-2 text-xs text-amber-700 underline">Fechar</button>
              </div>
            )}

            <div>
              <label className="block text-xs font-medium text-gray-600 mb-1">Motivo / notas</label>
              <input
                type="text"
                value={motivoMovimento}
                onChange={(e) => setMotivoMovimento(e.target.value)}
                placeholder="ex: Cor do vinho, capacidade, etc."
                className="w-full px-3 py-2 border border-gray-200 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-blue-300"
              />
            </div>
          </div>
          <DialogFooter>
            <button
              onClick={() => setShowTransferir(false)}
              className="px-4 py-2 border border-gray-200 rounded-lg text-sm text-gray-600 hover:bg-gray-50"
            >
              Cancelar
            </button>
            <button
              onClick={() => {
                if (!cubaDestinoId) { toast.error("Seleccione a cuba de destino"); return; }
                if (tipoMovimento === "transferencia") {
                  const destinosValidos = destinosTransferencia.filter((d) => d.cubaId > 0 && parseFloat(d.litros) > 0);
                  if (destinosValidos.length === 0) { toast.error("Adicione pelo menos um destino com litros"); return; }
                  transferirMutation.mutate({
                    cubaOrigemId: cuba.id,
                    destinos: destinosValidos.map((d) => ({ cubaId: d.cubaId, litros: parseFloat(d.litros), cubaCodigo: d.cubaCodigo })),
                    dataMovimento,
                    motivo: motivoMovimento || undefined,
                    restaOrigem,
                  });
                } else {
                  if (cubasJuncaoIds.length === 0) { toast.error("Adicione pelo menos uma cuba à junção"); return; }
                  const litrosArray = [cuba.id, ...cubasJuncaoIds]
                    .filter((cId) => litrosPorOrigem[cId] && parseFloat(litrosPorOrigem[cId]) > 0)
                    .map((cId) => ({ cubaId: cId, litros: parseFloat(litrosPorOrigem[cId]) }));
                  juntarMutation.mutate({
                    cubasOrigemIds: [cuba.id, ...cubasJuncaoIds],
                    cubaDestinoId,
                    dataMovimento,
                    motivo: motivoMovimento || undefined,
                    litrosPorOrigem: litrosArray.length > 0 ? litrosArray : undefined,
                  });
                }
              }}
              disabled={transferirMutation.isPending || juntarMutation.isPending}
              className={`px-4 py-2 rounded-lg text-sm font-semibold text-white transition-colors disabled:opacity-60 ${
                tipoMovimento === "transferencia" ? "bg-blue-600 hover:bg-blue-700" : "bg-purple-600 hover:bg-purple-700"
              }`}
            >
              {(transferirMutation.isPending || juntarMutation.isPending) ? "A processar..." :
               tipoMovimento === "transferencia" ? "Confirmar Transferência" : "Confirmar Junção"}
            </button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

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
              {cuba.tipoCuba === "porto" ? (
                <>
                  <div>
                    <label className="block text-xs font-medium mb-1" style={{ color: CORES.densL1 }}>Baumé (°)</label>
                    <input type="number" step="0.01" value={editForm.baumeL1}
                      onChange={(e) => setEditForm({ ...editForm, baumeL1: e.target.value })}
                      className="w-full border border-gray-200 rounded-lg px-3 py-2 text-sm focus:outline-none focus:border-green-500"
                    />
                  </div>
                  <div>
                    <label className="block text-xs font-medium mb-1" style={{ color: CORES.tempL1 }}>Temperatura (°C)</label>
                    <input type="number" step="0.1" value={editForm.tempL1}
                      onChange={(e) => setEditForm({ ...editForm, tempL1: e.target.value })}
                      className="w-full border border-gray-200 rounded-lg px-3 py-2 text-sm focus:outline-none focus:border-green-500"
                    />
                  </div>
                </>
              ) : (
                <>
                  <div>
                    <label className="block text-xs font-medium mb-1" style={{ color: CORES.densL1 }}>Densidade</label>
                    <input type="number" step="0.0001" value={editForm.densL1}
                      onChange={(e) => setEditForm({ ...editForm, densL1: e.target.value })}
                      className="w-full border border-gray-200 rounded-lg px-3 py-2 text-sm focus:outline-none focus:border-green-500"
                    />
                  </div>
                  <div>
                    <label className="block text-xs font-medium mb-1" style={{ color: CORES.tempL1 }}>Temperatura (°C)</label>
                    <input type="number" step="0.1" value={editForm.tempL1}
                      onChange={(e) => setEditForm({ ...editForm, tempL1: e.target.value })}
                      className="w-full border border-gray-200 rounded-lg px-3 py-2 text-sm focus:outline-none focus:border-green-500"
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
                </>
              )}
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

            {/* Desvio de densidade (só para cubas normais) */}
            {cuba.tipoCuba !== "porto" && (
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
            )}

            {/* Alertas de densidade por valor (só para cubas normais) */}
            {cuba.tipoCuba !== "porto" && (
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">
                  Alertas de densidade por valor específico
                </label>
                <input
                  type="text"
                  placeholder="ex: 1.050, 1.020, 1.000"
                  value={alertaForm.alertasDensidadeStr}
                  onChange={(e) => setAlertaForm({ ...alertaForm, alertasDensidadeStr: e.target.value })}
                  className="w-full border border-gray-200 rounded-lg px-3 py-2 text-sm focus:outline-none focus:border-amber-500"
                />
                <p className="text-xs text-gray-400 mt-1">
                  Separados por vírgula. Alerta quando a densidade baixar para ou abaixo de cada valor indicado.
                </p>
              </div>
            )}

            {/* Ponto de aguardentação (só para cubas VP) */}
            {cuba.tipoCuba === "porto" && (
              <>
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">
                    Ponto de aguardentação (Baumé °)
                  </label>
                  <input
                    type="number"
                    step="0.1"
                    placeholder="ex: 6.5"
                    value={alertaForm.pontoAguardentacao}
                    onChange={(e) => setAlertaForm({ ...alertaForm, pontoAguardentacao: e.target.value })}
                    className="w-full border border-gray-200 rounded-lg px-3 py-2 text-sm focus:outline-none focus:border-red-500"
                  />
                  <p className="text-xs text-gray-400 mt-1">
                    Alerta quando o Baumé atingir este valor. Aparece também como linha de referência no gráfico.
                  </p>
                </div>
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">
                    Desvio de tolerância para aguardentação (° Baumé)
                  </label>
                  <input
                    type="number"
                    step="0.1"
                    min="0.1"
                    value={alertaForm.desvioAguardentacaoAlerta}
                    onChange={(e) => setAlertaForm({ ...alertaForm, desvioAguardentacaoAlerta: e.target.value })}
                    className="w-full border border-gray-200 rounded-lg px-3 py-2 text-sm focus:outline-none focus:border-red-500"
                  />
                  <p className="text-xs text-gray-400 mt-1">
                    Alerta quando o Baumé estiver dentro de ±{alertaForm.desvioAguardentacaoAlerta}° do ponto de aguardentação.
                  </p>
                </div>
              </>
            )}
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
                // Converter lista de densidades para JSON
                let alertasDensidade: string | null = null;
                if (alertaForm.alertasDensidadeStr.trim()) {
                  const vals = alertaForm.alertasDensidadeStr.split(",")
                    .map((s) => parseFloat(s.trim()))
                    .filter((n) => !isNaN(n));
                  if (vals.length > 0) alertasDensidade = JSON.stringify(vals);
                }
                updateAlertas.mutate({
                  id: cuba.id,
                  tempPretendida: alertaForm.tempPretendida || null,
                  desvioTempAlerta: alertaForm.desvioTempAlerta,
                  desvioDesnsAlerta: alertaForm.desvioDesnsAlerta,
                  alertasDensidade,
                  pontoAguardentacao: alertaForm.pontoAguardentacao || null,
                  desvioAguardentacaoAlerta: alertaForm.desvioAguardentacaoAlerta,
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

      {/* Modal: Ficha Inicial */}
      <Dialog open={showFichaInicial} onOpenChange={setShowFichaInicial}>
        <DialogContent className="max-w-lg">
          <DialogHeader>
            <DialogTitle className="text-[var(--color-vinho)]" style={{ fontFamily: "var(--font-serif)" }}>
              Ficha Inicial — {cuba.codigo.toUpperCase()}
            </DialogTitle>
          </DialogHeader>
          <div className="py-2 grid grid-cols-2 gap-4">
            {([
              { key: "fichaKilos", label: "Kilos", placeholder: "ex: 15000" },
              { key: "fichaLitros", label: "Litros", placeholder: "ex: 12000" },
              { key: "fichaPh", label: "pH", placeholder: "ex: 3.45" },
              { key: "fichaAt", label: "AT (g/L)", placeholder: "ex: 6.5" },
              { key: "fichaAv", label: "AV (g/L)", placeholder: "ex: 0.35" },
              { key: "fichaNfa", label: "NFA (mg/L)", placeholder: "ex: 180" },
              { key: "fichaNtu", label: "NTU", placeholder: "ex: 120" },
              { key: "fichaGluconico", label: "Glucónico (g/L)", placeholder: "ex: 0.5" },
              { key: "fichaAlcoolProvavel", label: "Alcool Provável (%)", placeholder: "ex: 13.5" },
            ] as { key: keyof typeof fichaForm; label: string; placeholder: string }[]).map(({ key, label, placeholder }) => (
              <div key={key} className={key === "fichaAlcoolProvavel" ? "col-span-2" : ""}>
                <label className="block text-xs font-medium text-gray-600 mb-1">{label}</label>
                <input
                  type="text"
                  inputMode="decimal"
                  placeholder={placeholder}
                  value={fichaForm[key]}
                  onChange={(e) => setFichaForm({ ...fichaForm, [key]: e.target.value })}
                  className="w-full border border-gray-200 rounded-lg px-3 py-2 text-sm focus:outline-none focus:border-[var(--color-vinho)]"
                />
              </div>
            ))}
            {/* Campos VP — ponto de aguardentação */}
            {cuba.tipoCuba === "porto" && (
              <>
                <div className="col-span-2 border-t border-amber-100 pt-3 mt-1">
                  <p className="text-xs font-semibold text-amber-800 mb-3 flex items-center gap-1">
                    ⚠️ Vinho do Porto — Aguardentação
                  </p>
                </div>
                <div>
                  <label className="block text-xs font-medium text-gray-600 mb-1">Ponto de Aguardentação (Baumé °)</label>
                  <input
                    type="number"
                    step="0.1"
                    placeholder="ex: 6.5"
                    value={alertaForm.pontoAguardentacao}
                    onChange={(e) => setAlertaForm({ ...alertaForm, pontoAguardentacao: e.target.value })}
                    className="w-full border border-amber-200 rounded-lg px-3 py-2 text-sm focus:outline-none focus:border-amber-500"
                  />
                  <p className="text-xs text-gray-400 mt-1">Baumé alvo para adicionar aguardente.</p>
                </div>
                <div>
                  <label className="block text-xs font-medium text-gray-600 mb-1">Desvio de tolerância (± Baumé °)</label>
                  <input
                    type="number"
                    step="0.1"
                    min="0.1"
                    placeholder="ex: 0.5"
                    value={alertaForm.desvioAguardentacaoAlerta}
                    onChange={(e) => setAlertaForm({ ...alertaForm, desvioAguardentacaoAlerta: e.target.value })}
                    className="w-full border border-amber-200 rounded-lg px-3 py-2 text-sm focus:outline-none focus:border-amber-500"
                  />
                  <p className="text-xs text-gray-400 mt-1">Alerta quando Baumé estiver dentro de ±{alertaForm.desvioAguardentacaoAlerta}° do ponto.</p>
                </div>
              </>
            )}
          </div>
          <DialogFooter>
            <button
              onClick={() => setShowFichaInicial(false)}
              className="px-4 py-2 rounded-lg border border-gray-200 text-sm text-gray-600 hover:bg-gray-50"
            >
              Cancelar
            </button>
            <button
              onClick={() => {
                if (!cuba) return;
                updateFichaInicial.mutate({
                  id: cuba.id,
                  fichaKilos: fichaForm.fichaKilos || null,
                  fichaLitros: fichaForm.fichaLitros || null,
                  fichaPh: fichaForm.fichaPh || null,
                  fichaAt: fichaForm.fichaAt || null,
                  fichaAv: fichaForm.fichaAv || null,
                  fichaNfa: fichaForm.fichaNfa || null,
                  fichaNtu: fichaForm.fichaNtu || null,
                  fichaGluconico: fichaForm.fichaGluconico || null,
                  fichaAlcoolProvavel: fichaForm.fichaAlcoolProvavel || null,
                });
                // Para cubas VP, guardar também o ponto de aguardentação
                if (cuba.tipoCuba === "porto" && (alertaForm.pontoAguardentacao || alertaForm.desvioAguardentacaoAlerta)) {
                  updateAlertas.mutate({
                    id: cuba.id,
                    tempPretendida: alertaForm.tempPretendida || null,
                    desvioTempAlerta: alertaForm.desvioTempAlerta,
                    desvioDesnsAlerta: alertaForm.desvioDesnsAlerta,
                    pontoAguardentacao: alertaForm.pontoAguardentacao || null,
                    desvioAguardentacaoAlerta: alertaForm.desvioAguardentacaoAlerta,
                  });
                }
              }}
              disabled={updateFichaInicial.isPending || updateAlertas.isPending}
              className="flex items-center gap-2 px-5 py-2 bg-[var(--color-vinho)] text-white rounded-lg text-sm font-semibold hover:opacity-90 disabled:opacity-50"
            >
              {updateFichaInicial.isPending ? <RefreshCw size={14} className="animate-spin" /> : <ClipboardList size={14} />}
              Guardar ficha
            </button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Diálogo: Limite de densidade atingido */}
      {alertaLimiteDens && (
        <div className="fixed inset-0 z-[60] flex items-center justify-center bg-black/60 px-4">
          <div className="bg-white rounded-2xl shadow-2xl p-6 w-full max-w-md animate-fade-in">
            <div className="flex items-center gap-3 mb-4">
              <div className="w-10 h-10 rounded-full bg-amber-100 flex items-center justify-center">
                <AlertTriangle size={20} className="text-amber-700" />
              </div>
              <div>
                <h2 className="text-lg font-bold text-amber-800" style={{ fontFamily: "var(--font-serif)" }}>
                  Densidade Limite Atingida
                </h2>
                <p className="text-xs text-gray-500">{cuba?.codigo?.toUpperCase()}</p>
              </div>
            </div>
            <p className="text-sm text-gray-700 mb-2">
              A densidade registada <strong>{parseFloat(alertaLimiteDens.densidadeAtual).toFixed(4)}</strong> atingiu
              ou ultrapassou o limite configurado de <strong>{alertaLimiteDens.densidadeLimite}</strong>.
            </p>
            <p className="text-sm text-gray-600 mb-5">
              A fermentação continua ativa. Pode terminar agora ou continuar a registar leituras e terminar mais tarde.
            </p>
            <div className="flex gap-3 justify-end">
              <button
                onClick={() => setAlertaLimiteDens(null)}
                className="px-4 py-2 rounded-lg border border-gray-200 text-sm text-gray-600 hover:bg-gray-50"
              >
                Continuar fermentação
              </button>
              <button
                onClick={() => {
                  setAlertaLimiteDens(null);
                  if (cuba) setNomeLoteTerminar(cuba.nomeLote ?? "");
                  setShowTerminarFerm(true);
                }}
                className="flex items-center gap-2 px-5 py-2 bg-[var(--color-vinho)] text-white rounded-lg text-sm font-semibold hover:bg-[var(--color-vinho-light)]"
              >
                <CheckCircle2 size={14} />
                Terminar agora
              </button>
            </div>
          </div>
        </div>
      )}
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
