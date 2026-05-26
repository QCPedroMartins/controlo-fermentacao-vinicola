import { trpc } from "@/lib/trpc";
import { BarChart3, CheckCircle2, Circle, ClipboardList, FlaskConical } from "lucide-react";
import { useState } from "react";
import { Link } from "wouter";

type Estado = "todos" | "sem_dados" | "em_fermentacao" | "completa";

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

export default function Dashboard() {
  const [filtro, setFiltro] = useState<Estado>("todos");
  const { data: cubas, isLoading } = trpc.cubas.dashboard.useQuery();

  const semDados = cubas?.filter((c) => c.estado === "sem_dados").length ?? 0;
  const emFermentacao = cubas?.filter((c) => c.estado === "em_fermentacao").length ?? 0;
  const completas = cubas?.filter((c) => c.estado === "completa").length ?? 0;

  const cubasFiltradas = cubas?.filter(
    (c) => filtro === "todos" || c.estado === filtro
  );

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
        <Link href="/registo-rapido">
          <button className="flex items-center gap-2 px-4 py-2 rounded-lg bg-[var(--color-vinho)] text-white text-sm font-semibold shadow hover:bg-[var(--color-vinho)]/90 transition-colors">
            <ClipboardList size={16} />
            Registo Rápido
          </button>
        </Link>
      </div>

      {/* Estatísticas */}
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 mb-6">
        <StatCard label="Total" value={57} color="text-[var(--color-vinho)]" bg="bg-white" />
        <StatCard label="Sem dados" value={semDados} color="text-gray-500" bg="bg-white" />
        <StatCard label="Em fermentação" value={emFermentacao} color="text-amber-600" bg="bg-amber-50" />
        <StatCard label="Completas" value={completas} color="text-green-600" bg="bg-green-50" />
      </div>

      {/* Filtros */}
      <div className="flex flex-wrap gap-2 mb-5">
        {(["todos", "sem_dados", "em_fermentacao", "completa"] as Estado[]).map((f) => (
          <button
            key={f}
            onClick={() => setFiltro(f)}
            className={`px-3 py-1.5 rounded-lg text-xs font-medium border transition-all ${
              filtro === f
                ? "bg-[var(--color-vinho)] text-white border-[var(--color-vinho)]"
                : "bg-white text-gray-600 border-gray-200 hover:border-gray-300"
            }`}
          >
            {f === "todos"
              ? "Todas"
              : f === "sem_dados"
              ? "Sem dados"
              : f === "em_fermentacao"
              ? "Em fermentação"
              : "Completas"}
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
            return (
              <Link key={cuba.id} href={`/cuba/${cuba.codigo}`}>
                <div
                  className={`relative border rounded-lg p-2 cursor-pointer transition-all duration-150 hover:shadow-md hover:-translate-y-0.5 ${cfg.card}`}
                >
                  <div className="flex items-center justify-between mb-1">
                    <span className="text-[10px] font-bold text-gray-400 uppercase tracking-wide">
                      {cuba.codigo}
                    </span>
                    <div className={`w-2 h-2 rounded-full ${cfg.dot}`} />
                  </div>
                  <p className="text-xs font-semibold text-gray-700 truncate leading-tight">
                    {cuba.nomeLote ?? "—"}
                  </p>
                  <div className={`mt-1.5 inline-flex items-center gap-1 px-1.5 py-0.5 rounded text-[9px] font-medium ${cfg.badge}`}>
                    {cfg.icon}
                    <span className="hidden sm:inline">
                      {cuba.estado === "sem_dados"
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
}: {
  label: string;
  value: number;
  color: string;
  bg: string;
}) {
  return (
    <div className={`${bg} rounded-xl border border-gray-100 p-4 shadow-sm`}>
      <p className="text-xs text-gray-500 mb-1">{label}</p>
      <p className={`text-2xl font-bold ${color}`}>{value}</p>
    </div>
  );
}
