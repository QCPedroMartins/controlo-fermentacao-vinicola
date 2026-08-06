import { useState } from "react";
import { trpc } from "@/lib/trpc";
import { useAuth } from "@/_core/hooks/useAuth";
import { usePodeEditar } from "@/hooks/usePodeEditar";
import { toast } from "sonner";
import {
  Calendar,
  CheckCircle2,
  Plus,
  RefreshCw,
  Archive,
  ChevronDown,
  ChevronRight,
  FlaskConical,
  FileText,
  ExternalLink,
} from "lucide-react";
import { Link } from "wouter";

// Componente para mostrar as fermentações de uma campanha
function CampanhaFermentacoes({ campanhaId }: { campanhaId: number }) {
  const { data: fermentacoes, isLoading } = trpc.campanhas.fermentacoesByCampanha.useQuery(
    { campanhaId },
    { staleTime: 30_000 }
  );

  if (isLoading) {
    return (
      <div className="mt-3 space-y-2 pl-4">
        {[1, 2].map((i) => (
          <div key={i} className="bg-gray-50 rounded-xl h-14 animate-pulse" />
        ))}
      </div>
    );
  }

  if (!fermentacoes || fermentacoes.length === 0) {
    return (
      <div className="mt-3 pl-4 py-4 text-center text-gray-400 text-sm">
        <Archive size={20} className="mx-auto mb-1 opacity-30" />
        Sem fermentações arquivadas nesta campanha.
      </div>
    );
  }

  return (
    <div className="mt-3 space-y-2 pl-2">
      <p className="text-xs font-semibold text-gray-400 uppercase tracking-wide pl-2 mb-2">
        {fermentacoes.length} fermentaç{fermentacoes.length === 1 ? "ão" : "ões"} arquivada{fermentacoes.length !== 1 ? "s" : ""}
      </p>
      {fermentacoes.map((f) => (
        <Link
          key={f.id}
          href={`/cuba/${f.cubaCodigo.toLowerCase()}/arquivo/${f.fermentacaoNum}`}
        >
          <div className="bg-gray-50 hover:bg-[var(--color-vinho)]/5 border border-gray-100 hover:border-[var(--color-vinho)]/20 rounded-xl p-3 flex items-center justify-between transition-all cursor-pointer group">
            <div className="flex items-center gap-3">
              <div className="w-8 h-8 rounded-lg bg-[var(--color-vinho)]/10 flex items-center justify-center flex-shrink-0">
                <FlaskConical size={14} className="text-[var(--color-vinho)]" />
              </div>
              <div>
                <div className="flex items-center gap-2">
                  <span className="font-semibold text-sm text-[var(--color-vinho)]">
                    {f.cubaCodigo.toUpperCase()}
                  </span>
                  <span className="text-xs text-gray-400">Ferm. Nº {f.fermentacaoNum}</span>
                  {f.cubaTipo === "porto" && (
                    <span className="text-xs bg-amber-100 text-amber-700 px-1.5 py-0.5 rounded font-medium">VP</span>
                  )}
                </div>
                {f.nomeLote && (
                  <p className="text-xs text-gray-500 mt-0.5">{f.nomeLote}</p>
                )}
                <div className="flex items-center gap-3 mt-0.5">
                  {f.dataInicio && (
                    <span className="text-xs text-gray-400">
                      {new Date(f.dataInicio).toLocaleDateString("pt-PT")}
                      {f.dataFim && ` → ${new Date(f.dataFim).toLocaleDateString("pt-PT")}`}
                    </span>
                  )}
                  {f.totalDias && (
                    <span className="text-xs text-gray-400">{f.totalDias} dias</span>
                  )}
                  {f.densMin && (
                    <span className="text-xs text-gray-400">
                      {f.cubaTipo === "porto" ? `Baumé mín: ${f.densMin}°` : `Dens. mín: ${parseFloat(f.densMin).toFixed(4)}`}
                    </span>
                  )}
                </div>
              </div>
            </div>
            <ExternalLink size={14} className="text-gray-300 group-hover:text-[var(--color-vinho)] transition-colors flex-shrink-0" />
          </div>
        </Link>
      ))}
    </div>
  );
}

// Componente para um cartão de campanha com expansão
function CampanhaCard({
  campanha,
  canEdit,
  onAtivar,
  isAtivarPending,
}: {
  campanha: { id: number; nome: string; descricao: string | null; ativa: boolean; createdAt: Date | string };
  canEdit: boolean;
  onAtivar: (id: number) => void;
  isAtivarPending: boolean;
}) {
  const [expanded, setExpanded] = useState(campanha.ativa);

  return (
    <div
      className={`bg-white rounded-2xl border shadow-sm transition-all ${
        campanha.ativa ? "border-[var(--color-vinho)] ring-1 ring-[var(--color-vinho)]/20" : "border-gray-100"
      }`}
    >
      {/* Cabeçalho da campanha */}
      <div className="p-5 flex items-center justify-between">
        <button
          onClick={() => setExpanded(!expanded)}
          className="flex items-center gap-3 flex-1 text-left"
        >
          <div className={`w-8 h-8 rounded-lg flex items-center justify-center flex-shrink-0 ${
            campanha.ativa ? "bg-[var(--color-vinho)]" : "bg-gray-100"
          }`}>
            <Calendar size={14} className={campanha.ativa ? "text-white" : "text-gray-400"} />
          </div>
          <div className="flex-1 min-w-0">
            <div className="flex items-center gap-2 flex-wrap">
              <p className="font-semibold text-[var(--color-vinho)]" style={{ fontFamily: "var(--font-serif)" }}>
                {campanha.nome}
              </p>
              {campanha.ativa && (
                <span className="text-xs bg-[var(--color-vinho)] text-white px-2 py-0.5 rounded-full font-medium">
                  Ativa
                </span>
              )}
            </div>
            {campanha.descricao && (
              <p className="text-xs text-gray-500 mt-0.5 truncate">{campanha.descricao}</p>
            )}
            <p className="text-xs text-gray-400 mt-0.5">
              Criada em {new Date(campanha.createdAt).toLocaleDateString("pt-PT")}
            </p>
          </div>
          <div className="flex-shrink-0 ml-2">
            {expanded ? (
              <ChevronDown size={16} className="text-gray-400" />
            ) : (
              <ChevronRight size={16} className="text-gray-400" />
            )}
          </div>
        </button>

        {canEdit && !campanha.ativa && (
          <button
            onClick={() => onAtivar(campanha.id)}
            disabled={isAtivarPending}
            className="ml-3 flex items-center gap-1.5 px-3 py-1.5 rounded-lg border border-[var(--color-vinho)] text-[var(--color-vinho)] text-xs font-semibold hover:bg-[var(--color-vinho)] hover:text-white transition-colors flex-shrink-0"
          >
            <RefreshCw size={12} /> Ativar
          </button>
        )}
      </div>

      {/* Fermentações expandíveis */}
      {expanded && (
        <div className="border-t border-gray-50 px-5 pb-5">
          <CampanhaFermentacoes campanhaId={campanha.id} />
        </div>
      )}
    </div>
  );
}

export default function Campanhas() {
  const { isAuthenticated } = useAuth();
  const canEdit = usePodeEditar();
  const utils = trpc.useUtils();

  const { data: campanhas, isLoading } = trpc.campanhas.list.useQuery();
  const { data: campanhaAtiva } = trpc.campanhas.ativa.useQuery();

  const [showNova, setShowNova] = useState(false);
  const [nome, setNome] = useState("");
  const [descricao, setDescricao] = useState("");

  const criarMutation = trpc.campanhas.criar.useMutation({
    onSuccess: (data) => {
      const msg = data.cubasFechadas > 0
        ? `Campanha criada! ${data.cubasFechadas} fermentação${data.cubasFechadas !== 1 ? "ões" : ""} arquivada${data.cubasFechadas !== 1 ? "s" : ""} automaticamente.`
        : "Campanha criada e ativada com sucesso!";
      toast.success(msg);
      utils.campanhas.list.invalidate();
      utils.campanhas.ativa.invalidate();
      utils.campanhas.fermentacoesByCampanha.invalidate();
      setShowNova(false);
      setNome("");
      setDescricao("");
    },
    onError: (err) => toast.error("Erro ao criar campanha: " + err.message),
  });

  const ativarMutation = trpc.campanhas.ativar.useMutation({
    onSuccess: () => {
      toast.success("Campanha ativada!");
      utils.campanhas.list.invalidate();
      utils.campanhas.ativa.invalidate();
    },
    onError: (err) => toast.error("Erro ao ativar campanha: " + err.message),
  });

  return (
    <div className="min-h-screen bg-[var(--color-creme)] px-4 py-8 max-w-3xl mx-auto">
      {/* Cabeçalho */}
      <div className="flex items-center justify-between mb-6">
        <div>
          <h1 className="text-2xl font-bold text-[var(--color-vinho)]" style={{ fontFamily: "var(--font-serif)" }}>
            Campanhas de Vindima
          </h1>
          <p className="text-sm text-gray-500 mt-1">
            Organize as fermentações terminadas por campanha/ano de vindima.
          </p>
        </div>
        {isAuthenticated && (
          <button
            onClick={() => setShowNova(true)}
            className="flex items-center gap-2 px-4 py-2 bg-[var(--color-vinho)] text-white rounded-xl text-sm font-semibold hover:bg-[var(--color-vinho-light)] transition-colors flex-shrink-0"
          >
            <Plus size={14} /> Nova Campanha
          </button>
        )}
      </div>

      {/* Campanha ativa em destaque */}
      {campanhaAtiva && (
        <div className="bg-[var(--color-vinho)] text-white rounded-2xl p-5 mb-6 shadow-md">
          <div className="flex items-center gap-2 mb-1">
            <CheckCircle2 size={16} />
            <span className="text-xs font-semibold uppercase tracking-wide opacity-80">Campanha Ativa</span>
          </div>
          <p className="text-2xl font-bold" style={{ fontFamily: "var(--font-serif)" }}>{campanhaAtiva.nome}</p>
          {campanhaAtiva.descricao && <p className="text-sm opacity-80 mt-1">{campanhaAtiva.descricao}</p>}
          <p className="text-xs opacity-60 mt-2">
            Criada em {new Date(campanhaAtiva.createdAt).toLocaleDateString("pt-PT")} · As fermentações arquivadas a partir de agora serão associadas a esta campanha.
          </p>
        </div>
      )}

      {!campanhaAtiva && !isLoading && (
        <div className="bg-amber-50 border border-amber-200 rounded-2xl p-5 mb-6 text-center">
          <Calendar size={32} className="mx-auto mb-2 text-amber-400" />
          <p className="text-sm text-amber-700 font-medium">Nenhuma campanha ativa.</p>
          <p className="text-xs text-amber-600 mt-1">
            Crie uma nova campanha para começar a organizar as fermentações por ano.
          </p>
        </div>
      )}

      {/* Lista de campanhas */}
      <div className="space-y-3">
        <div className="flex items-center justify-between">
          <h2 className="text-sm font-semibold text-gray-500 uppercase tracking-wide">
            Todas as Campanhas
          </h2>
          {campanhas && campanhas.length > 0 && (
            <span className="text-xs text-gray-400">{campanhas.length} campanha{campanhas.length !== 1 ? "s" : ""}</span>
          )}
        </div>

        {isLoading && (
          <div className="space-y-3">
            {[1, 2, 3].map((i) => (
              <div key={i} className="bg-white rounded-2xl h-20 animate-pulse" />
            ))}
          </div>
        )}

        {!isLoading && campanhas?.length === 0 && (
          <div className="bg-white rounded-2xl border border-gray-100 p-8 text-center text-gray-400">
            <Archive size={32} className="mx-auto mb-2 opacity-30" />
            <p className="text-sm">Sem campanhas criadas</p>
            <p className="text-xs mt-1">Clique em "Nova Campanha" para começar.</p>
          </div>
        )}

        {campanhas?.map((c) => (
          <CampanhaCard
            key={c.id}
            campanha={c}
            canEdit={canEdit}
            onAtivar={(id) => ativarMutation.mutate({ id })}
            isAtivarPending={ativarMutation.isPending}
          />
        ))}
      </div>

      {/* Nota informativa */}
      <div className="mt-6 bg-blue-50 border border-blue-100 rounded-2xl p-4 flex gap-3">
        <FileText size={16} className="text-blue-400 flex-shrink-0 mt-0.5" />
        <div>
          <p className="text-xs font-semibold text-blue-700">Como funcionam as campanhas?</p>
          <p className="text-xs text-blue-600 mt-1">
            Quando termina uma fermentação, ela é automaticamente associada à campanha ativa. 
            Clique em qualquer campanha para ver todas as fermentações arquivadas e aceder aos respectivos relatórios.
          </p>
        </div>
      </div>

      {/* Modal Nova Campanha */}
      {showNova && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 px-4">
          <div className="bg-white rounded-2xl shadow-2xl p-6 w-full max-w-md animate-fade-in">
            <h2 className="text-lg font-bold text-[var(--color-vinho)] mb-1" style={{ fontFamily: "var(--font-serif)" }}>
              Nova Campanha de Vindima
            </h2>
            <div className="bg-amber-50 border border-amber-200 rounded-xl p-3 mb-4">
              <p className="text-xs font-semibold text-amber-800 mb-1">⚠️ Atenção — Esta acção irá:</p>
              <ul className="text-xs text-amber-700 space-y-0.5 list-disc list-inside">
                <li>Terminar e arquivar <strong>todas as fermentações activas</strong></li>
                <li>Passar todas as cubas em fermentação para estado <strong>Vazia</strong></li>
                <li>Tornar esta nova campanha a campanha <strong>activa</strong></li>
              </ul>
            </div>
            <div className="space-y-3">
              <div>
                <label className="text-xs font-semibold text-gray-600 block mb-1">Nome da Campanha *</label>
                <input
                  type="text"
                  value={nome}
                  onChange={(e) => setNome(e.target.value)}
                  placeholder="Ex: Campanha 2026"
                  className="w-full border border-gray-200 rounded-xl px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-[var(--color-vinho)]/30"
                  maxLength={60}
                  autoFocus
                />
              </div>
              <div>
                <label className="text-xs font-semibold text-gray-600 block mb-1">Descrição (opcional)</label>
                <textarea
                  value={descricao}
                  onChange={(e) => setDescricao(e.target.value)}
                  placeholder="Ex: Vindima 2026 — Castelares"
                  rows={2}
                  className="w-full border border-gray-200 rounded-xl px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-[var(--color-vinho)]/30 resize-none"
                />
              </div>
            </div>
            <div className="flex gap-2 mt-5">
              <button
                onClick={() => { setShowNova(false); setNome(""); setDescricao(""); }}
                className="flex-1 px-4 py-2 rounded-xl border border-gray-200 text-sm text-gray-600 hover:bg-gray-50 transition-colors"
              >
                Cancelar
              </button>
              <button
                onClick={() => criarMutation.mutate({ nome: nome.trim(), descricao: descricao.trim() || undefined })}
                disabled={!nome.trim() || criarMutation.isPending}
                className="flex-1 px-4 py-2 rounded-xl bg-[var(--color-vinho)] text-white text-sm font-semibold hover:bg-[var(--color-vinho-light)] transition-colors disabled:opacity-50"
              >
                {criarMutation.isPending ? "A criar..." : "Criar Campanha"}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
