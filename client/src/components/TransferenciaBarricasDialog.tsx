import { useMemo, useState } from "react";
import { Wine, Minus, Plus, Save } from "lucide-react";
import { toast } from "sonner";
import { trpc } from "@/lib/trpc";
import { Dialog, DialogContent, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog";

type CubaBarrica = { id: number; codigo: string; fichaLitros?: string | null };
type Destino = { capacidade: string; capacidadeOutra: string; litros: string; codigo: string };
const CAPACIDADES = ["225", "300", "500", "600", "customizada"];
const novoDestino = (): Destino => ({ capacidade: "225", capacidadeOutra: "", litros: "225", codigo: "" });

export default function TransferenciaBarricasDialog({ cuba, canEdit }: { cuba: CubaBarrica; canEdit: boolean }) {
  const utils = trpc.useUtils();
  const [aberto, setAberto] = useState(false);
  const [dataMovimento, setDataMovimento] = useState(() => new Date().toISOString().slice(0, 10));
  const [motivo, setMotivo] = useState("");
  const [destinos, setDestinos] = useState<Destino[]>([novoDestino()]);
  const litrosDisponiveis = Number(cuba.fichaLitros ?? 0);
  const capacidades = useMemo(() => destinos.map((d) => Number((d.capacidade === "customizada" ? d.capacidadeOutra : d.capacidade).replace(",", ".")) || 0), [destinos]);
  const litros = useMemo(() => destinos.map((d) => Number(d.litros.replace(",", ".")) || 0), [destinos]);
  const total = litros.reduce((soma, valor) => soma + valor, 0);
  const restante = litrosDisponiveis - total;
  const transferir = trpc.barricas.transferirDaCuba.useMutation({
    onSuccess: (dados) => {
      toast.success(`Transferência concluída: ${dados.barricas.map((b) => b.codigo).join(", ")}`);
      setAberto(false); setDestinos([novoDestino()]); setMotivo("");
      utils.cubas.get.invalidate(); utils.cubas.dashboard.invalidate(); utils.barricas.list.invalidate(); utils.barricas.movimentosByCuba.invalidate({ cubaId: cuba.id });
    },
    onError: (erro) => toast.error(`Erro na transferência para barricas: ${erro.message}`),
  });
  function abrir() { setDataMovimento(new Date().toISOString().slice(0, 10)); setDestinos([novoDestino()]); setMotivo(""); setAberto(true); }
  function actualizar(indice: number, patch: Partial<Destino>) { setDestinos((actual) => actual.map((destino, i) => i === indice ? { ...destino, ...patch } : destino)); }
  function guardar() {
    transferir.mutate({ cubaOrigemId: cuba.id, dataMovimento, motivo: motivo.trim() || undefined, destinos: destinos.map((d, i) => ({ capacidadeLitros: capacidades[i], litros: litros[i], codigo: d.codigo.trim() || undefined })) });
  }
  if (!canEdit) return null;
  return <><button onClick={abrir} disabled={litrosDisponiveis <= 0} className="flex items-center gap-2 rounded-xl border border-amber-600 px-4 py-2 text-sm font-semibold text-amber-800 hover:bg-amber-50 disabled:cursor-not-allowed disabled:opacity-50"><Wine size={16} /> Transferir para barricas</button><Dialog open={aberto} onOpenChange={setAberto}><DialogContent className="max-w-3xl"><DialogHeader><DialogTitle>Transferir {cuba.codigo.toUpperCase()} para barricas</DialogTitle></DialogHeader><div className="space-y-4 py-2"><div className="grid grid-cols-1 gap-3 rounded-xl bg-amber-50 p-4 text-sm sm:grid-cols-3"><div><p className="text-xs text-amber-700">Disponível na cuba</p><strong className="text-amber-950">{litrosDisponiveis.toLocaleString("pt-PT")} L</strong></div><div><p className="text-xs text-amber-700">A transferir</p><strong className={total > litrosDisponiveis ? "text-red-700" : "text-amber-950"}>{total.toLocaleString("pt-PT")} L</strong></div><div><p className="text-xs text-amber-700">Fica na cuba</p><strong className={restante < 0 ? "text-red-700" : "text-amber-950"}>{Math.max(0, restante).toLocaleString("pt-PT")} L</strong></div></div><label className="block text-sm font-medium">Data<input type="date" value={dataMovimento} onChange={(e) => setDataMovimento(e.target.value)} className="mt-1 w-full rounded-lg border border-gray-300 px-3 py-2" /></label><div className="space-y-3">{destinos.map((destino, indice) => <div key={indice} className="rounded-xl border border-gray-200 p-3"><div className="mb-2 flex items-center justify-between"><strong className="text-sm text-gray-800">Barrica {indice + 1}</strong>{destinos.length > 1 && <button onClick={() => setDestinos((actual) => actual.filter((_, i) => i !== indice))} className="text-xs text-red-600"><Minus size={14} className="inline" /> Remover</button>}</div><div className="grid grid-cols-1 gap-3 sm:grid-cols-3"><label className="text-xs font-medium text-gray-600">Capacidade<select value={destino.capacidade} onChange={(e) => actualizar(indice, { capacidade: e.target.value, litros: e.target.value === "customizada" ? destino.litros : e.target.value })} className="mt-1 w-full rounded-lg border border-gray-300 px-2 py-2 text-sm">{CAPACIDADES.map((capacidade) => <option key={capacidade} value={capacidade}>{capacidade === "customizada" ? "Outra capacidade" : `${capacidade} L`}</option>)}</select></label>{destino.capacidade === "customizada" && <label className="text-xs font-medium text-gray-600">Capacidade (L)<input value={destino.capacidadeOutra} onChange={(e) => actualizar(indice, { capacidadeOutra: e.target.value })} inputMode="decimal" className="mt-1 w-full rounded-lg border border-gray-300 px-2 py-2 text-sm" /></label>}<label className="text-xs font-medium text-gray-600">Litros a colocar<input value={destino.litros} onChange={(e) => actualizar(indice, { litros: e.target.value })} inputMode="decimal" className="mt-1 w-full rounded-lg border border-gray-300 px-2 py-2 text-sm" /></label><label className="text-xs font-medium text-gray-600">Código <span className="font-normal text-gray-400">(opcional)</span><input value={destino.codigo} onChange={(e) => actualizar(indice, { codigo: e.target.value })} className="mt-1 w-full rounded-lg border border-gray-300 px-2 py-2 text-sm" placeholder="Gerado automaticamente" /></label></div>{capacidades[indice] > 0 && litros[indice] > capacidades[indice] && <p className="mt-2 text-xs font-medium text-red-600">Os litros excedem a capacidade desta barrica.</p>}</div>)}</div><button onClick={() => setDestinos((actual) => [...actual, novoDestino()])} className="inline-flex items-center gap-1 text-sm font-semibold text-amber-800"><Plus size={15} /> Adicionar barrica</button><label className="block text-sm font-medium">Observação <span className="font-normal text-gray-400">(opcional)</span><textarea value={motivo} onChange={(e) => setMotivo(e.target.value)} rows={2} className="mt-1 w-full rounded-lg border border-gray-300 px-3 py-2" placeholder="Ex.: estágio em carvalho" /></label></div><DialogFooter><button onClick={() => setAberto(false)} className="rounded-lg border border-gray-300 px-4 py-2 text-sm font-medium">Cancelar</button><button onClick={guardar} disabled={transferir.isPending || total <= 0 || total > litrosDisponiveis || capacidades.some((capacidade, i) => capacidade <= 0 || litros[i] > capacidade)} className="inline-flex items-center gap-2 rounded-lg bg-amber-700 px-4 py-2 text-sm font-semibold text-white disabled:opacity-50"><Save size={15} />{transferir.isPending ? "A transferir..." : "Criar barricas e transferir"}</button></DialogFooter></DialogContent></Dialog></>;
}
