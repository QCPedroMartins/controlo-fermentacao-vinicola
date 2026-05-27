import { trpc } from "@/lib/trpc";
import { AlertTriangle, BarChart3, Calendar, CheckCircle2, Circle, ClipboardList, FlaskConical } from "lucide-react";
import { useState, useMemo } from "react";
import { Link } from "wouter";

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
    label: "Completa",
    icon: <CheckCircle2 size={12} className="text-green-500" />,
    card: "bg-green-50 border-green-200 hover:border-green-400",
    badge: "bg-green-100 text-green-700",
    dot: "bg-green-400",
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

  return (
    <div className="p-4 sm:p-6 lg:p-8 animate-fade-in">
      {/* Cabeçalho */}
      <div className="mb-6 flex flex-wrap items-start justify-between gap-4">
        <div>
          <div className="flex items-center gap-3 mb-1">
            <BarChart3 size={22} className="text-[var(--color-vinho)]" />
            <h1 className="text-2xl font-bold text-[var(--color-vinho)]">Dashboard</h1>
          </div>
          <p className="text-gray-500 text-sm">Estado geral das 57 cubas de fermentação</p>
        </div>
        <div className="flex items-center gap-2">
          <Link href="/campanhas">
            <button className="flex items-center gap-2 px-4 py-2 rounded-lg border border-[var(--color-vinho)] text-[var(--color-vinho)] text-sm font-semibold hover:bg-[var(--color-vinho)]/5 transition-colors">
              <Calendar size={16} />
              {campanhaAtiva ? campanhaAtiva.nome : "Campanhas"}
            </button>
          </Link>
          <Link href="/registo-rapido">
            <button className="flex items-center gap-2 px-4 py-2 rounded-lg bg-[var(--color-vinho)] text-white text-sm font-semibold shadow hover:bg-[var(--color-vinho)]/90 transition-colors">
              <ClipboardList size={16} />
              Registo Rápido
            </button>
          </Link>
        </div>
      </div>

      {/* Estatísticas */}
      <div className="grid grid-cols-2 sm:grid-cols-5 gap-3 mb-6">
        <StatCard label="Total" value={57} color="text-[var(--color-vinho)]" bg="bg-white" />
        <StatCard label="Sem dados" value={semDados} color="text-gray-500" bg="bg-white" />
        <StatCard label="Em fermentação" value={emFermentacao} color="text-amber-600" bg="bg-amber-50" />
        <StatCard label="Completas" value={completas} color="text-green-600" bg="bg-green-50" />
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
              ? "Completas"
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
        <div className="grid grid-cols-4 sm:grid-cols-6 md:grid-cols-8 lg:grid-cols-10 xl:grid-cols-12 gap-2">
          {Array.from({ length: 84 }).map((_, i) => (
            <div key={i} className="h-16 rounded-lg bg-gray-100 animate-pulse" />
          ))}
        </div>
      ) : (
        <div className="grid grid-cols-4 sm:grid-cols-6 md:grid-cols-8 lg:grid-cols-10 xl:grid-cols-12 gap-2">
          {cubasFiltradas?.map((cuba) => {
            const cfg = estadoConfig[cuba.estado];
            const temAlerta = alertasPorCuba.get(cuba.id) === true;
            return (
              <Link key={cuba.id} href={`/cuba/${cuba.codigo}`}>
                <div
                  className={`relative border rounded-lg p-2 cursor-pointer transition-all duration-150 hover:shadow-md hover:-translate-y-0.5 ${
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
                    <span className="text-[10px] font-bold text-gray-400 uppercase tracking-wide">
                      {cuba.codigo}
                    </span>
                    <div className={`w-2 h-2 rounded-full ${temAlerta ? "bg-red-400 animate-pulse" : cfg.dot}`} />
                  </div>
                  <p className="text-xs font-semibold text-gray-700 truncate leading-tight">
                    {cuba.nomeLote ?? "—"}
                  </p>
                  <div className={`mt-1.5 inline-flex items-center gap-1 px-1.5 py-0.5 rounded text-[9px] font-medium ${
                    temAlerta ? "bg-red-100 text-red-700" : cfg.badge
                  }`}>
                    {temAlerta ? <AlertTriangle size={9} /> : cfg.icon}
                    <span className="hidden sm:inline">
                      {temAlerta
                        ? "Alerta"
                        : cuba.estado === "sem_dados"
                        ? "Vazia"
                        : cuba.estado === "em_fermentacao"
                        ? "Ativa"
                        : "Pronta"}
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
