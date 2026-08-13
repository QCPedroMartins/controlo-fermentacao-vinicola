import { useState } from "react";
import { FlaskConical, Plus, Power, ShieldAlert, Trash2 } from "lucide-react";
import { toast } from "sonner";
import { trpc } from "@/lib/trpc";
import { usePodeEditar } from "@/hooks/usePodeEditar";
import { Dialog, DialogContent, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog";

type EtapaForm = {
  ordem: number;
  titulo: string;
  descricao: string;
  tipoEtapa: "adicao" | "controlo" | "manual";
  gatilhoTipo: "densidade" | "baume" | "temperatura" | "dia" | "manual";
  operador: "menor_igual" | "maior_igual" | "igual";
  valorGatilho: string;
  produto: string;
  dosePorHl: string;
  doseUnidade: string;
  instrucoes: string;
};

const etapaVazia = (ordem: number): EtapaForm => ({
  ordem,
  titulo: "",
  descricao: "",
  tipoEtapa: "adicao",
  gatilhoTipo: "densidade",
  operador: "menor_igual",
  valorGatilho: "",
  produto: "",
  dosePorHl: "",
  doseUnidade: "g/hL",
  instrucoes: "",
});

function etiquetaGatilho(etapa: { gatilhoTipo: string; operador: string | null; valorGatilho: string | null }) {
  if (etapa.gatilhoTipo === "manual") return "Confirmação manual";
  const nome = etapa.gatilhoTipo === "baume" ? "Baumé" : etapa.gatilhoTipo === "dia" ? "Dia de fermentação" : etapa.gatilhoTipo === "temperatura" ? "Temperatura" : "Densidade";
  const operador = etapa.operador === "menor_igual" ? "≤" : etapa.operador === "maior_igual" ? "≥" : "=";
  return `${nome} ${operador} ${etapa.valorGatilho ?? "—"}`;
}

export default function Protocolos() {
  const canEdit = usePodeEditar();
  const utils = trpc.useUtils();
  const { data: protocolos, isLoading } = trpc.protocolos.list.useQuery({ apenasAtivos: false });
  const [aberto, setAberto] = useState(false);
  const [nome, setNome] = useState("");
  const [descricao, setDescricao] = useState("");
  const [tipoCuba, setTipoCuba] = useState<"vinho" | "porto" | "todos">("todos");
  const [etapas, setEtapas] = useState<EtapaForm[]>([etapaVazia(1)]);

  const criar = trpc.protocolos.criar.useMutation({
    onSuccess: () => {
      toast.success("Protocolo criado com sucesso.");
      utils.protocolos.list.invalidate();
      fecharModal();
    },
    onError: (erro) => toast.error(`Não foi possível criar o protocolo: ${erro.message}`),
  });
  const definirEstado = trpc.protocolos.definirEstado.useMutation({
    onSuccess: () => utils.protocolos.list.invalidate(),
    onError: (erro) => toast.error(`Não foi possível actualizar o protocolo: ${erro.message}`),
  });

  function fecharModal() {
    setAberto(false);
    setNome("");
    setDescricao("");
    setTipoCuba("todos");
    setEtapas([etapaVazia(1)]);
  }

  function actualizarEtapa(indice: number, patch: Partial<EtapaForm>) {
    setEtapas((actual) => actual.map((etapa, i) => i === indice ? { ...etapa, ...patch } : etapa));
  }

  function guardar() {
    if (!nome.trim()) return toast.error("Indique o nome do protocolo.");
    if (etapas.some((etapa) => !etapa.titulo.trim())) return toast.error("Todas as etapas devem ter um título.");
    if (etapas.some((etapa) => etapa.gatilhoTipo !== "manual" && !etapa.valorGatilho.trim())) {
      return toast.error("Indique o valor de accionamento nas etapas automáticas.");
    }
    criar.mutate({
      nome: nome.trim(),
      descricao: descricao.trim() || null,
      tipoCuba,
      etapas: etapas.map((etapa, indice) => ({
        ...etapa,
        ordem: indice + 1,
        descricao: etapa.descricao.trim() || null,
        valorGatilho: etapa.gatilhoTipo === "manual" ? null : etapa.valorGatilho,
        produto: etapa.produto.trim() || null,
        dosePorHl: etapa.dosePorHl.trim() || null,
        doseUnidade: etapa.doseUnidade.trim() || null,
        instrucoes: etapa.instrucoes.trim() || null,
      })),
    });
  }

  return (
    <div className="max-w-6xl mx-auto px-4 sm:px-6 py-6">
      <div className="flex flex-col sm:flex-row sm:items-start justify-between gap-4 mb-6">
        <div>
          <p className="text-xs font-bold tracking-widest text-amber-600">BIBLIOTECA OPERACIONAL</p>
          <h1 className="text-3xl font-bold text-[var(--color-vinho)]" style={{ fontFamily: "var(--font-serif)" }}>Protocolos de Fermentação</h1>
          <p className="mt-1 text-sm text-gray-600 max-w-2xl">Defina etapas de leveduras, nutrientes, controlos e adições. Depois, atribua o protocolo a uma cuba e acompanhe os avisos pelo valor de densidade, Baumé, temperatura ou dia de fermentação.</p>
        </div>
        {canEdit && <button onClick={() => setAberto(true)} className="inline-flex items-center justify-center gap-2 rounded-xl bg-[var(--color-vinho)] px-4 py-2.5 text-sm font-semibold text-white shadow-sm hover:bg-[var(--color-vinho-light)]"><Plus size={16} /> Novo protocolo</button>}
      </div>

      <div className="rounded-xl border border-amber-200 bg-amber-50 px-4 py-3 text-sm text-amber-900 mb-5 flex gap-3">
        <ShieldAlert className="shrink-0 mt-0.5" size={18} />
        <p><strong>Sem valores pré-definidos:</strong> os protocolos são criados pela adega, para que as doses e momentos de adição correspondam exactamente às suas práticas.</p>
      </div>

      {isLoading ? <div className="text-center py-16 text-gray-400">A carregar protocolos...</div> : !protocolos?.length ? (
        <div className="rounded-2xl border border-dashed border-gray-300 bg-white px-6 py-14 text-center">
          <FlaskConical className="mx-auto text-amber-600 mb-3" size={34} />
          <h2 className="font-semibold text-gray-800">Ainda não existem protocolos</h2>
          <p className="mt-1 text-sm text-gray-500">Crie o primeiro protocolo com as etapas definidas pela enologia.</p>
        </div>
      ) : <div className="grid gap-4 md:grid-cols-2">
        {protocolos.map((protocolo) => (
          <article key={protocolo.id} className={`rounded-2xl border bg-white p-5 shadow-sm ${protocolo.ativo ? "border-gray-100" : "border-gray-200 opacity-65"}`}>
            <div className="flex justify-between gap-3">
              <div>
                <div className="flex items-center gap-2"><h2 className="font-bold text-gray-900">{protocolo.nome}</h2><span className={`rounded-full px-2 py-0.5 text-[11px] font-bold ${protocolo.ativo ? "bg-emerald-100 text-emerald-700" : "bg-gray-100 text-gray-500"}`}>{protocolo.ativo ? "Activo" : "Inactivo"}</span></div>
                <p className="mt-1 text-xs text-gray-500">Aplicável a: {protocolo.tipoCuba === "todos" ? "todas as cubas" : protocolo.tipoCuba === "porto" ? "Vinho do Porto" : "vinho"}</p>
              </div>
              {canEdit && <button onClick={() => definirEstado.mutate({ id: protocolo.id, ativo: !protocolo.ativo })} className="h-8 rounded-lg border border-gray-200 px-2 text-xs font-medium text-gray-600 hover:bg-gray-50" title={protocolo.ativo ? "Desactivar protocolo" : "Activar protocolo"}><Power size={14} /></button>}
            </div>
            {protocolo.descricao && <p className="mt-3 text-sm text-gray-600">{protocolo.descricao}</p>}
            <div className="mt-4 border-t border-gray-100 pt-3">
              <p className="mb-2 text-xs font-bold uppercase tracking-wide text-gray-500">{protocolo.etapas.length} etapa{protocolo.etapas.length === 1 ? "" : "s"}</p>
              <ol className="space-y-2">
                {protocolo.etapas.map((etapa) => <li key={etapa.id} className="flex gap-2 text-sm"><span className="flex h-5 w-5 shrink-0 items-center justify-center rounded-full bg-[var(--color-vinho)] text-[10px] font-bold text-white">{etapa.ordem}</span><div><strong className="text-gray-800">{etapa.titulo}</strong><span className="ml-2 text-xs text-amber-700">{etiquetaGatilho(etapa)}</span>{etapa.produto && <p className="text-xs text-gray-500">{etapa.produto}{etapa.dosePorHl ? ` · ${etapa.dosePorHl} ${etapa.doseUnidade ?? "g/hL"}` : ""}</p>}</div></li>)}
              </ol>
            </div>
          </article>
        ))}
      </div>}

      <Dialog open={aberto} onOpenChange={(valor) => valor ? setAberto(true) : fecharModal()}>
        <DialogContent className="max-w-4xl max-h-[90vh] overflow-y-auto">
          <DialogHeader><DialogTitle>Novo protocolo de fermentação</DialogTitle></DialogHeader>
          <div className="grid gap-4 py-2">
            <div className="grid md:grid-cols-[1fr_180px] gap-3"><label className="text-sm font-medium">Nome<input value={nome} onChange={(e) => setNome(e.target.value)} placeholder="Ex.: Tinto — fermentação standard" className="mt-1 w-full rounded-lg border border-gray-300 px-3 py-2" /></label><label className="text-sm font-medium">Aplicável a<select value={tipoCuba} onChange={(e) => setTipoCuba(e.target.value as typeof tipoCuba)} className="mt-1 w-full rounded-lg border border-gray-300 px-3 py-2"><option value="todos">Todas as cubas</option><option value="vinho">Vinho</option><option value="porto">Vinho do Porto</option></select></label></div>
            <label className="text-sm font-medium">Descrição<textarea value={descricao} onChange={(e) => setDescricao(e.target.value)} placeholder="Objectivo ou notas gerais do protocolo" className="mt-1 w-full rounded-lg border border-gray-300 px-3 py-2" rows={2} /></label>
            <div className="flex items-center justify-between"><h3 className="font-semibold text-gray-800">Etapas e condições</h3><button onClick={() => setEtapas((actual) => [...actual, etapaVazia(actual.length + 1)])} className="text-sm font-semibold text-[var(--color-vinho)]">+ Adicionar etapa</button></div>
            {etapas.map((etapa, indice) => <section key={indice} className="rounded-xl border border-gray-200 bg-gray-50 p-4">
              <div className="mb-3 flex items-center justify-between"><span className="rounded-full bg-[var(--color-vinho)] px-2 py-0.5 text-xs font-bold text-white">Etapa {indice + 1}</span>{etapas.length > 1 && <button onClick={() => setEtapas((actual) => actual.filter((_, i) => i !== indice).map((item, i) => ({ ...item, ordem: i + 1 })))} className="text-xs font-medium text-red-600"><Trash2 size={14} className="inline mr-1" />Remover</button>}</div>
              <div className="grid gap-3 md:grid-cols-2"><label className="text-xs font-semibold text-gray-600">Título<input value={etapa.titulo} onChange={(e) => actualizarEtapa(indice, { titulo: e.target.value })} placeholder="Ex.: Adicionar nutriente" className="mt-1 w-full rounded-lg border border-gray-300 bg-white px-3 py-2 text-sm" /></label><label className="text-xs font-semibold text-gray-600">Tipo<select value={etapa.tipoEtapa} onChange={(e) => actualizarEtapa(indice, { tipoEtapa: e.target.value as EtapaForm["tipoEtapa"] })} className="mt-1 w-full rounded-lg border border-gray-300 bg-white px-3 py-2 text-sm"><option value="adicao">Adição</option><option value="controlo">Controlo</option><option value="manual">Etapa manual</option></select></label></div>
              <div className="mt-3 grid gap-3 md:grid-cols-3"><label className="text-xs font-semibold text-gray-600">Accionar por<select value={etapa.gatilhoTipo} onChange={(e) => actualizarEtapa(indice, { gatilhoTipo: e.target.value as EtapaForm["gatilhoTipo"] })} className="mt-1 w-full rounded-lg border border-gray-300 bg-white px-3 py-2 text-sm"><option value="densidade">Densidade</option><option value="baume">Baumé</option><option value="temperatura">Temperatura</option><option value="dia">Dia de fermentação</option><option value="manual">Manual</option></select></label>{etapa.gatilhoTipo !== "manual" && <><label className="text-xs font-semibold text-gray-600">Condição<select value={etapa.operador} onChange={(e) => actualizarEtapa(indice, { operador: e.target.value as EtapaForm["operador"] })} className="mt-1 w-full rounded-lg border border-gray-300 bg-white px-3 py-2 text-sm"><option value="menor_igual">≤</option><option value="maior_igual">≥</option><option value="igual">=</option></select></label><label className="text-xs font-semibold text-gray-600">Valor<input value={etapa.valorGatilho} onChange={(e) => actualizarEtapa(indice, { valorGatilho: e.target.value })} inputMode="decimal" placeholder={etapa.gatilhoTipo === "dia" ? "Ex.: 3" : "Ex.: 1.0750"} className="mt-1 w-full rounded-lg border border-gray-300 bg-white px-3 py-2 text-sm" /></label></>}</div>
              {etapa.tipoEtapa === "adicao" && <div className="mt-3 grid gap-3 md:grid-cols-3"><label className="text-xs font-semibold text-gray-600">Produto<input value={etapa.produto} onChange={(e) => actualizarEtapa(indice, { produto: e.target.value })} placeholder="Ex.: Nutriente orgânico" className="mt-1 w-full rounded-lg border border-gray-300 bg-white px-3 py-2 text-sm" /></label><label className="text-xs font-semibold text-gray-600">Dose por hL<input value={etapa.dosePorHl} onChange={(e) => actualizarEtapa(indice, { dosePorHl: e.target.value })} inputMode="decimal" placeholder="Ex.: 20" className="mt-1 w-full rounded-lg border border-gray-300 bg-white px-3 py-2 text-sm" /></label><label className="text-xs font-semibold text-gray-600">Unidade<input value={etapa.doseUnidade} onChange={(e) => actualizarEtapa(indice, { doseUnidade: e.target.value })} placeholder="g/hL" className="mt-1 w-full rounded-lg border border-gray-300 bg-white px-3 py-2 text-sm" /></label></div>}
              <label className="mt-3 block text-xs font-semibold text-gray-600">Instruções<textarea value={etapa.instrucoes} onChange={(e) => actualizarEtapa(indice, { instrucoes: e.target.value })} placeholder="O que deve ser confirmado ou executado nesta etapa" className="mt-1 w-full rounded-lg border border-gray-300 bg-white px-3 py-2 text-sm" rows={2} /></label>
            </section>)}
          </div>
          <DialogFooter><button onClick={fecharModal} className="rounded-lg border border-gray-300 px-4 py-2 text-sm font-medium">Cancelar</button><button onClick={guardar} disabled={criar.isPending} className="rounded-lg bg-[var(--color-vinho)] px-4 py-2 text-sm font-semibold text-white disabled:opacity-50">{criar.isPending ? "A guardar..." : "Criar protocolo"}</button></DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
