import { trpc } from "@/lib/trpc";
import { useMemo } from "react";
import { useParams, Link } from "wouter";
import * as XLSX from "xlsx";
import {
  AlertTriangle,
  Archive,
  ArrowLeft,
  Calendar,
  Download,
  FlaskConical,
  TrendingDown,
  Droplets,
  ClipboardList,
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
  ReferenceLine,
} from "recharts";

// ── Cores fixas dos gráficos ──────────────────────────────
const CORES = {
  densL1: "#2e7d32",
  o2: "#00838f",
  redox: "#6a1b9a",
  tempL1: "#2e7d32",
};

function ChartCard({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <div className="bg-white rounded-2xl border border-gray-100 shadow-sm p-5">
      <h3 className="text-sm font-semibold text-[var(--color-vinho)] mb-4 flex items-center gap-2">
        {title}
      </h3>
      {children}
    </div>
  );
}

export default function ArquivoDetalhe() {
  const params = useParams<{ codigo: string; fermentacaoNum: string }>();
  const codigo = params.codigo;
  const fermentacaoNum = parseInt(params.fermentacaoNum ?? "1", 10);

  // Buscar dados da cuba
  const { data: cuba, isLoading: loadingCuba } = trpc.cubas.get.useQuery(
    { codigo },
    { enabled: !!codigo }
  );

  // Buscar metadados do arquivo
  const { data: resumo, isLoading: loadingResumo, error: errorResumo } = trpc.arquivoDetalhe.getResumo.useQuery(
    { cubaId: cuba?.id ?? 0, fermentacaoNum },
    { enabled: !!cuba?.id }
  );

  // Buscar leituras da fermentação arquivada
  const { data: leituras, isLoading: loadingLeituras, error: errorLeituras } = trpc.arquivoDetalhe.getLeituras.useQuery(
    { cubaId: cuba?.id ?? 0, fermentacaoNum },
    { enabled: !!cuba?.id }
  );

  // Buscar adições da fermentação arquivada
  const { data: adicoes, isLoading: loadingAdicoes, error: errorAdicoes } = trpc.arquivoDetalhe.getAdicoes.useQuery(
    { cubaId: cuba?.id ?? 0, fermentacaoNum },
    { enabled: !!cuba?.id }
  );

  // Dados para gráficos
  const chartData = useMemo(() => {
    if (!leituras) return [];
    return leituras.map((l) => ({
      dia: l.diaNr ?? 0,
      data: new Date(l.dataLeitura).toLocaleDateString("pt-PT"),
      densL1: l.densL1 ? parseFloat(l.densL1) : null,
      tempL1: l.tempL1 ? parseFloat(l.tempL1) : null,
      o2: l.o2 ? parseFloat(l.o2) : null,
      redox: l.redox ? parseFloat(l.redox) : null,
    }));
  }, [leituras]);

  // Exportar para Excel
  const exportarExcel = () => {
    if (!leituras || !cuba) return;
    const nomeFicheiro = `${cuba.codigo}_ferm${fermentacaoNum}${resumo?.nomeLote ? "_" + resumo.nomeLote.replace(/\s+/g, "_") : ""}`;

    const leiturasData = leituras.map((l) => ({
      "Data": new Date(l.dataLeitura).toLocaleDateString("pt-PT"),
      "Dia Nº": l.diaNr ?? "",
      "Densidade": l.densL1 ?? "",
      "Temperatura (°C)": l.tempL1 ?? "",
      "O₂ (mg/L)": l.o2 ?? "",
      "Redox (mV)": l.redox ?? "",
      "Registado por": l.userName ?? "",
    }));

    const adicoesData = (adicoes ?? []).map((a) => ({
      "Data": new Date(a.dataAdicao).toLocaleDateString("pt-PT"),
      "Produto / Adição": a.produto ?? "",
      "Dose": a.dose ?? "",
      "Observações": a.observacoes ?? "",
      "Por": a.userName ?? "",
    }));

    const wb = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(wb, XLSX.utils.json_to_sheet(leiturasData), "Leituras");
    if (adicoesData.length > 0) {
      XLSX.utils.book_append_sheet(wb, XLSX.utils.json_to_sheet(adicoesData), "Adições");
    }
    XLSX.writeFile(wb, `${nomeFicheiro}.xlsx`);
  };

  const exportarCSV = () => {
    if (!leituras || !cuba) return;
    const nomeFicheiro = `${cuba.codigo}_ferm${fermentacaoNum}`;
    const linhas = [
      ["Data", "Dia Nº", "Densidade", "Temperatura (°C)", "O₂ (mg/L)", "Redox (mV)", "Utilizador"],
      ...leituras.map((l) => [
        new Date(l.dataLeitura).toLocaleDateString("pt-PT"),
        l.diaNr ?? "",
        l.densL1 ?? "", l.tempL1 ?? "",
        l.o2 ?? "", l.redox ?? "",
        l.userName ?? "",
      ]),
    ];
    const csv = linhas.map((r) => r.join(";")).join("\n");
    const blob = new Blob(["\uFEFF" + csv], { type: "text/csv;charset=utf-8;" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = `${nomeFicheiro}.csv`;
    a.click();
    URL.revokeObjectURL(url);
  };

  const isLoading = loadingCuba || loadingResumo;

  if (isLoading) {
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
        <Link href="/" className="text-[var(--color-vinho)] text-sm underline mt-2 block">Voltar ao Dashboard</Link>
      </div>
    );
  }

  // Erro crítico: não foi possível carregar os dados do arquivo
  if (errorResumo || errorLeituras) {
    return (
      <div className="p-8">
        <Link href={`/cuba/${codigo}`}>
          <button className="flex items-center gap-2 text-sm text-gray-500 hover:text-[var(--color-vinho)] mb-4 transition-colors">
            <ArrowLeft size={16} /> Voltar a {cuba.codigo.toUpperCase()}
          </button>
        </Link>
        <div className="bg-red-50 border border-red-200 rounded-2xl p-6 text-center">
          <AlertTriangle size={36} className="mx-auto mb-3 text-red-500" />
          <p className="font-semibold text-red-700 mb-1">Erro ao carregar a fermentação arquivada</p>
          <p className="text-sm text-red-600">
            {errorResumo?.message ?? errorLeituras?.message ?? "Erro desconhecido. Tente novamente."}
          </p>
        </div>
      </div>
    );
  }

  const nomeLote = resumo?.nomeLote ?? `Fermentação Nº ${fermentacaoNum}`;
  const dataInicio = resumo?.dataInicio ? new Date(resumo.dataInicio).toLocaleDateString("pt-PT") : "—";
  const dataFim = resumo?.dataFim ? new Date(resumo.dataFim).toLocaleDateString("pt-PT") : "—";

  return (
    <div className="p-4 sm:p-6 lg:p-8 animate-fade-in">
      {/* Cabeçalho */}
      <div className="mb-6">
        <Link href={`/cuba/${codigo}`}>
          <button className="flex items-center gap-2 text-sm text-gray-500 hover:text-[var(--color-vinho)] mb-4 transition-colors">
            <ArrowLeft size={16} />
            Voltar a {cuba.codigo.toUpperCase()}
          </button>
        </Link>

        <div className="flex flex-wrap items-start justify-between gap-4">
          <div>
            <div className="flex items-center gap-2 mb-1">
              <Archive size={18} className="text-amber-600" />
              <span className="text-xs font-mono text-gray-400 uppercase tracking-widest">
                {cuba.codigo.toUpperCase()} · Fermentação Nº {fermentacaoNum} · Arquivo
              </span>
            </div>
            <h1
              className="text-2xl font-bold text-[var(--color-vinho)]"
              style={{ fontFamily: "var(--font-serif)" }}
            >
              {nomeLote}
            </h1>
            <div className="flex items-center gap-2 mt-1 text-sm text-gray-500">
              <Calendar size={14} />
              <span>{dataInicio} → {dataFim}</span>
              {resumo?.archivedBy && (
                <span className="text-gray-400">· Arquivado por {resumo.archivedBy}</span>
              )}
            </div>
          </div>

          {/* Botões de exportação */}
          <div className="flex gap-2">
            <button
              onClick={exportarExcel}
              className="flex items-center gap-2 px-3 py-2 rounded-lg border border-green-300 text-green-700 bg-green-50 text-xs font-medium hover:bg-green-100 transition-colors"
            >
              <Download size={14} /> Excel
            </button>
            <button
              onClick={exportarCSV}
              className="flex items-center gap-2 px-3 py-2 rounded-lg border border-blue-300 text-blue-700 bg-blue-50 text-xs font-medium hover:bg-blue-100 transition-colors"
            >
              <Download size={14} /> CSV
            </button>
          </div>
        </div>

        {/* Resumo estatístico */}
        <div className="grid grid-cols-3 sm:grid-cols-5 gap-3 mt-5">
          <div className="bg-white rounded-xl border border-gray-100 shadow-sm p-3 text-center">
            <p className="text-xl font-bold text-[var(--color-vinho)]">{resumo?.totalDias ?? leituras?.length ?? "—"}</p>
            <p className="text-xs text-gray-400">dias</p>
          </div>
          <div className="bg-white rounded-xl border border-gray-100 shadow-sm p-3 text-center">
                  <p className="text-xl font-bold text-green-700">
              {resumo?.densMin ? parseFloat(resumo.densMin).toFixed(4) : "—"}
            </p>
            <p className="text-xs text-gray-400">dens. mín.</p>
          </div>
          <div className="bg-white rounded-xl border border-gray-100 shadow-sm p-3 text-center">
            <p className="text-xl font-bold text-red-600">
              {resumo?.tempMax ? `${parseFloat(resumo.tempMax).toFixed(1)}°C` : "—"}
            </p>
            <p className="text-xs text-gray-400">temp. máx.</p>
          </div>
          <div className="bg-white rounded-xl border border-gray-100 shadow-sm p-3 text-center">
            <p className="text-xl font-bold text-blue-700">{leituras?.length ?? "—"}</p>
            <p className="text-xs text-gray-400">leituras</p>
          </div>
          <div className="bg-white rounded-xl border border-gray-100 shadow-sm p-3 text-center">
            <p className="text-xl font-bold text-amber-700">{adicoes?.length ?? "—"}</p>
            <p className="text-xs text-gray-400">adições</p>
          </div>
        </div>
      </div>

      {/* ── Gráficos ─────────────────────────────────────── */}
      {loadingLeituras ? (
        <div className="flex items-center justify-center py-12">
          <div className="animate-spin w-6 h-6 border-2 border-[var(--color-vinho)] border-t-transparent rounded-full" />
        </div>
      ) : chartData.length > 0 ? (
        <div className="space-y-4 mb-6">
          <h2 className="text-base font-semibold text-[var(--color-vinho)] flex items-center gap-2">
            <TrendingDown size={16} /> Gráficos
          </h2>

          <ChartCard title="Densidade">
            <ResponsiveContainer width="100%" height={240}>
              <LineChart data={chartData} margin={{ top: 5, right: 20, left: 0, bottom: 20 }}>
                <CartesianGrid strokeDasharray="3 3" stroke="#f0f0f0" />
                <XAxis dataKey="dia" label={{ value: "Dia de fermentação", position: "insideBottom", offset: -10, fontSize: 11 }} tick={{ fontSize: 11 }} />
                <YAxis domain={["auto", "auto"]} tick={{ fontSize: 11 }} />
                <Tooltip formatter={(v: number) => v?.toFixed(4)} labelFormatter={(l) => `Dia ${l}`} />
                <Legend verticalAlign="top" height={24} />
                {resumo?.densMin && (
                  <ReferenceLine y={parseFloat(resumo.densMin)} stroke="#999" strokeDasharray="4 4" label={{ value: `Mín: ${parseFloat(resumo.densMin).toFixed(4)}`, fontSize: 10, fill: "#999" }} />
                )}
                <Line type="monotone" dataKey="densL1" name="Densidade" stroke={CORES.densL1} strokeWidth={2.5} dot={{ r: 3 }} connectNulls={false} />
              </LineChart>
            </ResponsiveContainer>
          </ChartCard>

          <ChartCard title="Temperatura (°C)">
            <ResponsiveContainer width="100%" height={240}>
              <LineChart data={chartData} margin={{ top: 5, right: 20, left: 0, bottom: 20 }}>
                <CartesianGrid strokeDasharray="3 3" stroke="#f0f0f0" />
                <XAxis dataKey="dia" label={{ value: "Dia de fermentação", position: "insideBottom", offset: -10, fontSize: 11 }} tick={{ fontSize: 11 }} />
                <YAxis tick={{ fontSize: 11 }} />
                <Tooltip formatter={(v: number) => `${v?.toFixed(1)}°C`} labelFormatter={(l) => `Dia ${l}`} />
                <Legend verticalAlign="top" height={24} />
                {resumo?.tempMax && (
                  <ReferenceLine y={parseFloat(resumo.tempMax)} stroke="#ef5350" strokeDasharray="4 4" label={{ value: `Máx: ${parseFloat(resumo.tempMax).toFixed(1)}°C`, fontSize: 10, fill: "#ef5350" }} />
                )}
                <Line type="monotone" dataKey="tempL1" name="Temperatura" stroke={CORES.tempL1} strokeWidth={2.5} dot={{ r: 3 }} connectNulls={false} />
              </LineChart>
            </ResponsiveContainer>
          </ChartCard>

          {chartData.some((d) => d.o2 !== null) && (
            <ChartCard title="O₂ Dissolvido (mg/L)">
              <ResponsiveContainer width="100%" height={220}>
                <LineChart data={chartData} margin={{ top: 5, right: 20, left: 0, bottom: 20 }}>
                  <CartesianGrid strokeDasharray="3 3" stroke="#f0f0f0" />
                  <XAxis dataKey="dia" label={{ value: "Dia de fermentação", position: "insideBottom", offset: -10, fontSize: 11 }} tick={{ fontSize: 11 }} />
                  <YAxis tick={{ fontSize: 11 }} />
                  <Tooltip formatter={(v: number) => `${v?.toFixed(2)} mg/L`} labelFormatter={(l) => `Dia ${l}`} />
                  <Line type="monotone" dataKey="o2" name="O₂ Dissolvido" stroke={CORES.o2} strokeWidth={2.5} dot={{ r: 4, fill: CORES.o2 }} connectNulls={false} />
                </LineChart>
              </ResponsiveContainer>
            </ChartCard>
          )}

          {chartData.some((d) => d.redox !== null) && (
            <ChartCard title="Potencial Redox (mV)">
              <ResponsiveContainer width="100%" height={220}>
                <LineChart data={chartData} margin={{ top: 5, right: 20, left: 0, bottom: 20 }}>
                  <CartesianGrid strokeDasharray="3 3" stroke="#f0f0f0" />
                  <XAxis dataKey="dia" label={{ value: "Dia de fermentação", position: "insideBottom", offset: -10, fontSize: 11 }} tick={{ fontSize: 11 }} />
                  <YAxis tick={{ fontSize: 11 }} />
                  <Tooltip formatter={(v: number) => `${v?.toFixed(0)} mV`} labelFormatter={(l) => `Dia ${l}`} />
                  <Line type="monotone" dataKey="redox" name="Potencial Redox" stroke={CORES.redox} strokeWidth={2.5} dot={{ r: 4, fill: CORES.redox }} connectNulls={false} />
                </LineChart>
              </ResponsiveContainer>
            </ChartCard>
          )}
        </div>
      ) : null}

      {/* ── Histórico de Leituras ─────────────────────────── */}
      <div className="mb-6">
        <h2 className="text-base font-semibold text-[var(--color-vinho)] flex items-center gap-2 mb-3">
          <ClipboardList size={16} /> Histórico de Leituras
        </h2>
        <div className="bg-white rounded-2xl border border-gray-100 shadow-sm overflow-hidden">
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="bg-[var(--color-vinho)] text-white">
                  <th className="px-3 py-3 text-left text-xs font-semibold">Data</th>
                  <th className="px-3 py-3 text-center text-xs font-semibold">Dia</th>
                  <th className="px-3 py-3 text-center text-xs font-semibold" style={{ color: "#a5d6a7" }}>Densidade</th>
                  <th className="px-3 py-3 text-center text-xs font-semibold" style={{ color: "#a5d6a7" }}>Temperatura</th>
                  <th className="px-3 py-3 text-center text-xs font-semibold" style={{ color: "#80deea" }}>O₂</th>
                  <th className="px-3 py-3 text-center text-xs font-semibold" style={{ color: "#ce93d8" }}>Redox</th>
                  <th className="px-3 py-3 text-center text-xs font-semibold">Utilizador</th>
                </tr>
              </thead>
              <tbody>
                {loadingLeituras ? (
                  <tr><td colSpan={7} className="text-center py-8 text-gray-400">A carregar...</td></tr>
                ) : !leituras?.length ? (
                  <tr><td colSpan={7} className="text-center py-8 text-gray-400">Sem leituras registadas</td></tr>
                ) : (
                  leituras.map((l, idx) => (
                    <tr key={l.id} className={idx % 2 === 0 ? "bg-white" : "bg-gray-50"}>
                      <td className="px-3 py-2.5 text-xs text-gray-600 whitespace-nowrap">
                        {new Date(l.dataLeitura).toLocaleDateString("pt-PT")}
                      </td>
                      <td className="px-3 py-2.5 text-center text-xs font-bold text-[var(--color-vinho)]">{l.diaNr ?? "—"}</td>
                      <td className="px-3 py-2.5 text-center text-xs font-mono" style={{ color: CORES.densL1 }}>{l.densL1 ? parseFloat(l.densL1).toFixed(4) : "—"}</td>
                      <td className="px-3 py-2.5 text-center text-xs font-mono" style={{ color: CORES.tempL1 }}>{l.tempL1 ? `${parseFloat(l.tempL1).toFixed(1)}°` : "—"}</td>
                      <td className="px-3 py-2.5 text-center text-xs font-mono" style={{ color: CORES.o2 }}>{l.o2 ? `${parseFloat(l.o2).toFixed(2)}` : "—"}</td>
                      <td className="px-3 py-2.5 text-center text-xs font-mono" style={{ color: CORES.redox }}>{l.redox ? `${parseFloat(l.redox).toFixed(0)}` : "—"}</td>
                      <td className="px-3 py-2.5 text-center text-xs text-gray-400">{l.userName ?? "—"}</td>
                    </tr>
                  ))
                )}
              </tbody>
            </table>
          </div>
        </div>
      </div>

      {/* ── Adições e Notas ───────────────────────────────── */}
      <div className="mb-6">
        <h2 className="text-base font-semibold text-[var(--color-vinho)] flex items-center gap-2 mb-3">
          <Droplets size={16} /> Adições e Notas
        </h2>
        {errorAdicoes ? (
          <div className="bg-red-50 border border-red-200 rounded-xl p-4 text-sm text-red-600 flex items-center gap-2">
            <AlertTriangle size={16} /> Erro ao carregar as adições: {errorAdicoes.message}
          </div>
        ) : loadingAdicoes ? (
          <div className="flex items-center justify-center py-8">
            <div className="animate-spin w-6 h-6 border-2 border-[var(--color-vinho)] border-t-transparent rounded-full" />
          </div>
        ) : !adicoes?.length ? (
          <div className="bg-white rounded-2xl border border-gray-100 shadow-sm p-8 text-center text-gray-400">
            <Droplets size={32} className="mx-auto mb-2 opacity-30" />
            <p className="text-sm">Sem adições registadas nesta fermentação</p>
          </div>
        ) : (
          <div className="bg-white rounded-2xl border border-gray-100 shadow-sm overflow-hidden">
            <table className="w-full text-sm">
              <thead>
                <tr className="bg-[var(--color-vinho)] text-white">
                  <th className="px-4 py-3 text-left text-xs font-semibold">Data</th>
                  <th className="px-4 py-3 text-left text-xs font-semibold">Produto / Adição</th>
                  <th className="px-4 py-3 text-left text-xs font-semibold">Dose</th>
                  <th className="px-4 py-3 text-left text-xs font-semibold">Observações</th>
                  <th className="px-4 py-3 text-center text-xs font-semibold">Por</th>
                </tr>
              </thead>
              <tbody>
                {adicoes.map((a, idx) => (
                  <tr key={a.id} className={idx % 2 === 0 ? "bg-white" : "bg-gray-50"}>
                    <td className="px-4 py-2.5 text-xs text-gray-600 whitespace-nowrap">
                      {new Date(a.dataAdicao).toLocaleDateString("pt-PT")}
                    </td>
                    <td className="px-4 py-2.5 text-xs font-medium text-gray-800">{a.produto ?? "—"}</td>
                    <td className="px-4 py-2.5 text-xs text-gray-600">{a.dose ?? "—"}</td>
                    <td className="px-4 py-2.5 text-xs text-gray-500">{a.observacoes ?? "—"}</td>
                    <td className="px-4 py-2.5 text-center text-xs text-gray-400">{a.userName ?? "—"}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>

      {/* Rodapé: voltar */}
      <div className="mt-6 pt-4 border-t border-gray-100">
        <Link href={`/cuba/${codigo}`}>
          <button className="flex items-center gap-2 text-sm text-gray-500 hover:text-[var(--color-vinho)] transition-colors">
            <ArrowLeft size={16} />
            Voltar à cuba {cuba.codigo.toUpperCase()} (fermentação atual)
          </button>
        </Link>
      </div>
    </div>
  );
}
