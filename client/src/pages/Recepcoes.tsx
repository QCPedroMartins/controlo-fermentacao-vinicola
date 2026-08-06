import { trpc } from "@/lib/trpc";
import { useState, useMemo } from "react";
import { toast } from "sonner";
import { Truck, Plus, Trash2, ChevronDown, ChevronUp, Package } from "lucide-react";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";

interface DistribuicaoItem {
  cubaId: number;
  cubaCodigo: string;
  kg: string;
  notas: string;
}

export default function Recepcoes() {
  const utils = trpc.useUtils();
  const { data: recepcoes, isLoading } = trpc.recepcoes.list.useQuery();
  const { data: todasCubas } = trpc.cubas.list.useQuery();
  const { data: campanhaAtiva } = trpc.campanhas.ativa.useQuery();

  const [modalAberto, setModalAberto] = useState(false);
  const [expandido, setExpandido] = useState<number | null>(null);

  // Formulário
  const [dataRecepcao, setDataRecepcao] = useState(() => new Date().toISOString().slice(0, 10));
  const [casta, setCasta] = useState("");
  const [kgTotal, setKgTotal] = useState("");
  const [notas, setNotas] = useState("");
  const [distribuicao, setDistribuicao] = useState<DistribuicaoItem[]>([
    { cubaId: 0, cubaCodigo: "", kg: "", notas: "" },
  ]);

  const criarMutation = trpc.recepcoes.criar.useMutation({
    onSuccess: () => {
      toast.success("Recepção registada com sucesso");
      utils.recepcoes.list.invalidate();
      setModalAberto(false);
      resetForm();
    },
    onError: (err) => toast.error(`Erro: ${err.message}`),
  });

  const eliminarMutation = trpc.recepcoes.eliminar.useMutation({
    onSuccess: () => {
      toast.success("Recepção eliminada");
      utils.recepcoes.list.invalidate();
    },
    onError: (err) => toast.error(`Erro: ${err.message}`),
  });

  function resetForm() {
    setDataRecepcao(new Date().toISOString().slice(0, 10));
    setCasta("");
    setKgTotal("");
    setNotas("");
    setDistribuicao([{ cubaId: 0, cubaCodigo: "", kg: "", notas: "" }]);
  }

  const kgDistribuido = useMemo(
    () => distribuicao.reduce((sum, d) => sum + (parseFloat(d.kg) || 0), 0),
    [distribuicao]
  );
  const kgRestante = (parseFloat(kgTotal) || 0) - kgDistribuido;

  function addLinha() {
    setDistribuicao((prev) => [...prev, { cubaId: 0, cubaCodigo: "", kg: "", notas: "" }]);
  }

  function removeLinha(idx: number) {
    setDistribuicao((prev) => prev.filter((_, i) => i !== idx));
  }

  function updateLinha(idx: number, field: keyof DistribuicaoItem, value: string | number) {
    setDistribuicao((prev) =>
      prev.map((d, i) => {
        if (i !== idx) return d;
        if (field === "cubaId") {
          const cuba = todasCubas?.find((c) => c.id === Number(value));
          return { ...d, cubaId: Number(value), cubaCodigo: cuba?.codigo ?? "" };
        }
        return { ...d, [field]: value };
      })
    );
  }

  function submeter() {
    const linhasValidas = distribuicao.filter((d) => d.cubaId > 0 && parseFloat(d.kg) > 0);
    if (!dataRecepcao || !kgTotal || parseFloat(kgTotal) <= 0) {
      toast.error("Preencha a data e os kg totais");
      return;
    }
    if (linhasValidas.length === 0) {
      toast.error("Adicione pelo menos uma cuba com kg");
      return;
    }
    criarMutation.mutate({
      dataRecepcao,
      casta: casta || undefined,
      kgTotal: parseFloat(kgTotal),
      notas: notas || undefined,
      campanhaId: campanhaAtiva?.id ?? undefined,
      distribuicao: linhasValidas.map((d) => ({
        cubaId: d.cubaId,
        kg: parseFloat(d.kg),
        notas: d.notas || undefined,
      })),
    });
  }

  const cubasDisponiveis = todasCubas ?? [];

  return (
    <div className="p-4 sm:p-6 lg:p-8 animate-fade-in">
      {/* Cabeçalho */}
      <div className="mb-6 flex flex-wrap items-start justify-between gap-4">
        <div>
          <div className="flex items-center gap-3 mb-1">
            <Truck size={22} className="text-[var(--color-vinho)]" />
            <h1 className="text-2xl font-bold text-[var(--color-vinho)]">Recepção de Uvas</h1>
          </div>
          <p className="text-gray-500 text-sm">Registo de entradas de uva e distribuição por cubas</p>
        </div>
        <Button
          onClick={() => setModalAberto(true)}
          className="bg-[var(--color-vinho)] text-white hover:bg-[var(--color-vinho)]/90 flex items-center gap-2"
        >
          <Plus size={16} />
          Nova Recepção
        </Button>
      </div>

      {/* Lista de recepções */}
      {isLoading ? (
        <div className="text-center py-16 text-gray-400">A carregar...</div>
      ) : !recepcoes || recepcoes.length === 0 ? (
        <div className="text-center py-16">
          <Package size={40} className="mx-auto mb-3 text-gray-300" />
          <p className="text-gray-400 text-sm">Nenhuma recepção registada</p>
          <p className="text-gray-300 text-xs mt-1">Clique em "Nova Recepção" para começar</p>
        </div>
      ) : (
        <div className="space-y-3">
          {recepcoes.map((r) => (
            <div key={r.id} className="bg-white border border-gray-200 rounded-xl shadow-sm overflow-hidden">
              <div
                className="flex items-center justify-between px-5 py-4 cursor-pointer hover:bg-gray-50 transition-colors"
                onClick={() => setExpandido(expandido === r.id ? null : r.id)}
              >
                <div className="flex items-center gap-4">
                  <div className="w-10 h-10 rounded-lg bg-[var(--color-vinho)]/10 flex items-center justify-center">
                    <Truck size={18} className="text-[var(--color-vinho)]" />
                  </div>
                  <div>
                    <div className="flex items-center gap-2">
                      <span className="font-semibold text-gray-800">
                        {new Date(r.dataRecepcao + "T12:00:00").toLocaleDateString("pt-PT")}
                      </span>
                      {r.casta && (
                        <span className="px-2 py-0.5 rounded-full bg-[var(--color-vinho)]/10 text-[var(--color-vinho)] text-xs font-medium">
                          {r.casta}
                        </span>
                      )}
                    </div>
                    <div className="flex items-center gap-3 mt-0.5">
                      <span className="text-sm text-gray-600 font-medium">
                        {parseFloat(r.kgTotal).toLocaleString("pt-PT")} kg
                      </span>
                      <span className="text-xs text-gray-400">
                        → {r.distribuicao.length} cuba(s): {r.distribuicao.map((d) => d.cubaCodigo.toUpperCase()).join(", ")}
                      </span>
                    </div>
                  </div>
                </div>
                <div className="flex items-center gap-2">
                  <button
                    onClick={(e) => {
                      e.stopPropagation();
                      if (confirm("Eliminar esta recepção?")) eliminarMutation.mutate({ id: r.id });
                    }}
                    className="p-1.5 rounded-lg text-gray-400 hover:text-red-500 hover:bg-red-50 transition-colors"
                  >
                    <Trash2 size={15} />
                  </button>
                  {expandido === r.id ? <ChevronUp size={16} className="text-gray-400" /> : <ChevronDown size={16} className="text-gray-400" />}
                </div>
              </div>

              {expandido === r.id && (
                <div className="border-t border-gray-100 px-5 py-4 bg-gray-50">
                  {r.notas && <p className="text-sm text-gray-600 mb-3 italic">"{r.notas}"</p>}
                  <table className="w-full text-sm">
                    <thead>
                      <tr className="text-xs text-gray-500 uppercase tracking-wide">
                        <th className="text-left pb-2">Cuba</th>
                        <th className="text-right pb-2">Kg atribuídos</th>
                        <th className="text-right pb-2">% do total</th>
                        <th className="text-left pb-2 pl-4">Notas</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-gray-100">
                      {r.distribuicao.map((d) => (
                        <tr key={d.id}>
                          <td className="py-2 font-medium text-[var(--color-vinho)]">{d.cubaCodigo.toUpperCase()}</td>
                          <td className="py-2 text-right font-mono">{parseFloat(d.kg).toLocaleString("pt-PT")} kg</td>
                          <td className="py-2 text-right text-gray-500">
                            {((parseFloat(d.kg) / parseFloat(r.kgTotal)) * 100).toFixed(1)}%
                          </td>
                          <td className="py-2 pl-4 text-gray-500">{d.notas ?? "—"}</td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              )}
            </div>
          ))}
        </div>
      )}

      {/* Modal de nova recepção */}
      <Dialog open={modalAberto} onOpenChange={setModalAberto}>
        <DialogContent className="max-w-2xl max-h-[90vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2 text-[var(--color-vinho)]">
              <Truck size={18} />
              Nova Recepção de Uvas
            </DialogTitle>
          </DialogHeader>

          <div className="space-y-4 py-2">
            {/* Dados gerais */}
            <div className="grid grid-cols-2 gap-3">
              <div>
                <label className="block text-xs font-medium text-gray-600 mb-1">Data de recepção *</label>
                <input
                  type="date"
                  value={dataRecepcao}
                  onChange={(e) => setDataRecepcao(e.target.value)}
                  className="w-full px-3 py-2 border border-gray-200 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-[var(--color-vinho)]/30"
                />
              </div>
              <div>
                <label className="block text-xs font-medium text-gray-600 mb-1">Kg totais recebidos *</label>
                <input
                  type="number"
                  value={kgTotal}
                  onChange={(e) => setKgTotal(e.target.value)}
                  placeholder="ex: 10000"
                  className="w-full px-3 py-2 border border-gray-200 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-[var(--color-vinho)]/30"
                />
              </div>
            </div>
            <div className="grid grid-cols-2 gap-3">
              <div>
                <label className="block text-xs font-medium text-gray-600 mb-1">Casta / Variedade</label>
                <input
                  type="text"
                  value={casta}
                  onChange={(e) => setCasta(e.target.value)}
                  placeholder="ex: Touriga Nacional"
                  className="w-full px-3 py-2 border border-gray-200 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-[var(--color-vinho)]/30"
                />
              </div>
              <div>
                <label className="block text-xs font-medium text-gray-600 mb-1">Notas gerais</label>
                <input
                  type="text"
                  value={notas}
                  onChange={(e) => setNotas(e.target.value)}
                  placeholder="Observações opcionais"
                  className="w-full px-3 py-2 border border-gray-200 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-[var(--color-vinho)]/30"
                />
              </div>
            </div>

            {/* Distribuição por cubas */}
            <div>
              <div className="flex items-center justify-between mb-2">
                <label className="text-xs font-medium text-gray-600">Distribuição por cubas *</label>
                {parseFloat(kgTotal) > 0 && (
                  <span className={`text-xs font-medium ${Math.abs(kgRestante) < 0.1 ? "text-green-600" : kgRestante < 0 ? "text-red-500" : "text-amber-600"}`}>
                    {kgRestante > 0.05 ? `Faltam ${kgRestante.toLocaleString("pt-PT")} kg` :
                     kgRestante < -0.05 ? `Excesso de ${Math.abs(kgRestante).toLocaleString("pt-PT")} kg` :
                     "✓ Total distribuído"}
                  </span>
                )}
              </div>

              <div className="space-y-2">
                {distribuicao.map((d, idx) => (
                  <div key={idx} className="flex items-center gap-2">
                    <select
                      value={d.cubaId || ""}
                      onChange={(e) => updateLinha(idx, "cubaId", e.target.value)}
                      className="flex-1 px-3 py-2 border border-gray-200 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-[var(--color-vinho)]/30 bg-white"
                    >
                      <option value="">Seleccionar cuba...</option>
                      {cubasDisponiveis.map((c) => (
                        <option key={c.id} value={c.id}>
                          {c.codigo.toUpperCase()}{c.nomeLote ? ` — ${c.nomeLote}` : ""}
                        </option>
                      ))}
                    </select>
                    <input
                      type="number"
                      value={d.kg}
                      onChange={(e) => updateLinha(idx, "kg", e.target.value)}
                      placeholder="Kg"
                      className="w-28 px-3 py-2 border border-gray-200 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-[var(--color-vinho)]/30"
                    />
                    <input
                      type="text"
                      value={d.notas}
                      onChange={(e) => updateLinha(idx, "notas", e.target.value)}
                      placeholder="Notas (opcional)"
                      className="flex-1 px-3 py-2 border border-gray-200 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-[var(--color-vinho)]/30"
                    />
                    {distribuicao.length > 1 && (
                      <button onClick={() => removeLinha(idx)} className="p-1.5 text-gray-400 hover:text-red-500 transition-colors">
                        <Trash2 size={15} />
                      </button>
                    )}
                  </div>
                ))}
              </div>

              <button
                onClick={addLinha}
                className="mt-2 flex items-center gap-1.5 text-xs text-[var(--color-vinho)] hover:underline"
              >
                <Plus size={13} />
                Adicionar cuba
              </button>
            </div>
          </div>

          <DialogFooter>
            <Button variant="outline" onClick={() => { setModalAberto(false); resetForm(); }}>
              Cancelar
            </Button>
            <Button
              onClick={submeter}
              disabled={criarMutation.isPending}
              className="bg-[var(--color-vinho)] text-white hover:bg-[var(--color-vinho)]/90"
            >
              {criarMutation.isPending ? "A guardar..." : "Registar Recepção"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
