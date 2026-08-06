import { formatarDensidade } from "@shared/const";
import { trpc } from "@/lib/trpc";
import { AlertTriangle, Archive, BarChart3, Calendar, CheckCircle2, Circle, ClipboardList, Download, FileSpreadsheet, FileText, FlaskConical, Mail, Search, Upload, X } from "lucide-react";
import { toast } from "sonner";
import { useState, useMemo, useRef, useEffect } from "react";
import { Link } from "wouter";
import ImportacaoCsvModal from "@/components/ImportacaoCsvModal";
import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuTrigger } from "@/components/ui/dropdown-menu";

type Estado = "todos" | "sem_dados" | "em_fermentacao" | "completa" | "com_alertas";

const estadoConfig = {
  sem_dados: {
    label: "Sem dados",
    icon: <Circle size={12} className="text-gray-400" />,
    card: "bg-white border-gray-200 hover:border-gray-300",
    badge: "bg-gray-100 text-gray-500",
    dot: "bg-gray-300",
  },
  em_fermentacao: {
    label: "Em fermentação",
    icon: <FlaskConical size={12} className="text-amber-500" />,
    card: "bg-amber-50 border-amber-200 hover:border-amber-400",
    badge: "bg-amber-100 text-amber-700",
    dot: "bg-amber-400 animate-pulse",
  },
  completa: {
    label: "Vazia",
    icon: <Circle size={12} className="text-gray-400" />,
    card: "bg-white border-gray-200 hover:border-gray-300",
    badge: "bg-gray-100 text-gray-500",
    dot: "bg-gray-300",
  },
};

/** Calcula alertas para uma cuba com base nas suas leituras — lógica idêntica ao CubaPage */
function temAlertasAtivos(cuba: {
  tempPretendida?: string | null;
  desvioTempAlerta?: string | null;
  desvioDesnsAlerta?: string | null;
  leituras: Array<{
    densL1?: string | null; densL2?: string | null; densL3?: string | null;
    tempL1?: string | null; tempL2?: string | null; tempL3?: string | null;
  }>;
}): boolean {
  const desvioTemp = parseFloat(cuba.desvioTempAlerta ?? "5") || 5;
  const desvioDesns = parseFloat(cuba.desvioDesnsAlerta ?? "0.010") || 0.010;

  for (let i = 0; i < cuba.leituras.length; i++) {
    const l = cuba.leituras[i];

    // Alerta de temperatura
    if (cuba.tempPretendida) {
      const pretendida = parseFloat(cuba.tempPretendida);
      const temps = [l.tempL1, l.tempL2, l.tempL3]
        .filter((t): t is string => !!t)
        .map(parseFloat);
      for (const t of temps) {
        if (Math.abs(t - pretendida) > desvioTemp) return true;
      }
    }

    // Alerta de variação brusca de densidade
    if (i > 0) {
      const anterior = cuba.leituras[i - 1];
      const pares: [string | null | undefined, string | null | undefined][] = [
        [anterior.densL1, l.densL1],
        [anterior.densL2, l.densL2],
        [anterior.densL3, l.densL3],
      ];
      for (const [ant, atual] of pares) {
        if (ant && atual) {
          const diff = Math.abs(parseFloat(ant) - parseFloat(atual));
          if (diff > desvioDesns) return true;
        }
      }
    }
  }
  return false;
}

export default function Dashboard() {
  const [filtro, setFiltro] = useState<Estado>("todos");

  const enviarRelatorio = trpc.relatorio.enviarDigestDiario.useMutation({
    onSuccess: (data) => {
      toast.success(`Relatório enviado com sucesso — ${data.cubasAtivas} cuba(s) activa(s)`);
    },
    onError: (err) => {
      toast.error(`Erro ao enviar relatório: ${err.message}`);
    },
  });
  const [csvModalAberto, setCsvModalAberto] = useState(false);
  const [termoPesquisa, setTermoPesquisa] = useState("");
  const [pesquisaAberta, setPesquisaAberta] = useState(false);
  const pesquisaRef = useRef<HTMLDivElement>(null);

  // Fechar pesquisa ao clicar fora
  useEffect(() => {
    function handleClick(e: MouseEvent) {
      if (pesquisaRef.current && !pesquisaRef.current.contains(e.target as Node)) {
        setPesquisaAberta(false);
      }
    }
    document.addEventListener("mousedown", handleClick);
    return () => document.removeEventListener("mousedown", handleClick);
  }, []);

  const termoDebouncado = useMemo(() => termoPesquisa.trim(), [termoPesquisa]);
  const { data: resultadosPesquisa, isLoading: pesquisando } = trpc.pesquisa.global.useQuery(
    { termo: termoDebouncado },
    { enabled: termoDebouncado.length >= 2 }
  );
  const utils = trpc.useUtils();
  const { data: cubas, isLoading } = trpc.cubas.dashboard.useQuery();
  const { data: todasLeituras, isLoading: loadingAlertas } = trpc.leituras.listAllDashboard.useQuery();
  const { data: campanhaAtiva } = trpc.campanhas.ativa.useQuery();

  const semDados = cubas?.filter((c) => c.estado === "sem_dados").length ?? 0;
  const emFermentacao = cubas?.filter((c) => c.estado === "em_fermentacao").length ?? 0;
  const completas = cubas?.filter((c) => c.estado === "completa").length ?? 0;

  // Calcular alertas por cuba
  const alertasPorCuba = useMemo(() => {
    if (!cubas || !todasLeituras) return new Map<number, boolean>();
    const map = new Map<number, boolean>();
    for (const cuba of cubas) {
      if (cuba.estado !== "em_fermentacao") continue;
      const leiturasC = todasLeituras.filter((l) => l.cubaId === cuba.id && l.fermentacaoNum === cuba.fermentacaoNum);
      map.set(cuba.id, temAlertasAtivos({ ...cuba, leituras: leiturasC }));
    }
    return map;
  }, [cubas, todasLeituras]);

  const totalAlertas = useMemo(() => {
    let count = 0;
    alertasPorCuba.forEach((v) => { if (v) count++; });
    return count;
  }, [alertasPorCuba]);

  const cubasFiltradas = cubas?.filter((c) => {
    if (filtro === "todos") return true;
    if (filtro === "com_alertas") return alertasPorCuba.get(c.id) === true;
    return c.estado === filtro;
  });

  const totalResultados = resultadosPesquisa
    ? (resultadosPesquisa.cubas?.length ?? 0) + (resultadosPesquisa.adicoes?.length ?? 0) + (resultadosPesquisa.arquivo?.length ?? 0)
    : 0;

  return (
    <div className="p-4 sm:p-6 lg:p-8 animate-fade-in">
      {/* Cabeçalho */}
      <div className="mb-6 flex flex-wrap items-start justify-between gap-4">
        <div>
          <div className="flex items-center gap-3 mb-1">
            <BarChart3 size={22} className="text-[var(--color-vinho)]" />
            <h1 className="text-2xl font-bold text-[var(--color-vinho)]">Dashboard</h1>
          </div>
          <p className="text-gray-500 text-sm">Estado geral das 62 cubas de fermentação</p>
        </div>
        <div className="flex items-center gap-2">
          <Link href="/campanhas">
            <button className={`flex items-center gap-2 px-4 py-2 rounded-lg text-sm font-semibold transition-colors ${
              campanhaAtiva
                ? "bg-[var(--color-vinho)] text-white hover:bg-[var(--color-vinho)]/90 shadow"
                : "border border-[var(--color-vinho)] text-[var(--color-vinho)] hover:bg-[var(--color-vinho)]/5"
            }`}>
              <Calendar size={16} />
              {campanhaAtiva ? (
                <span className="flex items-center gap-1.5">
                  <span className="w-2 h-2 rounded-full bg-amber-300 animate-pulse" />
                  {campanhaAtiva.nome}
                </span>
              ) : "Campanhas"}
            </button>
          </Link>
          <button
            onClick={() => setCsvModalAberto(true)}
            className="flex items-center gap-2 px-4 py-2 rounded-lg border border-amber-600 text-amber-700 text-sm font-semibold hover:bg-amber-50 transition-colors"
          >
            <Upload size={16} />
            Importar CSV
          </button>
          <button
            onClick={() => enviarRelatorio.mutate()}
            disabled={enviarRelatorio.isPending}
            className="flex items-center gap-2 px-4 py-2 rounded-lg border border-[var(--color-vinho)] text-[var(--color-vinho)] text-sm font-semibold hover:bg-[var(--color-vinho)]/5 transition-colors disabled:opacity-60 disabled:cursor-not-allowed"
          >
            {enviarRelatorio.isPending ? (
              <>
                <svg className="animate-spin h-4 w-4" xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24">
                  <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
                  <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8v8z" />
                </svg>
                A enviar...
              </>
            ) : (
              <>
                <Mail size={16} />
                Enviar Relatório
              </>
            )}
          </button>
          <DropdownMenu>
            <DropdownMenuTrigger asChild>
              <button className="flex items-center gap-2 px-4 py-2 rounded-lg border border-gray-300 text-gray-700 text-sm font-semibold hover:bg-gray-50 transition-colors">
                <Download size={16} />
                Exportar
              </button>
            </DropdownMenuTrigger>
            <DropdownMenuContent align="end" className="w-48">
              <DropdownMenuItem
                onClick={() => { window.open("/api/export/dashboard-pdf", "_blank"); }}
                className="flex items-center gap-2 cursor-pointer"
              >
                <FileText size={15} className="text-red-600" />
                <span>Exportar PDF</span>
              </DropdownMenuItem>
              <DropdownMenuItem
                onClick={() => { window.open("/api/export/dashboard-excel", "_blank"); }}
                className="flex items-center gap-2 cursor-pointer"
              >
                <FileSpreadsheet size={15} className="text-green-600" />
                <span>Exportar Excel</span>
              </DropdownMenuItem>
            </DropdownMenuContent>
          </DropdownMenu>
          <Link href="/registo-rapido">
            <button className="flex items-center gap-2 px-4 py-2 rounded-lg bg-[var(--color-vinho)] text-white text-sm font-semibold shadow hover:bg-[var(--color-vinho)]/90 transition-colors">
              <ClipboardList size={16} />
              Registo Rápido
            </button>
          </Link>
        </div>
      </div>

      {/* Barra de Pesquisa Global */}
      <div ref={pesquisaRef} className="relative mb-6">
        <div className="relative">
          <Search size={16} className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400" />
          <input
            type="text"
            value={termoPesquisa}
            onChange={(e) => { setTermoPesquisa(e.target.value); setPesquisaAberta(true); }}
            onFocus={() => termoPesquisa.length >= 2 && setPesquisaAberta(true)}
            placeholder="Pesquisar por cuba, lote, produto adicionado, casta..."
            className="w-full pl-9 pr-9 py-2.5 rounded-xl border border-gray-200 bg-white text-sm focus:outline-none focus:ring-2 focus:ring-[var(--color-vinho)]/30 focus:border-[var(--color-vinho)] transition-all shadow-sm"
          />
          {termoPesquisa && (
            <button onClick={() => { setTermoPesquisa(""); setPesquisaAberta(false); }} className="absolute right-3 top-1/2 -translate-y-1/2 text-gray-400 hover:text-gray-600">
              <X size={15} />
            </button>
          )}
        </div>

        {/* Painel de resultados */}
        {pesquisaAberta && termoDebouncado.length >= 2 && (
          <div className="absolute top-full left-0 right-0 mt-1 bg-white border border-gray-200 rounded-xl shadow-xl z-50 max-h-[480px] overflow-y-auto">
            {pesquisando ? (
              <div className="p-6 text-center text-gray-400 text-sm">A pesquisar...</div>
            ) : totalResultados === 0 ? (
              <div className="p-6 text-center text-gray-400 text-sm">
                <Search size={24} className="mx-auto mb-2 opacity-30" />
                Nenhum resultado para "{termoDebouncado}"
              </div>
            ) : (
              <div className="divide-y divide-gray-100">
                {/* Cubas */}
                {(resultadosPesquisa?.cubas?.length ?? 0) > 0 && (
                  <div>
                    <div className="px-4 py-2 text-xs font-bold text-gray-400 uppercase tracking-wider bg-gray-50">Cubas ({resultadosPesquisa!.cubas.length})</div>
                    {resultadosPesquisa!.cubas.map((cuba) => (
                      <Link key={cuba.id} href={`/cuba/${cuba.codigo}`}>
                        <div onClick={() => setPesquisaAberta(false)} className="flex items-center gap-3 px-4 py-3 hover:bg-amber-50 cursor-pointer transition-colors">
                          <FlaskConical size={16} className="text-amber-500 shrink-0" />
                          <div className="min-w-0">
                            <p className="text-sm font-semibold text-gray-800">{cuba.codigo.toUpperCase()}</p>
                            {cuba.nomeLote && <p className="text-xs text-gray-500 truncate">{cuba.nomeLote}</p>}
                          </div>
                          <span className={`ml-auto text-[10px] px-2 py-0.5 rounded-full font-medium shrink-0 ${
                            cuba.estado === "em_fermentacao" ? "bg-amber-100 text-amber-700" : "bg-gray-100 text-gray-500"
                          }`}>{cuba.estado === "em_fermentacao" ? "Em fermentação" : "Vazia"}</span>
                        </div>
                      </Link>
                    ))}
                  </div>
                )}

                {/* Adições */}
                {(resultadosPesquisa?.adicoes?.length ?? 0) > 0 && (
                  <div>
                    <div className="px-4 py-2 text-xs font-bold text-gray-400 uppercase tracking-wider bg-gray-50">Adições ({resultadosPesquisa!.adicoes.length})</div>
                    {resultadosPesquisa!.adicoes.map((adicao) => (
                      <Link key={adicao.id} href={`/cuba/${adicao.cubaCodigo}`}>
                        <div onClick={() => setPesquisaAberta(false)} className="flex items-center gap-3 px-4 py-3 hover:bg-amber-50 cursor-pointer transition-colors">
                          <div className="w-8 h-8 rounded-lg bg-green-100 flex items-center justify-center shrink-0">
                            <span className="text-[10px] font-bold text-green-700">{adicao.cubaCodigo?.toUpperCase()}</span>
                          </div>
                          <div className="min-w-0 flex-1">
                            <p className="text-sm font-semibold text-gray-800 truncate">{adicao.produto ?? "—"}</p>
                            <p className="text-xs text-gray-500">{adicao.cubaCodigo?.toUpperCase()} · {adicao.dataAdicao} {adicao.dose ? `· ${adicao.dose}` : ""}</p>
                            {adicao.observacoes && <p className="text-xs text-gray-400 truncate">{adicao.observacoes}</p>}
                          </div>
                        </div>
                      </Link>
                    ))}
                  </div>
                )}

                {/* Arquivo */}
                {(resultadosPesquisa?.arquivo?.length ?? 0) > 0 && (
                  <div>
                    <div className="px-4 py-2 text-xs font-bold text-gray-400 uppercase tracking-wider bg-gray-50">Fermentações Arquivadas ({resultadosPesquisa!.arquivo.length})</div>
                    {resultadosPesquisa!.arquivo.map((ferm) => (
                      <Link key={ferm.id} href={`/cuba/${ferm.cubaCodigo}`}>
                        <div onClick={() => setPesquisaAberta(false)} className="flex items-center gap-3 px-4 py-3 hover:bg-amber-50 cursor-pointer transition-colors">
                          <Archive size={16} className="text-gray-400 shrink-0" />
                          <div className="min-w-0 flex-1">
                            <p className="text-sm font-semibold text-gray-800">{ferm.cubaCodigo?.toUpperCase()} — Ferm. #{ferm.fermentacaoNum}</p>
                            {ferm.nomeLote && <p className="text-xs text-gray-500 truncate">{ferm.nomeLote}</p>}
                            <p className="text-xs text-gray-400">{ferm.dataInicio ?? "?"} → {ferm.dataFim ?? "?"} · {ferm.totalDias ?? "?"} dias</p>
                          </div>
                        </div>
                      </Link>
                    ))}
                  </div>
                )}
              </div>
            )}
          </div>
        )}
      </div>
      <ImportacaoCsvModal
        open={csvModalAberto}
        onClose={() => setCsvModalAberto(false)}
        onImportado={() => { utils.cubas.dashboard.invalidate(); utils.leituras.listAllDashboard.invalidate(); }}
      />

      {/* Estatísticas */}
      <div className="grid grid-cols-2 sm:grid-cols-5 gap-3 mb-6">
        <StatCard label="Total" value={62} color="text-[var(--color-vinho)]" bg="bg-white" />
        <StatCard label="Sem dados" value={semDados} color="text-gray-500" bg="bg-white" />
        <StatCard label="Em fermentação" value={emFermentacao} color="text-amber-600" bg="bg-amber-50" />
        <StatCard label="Vazias" value={completas} color="text-gray-500" bg="bg-white" />
        <StatCard label="Com alertas" value={totalAlertas} color="text-red-600" bg="bg-red-50" icon={<AlertTriangle size={14} className="text-red-500" />} loading={loadingAlertas} />
      </div>

      {/* Filtros */}
      <div className="flex flex-wrap gap-2 mb-5">
        {(["todos", "sem_dados", "em_fermentacao", "completa", "com_alertas"] as Estado[]).map((f) => (
          <button
            key={f}
            onClick={() => setFiltro(f)}
            className={`px-3 py-1.5 rounded-lg text-xs font-medium border transition-all ${
              filtro === f
                ? f === "com_alertas"
                  ? "bg-red-600 text-white border-red-600"
                  : "bg-[var(--color-vinho)] text-white border-[var(--color-vinho)]"
                : f === "com_alertas"
                  ? "bg-red-50 text-red-600 border-red-200 hover:border-red-400"
                  : "bg-white text-gray-600 border-gray-200 hover:border-gray-300"
            }`}
          >
            {f === "todos"
              ? "Todas"
              : f === "sem_dados"
              ? "Sem dados"
              : f === "em_fermentacao"
              ? "Em fermentação"
              : f === "completa"
              ? "Vazias"
              : (
                <span className="flex items-center gap-1">
                  <AlertTriangle size={11} /> Com alertas {totalAlertas > 0 && `(${totalAlertas})`}
                </span>
              )}
          </button>
        ))}
      </div>

      {/* Grid de cubas */}
      {isLoading ? (
        <div className="grid grid-cols-3 sm:grid-cols-4 md:grid-cols-6 lg:grid-cols-8 xl:grid-cols-10 gap-2">
          {Array.from({ length: 84 }).map((_, i) => (
            <div key={i} className="h-24 rounded-lg bg-gray-100 animate-pulse" />
          ))}
        </div>
      ) : (
        <div className="grid grid-cols-3 sm:grid-cols-4 md:grid-cols-6 lg:grid-cols-8 xl:grid-cols-10 gap-2">
          {cubasFiltradas?.map((cuba) => {
            const cfg = estadoConfig[cuba.estado];
            const temAlerta = alertasPorCuba.get(cuba.id) === true;
            return (
              <Link key={cuba.id} href={`/cuba/${cuba.codigo}`}>
                <div
                  className={`relative border rounded-lg p-3 cursor-pointer transition-all duration-150 hover:shadow-md hover:-translate-y-0.5 ${
                    temAlerta
                      ? "bg-red-50 border-red-300 hover:border-red-500"
                      : cfg.card
                  }`}
                >
                  {/* Badge de alerta */}
                  {temAlerta && (
                    <div className="absolute -top-1.5 -right-1.5 w-4 h-4 bg-red-500 rounded-full flex items-center justify-center shadow">
                      <AlertTriangle size={9} className="text-white" />
                    </div>
                  )}
                  <div className="flex items-center justify-between mb-1">
                    <span className="text-xs font-bold text-gray-400 uppercase tracking-wide">
                      {cuba.codigo}
                    </span>
                    <div className="flex items-center gap-1">
                      {(cuba as { tipoCuba?: string }).tipoCuba === "porto" && (
                        <span className="text-[8px] font-bold bg-amber-800 text-amber-100 px-1 rounded">VP</span>
                      )}
                      <div className={`w-2 h-2 rounded-full ${temAlerta ? "bg-red-400 animate-pulse" : cfg.dot}`} />
                    </div>
                  </div>
                  <p className="text-sm font-semibold text-gray-700 truncate leading-tight">
                    {cuba.nomeLote ?? "—"}
                  </p>
                  {(cuba as { ultimaDensidade?: string | null }).ultimaDensidade && (
                    <p className="text-xs font-mono text-gray-600 mt-0.5 truncate">
                      {formatarDensidade((cuba as { ultimaDensidade: string }).ultimaDensidade)}
                    </p>
                  )}
                  {(cuba as { fichaLitros?: string | null }).fichaLitros && (
                    <p className="text-xs font-mono text-gray-500 truncate">
                      {Math.round(parseFloat((cuba as { fichaLitros: string }).fichaLitros)).toLocaleString("pt-PT")} L
                    </p>
                  )}
                  <div className={`mt-1.5 inline-flex items-center gap-1 px-2 py-0.5 rounded text-[10px] font-medium ${
                    temAlerta ? "bg-red-100 text-red-700" : cfg.badge
                  }`}>
                    {temAlerta ? <AlertTriangle size={9} /> : cfg.icon}
                    <span className="hidden sm:inline">
                      {temAlerta
                        ? "Alerta"
                        : cuba.estado === "em_fermentacao"
                        ? "Ativa"
                        : "Vazia"}
                    </span>
                  </div>
                </div>
              </Link>
            );
          })}
        </div>
      )}

      {cubasFiltradas?.length === 0 && !isLoading && (
        <div className="text-center py-16 text-gray-400">
          <FlaskConical size={40} className="mx-auto mb-3 opacity-30" />
          <p className="text-sm">Nenhuma cuba com este estado</p>
        </div>
      )}
    </div>
  );
}

function StatCard({
  label,
  value,
  color,
  bg,
  icon,
  loading,
}: {
  label: string;
  value: number;
  color: string;
  bg: string;
  icon?: React.ReactNode;
  loading?: boolean;
}) {
  return (
    <div className={`${bg} rounded-xl border border-gray-100 p-4 shadow-sm`}>
      <div className="flex items-center gap-1 mb-1">
        {icon}
        <p className="text-xs text-gray-500">{label}</p>
      </div>
      {loading ? (
        <div className="h-8 w-10 bg-gray-200 animate-pulse rounded mt-1" />
      ) : (
        <p className={`text-2xl font-bold ${color}`}>{value}</p>
      )}
    </div>
  );
}
