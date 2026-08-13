import { useEffect, useMemo, useState } from "react";
import { AlertTriangle, CheckCircle2, ClipboardCheck, PlusCircle, SkipForward } from "lucide-react";
import { toast } from "sonner";
import { trpc } from "@/lib/trpc";
import { Dialog, DialogContent, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog";

type Props = { cubaId: number; canEdit: boolean };

function condicao(etapa: any) {
  if (etapa.gatilhoTipo === "manual") return "Acção inicial — sem leitura";
  const campo = etapa.gatilhoTipo === "densidade" ? "Densidade" : etapa.gatilhoTipo === "baume" ? "Baumé" : etapa.gatilhoTipo === "temperatura" ? "Temperatura" : "Dia";
  const operador = etapa.operador === "menor_igual" ? "≤" : etapa.operador === "maior_igual" ? "≥" : "=";
  return `${campo} ${operador} ${etapa.valorGatilho ?? "—"}`;
}

function valorActual(etapa: any) {
  if (etapa.valorAtual === null || etapa.valorAtual === undefined) return "Sem leitura";
  const sufixo = etapa.gatilhoTipo === "temperatura" ? " °C" : etapa.gatilhoTipo === "baume" ? " °Bé" : etapa.gatilhoTipo === "dia" ? "º dia" : "";
  return `${Number(etapa.valorAtual).toLocaleString("pt-PT", { maximumFractionDigits: 4 })}${sufixo}`;
}

export default function ProtocolosCubaPanel({ cubaId, canEdit }: Props) {
  const utils = trpc.useUtils();
  const { data: acompanhamento, isLoading } = trpc.protocolos.daCuba.useQuery({ cubaId }, { enabled: !!cubaId });
  const { data: protocolos } = trpc.protocolos.list.useQuery({ apenasAtivos: true });
  const [protocoloId, setProtocoloId] = useState("");
  const [etapaSeleccionada, setEtapaSeleccionada] = useState<any>(null);
  const [observacoes, setObservacoes] = useState("");
  const [registarAdicao, setRegistarAdicao] = useState(true);
  const [doseReal, setDoseReal] = useState("");

  const protocolosCompativeis = useMemo(() => (protocolos ?? []).filter((protocolo) => {
    const tipoCuba = acompanhamento?.cuba?.tipoCuba;
    return protocolo.tipoCuba === "todos" || protocolo.tipoCuba === tipoCuba;
  }), [protocolos, acompanhamento?.cuba?.tipoCuba]);

  useEffect(() => {
    if (acompanhamento?.protocolo?.id) setProtocoloId(String(acompanhamento.protocolo.id));
  }, [acompanhamento?.protocolo?.id]);

  const atribuir = trpc.protocolos.atribuirACuba.useMutation({
    onSuccess: () => {
      toast.success("Protocolo atribuído a esta fermentação.");
      utils.protocolos.daCuba.invalidate({ cubaId });
    },
    onError: (erro) => toast.error(`Não foi possível atribuir: ${erro.message}`),
  });
  const concluir = trpc.protocolos.concluirEtapa.useMutation({
    onSuccess: () => {
      toast.success("Etapa actualizada.");
      utils.protocolos.daCuba.invalidate({ cubaId });
      utils.adicoes.listByCuba.invalidate();
      fecharConclusao();
    },
    onError: (erro) => toast.error(`Não foi possível concluir a etapa: ${erro.message}`),
  });

  const etapas = acompanhamento?.etapas ?? [];
  const avisos = etapas.filter((etapa: any) => etapa.alertaAtivo);

  function abrirConclusao(etapa: any) {
    setEtapaSeleccionada(etapa);
    setObservacoes("");
    setRegistarAdicao(etapa.tipoEtapa === "adicao");
    setDoseReal(etapa.doseTotal ? `${etapa.doseTotal} ${etapa.unidadeTotal}` : etapa.dosePorHl ? `${etapa.dosePorHl} ${etapa.doseUnidade ?? "g/hL"}` : "");
  }
  function fecharConclusao() {
    setEtapaSeleccionada(null);
    setObservacoes("");
    setDoseReal("");
  }
  function concluirEtapa() {
    if (!etapaSeleccionada?.estado?.id) return;
    concluir.mutate({
      etapaCubaId: etapaSeleccionada.estado.id,
      estado: "concluida",
      observacoes: observacoes.trim() || null,
      registarAdicao: etapaSeleccionada.tipoEtapa === "adicao" && registarAdicao,
      doseReal: doseReal.trim() || null,
    });
  }
  function dispensarEtapa(etapa: any) {
    if (!etapa.estado?.id) return;
    if (!window.confirm(`Pretende dispensar a etapa “${etapa.titulo}”? A decisão ficará registada.`)) return;
    concluir.mutate({ etapaCubaId: etapa.estado.id, estado: "dispensada", registarAdicao: false });
  }

  if (isLoading) return <div className="rounded-2xl border border-gray-100 bg-white p-8 text-center text-sm text-gray-400">A carregar protocolo...</div>;

  if (!acompanhamento?.atribuicao || !acompanhamento.protocolo) {
    return <section className="rounded-2xl border border-dashed border-amber-300 bg-amber-50 p-6">
      <div className="flex gap-3"><ClipboardCheck className="mt-0.5 text-amber-700" /><div><h3 className="font-semibold text-amber-950">Sem protocolo atribuído</h3><p className="mt-1 text-sm text-amber-800">Escolha o protocolo para esta fermentação. A aplicação passará a acompanhar as etapas a partir das leituras da cuba.</p></div></div>
      {canEdit ? <div className="mt-5 flex flex-col gap-2 sm:flex-row"><select value={protocoloId} onChange={(event) => setProtocoloId(event.target.value)} className="min-w-0 flex-1 rounded-lg border border-amber-300 bg-white px-3 py-2 text-sm"><option value="">Seleccione um protocolo</option>{protocolosCompativeis.map((protocolo) => <option key={protocolo.id} value={protocolo.id}>{protocolo.nome}</option>)}</select><button onClick={() => protocoloId && atribuir.mutate({ cubaId, protocoloId: Number(protocoloId) })} disabled={!protocoloId || atribuir.isPending} className="rounded-lg bg-[var(--color-vinho)] px-4 py-2 text-sm font-semibold text-white disabled:opacity-50">{atribuir.isPending ? "A atribuir..." : "Atribuir protocolo"}</button></div> : <p className="mt-4 text-sm text-amber-800">Peça a um utilizador com permissão de edição para atribuir um protocolo.</p>}
    </section>;
  }

  return <section className="space-y-4">
    <div className="rounded-2xl border border-gray-100 bg-white p-5 shadow-sm"><div className="flex flex-col justify-between gap-3 sm:flex-row sm:items-start"><div><p className="text-xs font-bold tracking-widest text-amber-600">PROTOCOLO ATRIBUÍDO</p><h3 className="text-xl font-bold text-[var(--color-vinho)]">{acompanhamento.protocolo.nome}</h3>{acompanhamento.protocolo.descricao && <p className="mt-1 text-sm text-gray-600">{acompanhamento.protocolo.descricao}</p>}</div><div className="rounded-xl bg-gray-50 px-3 py-2 text-right text-xs text-gray-500"><strong className="block text-sm text-gray-800">{acompanhamento.diaFermentacao ? `Dia ${acompanhamento.diaFermentacao}` : "Sem dia calculado"}</strong>Última leitura: {acompanhamento.leituraAtual?.dataLeitura ?? "—"}</div></div></div>

    {avisos.length > 0 && <div className="rounded-2xl border border-amber-300 bg-amber-50 p-4"><div className="flex gap-3"><AlertTriangle className="mt-0.5 shrink-0 text-amber-700" /><div><h3 className="font-semibold text-amber-950">{avisos.length} etapa{avisos.length > 1 ? "s" : ""} do protocolo requer{avisos.length === 1 ? "" : "em"} atenção</h3><p className="mt-1 text-sm text-amber-800">A leitura actual atingiu a condição prevista. Confirme ou dispense cada etapa após verificar a operação na adega.</p></div></div></div>}

    <div className="space-y-3">{etapas.map((etapa: any) => {
      const concluida = etapa.estado?.estado === "concluida";
      const dispensada = etapa.estado?.estado === "dispensada";
      return <article key={etapa.id} className={`rounded-xl border p-4 ${etapa.alertaAtivo ? "border-amber-300 bg-amber-50" : concluida ? "border-emerald-200 bg-emerald-50" : dispensada ? "border-gray-200 bg-gray-50 opacity-75" : "border-gray-100 bg-white"}`}>
        <div className="flex flex-col gap-3 sm:flex-row sm:items-start"><div className={`flex h-8 w-8 shrink-0 items-center justify-center rounded-full text-xs font-bold ${concluida ? "bg-emerald-600 text-white" : dispensada ? "bg-gray-400 text-white" : etapa.alertaAtivo ? "bg-amber-500 text-white" : "bg-[var(--color-vinho)] text-white"}`}>{concluida ? <CheckCircle2 size={16} /> : etapa.ordem}</div><div className="min-w-0 flex-1"><div className="flex flex-wrap items-center gap-2"><h4 className="font-semibold text-gray-900">{etapa.titulo}</h4><span className="rounded-full bg-white/80 px-2 py-0.5 text-[11px] font-bold text-gray-600">{etapa.tipoEtapa === "adicao" ? "Adição" : etapa.tipoEtapa === "controlo" ? "Controlo" : "Manual"}</span>{etapa.alertaAtivo && <span className="rounded-full bg-amber-200 px-2 py-0.5 text-[11px] font-bold text-amber-900">Agora</span>}</div><p className="mt-1 text-sm text-gray-600">{etapa.instrucoes || etapa.descricao || "Sem instruções adicionais."}</p><div className="mt-2 flex flex-wrap gap-x-4 gap-y-1 text-xs text-gray-500"><span>Condição: <strong>{condicao(etapa)}</strong></span>{etapa.gatilhoTipo !== "manual" && <span>Valor actual: <strong>{valorActual(etapa)}</strong></span>}{etapa.produto && <span>Produto: <strong>{etapa.produto}</strong>{etapa.dosePorHl ? ` · ${etapa.dosePorHl} ${etapa.doseUnidade ?? "g/hL"}` : ""}{etapa.doseTotal ? ` · total estimado ${etapa.doseTotal} ${etapa.unidadeTotal}` : ""}</span>}</div>{etapa.estado?.observacoes && <p className="mt-2 text-xs italic text-gray-500">Registo: {etapa.estado.observacoes}</p>}{concluida && <p className="mt-2 text-xs font-medium text-emerald-700">Concluída por {etapa.estado?.concluidaPorNome ?? "utilizador"}{etapa.estado?.concluidaEm ? ` em ${new Date(etapa.estado.concluidaEm).toLocaleDateString("pt-PT")}` : ""}.</p>}{dispensada && <p className="mt-2 text-xs font-medium text-gray-500">Etapa dispensada.</p>}</div>{canEdit && !concluida && !dispensada && <div className="flex shrink-0 gap-2"><button onClick={() => abrirConclusao(etapa)} className="inline-flex items-center gap-1 rounded-lg bg-[var(--color-vinho)] px-3 py-2 text-xs font-semibold text-white"><CheckCircle2 size={14} /> Concluir</button><button onClick={() => dispensarEtapa(etapa)} className="inline-flex items-center gap-1 rounded-lg border border-gray-300 bg-white px-3 py-2 text-xs font-semibold text-gray-600"><SkipForward size={14} /> Dispensar</button></div>}</div>
      </article>;
    })}</div>

    <Dialog open={!!etapaSeleccionada} onOpenChange={(open) => !open && fecharConclusao()}><DialogContent className="max-w-lg"><DialogHeader><DialogTitle>Concluir etapa do protocolo</DialogTitle></DialogHeader>{etapaSeleccionada && <div className="space-y-4 py-2"><div className="rounded-lg bg-gray-50 p-3"><p className="font-semibold text-gray-900">{etapaSeleccionada.titulo}</p>{etapaSeleccionada.produto && <p className="mt-1 text-sm text-gray-600">{etapaSeleccionada.produto}</p>}</div>{etapaSeleccionada.tipoEtapa === "adicao" && <><label className="flex items-center gap-2 text-sm text-gray-700"><input type="checkbox" checked={registarAdicao} onChange={(event) => setRegistarAdicao(event.target.checked)} /> Registar esta adição no histórico da cuba</label>{registarAdicao && <label className="block text-sm font-medium">Dose efectivamente aplicada<input value={doseReal} onChange={(event) => setDoseReal(event.target.value)} className="mt-1 w-full rounded-lg border border-gray-300 px-3 py-2" placeholder="Ex.: 540 g" /></label>}</>}<label className="block text-sm font-medium">Observações <span className="font-normal text-gray-400">(opcional)</span><textarea value={observacoes} onChange={(event) => setObservacoes(event.target.value)} className="mt-1 w-full rounded-lg border border-gray-300 px-3 py-2" rows={3} placeholder="Registe qualquer ajuste ou observação operacional" /></label></div>}<DialogFooter><button onClick={fecharConclusao} className="rounded-lg border border-gray-300 px-4 py-2 text-sm font-medium">Cancelar</button><button onClick={concluirEtapa} disabled={concluir.isPending} className="rounded-lg bg-[var(--color-vinho)] px-4 py-2 text-sm font-semibold text-white disabled:opacity-50">{concluir.isPending ? "A guardar..." : "Concluir etapa"}</button></DialogFooter></DialogContent></Dialog>
  </section>;
}
