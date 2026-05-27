import { useState } from "react";
import { trpc } from "@/lib/trpc";
import { useAuth } from "@/_core/hooks/useAuth";
import { toast } from "sonner";
import { Calendar, CheckCircle2, Plus, RefreshCw, Archive } from "lucide-react";
import { Link } from "wouter";

export default function Campanhas() {
  const { isAuthenticated } = useAuth();
  const utils = trpc.useUtils();

  const { data: campanhas, isLoading } = trpc.campanhas.list.useQuery();
  const { data: campanhaAtiva } = trpc.campanhas.ativa.useQuery();

  const [showNova, setShowNova] = useState(false);
  const [nome, setNome] = useState("");
  const [descricao, setDescricao] = useState("");

  const criarMutation = trpc.campanhas.criar.useMutation({
    onSuccess: () => {
      toast.success("Campanha criada e ativada com sucesso!");
      utils.campanhas.list.invalidate();
      utils.campanhas.ativa.invalidate();
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
    <div className="min-h-screen bg-[var(--color-creme)] px-4 py-8 max-w-2xl mx-auto">
      {/* Cabeçalho */}
      <div className="flex items-center justify-between mb-6">
        <div className="flex items-center gap-3">
          <Link href="/">
            <button className="text-[var(--color-vinho)] hover:underline text-sm font-medium">← Dashboard</button>
          </Link>
          <span className="text-gray-300">|</span>
          <h1 className="text-2xl font-bold text-[var(--color-vinho)]" style={{ fontFamily: "var(--font-serif)" }}>
            Campanhas de Vindima
          </h1>
        </div>
        {isAuthenticated && (
          <button
            onClick={() => setShowNova(true)}
            className="flex items-center gap-2 px-4 py-2 bg-[var(--color-vinho)] text-white rounded-xl text-sm font-semibold hover:bg-[var(--color-vinho-light)] transition-colors"
          >
            <Plus size={14} /> Nova Campanha
          </button>
        )}
      </div>

      {/* Campanha ativa */}
      {campanhaAtiva && (
        <div className="bg-[var(--color-vinho)] text-white rounded-2xl p-5 mb-6 shadow-md">
          <div className="flex items-center gap-2 mb-1">
            <CheckCircle2 size={16} />
            <span className="text-xs font-semibold uppercase tracking-wide opacity-80">Campanha Ativa</span>
          </div>
          <p className="text-2xl font-bold" style={{ fontFamily: "var(--font-serif)" }}>{campanhaAtiva.nome}</p>
          {campanhaAtiva.descricao && <p className="text-sm opacity-80 mt-1">{campanhaAtiva.descricao}</p>}
          <p className="text-xs opacity-60 mt-2">
            Criada em {new Date(campanhaAtiva.createdAt).toLocaleDateString("pt-PT")}
          </p>
        </div>
      )}

      {!campanhaAtiva && !isLoading && (
        <div className="bg-amber-50 border border-amber-200 rounded-2xl p-5 mb-6 text-center">
          <Calendar size={32} className="mx-auto mb-2 text-amber-400" />
          <p className="text-sm text-amber-700 font-medium">Nenhuma campanha ativa.</p>
          <p className="text-xs text-amber-600 mt-1">Crie uma nova campanha para começar a organizar as fermentações por ano.</p>
        </div>
      )}

      {/* Lista de campanhas */}
      <div className="space-y-3">
        <h2 className="text-sm font-semibold text-gray-500 uppercase tracking-wide">Todas as Campanhas</h2>
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
          </div>
        )}
        {campanhas?.map((c) => (
          <div
            key={c.id}
            className={`bg-white rounded-2xl border shadow-sm p-5 flex items-center justify-between transition-all ${
              c.ativa ? "border-[var(--color-vinho)] ring-1 ring-[var(--color-vinho)]/20" : "border-gray-100"
            }`}
          >
            <div>
              <div className="flex items-center gap-2">
                <p className="font-semibold text-[var(--color-vinho)]" style={{ fontFamily: "var(--font-serif)" }}>
                  {c.nome}
                </p>
                {c.ativa && (
                  <span className="text-xs bg-[var(--color-vinho)] text-white px-2 py-0.5 rounded-full font-medium">
                    Ativa
                  </span>
                )}
              </div>
              {c.descricao && <p className="text-xs text-gray-500 mt-0.5">{c.descricao}</p>}
              <p className="text-xs text-gray-400 mt-1">
                Criada em {new Date(c.createdAt).toLocaleDateString("pt-PT")}
              </p>
            </div>
            {isAuthenticated && !c.ativa && (
              <button
                onClick={() => ativarMutation.mutate({ id: c.id })}
                disabled={ativarMutation.isPending}
                className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg border border-[var(--color-vinho)] text-[var(--color-vinho)] text-xs font-semibold hover:bg-[var(--color-vinho)] hover:text-white transition-colors"
              >
                <RefreshCw size={12} /> Ativar
              </button>
            )}
          </div>
        ))}
      </div>

      {/* Modal Nova Campanha */}
      {showNova && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 px-4">
          <div className="bg-white rounded-2xl shadow-2xl p-6 w-full max-w-md animate-fade-in">
            <h2 className="text-lg font-bold text-[var(--color-vinho)] mb-1" style={{ fontFamily: "var(--font-serif)" }}>
              Nova Campanha
            </h2>
            <p className="text-sm text-gray-500 mb-4">
              Ao criar uma nova campanha, ela torna-se automaticamente ativa. As fermentações arquivadas a partir deste momento serão associadas a esta campanha.
            </p>
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
