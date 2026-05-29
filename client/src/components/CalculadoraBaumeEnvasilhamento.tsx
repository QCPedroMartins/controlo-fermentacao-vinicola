import { useState, useEffect, useRef } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Wine, CheckCircle2, Clock } from "lucide-react";
import { trpc } from "@/lib/trpc";

// ── Fórmulas (extraídas do Excel "bédeenvasilhamento.xlsx") ───────────────────
//
// INPUTS editáveis:
//   C = Mosto Fresco (L)              [azul]
//   D = Bé Lágrima Mosto Fresco (°Bé) [laranja]
//   E = Álcool V/V (%)                [amarelo]
//   F = Bé actual (°Bé)               [verde]
//   G = Grau Vínica (%)               [azul, por defeito 77]
//
// CÁLCULOS:
//   M = E × 0.26
//   N = M + F
//   O = D - N                         → Bé Lágrima Pretendido
//   P = O × 0.26
//   Q = N - P                         → Bé a abafar FINAL
//   I = (C × (E - O)) / (G - E)       → AD Necessária (L)
//   K = I + C                         → Volume Vinho Final (L)
//   L = K / 550                       → Pipas Finais
//   J = I / L                         → AD por pipa (L/pipa)
// ─────────────────────────────────────────────────────────────────────────────

interface CalculadoraBaumeEnvasilhamentoProps {
  cubaId: number;
  volumeCuba?: number;
}

export default function CalculadoraBaumeEnvasilhamento({
  cubaId,
  volumeCuba,
}: CalculadoraBaumeEnvasilhamentoProps) {
  const [mostoFresco, setMostoFresco] = useState("");
  const [beLagrima, setBeLagrima] = useState("");
  const [alcool, setAlcool] = useState("");
  const [beActual, setBeActual] = useState("");
  const [grauVinica, setGrauVinica] = useState("77");
  const [savedAt, setSavedAt] = useState<Date | null>(null);
  const [saving, setSaving] = useState(false);
  const debounceRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const initializedRef = useRef(false);

  // Carregar últimos valores guardados da BD
  const { data: saved } = trpc.cubas.getBaumeCalculo.useQuery(
    { cubaId },
    { enabled: !!cubaId }
  );

  // Pré-preencher campos com os últimos valores guardados (ou volume da cuba)
  useEffect(() => {
    if (initializedRef.current) return;
    if (saved) {
      initializedRef.current = true;
      setMostoFresco(saved.mostoFresco ?? (volumeCuba ? String(volumeCuba) : ""));
      setBeLagrima(saved.beLagrima ?? "");
      setAlcool(saved.alcool ?? "");
      setBeActual(saved.beActual ?? "");
      setGrauVinica(saved.grauVinica ?? "77");
      setSavedAt(new Date(saved.updatedAt));
    } else if (saved === null) {
      // Sem dados guardados — usar volume da cuba como default
      initializedRef.current = true;
      if (volumeCuba) setMostoFresco(String(volumeCuba));
    }
  }, [saved, volumeCuba]);

  const saveMutation = trpc.cubas.saveBaumeCalculo.useMutation({
    onSuccess: () => {
      setSaving(false);
      setSavedAt(new Date());
    },
    onError: () => setSaving(false),
  });

  // Calcular em tempo real
  const C = parseFloat(mostoFresco);
  const D = parseFloat(beLagrima);
  const E = parseFloat(alcool);
  const F = parseFloat(beActual);
  const G = parseFloat(grauVinica);

  const todosPreenchidos = [C, D, E, F, G].every((v) => !isNaN(v) && isFinite(v));
  const denominadorValido = todosPreenchidos && Math.abs(G - E) > 0.001;
  const volumeValido = todosPreenchidos && C > 0;

  let beAbafar: number | null = null;
  let beLagrimaPretendido: number | null = null;
  let adNecessaria: number | null = null;
  let adPorPipa: number | null = null;
  let volumeFinal: number | null = null;
  let pipasFinals: number | null = null;
  let erroMsg: string | null = null;

  if (todosPreenchidos) {
    if (!volumeValido) {
      erroMsg = "O volume de mosto fresco deve ser maior que zero.";
    } else if (!denominadorValido) {
      erroMsg = "O grau vínica não pode ser igual ao álcool V/V.";
    } else {
      const M = E * 0.26;
      const N = M + F;
      const O = D - N;
      const P = O * 0.26;
      const Q = N - P;
      const I = (C * (E - O)) / (G - E);
      const K = I + C;
      const L = K / 550;
      const J = L !== 0 ? I / L : 0;

      beAbafar = Q;
      beLagrimaPretendido = O;
      adNecessaria = I;
      adPorPipa = J;
      volumeFinal = K;
      pipasFinals = L;
    }
  }

  // Guardar automaticamente com debounce de 1s quando há resultado válido
  useEffect(() => {
    if (beAbafar === null || !initializedRef.current) return;
    if (debounceRef.current) clearTimeout(debounceRef.current);
    setSaving(true);
    debounceRef.current = setTimeout(() => {
      saveMutation.mutate({
        cubaId,
        mostoFresco: C,
        beLagrima: D,
        alcool: E,
        beActual: F,
        grauVinica: G,
        beAbafar: beAbafar!,
        beLagrimaPretendido: beLagrimaPretendido!,
        adNecessaria: adNecessaria!,
        adPorPipa: adPorPipa!,
        volumeFinal: volumeFinal!,
        pipasFinals: pipasFinals!,
      });
    }, 1000);
    return () => {
      if (debounceRef.current) clearTimeout(debounceRef.current);
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [mostoFresco, beLagrima, alcool, beActual, grauVinica]);

  const inputClass = (cor: string) => {
    const map: Record<string, string> = {
      azul: "border-2 border-blue-400",
      laranja: "border-2 border-orange-400",
      amarelo: "border-2 border-yellow-400",
      verde: "border-2 border-green-500",
    };
    return `h-9 text-sm text-right ${map[cor] ?? ""}`;
  };

  const formatHora = (d: Date) =>
    d.toLocaleTimeString("pt-PT", { hour: "2-digit", minute: "2-digit" });

  return (
    <Card className="border-amber-300/60 bg-gradient-to-br from-amber-50/40 to-white">
      <CardHeader className="pb-2">
        <div className="flex items-start justify-between">
          <div>
            <CardTitle className="text-base text-[var(--color-vinho)] flex items-center gap-2">
              <Wine size={18} />
              Baumé de Envasilhamento — Vinho do Porto
            </CardTitle>
            <p className="text-xs text-gray-500 mt-0.5">
              Preencha os dados para calcular o Bé a abafar, a aguardente necessária e o volume final.
            </p>
          </div>
          {/* Indicador de estado de gravação */}
          <div className="shrink-0 ml-4 mt-0.5">
            {saving && (
              <span className="flex items-center gap-1 text-[10px] text-amber-600">
                <Clock size={11} className="animate-spin" />
                A guardar…
              </span>
            )}
            {!saving && savedAt && (
              <span className="flex items-center gap-1 text-[10px] text-green-600">
                <CheckCircle2 size={11} />
                Guardado às {formatHora(savedAt)}
              </span>
            )}
          </div>
        </div>
      </CardHeader>
      <CardContent>
        <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
          {/* Coluna esquerda: Inputs */}
          <div className="space-y-3">
            <p className="text-xs font-semibold text-gray-500 uppercase tracking-wide">Dados de entrada</p>

            <div className="space-y-1">
              <Label className="text-xs text-gray-600 flex items-center gap-1.5">
                <span className="inline-block w-3 h-3 rounded-full bg-blue-200 border border-blue-400" />
                Mosto Fresco (L)
              </Label>
              <Input type="number" step="1" placeholder="ex: 34400" value={mostoFresco}
                onChange={(e) => setMostoFresco(e.target.value)} className={inputClass("azul")} />
            </div>

            <div className="space-y-1">
              <Label className="text-xs text-gray-600 flex items-center gap-1.5">
                <span className="inline-block w-3 h-3 rounded-full bg-orange-200 border border-orange-400" />
                Bé Lágrima Mosto Fresco (°Bé)
              </Label>
              <Input type="number" step="0.01" placeholder="ex: 4.85" value={beLagrima}
                onChange={(e) => setBeLagrima(e.target.value)} className={inputClass("laranja")} />
            </div>

            <div className="space-y-1">
              <Label className="text-xs text-gray-600 flex items-center gap-1.5">
                <span className="inline-block w-3 h-3 rounded-full bg-yellow-200 border border-yellow-400" />
                Álcool V/V (%)
              </Label>
              <Input type="number" step="0.01" placeholder="ex: 18.5" value={alcool}
                onChange={(e) => setAlcool(e.target.value)} className={inputClass("amarelo")} />
            </div>

            <div className="space-y-1">
              <Label className="text-xs text-gray-600 flex items-center gap-1.5">
                <span className="inline-block w-3 h-3 rounded-full bg-green-200 border border-green-500" />
                Bé actual (°Bé)
              </Label>
              <Input type="number" step="0.01" placeholder="ex: 3.5" value={beActual}
                onChange={(e) => setBeActual(e.target.value)} className={inputClass("verde")} />
            </div>

            <div className="space-y-1">
              <Label className="text-xs text-gray-600 flex items-center gap-1.5">
                <span className="inline-block w-3 h-3 rounded-full bg-blue-200 border border-blue-400" />
                Grau Vínica — aguardente (%)
              </Label>
              <Input type="number" step="0.1" placeholder="77" value={grauVinica}
                onChange={(e) => setGrauVinica(e.target.value)} className={inputClass("azul")} />
            </div>
          </div>

          {/* Coluna direita: Resultados */}
          <div className="space-y-3">
            <p className="text-xs font-semibold text-gray-500 uppercase tracking-wide">Resultados</p>

            {erroMsg && (
              <div className="p-3 rounded-lg bg-red-50 border border-red-200 text-red-700 text-sm">
                ⚠ {erroMsg}
              </div>
            )}

            {!todosPreenchidos && !erroMsg && (
              <div className="p-4 rounded-lg bg-gray-50 border border-dashed border-gray-300 text-gray-400 text-sm text-center">
                Preencha todos os campos à esquerda para ver os resultados.
              </div>
            )}

            {beAbafar !== null && (
              <>
                {/* Bé a abafar */}
                <div className="rounded-xl border-2 border-[var(--color-vinho)]/30 bg-[var(--color-vinho)]/5 p-4">
                  <p className="text-[10px] font-semibold text-[var(--color-vinho)]/70 uppercase tracking-wide mb-1">
                    Bé a Abafar
                  </p>
                  <p className="text-3xl font-bold text-[var(--color-vinho)]">
                    {beAbafar.toFixed(2)}
                    <span className="text-base font-normal ml-1">°Bé</span>
                  </p>
                  {beLagrimaPretendido !== null && (
                    <p className="text-xs text-gray-500 mt-1">
                      Bé Lágrima Pretendido: <strong>{beLagrimaPretendido.toFixed(2)} °Bé</strong>
                    </p>
                  )}
                </div>

                {/* AD Necessária */}
                <div className="rounded-xl border-2 border-amber-300/50 bg-amber-50 p-4">
                  <p className="text-[10px] font-semibold text-amber-700/70 uppercase tracking-wide mb-1">
                    Aguardente (AD) Necessária
                  </p>
                  <p className="text-3xl font-bold text-amber-700">
                    {adNecessaria!.toFixed(0)}
                    <span className="text-base font-normal ml-1">L</span>
                  </p>
                  {adPorPipa !== null && (
                    <p className="text-xs text-amber-600 mt-1">
                      Por pipa (550 L): <strong>{adPorPipa.toFixed(1)} L/pipa</strong>
                    </p>
                  )}
                </div>

                {/* Volume Final */}
                <div className="rounded-xl border-2 border-green-300/50 bg-green-50 p-4">
                  <p className="text-[10px] font-semibold text-green-700/70 uppercase tracking-wide mb-1">
                    Volume Final
                  </p>
                  <p className="text-3xl font-bold text-green-700">
                    {volumeFinal!.toFixed(0)}
                    <span className="text-base font-normal ml-1">L</span>
                  </p>
                  {pipasFinals !== null && (
                    <p className="text-xs text-green-600 mt-1">
                      Pipas finais (550 L): <strong>{pipasFinals.toFixed(1)} pipas</strong>
                    </p>
                  )}
                </div>
              </>
            )}
          </div>
        </div>
      </CardContent>
    </Card>
  );
}
