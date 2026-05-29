import { useState, useMemo, useEffect } from "react";
import { trpc } from "@/lib/trpc";
import { useAuth } from "@/_core/hooks/useAuth";
import { getLoginUrl } from "@/const";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { Save, RotateCcw, CheckCircle2, XCircle, Loader2, LogIn, FileText, X } from "lucide-react";
import { lerDadosCsvDoStorage, limparDadosCsvDoStorage } from "@/components/ImportacaoCsvModal";

const CUBAS_VINHO = [
  'CF1','CF2','CF3','CF4','CF5','CF6','CF7','CF8','CF9','CF10',
  'CF11','CF12','CF13','CF14','CF15','CF16','CF17','CF18','CF19','CF20',
  'CF21','CF22','CF23','CF24','CF25','CF26','CF27','CF28','CF29','CF30',
  'CF31','CF32','CF33','CF34','CF35','CF36',
  'LF37','LF38',
  'CF80','CF81','CF82','CF83','CF84','CF85',
  'CF93','CF94',
  'CF200','CF201','CF202','CF203','CF204','CF205','CF206','CF207','CF208','CF209','CF210',
];

const CUBAS_PORTO = ['VP01','VP02','VP03','VP04','VP05'];

const TODAS_CUBAS = [...CUBAS_VINHO, ...CUBAS_PORTO];

type LinhaLeitura = {
  densL1: string;
  baumeL1: string;
  tempL1: string;
  o2: string; redox: string;
};

type EstadoLinha = "idle" | "ok" | "erro";

function linhaVazia(): LinhaLeitura {
  return {
    densL1: "",
    baumeL1: "",
    tempL1: "",
    o2: "", redox: "",
  };
}

function temDados(linha: LinhaLeitura): boolean {
  return Object.values(linha).some((v) => v.trim() !== "");
}

function toNullable(v: string): string | null {
  return v.trim() === "" ? null : v.trim();
}

export default function RegistoRapido() {
  const { isAuthenticated } = useAuth();
  const today = new Date().toISOString().split("T")[0];
  const [data, setData] = useState(today);
  const [linhas, setLinhas] = useState<Record<string, LinhaLeitura>>(() =>
    Object.fromEntries(TODAS_CUBAS.map((c) => [c, linhaVazia()]))
  );
  const [estados, setEstados] = useState<Record<string, EstadoLinha>>({});
  const [mostrarSemDados, setMostrarSemDados] = useState(true);
  const [dadosCsvInfo, setDadosCsvInfo] = useState<{ nCubas: number; importadoEm: string; cubas: { codigo: string; hora: string }[] } | null>(null);
  // Mapa de hora por código de cuba (vem do CSV, para guardar na BD)
  const [horasPorCuba, setHorasPorCuba] = useState<Record<string, string>>({});

  const { data: cubasData } = trpc.cubas.list.useQuery();
  const registarLote = trpc.leituras.registarLote.useMutation();

  const cubaMap = useMemo(() => {
    if (!cubasData) return {};
    return Object.fromEntries(cubasData.map((c) => [c.codigo.toUpperCase(), c]));
  }, [cubasData]);

  // Ao montar, verificar se há dados CSV no localStorage para pré-preencher
  useEffect(() => {
    const dadosCsv = lerDadosCsvDoStorage();
    if (!dadosCsv) return;

    // Pré-preencher a data
    setData(dadosCsv.data);

    // Normaliza código: remove zeros à frente no número (ex: CF03 → CF3, VP01 → VP01)
    function normalizarCodigo(codigo: string): string {
      return codigo.toUpperCase().replace(/^([A-Z]+)(0+)(\d+)$/, (_, prefix, _zeros, num) => prefix + num);
    }

    // Pré-preencher as linhas com os dados do CSV
    setLinhas((prev) => {
      const novo = { ...prev };
      for (const cuba of dadosCsv.cubas) {
        const codigoUpper = normalizarCodigo(cuba.cubaCodigo);
        if (codigoUpper in novo) {
          if (cuba.isPorto) {
            novo[codigoUpper] = {
              ...linhaVazia(),
              baumeL1: cuba.densidade,   // para VP, densidade do CSV vai para baumeL1
              tempL1: cuba.temperatura,
            };
          } else {
            novo[codigoUpper] = {
              ...linhaVazia(),
              densL1: cuba.densidade,    // 4 casas decimais
              tempL1: cuba.temperatura,
            };
          }
        }
      }
      return novo;
    });

    setDadosCsvInfo({
      nCubas: dadosCsv.cubas.length,
      importadoEm: dadosCsv.importadoEm,
      cubas: dadosCsv.cubas.map((c) => ({ codigo: normalizarCodigo(c.cubaCodigo), hora: c.hora ?? "" })),
    });

    // Guardar mapa de horas por código normalizado
    const horasMap: Record<string, string> = {};
    for (const cuba of dadosCsv.cubas) {
      const codigoNorm = normalizarCodigo(cuba.cubaCodigo);
      if (cuba.hora) horasMap[codigoNorm] = cuba.hora;
    }
    setHorasPorCuba(horasMap);

    // Mostrar apenas as cubas com dados ao pré-preencher via CSV
    setMostrarSemDados(false);
  }, []);

  const cubasComDados = TODAS_CUBAS.filter((c) => temDados(linhas[c]));
  const cubasSemDados = TODAS_CUBAS.filter((c) => !temDados(linhas[c]));

  function updateCampo(codigo: string, campo: keyof LinhaLeitura, valor: string) {
    setLinhas((prev) => ({ ...prev, [codigo]: { ...prev[codigo], [campo]: valor } }));
    setEstados((prev) => ({ ...prev, [codigo]: "idle" }));
  }

  function limparTudo() {
    setLinhas(Object.fromEntries(TODAS_CUBAS.map((c) => [c, linhaVazia()])));
    setEstados({});
    limparDadosCsvDoStorage();
    setDadosCsvInfo(null);
  }

  function descartarCsv() {
    limparDadosCsvDoStorage();
    setDadosCsvInfo(null);
    setLinhas(Object.fromEntries(TODAS_CUBAS.map((c) => [c, linhaVazia()])));
    setEstados({});
    setMostrarSemDados(true);
  }

  async function registar() {
    const linhasComDados = TODAS_CUBAS.filter((c) => temDados(linhas[c]));
    if (linhasComDados.length === 0) {
      toast.error("Não há dados para registar. Preencha pelo menos uma leitura.");
      return;
    }
    if (!data) {
      toast.error("Selecione uma data antes de registar.");
      return;
    }

    const payload = linhasComDados.map((codigo) => {
      const cuba = cubaMap[codigo.toUpperCase()];
      const l = linhas[codigo];
      const isPorto = CUBAS_PORTO.includes(codigo);
      return {
        cubaId: cuba.id,
        fermentacaoNum: cuba.fermentacaoNum,
        hora: horasPorCuba[codigo] ?? null,
        densL1: isPorto ? null : toNullable(l.densL1),
        baumeL1: isPorto ? toNullable(l.baumeL1) : null,
        tempL1: toNullable(l.tempL1),
        o2: toNullable(l.o2),
        redox: toNullable(l.redox),
      };
    });

    try {
      const resultado = await registarLote.mutateAsync({ dataLeitura: data, leituras: payload });
      const novosEstados: Record<string, EstadoLinha> = {};
      resultado.resultados.forEach((r) => {
        const cuba = cubasData?.find((c) => c.id === r.cubaId);
        if (cuba) novosEstados[cuba.codigo.toUpperCase()] = r.success ? "ok" : "erro";
      });
      setEstados(novosEstados);
      toast.success(`${resultado.sucesso} de ${resultado.total} cubas registadas com sucesso!`);
      // Limpar dados CSV do localStorage após registo com sucesso
      limparDadosCsvDoStorage();
      setDadosCsvInfo(null);
      setLinhas((prev) => {
        const novo = { ...prev };
        resultado.resultados.forEach((r) => {
          if (r.success) {
            const cuba = cubasData?.find((c) => c.id === r.cubaId);
            if (cuba) novo[cuba.codigo.toUpperCase()] = linhaVazia();
          }
        });
        return novo;
      });
    } catch {
      toast.error("Erro ao registar leituras. Tente novamente.");
    }
  }

  if (!isAuthenticated) {
    return (
      <div className="flex flex-col items-center justify-center min-h-[60vh] gap-4">
        <p className="text-[var(--color-vinho)] font-semibold text-lg">Precisa de iniciar sessão para registar leituras.</p>
        <a href={getLoginUrl()}>
          <Button className="gap-2 bg-[var(--color-vinho)] text-white">
            <LogIn size={16} /> Iniciar Sessão
          </Button>
        </a>
      </div>
    );
  }

  const cubasVinhoVisiveis = mostrarSemDados
    ? CUBAS_VINHO
    : CUBAS_VINHO.filter((c) => temDados(linhas[c]));

  const cubasPortoVisiveis = mostrarSemDados
    ? CUBAS_PORTO
    : CUBAS_PORTO.filter((c) => temDados(linhas[c]));

  return (
    <div className="p-4 sm:p-6 max-w-full animate-fade-in">
      {/* Cabeçalho */}
      <div className="mb-5">
        <h1 className="text-2xl font-bold text-[var(--color-vinho)] mb-1">Registo Rápido</h1>
        <p className="text-gray-500 text-sm">
          Preencha as leituras de várias cubas de uma só vez e clique em "Registar Tudo".
        </p>
      </div>

      {/* Banner de dados CSV pré-preenchidos */}
      {dadosCsvInfo && (
        <div className="mb-4 p-3 bg-blue-50 border border-blue-200 rounded-xl text-sm text-blue-800">
          <div className="flex items-center gap-3">
            <FileText className="w-5 h-5 text-blue-600 shrink-0" />
            <div className="flex-1">
              <span className="font-semibold">Dados importados do CSV</span>
              {" — "}
              <span>{dadosCsvInfo.nCubas} cuba{dadosCsvInfo.nCubas !== 1 ? "s" : ""} pré-preenchida{dadosCsvInfo.nCubas !== 1 ? "s" : ""}.</span>
              <span className="text-blue-600 ml-1 text-xs">
                Reveja os valores, complete os campos em falta e clique em "Registar Tudo".
              </span>
            </div>
            <button
              onClick={descartarCsv}
              className="shrink-0 text-blue-400 hover:text-blue-700 transition-colors"
              title="Descartar dados do CSV"
            >
              <X className="w-4 h-4" />
            </button>
          </div>
          {dadosCsvInfo.cubas.some((c) => c.hora) && (
            <div className="mt-2 flex flex-wrap gap-1.5">
              {dadosCsvInfo.cubas.map((c) => (
                <span
                  key={c.codigo}
                  className="inline-flex items-center gap-1 bg-blue-100 border border-blue-200 rounded px-2 py-0.5 text-xs font-mono text-blue-900"
                >
                  <span className="font-semibold">{c.codigo}</span>
                  {c.hora && <span className="text-blue-600">{c.hora}</span>}
                </span>
              ))}
            </div>
          )}
        </div>
      )}

      {/* Barra de controlo */}
      <div className="flex flex-wrap items-center gap-3 mb-6 p-4 bg-white rounded-xl border border-[var(--color-dourado)]/30 shadow-sm">
        <div className="flex items-center gap-2">
          <label className="text-xs font-medium text-gray-600">Data:</label>
          <Input
            type="date"
            value={data}
            onChange={(e) => setData(e.target.value)}
            className="h-8 text-xs w-36"
          />
        </div>
        <Button
          variant="outline"
          size="sm"
          onClick={() => setMostrarSemDados((v) => !v)}
          className="text-xs gap-1.5"
        >
          {mostrarSemDados ? "Ocultar vazias" : `Mostrar todas (${cubasSemDados.length} vazias)`}
        </Button>
        <Badge variant="secondary" className="text-xs">
          {cubasComDados.length} cubas com dados
        </Badge>
        <Button variant="outline" size="sm" onClick={limparTudo} className="text-xs gap-1.5">
          <RotateCcw size={12} /> Limpar
        </Button>
        <Button
          size="sm"
          onClick={registar}
          disabled={registarLote.isPending || cubasComDados.length === 0}
          className="gap-1.5 text-xs bg-[var(--color-vinho)] hover:bg-[var(--color-vinho)]/90 text-white"
        >
          {registarLote.isPending ? (
            <><Loader2 size={13} className="animate-spin" /> A registar...</>
          ) : (
            <><Save size={13} /> Registar Tudo ({cubasComDados.length})</>
          )}
        </Button>
      </div>

      {/* ── Tabela Cubas de Vinho ─────────────────────────── */}
      {cubasVinhoVisiveis.length > 0 && (
        <div className="mb-8 bg-white rounded-xl border border-gray-200 shadow-sm overflow-hidden">
          <div className="px-4 py-2 bg-[var(--color-vinho)]/5 border-b border-[var(--color-vinho)]/20">
            <span className="text-sm font-semibold text-[var(--color-vinho)]">Cubas de Vinho — CF / LF</span>
          </div>
          <div className="overflow-x-auto">
            <table className="w-full text-xs">
              <thead>
                <tr className="bg-[var(--color-vinho)] text-white">
                  <th className="sticky left-0 z-10 bg-[var(--color-vinho)] px-3 py-3 text-left font-semibold w-20">Cuba</th>
                  <th className="px-2 py-3 text-center font-semibold text-green-300 w-28">Densidade</th>
                  <th className="px-2 py-3 text-center font-semibold text-green-300 w-24">Temperatura (°C)</th>
                  <th className="px-2 py-3 text-center font-semibold text-cyan-300 w-20">O₂ (mg/L)</th>
                  <th className="px-2 py-3 text-center font-semibold text-purple-300 w-20">Redox (mV)</th>
                  <th className="px-2 py-3 text-center font-semibold w-16">Estado</th>
                </tr>
              </thead>
              <tbody>
                {cubasVinhoVisiveis.map((codigo, idx) => {
                  const linha = linhas[codigo];
                  const estado = estados[codigo] ?? "idle";
                  const temDadosLinha = temDados(linha);
                  const rowBg = temDadosLinha ? "bg-amber-50" : idx % 2 === 0 ? "bg-white" : "bg-gray-50/60";
                  return (
                    <tr key={`vinho-${codigo}`} className={`${rowBg} hover:bg-amber-50/80 transition-colors border-b border-gray-100`}>
                      <td className={`sticky left-0 z-10 ${rowBg} px-3 py-1.5`}>
                        <span className="font-bold text-[var(--color-vinho)] text-xs">{codigo}</span>
                      </td>
                      <td className="px-1 py-1">
                        <Input type="number" step="0.0001" placeholder="—" value={linha.densL1}
                          onChange={(e) => updateCampo(codigo, "densL1", e.target.value)}
                          className="h-7 text-xs text-center border-green-200 focus:border-green-500 px-1" />
                      </td>
                      <td className="px-1 py-1">
                        <Input type="number" step="0.1" placeholder="—" value={linha.tempL1}
                          onChange={(e) => updateCampo(codigo, "tempL1", e.target.value)}
                          className="h-7 text-xs text-center border-green-200 focus:border-green-500 px-1" />
                      </td>
                      <td className="px-1 py-1">
                        <Input type="number" step="0.01" placeholder="—" value={linha.o2}
                          onChange={(e) => updateCampo(codigo, "o2", e.target.value)}
                          className="h-7 text-xs text-center border-cyan-200 focus:border-cyan-500 px-1" />
                      </td>
                      <td className="px-1 py-1">
                        <Input type="number" step="1" placeholder="—" value={linha.redox}
                          onChange={(e) => updateCampo(codigo, "redox", e.target.value)}
                          className="h-7 text-xs text-center border-purple-200 focus:border-purple-500 px-1" />
                      </td>
                      <td className="px-2 py-1 text-center">
                        {estado === "ok" && <CheckCircle2 size={16} className="text-green-500 mx-auto" />}
                        {estado === "erro" && <XCircle size={16} className="text-red-500 mx-auto" />}
                        {estado === "idle" && temDadosLinha && (
                          <div className="w-2 h-2 rounded-full bg-amber-400 mx-auto" title="Por registar" />
                        )}
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {/* ── Tabela Cubas de Vinho do Porto ───────────────── */}
      {cubasPortoVisiveis.length > 0 && (
        <div className="mb-8 bg-white rounded-xl border border-amber-200 shadow-sm overflow-hidden">
          <div className="px-4 py-2 bg-amber-50 border-b border-amber-200 flex items-center gap-2">
            <span className="text-sm font-semibold text-amber-800">Cubas de Vinho do Porto — VP</span>
            <span className="text-[10px] font-bold bg-amber-800 text-amber-100 px-1.5 py-0.5 rounded">BAUMÉ</span>
          </div>
          <div className="overflow-x-auto">
            <table className="w-full text-xs">
              <thead>
                <tr className="bg-amber-800 text-white">
                  <th className="sticky left-0 z-10 bg-amber-800 px-3 py-3 text-left font-semibold w-20">Cuba</th>
                  <th className="px-2 py-3 text-center font-semibold text-green-300 w-24">Baumé (°)</th>
                  <th className="px-2 py-3 text-center font-semibold text-green-300 w-24">Temperatura (°C)</th>
                  <th className="px-2 py-3 text-center font-semibold text-cyan-300 w-20">O₂ (mg/L)</th>
                  <th className="px-2 py-3 text-center font-semibold text-purple-300 w-20">Redox (mV)</th>
                  <th className="px-2 py-3 text-center font-semibold w-16">Estado</th>
                </tr>
              </thead>
              <tbody>
                {cubasPortoVisiveis.map((codigo, idx) => {
                  const linha = linhas[codigo];
                  const estado = estados[codigo] ?? "idle";
                  const temDadosLinha = temDados(linha);
                  const rowBg = temDadosLinha ? "bg-amber-50" : idx % 2 === 0 ? "bg-white" : "bg-amber-50/30";
                  return (
                    <tr key={`porto-${codigo}`} className={`${rowBg} hover:bg-amber-50/80 transition-colors border-b border-amber-100`}>
                      <td className={`sticky left-0 z-10 ${rowBg} px-3 py-1.5`}>
                        <div className="flex items-center gap-1.5">
                          <span className="font-bold text-amber-800 text-xs">{codigo}</span>
                          <span className="text-[8px] font-bold bg-amber-800 text-amber-100 px-1 rounded">VP</span>
                        </div>
                      </td>
                      <td className="px-1 py-1">
                        <Input type="number" step="0.1" placeholder="—" value={linha.baumeL1}
                          onChange={(e) => updateCampo(codigo, "baumeL1", e.target.value)}
                          className="h-7 text-xs text-center border-green-200 focus:border-green-500 px-1" />
                      </td>
                      <td className="px-1 py-1">
                        <Input type="number" step="0.1" placeholder="—" value={linha.tempL1}
                          onChange={(e) => updateCampo(codigo, "tempL1", e.target.value)}
                          className="h-7 text-xs text-center border-green-200 focus:border-green-500 px-1" />
                      </td>
                      <td className="px-1 py-1">
                        <Input type="number" step="0.01" placeholder="—" value={linha.o2}
                          onChange={(e) => updateCampo(codigo, "o2", e.target.value)}
                          className="h-7 text-xs text-center border-cyan-200 focus:border-cyan-500 px-1" />
                      </td>
                      <td className="px-1 py-1">
                        <Input type="number" step="1" placeholder="—" value={linha.redox}
                          onChange={(e) => updateCampo(codigo, "redox", e.target.value)}
                          className="h-7 text-xs text-center border-purple-200 focus:border-purple-500 px-1" />
                      </td>
                      <td className="px-2 py-1 text-center">
                        {estado === "ok" && <CheckCircle2 size={16} className="text-green-500 mx-auto" />}
                        {estado === "erro" && <XCircle size={16} className="text-red-500 mx-auto" />}
                        {estado === "idle" && temDadosLinha && (
                          <div className="w-2 h-2 rounded-full bg-amber-400 mx-auto" title="Por registar" />
                        )}
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {/* Rodapé */}
      <div className="mt-4 flex flex-wrap items-center justify-between gap-3 text-xs text-gray-500">
        <div className="flex items-center gap-4">
          <span className="flex items-center gap-1.5"><span className="w-3 h-3 rounded bg-amber-100 border border-amber-300 inline-block" /> Linha com dados por registar</span>
          <span className="flex items-center gap-1.5"><CheckCircle2 size={12} className="text-green-500" /> Registado com sucesso</span>
          <span className="flex items-center gap-1.5"><XCircle size={12} className="text-red-500" /> Erro no registo</span>
        </div>
        <Button
          size="sm"
          onClick={registar}
          disabled={registarLote.isPending || cubasComDados.length === 0}
          className="gap-1.5 text-xs bg-[var(--color-vinho)] hover:bg-[var(--color-vinho)]/90 text-white"
        >
          {registarLote.isPending ? (
            <><Loader2 size={13} className="animate-spin" /> A registar...</>
          ) : (
            <><Save size={13} /> Registar Tudo ({cubasComDados.length})</>
          )}
        </Button>
      </div>
    </div>
  );
}
