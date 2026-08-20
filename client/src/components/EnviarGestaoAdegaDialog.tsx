import { useMemo, useState } from "react";
import { ArrowRightLeft, Plus, Send, Trash2 } from "lucide-react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Textarea } from "@/components/ui/textarea";
import { trpc } from "@/lib/trpc";

type CubaResumo = { id: number; codigo: string; fichaLitros: string | null };

export default function EnviarGestaoAdegaDialog({ cuba, canEdit }: { cuba: CubaResumo; canEdit: boolean }) {
  const [open, setOpen] = useState(false);
  const [origens, setOrigens] = useState([{ cubaId: cuba.id, litros: Math.round(Number(cuba.fichaLitros ?? 0)) }]);
  const [destinos, setDestinos] = useState([{ cubaCodigo: "", litros: 0 }]);
  const [observacoes, setObservacoes] = useState("");
  const { data: cubas = [] } = trpc.cubas.list.useQuery(undefined, { enabled: open });
  const preparar = trpc.gestaoAdega.prepararEnvio.useMutation({
    onSuccess: resultado => window.location.assign(resultado.urlConfirmacao),
    onError: error => toast.error(error.message),
  });

  const porId = useMemo(() => new Map(cubas.map(item => [item.id, item])), [cubas]);
  const totalOrigem = origens.reduce((total, origem) => total + (Number(origem.litros) || 0), 0);
  const totalDestino = destinos.reduce((total, destino) => total + (Number(destino.litros) || 0), 0);
  const saldo = totalDestino - totalOrigem;
  const origemInvalida = origens.some(origem => {
    const detalhe = porId.get(origem.cubaId);
    return !detalhe || origem.litros <= 0 || origem.litros > Math.floor(Number(detalhe.fichaLitros ?? 0));
  });
  const destinoInvalido = destinos.some(destino => !destino.cubaCodigo.trim() || destino.litros <= 0);
  const podeEnviar = totalOrigem > 0 && saldo === 0 && !origemInvalida && !destinoInvalido && !preparar.isPending;

  function abrir() {
    setOrigens([{ cubaId: cuba.id, litros: Math.round(Number(cuba.fichaLitros ?? 0)) }]);
    setDestinos([{ cubaCodigo: "", litros: 0 }]);
    setObservacoes("");
    setOpen(true);
  }

  return <Dialog open={open} onOpenChange={setOpen}>
    <DialogTrigger asChild>
      <Button variant="outline" onClick={abrir} disabled={!canEdit} className="border-indigo-200 text-indigo-800 hover:bg-indigo-50"><Send className="mr-2 h-4 w-4" /> Enviar para Gestão de Adega</Button>
    </DialogTrigger>
    <DialogContent className="max-h-[90vh] max-w-3xl overflow-y-auto">
      <DialogHeader>
        <DialogTitle className="flex items-center gap-2"><ArrowRightLeft className="h-5 w-5" /> Enviar vinho para Gestão de Adega</DialogTitle>
        <DialogDescription>Escolha uma ou várias origens e distribua os litros por cubas já existentes na Gestão de Adega. A confirmação final é feita na Gestão de Adega, com rastreabilidade dos dois lados.</DialogDescription>
      </DialogHeader>

      <section className="space-y-3">
        <div className="flex items-center justify-between"><Label className="font-semibold">Cubas de origem</Label><Button type="button" variant="outline" size="sm" onClick={() => setOrigens([...origens, { cubaId: 0, litros: 0 }])}><Plus className="mr-1 h-3.5 w-3.5" /> Adicionar origem</Button></div>
        {origens.map((origem, index) => {
          const detalhe = porId.get(origem.cubaId);
          const outrosIds = origens.filter((_, posicao) => posicao !== index).map(item => item.cubaId);
          return <div key={index} className="grid grid-cols-[1fr_110px_36px] gap-2">
            <Select value={origem.cubaId ? String(origem.cubaId) : undefined} onValueChange={valor => setOrigens(origens.map((item, posicao) => posicao === index ? { ...item, cubaId: Number(valor), litros: 0 } : item))}>
              <SelectTrigger><SelectValue placeholder="Escolher cuba de origem" /></SelectTrigger>
              <SelectContent>{cubas.filter(item => item.id === cuba.id || !outrosIds.includes(item.id)).map(item => <SelectItem key={item.id} value={String(item.id)}>{item.codigo} · {Number(item.fichaLitros ?? 0).toLocaleString("pt-PT")} L</SelectItem>)}</SelectContent>
            </Select>
            <Input type="number" step="1" min="1" value={origem.litros || ""} onChange={evento => setOrigens(origens.map((item, posicao) => posicao === index ? { ...item, litros: Number(evento.target.value) } : item))} placeholder="Litros" />
            <Button type="button" variant="ghost" size="icon" disabled={origens.length === 1} onClick={() => setOrigens(origens.filter((_, posicao) => posicao !== index))}><Trash2 className="h-4 w-4" /></Button>
            {detalhe && origem.litros > Math.floor(Number(detalhe.fichaLitros ?? 0)) && <p className="col-span-3 text-xs text-destructive">{detalhe.codigo} só tem {Math.floor(Number(detalhe.fichaLitros ?? 0))} L disponíveis para envio.</p>}
          </div>;
        })}
      </section>

      <section className="space-y-3 border-t pt-4">
        <div className="flex items-center justify-between"><Label className="font-semibold">Cubas de destino na Gestão de Adega</Label><Button type="button" variant="outline" size="sm" onClick={() => setDestinos([...destinos, { cubaCodigo: "", litros: 0 }])}><Plus className="mr-1 h-3.5 w-3.5" /> Adicionar destino</Button></div>
        {destinos.map((destino, index) => <div key={index} className="grid grid-cols-[1fr_110px_36px] gap-2"><Input value={destino.cubaCodigo} onChange={evento => setDestinos(destinos.map((item, posicao) => posicao === index ? { ...item, cubaCodigo: evento.target.value.toUpperCase() } : item))} placeholder="Ex.: C49" /><Input type="number" step="1" min="1" value={destino.litros || ""} onChange={evento => setDestinos(destinos.map((item, posicao) => posicao === index ? { ...item, litros: Number(evento.target.value) } : item))} placeholder="Litros" /><Button type="button" variant="ghost" size="icon" disabled={destinos.length === 1} onClick={() => setDestinos(destinos.filter((_, posicao) => posicao !== index))}><Trash2 className="h-4 w-4" /></Button></div>)}
      </section>

      <section className={`rounded-lg border p-3 text-sm ${saldo === 0 && totalOrigem > 0 ? "border-emerald-200 bg-emerald-50" : "border-amber-200 bg-amber-50"}`}><div className="grid grid-cols-3 gap-2"><span>Origem: <strong>{totalOrigem.toLocaleString("pt-PT")} L</strong></span><span>Destino: <strong>{totalDestino.toLocaleString("pt-PT")} L</strong></span><span>Balanço: <strong>{saldo === 0 ? "Correcto" : `${saldo > 0 ? "+" : ""}${saldo.toLocaleString("pt-PT")} L`}</strong></span></div><p className="mt-2 text-xs">Os movimentos para a Gestão de Adega são registados em litros inteiros, porque as cubas de destino trabalham à unidade de litro.</p></section>
      <div className="space-y-2"><Label>Observações</Label><Textarea value={observacoes} onChange={evento => setObservacoes(evento.target.value)} placeholder="Motivo, lote ou indicação para o movimento (opcional)" /></div>
      <DialogFooter><Button type="button" variant="outline" onClick={() => setOpen(false)}>Cancelar</Button><Button disabled={!podeEnviar} onClick={() => preparar.mutate({ origens, destinos, observacoes: observacoes || null, origemUrl: window.location.origin })}>{preparar.isPending ? "A preparar…" : "Continuar para Gestão de Adega"}</Button></DialogFooter>
    </DialogContent>
  </Dialog>;
}
