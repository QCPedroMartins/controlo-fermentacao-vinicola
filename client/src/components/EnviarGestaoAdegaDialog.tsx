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
import { distribuirVinhoPorOrigens } from "@/lib/gestaoAdegaBalance";
import { encontrarDestinosAdegaDuplicados, normalizarCodigoDestinoAdega } from "@shared/gestaoAdegaDestinos";

type CubaResumo = { id: number; codigo: string; fichaLitros: string | null };
type Origem = { cubaId: number; litros: number };
type Borras = { cubaOrigemId: number; litros: number; destino: "manter" | "cuba_borras" | "lixo"; cubaDestinoId?: number | null };

export default function EnviarGestaoAdegaDialog({ cuba, canEdit }: { cuba: CubaResumo; canEdit: boolean }) {
  const [open, setOpen] = useState(false);
  const [origens, setOrigens] = useState<Origem[]>([{ cubaId: cuba.id, litros: Math.round(Number(cuba.fichaLitros ?? 0)) }]);
  const [destinos, setDestinos] = useState([{ cubaCodigo: "", litros: 0 }]);
  const [borras, setBorras] = useState<Borras[]>([]);
  const [observacoes, setObservacoes] = useState("");
  const { data: cubas = [] } = trpc.cubas.list.useQuery(undefined, { enabled: open });
  const destinosAdegaQuery = trpc.gestaoAdega.destinos.useQuery(undefined, {
    enabled: open,
    retry: false,
    refetchOnWindowFocus: true,
    refetchInterval: 20_000,
  });
  const preparar = trpc.gestaoAdega.prepararEnvio.useMutation({
    onSuccess: resultado => window.location.assign(resultado.urlConfirmacao),
    onError: error => toast.error(error.message),
  });

  const porId = useMemo(() => new Map(cubas.map(item => [item.id, item])), [cubas]);
  const destinosAdega = destinosAdegaQuery.data ?? [];
  const porCodigoAdega = useMemo(() => new Map(destinosAdega.map(item => [item.codigo.toUpperCase(), item])), [destinosAdega]);
  const destinosDuplicados = encontrarDestinosAdegaDuplicados(destinos);
  const totalDestino = destinos.reduce((total, destino) => total + (Number(destino.litros) || 0), 0);
  const distribuicao = distribuirVinhoPorOrigens(origens.map(origem => ({
    cubaId: origem.cubaId,
    limiteLitros: origem.litros,
    disponivelLitros: Number(porId.get(origem.cubaId)?.fichaLitros ?? 0),
  })), totalDestino);
  const origensParaEnviar = distribuicao.filter(origem => origem.litros > 0).map(({ cubaId, litros }) => ({ cubaId, litros }));
  const totalVinho = origensParaEnviar.reduce((total, origem) => total + origem.litros, 0);
  const totalDisponivel = distribuicao.reduce((total, origem) => total + origem.disponivel, 0);
  const borrasAtivas = borras.filter(borra => origens.some(origem => origem.cubaId === borra.cubaOrigemId));
  const totalBorras = borrasAtivas.reduce((total, borra) => total + (Number(borra.litros) || 0), 0);
  const sobraPorAfectar = Math.max(0, totalDisponivel - totalVinho - totalBorras);
  const saldo = totalDestino - totalVinho;
  const origemInvalida = origens.some(origem => {
    const detalhe = porId.get(origem.cubaId);
    return !detalhe || origem.litros <= 0 || origem.litros > Number(detalhe.fichaLitros ?? 0);
  });
  const destinoInvalido = destinos.some(destino => {
    const cubaDestino = porCodigoAdega.get(destino.cubaCodigo.trim().toUpperCase());
    return !destino.cubaCodigo.trim() || destino.litros <= 0 || !cubaDestino || destino.litros > cubaDestino.disponivelLitros;
  }) || destinosDuplicados.length > 0;
  const borrasInvalida = borrasAtivas.some(borra => {
    const origem = distribuicao.find(item => item.cubaId === borra.cubaOrigemId);
    return !origem || borra.litros < 0 || borra.litros > origem.restante || (borra.destino === "cuba_borras" && !borra.cubaDestinoId);
  });
  const capacidadeInvalida = destinosAdegaQuery.isError || !destinosAdegaQuery.data;
  const podeEnviar = totalDestino > 0 && totalVinho > 0 && saldo === 0 && !origemInvalida && !destinoInvalido && !borrasInvalida && !capacidadeInvalida && !preparar.isPending;

  function actualizarBorras(cubaOrigemId: number, alteracao: Partial<Borras>) {
    setBorras(actual => {
      const existente = actual.find(borra => borra.cubaOrigemId === cubaOrigemId);
      const proxima = { cubaOrigemId, litros: 0, destino: "manter" as const, cubaDestinoId: null, ...existente, ...alteracao };
      return existente ? actual.map(borra => borra.cubaOrigemId === cubaOrigemId ? proxima : borra) : [...actual, proxima];
    });
  }

  function abrir() {
    setOrigens([{ cubaId: cuba.id, litros: Math.round(Number(cuba.fichaLitros ?? 0)) }]);
    setDestinos([{ cubaCodigo: "", litros: 0 }]);
    setBorras([]);
    setObservacoes("");
    setOpen(true);
  }

  return <Dialog open={open} onOpenChange={setOpen}>
    <DialogTrigger asChild>
      <Button
        variant="outline"
        onClick={abrir}
        disabled={!canEdit}
        className="min-h-12 rounded-xl border-indigo-500 bg-indigo-50/40 px-5 py-3 text-sm font-semibold text-indigo-700 shadow-sm transition-colors hover:bg-indigo-100 hover:text-indigo-800"
      >
        <Send className="mr-2 h-4 w-4" /> Enviar para Gestão de Adega
      </Button>
    </DialogTrigger>
    <DialogContent className="max-h-[90vh] max-w-3xl overflow-y-auto">
      <DialogHeader>
        <DialogTitle className="flex items-center gap-2"><ArrowRightLeft className="h-5 w-5" /> Enviar vinho para Gestão de Adega</DialogTitle>
        <DialogDescription>As cubas de destino, ocupação e disponibilidade são consultadas em tempo real na Gestão de Adega. O movimento só continua se existir capacidade.</DialogDescription>
      </DialogHeader>

      <section className="space-y-3">
        <div className="flex items-center justify-between"><Label className="font-semibold">Cubas de origem</Label><Button type="button" variant="outline" size="sm" onClick={() => setOrigens([...origens, { cubaId: 0, litros: 0 }])}><Plus className="mr-1 h-3.5 w-3.5" /> Adicionar origem</Button></div>
        {origens.map((origem, index) => {
          const detalhe = porId.get(origem.cubaId);
          const distribuida = distribuicao[index];
          const outrosIds = origens.filter((_, posicao) => posicao !== index).map(item => item.cubaId);
          return <div key={index} className="grid grid-cols-[1fr_130px_36px] gap-2">
            <Select value={origem.cubaId ? String(origem.cubaId) : undefined} onValueChange={valor => {
              const detalheNova = porId.get(Number(valor));
              setOrigens(origens.map((item, posicao) => posicao === index ? { ...item, cubaId: Number(valor), litros: Math.floor(Number(detalheNova?.fichaLitros ?? 0)) } : item));
            }}>
              <SelectTrigger><SelectValue placeholder="Escolher cuba de origem" /></SelectTrigger>
              <SelectContent>{cubas.filter(item => item.id === cuba.id || !outrosIds.includes(item.id)).map(item => <SelectItem key={item.id} value={String(item.id)}>{item.codigo} · {Number(item.fichaLitros ?? 0).toLocaleString("pt-PT")} L</SelectItem>)}</SelectContent>
            </Select>
            <Input type="number" step="1" min="1" value={origem.litros || ""} onChange={evento => setOrigens(origens.map((item, posicao) => posicao === index ? { ...item, litros: Number(evento.target.value) } : item))} placeholder="Máx. a enviar" />
            <Button type="button" variant="ghost" size="icon" disabled={origens.length === 1} onClick={() => setOrigens(origens.filter((_, posicao) => posicao !== index))}><Trash2 className="h-4 w-4" /></Button>
            {detalhe && <p className="col-span-3 text-xs text-muted-foreground">Disponível: {Number(detalhe.fichaLitros ?? 0).toLocaleString("pt-PT")} L · Vinho atribuído: {distribuida?.litros.toLocaleString("pt-PT") ?? 0} L</p>}
          </div>;
        })}
      </section>

      <section className="space-y-3 border-t pt-4">
        <div className="flex items-center justify-between"><Label className="font-semibold">Cubas de destino na Gestão de Adega</Label><Button type="button" variant="outline" size="sm" onClick={() => setDestinos([...destinos, { cubaCodigo: "", litros: 0 }])} disabled={capacidadeInvalida}><Plus className="mr-1 h-3.5 w-3.5" /> Adicionar destino</Button></div>
        {destinosAdegaQuery.isLoading && <p className="text-sm text-muted-foreground">A consultar capacidades actuais da Gestão de Adega…</p>}
        {destinosAdegaQuery.isError && <p className="rounded-md border border-destructive/30 bg-destructive/5 p-2 text-sm text-destructive">Não foi possível consultar a Gestão de Adega. O envio está bloqueado até a ligação voltar a estar disponível.</p>}
        {destinos.map((destino, index) => {
          const detalhe = porCodigoAdega.get(destino.cubaCodigo.trim().toUpperCase());
          const outrosCodigos = new Set(destinos.filter((_, posicao) => posicao !== index).map(item => normalizarCodigoDestinoAdega(item.cubaCodigo)).filter(Boolean));
          return <div key={index} className="grid grid-cols-[1fr_110px_36px] gap-2">
            <Select value={destino.cubaCodigo || undefined} onValueChange={valor => {
              const codigo = normalizarCodigoDestinoAdega(valor);
              if (outrosCodigos.has(codigo)) {
                toast.error(`A cuba ${codigo} já foi escolhida. Some os litros na linha existente.`);
                return;
              }
              setDestinos(destinos.map((item, posicao) => posicao === index ? { ...item, cubaCodigo: codigo } : item));
            }} disabled={capacidadeInvalida}>
              <SelectTrigger><SelectValue placeholder="Escolher cuba de destino" /></SelectTrigger>
              <SelectContent>{destinosAdega.filter(item => normalizarCodigoDestinoAdega(item.codigo) === normalizarCodigoDestinoAdega(destino.cubaCodigo) || !outrosCodigos.has(normalizarCodigoDestinoAdega(item.codigo))).map(item => <SelectItem key={item.id} value={normalizarCodigoDestinoAdega(item.codigo)}>{item.codigo} · {item.litrosAtuais.toLocaleString("pt-PT")} / {item.capacidadeLitros.toLocaleString("pt-PT")} L · livre {item.disponivelLitros.toLocaleString("pt-PT")} L</SelectItem>)}</SelectContent>
            </Select>
            <Input type="number" step="1" min="1" max={detalhe?.disponivelLitros} value={destino.litros || ""} onChange={evento => setDestinos(destinos.map((item, posicao) => posicao === index ? { ...item, litros: Number(evento.target.value) } : item))} placeholder="Litros" disabled={capacidadeInvalida} />
            <Button type="button" variant="ghost" size="icon" disabled={destinos.length === 1} onClick={() => setDestinos(destinos.filter((_, posicao) => posicao !== index))}><Trash2 className="h-4 w-4" /></Button>
            {detalhe && <p className={`col-span-3 text-xs ${destino.litros > detalhe.disponivelLitros ? "text-destructive" : "text-muted-foreground"}`}>Ocupação actual: {detalhe.litrosAtuais.toLocaleString("pt-PT")} / {detalhe.capacidadeLitros.toLocaleString("pt-PT")} L · Disponível: {detalhe.disponivelLitros.toLocaleString("pt-PT")} L</p>}
          </div>;
        })}
        {destinosDuplicados.length > 0 && <p className="rounded-md border border-destructive/30 bg-destructive/5 p-2 text-sm text-destructive">A cuba {destinosDuplicados.join(", ")} só pode ser indicada uma vez. Some os litros na linha existente.</p>}
      </section>

      <section className="space-y-3 border-t pt-4">
        <div><Label className="font-semibold">Borras e fecho da fermentação</Label><p className="mt-1 text-xs text-muted-foreground">O restante após vinho é calculado automaticamente por cuba. Ao escolher lixo ou cuba de borras, o valor restante é preenchido e pode ser ajustado.</p></div>
        {distribuicao.filter(origem => origem.cubaId).map(origem => {
          const detalhe = porId.get(origem.cubaId);
          const borra = borrasAtivas.find(item => item.cubaOrigemId === origem.cubaId) ?? { cubaOrigemId: origem.cubaId, litros: 0, destino: "manter" as const, cubaDestinoId: null };
          return <div key={origem.cubaId} className="rounded-lg border bg-amber-50/60 p-3"><div className="mb-2 flex justify-between text-sm"><strong>{detalhe?.codigo ?? "Cuba"}</strong><span>Restante após vinho: {origem.restante.toLocaleString("pt-PT")} L</span></div><div className="grid gap-2 md:grid-cols-[120px_1fr_1fr]"><Input type="number" step="1" min="0" max={origem.restante} value={borra.litros || ""} onChange={evento => actualizarBorras(origem.cubaId, { litros: Number(evento.target.value) })} placeholder="Litros de borras" /><Select value={borra.destino} onValueChange={valor => actualizarBorras(origem.cubaId, { destino: valor as Borras["destino"], litros: valor === "manter" ? borra.litros : origem.restante, cubaDestinoId: valor === "cuba_borras" ? borra.cubaDestinoId : null })}><SelectTrigger><SelectValue /></SelectTrigger><SelectContent><SelectItem value="manter">Manter na cuba</SelectItem><SelectItem value="cuba_borras">Enviar para cuba de borras</SelectItem><SelectItem value="lixo">Registar como lixo</SelectItem></SelectContent></Select>{borra.destino === "cuba_borras" ? <Select value={borra.cubaDestinoId ? String(borra.cubaDestinoId) : undefined} onValueChange={valor => actualizarBorras(origem.cubaId, { cubaDestinoId: Number(valor) })}><SelectTrigger><SelectValue placeholder="Escolher cuba de borras" /></SelectTrigger><SelectContent>{cubas.filter(item => item.id !== origem.cubaId && !origens.some(fonte => fonte.cubaId === item.id)).map(item => <SelectItem key={item.id} value={String(item.id)}>{item.codigo} · {Number(item.fichaLitros ?? 0).toLocaleString("pt-PT")} L</SelectItem>)}</SelectContent></Select> : <div className="rounded-md border bg-white px-3 py-2 text-sm text-muted-foreground">{borra.destino === "lixo" ? "Sem recipiente de destino" : "Fica na cuba como borras"}</div>}</div>{borra.litros > origem.restante && <p className="mt-2 text-xs text-destructive">As borras não podem exceder os litros restantes.</p>}</div>;
        })}
      </section>

      <section className={`rounded-lg border p-3 text-sm ${saldo === 0 && totalDestino > 0 && !origemInvalida && !destinoInvalido && !borrasInvalida && !capacidadeInvalida ? "border-emerald-200 bg-emerald-50" : "border-amber-200 bg-amber-50"}`}><div className="grid gap-2 md:grid-cols-4"><span>Vinho: <strong>{totalVinho.toLocaleString("pt-PT")} L</strong></span><span>Destinos: <strong>{totalDestino.toLocaleString("pt-PT")} L</strong></span><span>Borras: <strong>{totalBorras.toLocaleString("pt-PT")} L</strong></span><span>Por afectar: <strong>{sobraPorAfectar.toLocaleString("pt-PT")} L</strong></span></div><p className="mt-2 text-xs">Balanço do vinho: {saldo === 0 ? "Correcto" : `${saldo > 0 ? "+" : ""}${saldo.toLocaleString("pt-PT")} L entre vinho atribuído e destinos de adega`}. Uma cuba é terminada quando vinho e borras correspondem à totalidade dos seus litros.</p></section>
      <div className="space-y-2"><Label>Observações</Label><Textarea value={observacoes} onChange={evento => setObservacoes(evento.target.value)} placeholder="Motivo, lote ou indicação para o movimento (opcional)" /></div>
      <DialogFooter><Button type="button" variant="outline" onClick={() => setOpen(false)}>Cancelar</Button><Button disabled={!podeEnviar} onClick={() => preparar.mutate({ origens: origensParaEnviar, destinos, borras: borrasAtivas, observacoes: observacoes || null, origemUrl: window.location.origin })}>{preparar.isPending ? "A preparar…" : "Continuar para Gestão de Adega"}</Button></DialogFooter>
    </DialogContent>
  </Dialog>;
}
