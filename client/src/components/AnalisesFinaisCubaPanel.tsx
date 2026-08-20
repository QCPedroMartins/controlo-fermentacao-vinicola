import { useState } from "react";
import { ClipboardCheck, FlaskConical, Plus, Save } from "lucide-react";
import { toast } from "sonner";
import { trpc } from "@/lib/trpc";
import { Dialog, DialogContent, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog";

type CubaAnalise = {
  id: number;
  fermentacaoNum?: number | null;
  fichaKilos?: string | null;
  fichaLitros?: string | null;
  fichaPh?: string | null;
  fichaAt?: string | null;
  fichaAv?: string | null;
  fichaNfa?: string | null;
  fichaNtu?: string | null;
  fichaGluconico?: string | null;
  fichaAlcoolProvavel?: string | null;
};

type Props = { cuba: CubaAnalise; canEdit: boolean };

const CAMPOS_BASE = [
  ["fichaKilos", "Kg"], ["fichaLitros", "Litros"], ["fichaPh", "pH"],
  ["fichaAt", "AT (g/L)"], ["fichaAv", "AV (g/L)"], ["fichaNfa", "NFA (mg/L)"],
  ["fichaNtu", "NTU"], ["fichaGluconico", "Glucónico (g/L)"], ["fichaAlcoolProvavel", "Álcool provável (%)"],
] as const;

function fichaDaCuba(cuba: CubaAnalise) {
  return {
    dataAnalise: new Date().toISOString().slice(0, 10),
    fichaKilos: cuba.fichaKilos ?? "", fichaLitros: cuba.fichaLitros ?? "",
    fichaPh: cuba.fichaPh ?? "", fichaAt: cuba.fichaAt ?? "", fichaAv: cuba.fichaAv ?? "",
    fichaNfa: cuba.fichaNfa ?? "", fichaNtu: cuba.fichaNtu ?? "",
    fichaGluconico: cuba.fichaGluconico ?? "", fichaAlcoolProvavel: cuba.fichaAlcoolProvavel ?? "",
    acucaresResiduais: "", acidoMalico: "", observacoes: "",
  };
}

export default function AnalisesFinaisCubaPanel({ cuba, canEdit }: Props) {
  const utils = trpc.useUtils();
  const [aberto, setAberto] = useState(false);
  const [form, setForm] = useState(() => fichaDaCuba(cuba));
  const { data: historico, isLoading } = trpc.analisesFinais.byCuba.useQuery(
    { cubaId: cuba.id, fermentacaoNum: cuba.fermentacaoNum ?? undefined },
    { enabled: !!cuba.id },
  );
  const criar = trpc.analisesFinais.criar.useMutation({
    onSuccess: () => {
      toast.success("Análise final guardada no histórico.");
      setAberto(false);
      utils.analisesFinais.byCuba.invalidate({ cubaId: cuba.id });
    },
    onError: (erro) => toast.error(`Não foi possível guardar: ${erro.message}`),
  });

  function abrir() {
    setForm(fichaDaCuba(cuba));
    setAberto(true);
  }
  function guardar() {
    criar.mutate({
      cubaId: cuba.id,
      dataAnalise: form.dataAnalise,
      fichaKilos: form.fichaKilos || null, fichaLitros: form.fichaLitros || null,
      fichaPh: form.fichaPh || null, fichaAt: form.fichaAt || null, fichaAv: form.fichaAv || null,
      fichaNfa: form.fichaNfa || null, fichaNtu: form.fichaNtu || null,
      fichaGluconico: form.fichaGluconico || null, fichaAlcoolProvavel: form.fichaAlcoolProvavel || null,
      acucaresResiduais: form.acucaresResiduais || null,
      acidoMalico: form.acidoMalico || null,
      observacoes: form.observacoes || null,
    });
  }

  return <section className="space-y-4 animate-fade-in">
    <div className="rounded-2xl border border-emerald-200 bg-emerald-50 p-5">
      <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
        <div className="flex gap-3"><div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-emerald-700 text-white"><FlaskConical size={19} /></div><div><p className="text-xs font-bold tracking-widest text-emerald-700">CONTROLO DE FIM DE FERMENTAÇÃO</p><h3 className="font-bold text-emerald-950">Análises Finais de Fermentação</h3><p className="mt-1 text-sm text-emerald-800">Cada registo mantém os valores da ficha, açúcares residuais e ácido málico, com data e operador.</p></div></div>
        {canEdit && <button onClick={abrir} className="inline-flex shrink-0 items-center justify-center gap-2 rounded-xl bg-emerald-700 px-4 py-2.5 text-sm font-semibold text-white hover:bg-emerald-800"><Plus size={16} /> Registar análise final</button>}
      </div>
    </div>

    {isLoading ? <div className="rounded-xl bg-white p-8 text-center text-sm text-gray-400">A carregar histórico...</div> : !historico?.length ? <div className="rounded-xl border border-dashed border-gray-200 bg-white p-8 text-center"><ClipboardCheck className="mx-auto text-gray-300" size={28} /><p className="mt-2 text-sm text-gray-500">Ainda não existem análises finais registadas para esta fermentação.</p></div> : <div className="space-y-3">{historico.map((analise) => <article key={analise.id} className="rounded-xl border border-gray-100 bg-white p-4 shadow-sm"><div className="flex flex-wrap items-center justify-between gap-2"><div><span className="font-semibold text-gray-900">{new Date(`${analise.dataAnalise}T00:00:00`).toLocaleDateString("pt-PT")}</span><span className="ml-2 text-xs text-gray-500">por {analise.userName ?? "—"}</span></div><div className="flex gap-2"><span className="rounded-full bg-amber-100 px-2 py-0.5 text-xs font-semibold text-amber-800">AR: {analise.acucaresResiduais ?? "—"} g/L</span><span className="rounded-full bg-violet-100 px-2 py-0.5 text-xs font-semibold text-violet-800">Málico: {analise.acidoMalico ?? "—"} g/L</span></div></div><div className="mt-3 grid grid-cols-2 gap-x-4 gap-y-1 text-xs text-gray-600 sm:grid-cols-3 lg:grid-cols-5">{CAMPOS_BASE.map(([key, label]) => <span key={key}>{label}: <strong className="text-gray-900">{(analise as any)[key] ?? "—"}</strong></span>)}</div>{analise.observacoes && <p className="mt-3 border-t border-gray-100 pt-3 text-sm italic text-gray-600">{analise.observacoes}</p>}</article>)}</div>}

    <Dialog open={aberto} onOpenChange={setAberto}><DialogContent className="max-w-3xl"><DialogHeader><DialogTitle>Nova análise final de fermentação</DialogTitle></DialogHeader><div className="max-h-[68vh] space-y-5 overflow-y-auto px-0.5 py-2"><p className="rounded-lg bg-gray-50 p-3 text-sm text-gray-600">Os valores da ficha inicial foram pré-preenchidos. Pode corrigi-los nesta análise sem alterar os registos anteriores.</p><label className="block text-sm font-medium text-gray-700">Data da análise<input type="date" value={form.dataAnalise} onChange={(e) => setForm({ ...form, dataAnalise: e.target.value })} className="mt-1 w-full rounded-lg border border-gray-300 px-3 py-2" /></label><div className="grid grid-cols-1 gap-3 sm:grid-cols-2">{CAMPOS_BASE.map(([key, label]) => <label key={key} className="block text-sm font-medium text-gray-700">{label}<input value={(form as any)[key]} onChange={(e) => setForm({ ...form, [key]: e.target.value })} className="mt-1 w-full rounded-lg border border-gray-300 px-3 py-2" inputMode="decimal" /></label>)}</div><div className="grid grid-cols-1 gap-3 rounded-xl border border-amber-200 bg-amber-50 p-4 sm:grid-cols-2"><label className="block text-sm font-semibold text-amber-950">Açúcares residuais (g/L)<input value={form.acucaresResiduais} onChange={(e) => setForm({ ...form, acucaresResiduais: e.target.value })} className="mt-1 w-full rounded-lg border border-amber-300 bg-white px-3 py-2" inputMode="decimal" placeholder="Ex.: 1,25" /></label><label className="block text-sm font-semibold text-amber-950">Ácido málico (g/L)<input value={form.acidoMalico} onChange={(e) => setForm({ ...form, acidoMalico: e.target.value })} className="mt-1 w-full rounded-lg border border-amber-300 bg-white px-3 py-2" inputMode="decimal" placeholder="Ex.: 0,10" /></label></div><label className="block text-sm font-medium text-gray-700">Observações <span className="font-normal text-gray-400">(opcional)</span><textarea value={form.observacoes} onChange={(e) => setForm({ ...form, observacoes: e.target.value })} className="mt-1 w-full rounded-lg border border-gray-300 px-3 py-2" rows={3} placeholder="Ex.: fermentação terminada, preparado para barrica" /></label></div><DialogFooter><button onClick={() => setAberto(false)} className="rounded-lg border border-gray-300 px-4 py-2 text-sm font-medium">Cancelar</button><button onClick={guardar} disabled={criar.isPending} className="inline-flex items-center gap-2 rounded-lg bg-[var(--color-vinho)] px-4 py-2 text-sm font-semibold text-white disabled:opacity-50"><Save size={15} />{criar.isPending ? "A guardar..." : "Guardar análise"}</button></DialogFooter></DialogContent></Dialog>
  </section>;
}
