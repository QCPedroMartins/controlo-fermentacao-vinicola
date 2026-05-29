import { useState } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Wine } from "lucide-react";

// ── Fórmulas (extraídas do Excel "bédeenvasilhamento.xlsx") ───────────────────
//
// INPUTS (células editáveis):
//   C = Mosto Fresco (L)
//   D = Bé Lágrima Mosto Fresco (°Bé)
//   E = Álcool V/V (%)            ← célula amarela
//   F = Bé actual (°Bé)
//   G = Grau Vínica (%)           ← por defeito 77
//
// CÁLCULOS (cadeia):
//   M = E × 0.26
//   N = M + F                     → Bé a abafar (intermédio)
//   O = D - N                     → Bé Lágrima Pretendido
//   P = O × 0.26
//   Q = N - P                     → Bé a abafar FINAL
//   I = (C × (E - O)) / (G - E)   → AD Necessária (L)
//   K = I + C                     → Volume Vinho Final (L)
//   L = K / 550                   → Pipas Finais
//   J = I / L                     → AD a aplicar por pipa (L/pipa)
// ─────────────────────────────────────────────────────────────────────────────

interface Resultado {
  M: number; // Bé a abafar passo 1
  N: number; // Bé a abafar passo 2
  O: number; // Bé Lágrima Pretendido
  P: number; // Bé a abafar passo 3
  Q: number; // Bé a abafar FINAL
  I: number; // AD Necessária (L)
  K: number; // Volume Vinho Final (L)
  L: number; // Pipas Finais
  J: number; // AD por pipa (L/pipa)
}

function calcular(
  C: number,
  D: number,
  E: number,
  F: number,
  G: number
): { resultado: Resultado | null; erro: string | null } {
  if ([C, D, E, F, G].some((v) => isNaN(v))) return { resultado: null, erro: null };
  if (C <= 0) return { resultado: null, erro: "O volume de mosto fresco deve ser maior que zero." };
  if (Math.abs(G - E) < 0.001) return { resultado: null, erro: "O grau vínica não pode ser igual ao álcool V/V." };

  const M = E * 0.26;
  const N = M + F;
  const O = D - N;
  const P = O * 0.26;
  const Q = N - P;
  const I = (C * (E - O)) / (G - E);
  const K = I + C;
  const L = K / 550;
  const J = L !== 0 ? I / L : 0;

  return { resultado: { M, N, O, P, Q, I, K, L, J }, erro: null };
}

function CampoInput({
  label,
  sublabel,
  value,
  onChange,
  step = "0.01",
  placeholder = "0",
  unidade,
  corBorda,
}: {
  label: string;
  sublabel?: string;
  value: string;
  onChange: (v: string) => void;
  step?: string;
  placeholder?: string;
  unidade: string;
  corBorda: "azul" | "laranja" | "amarelo" | "verde";
}) {
  const bordas = {
    azul: "border-blue-400 focus:ring-blue-300",
    laranja: "border-orange-400 focus:ring-orange-300",
    amarelo: "border-yellow-400 focus:ring-yellow-300",
    verde: "border-green-500 focus:ring-green-300",
  };
  const labels = {
    azul: "bg-blue-100 text-blue-800",
    laranja: "bg-orange-100 text-orange-800",
    amarelo: "bg-yellow-100 text-yellow-800",
    verde: "bg-green-100 text-green-800",
  };

  return (
    <div className="space-y-1">
      <Label className="text-xs font-medium text-gray-700 leading-tight">
        <span className={`inline-block px-1.5 py-0.5 rounded text-[10px] font-bold mr-1 ${labels[corBorda]}`}>
          {corBorda === "azul" ? "●" : corBorda === "laranja" ? "●" : corBorda === "amarelo" ? "●" : "●"}
        </span>
        {label}
      </Label>
      {sublabel && <p className="text-[10px] text-gray-400 -mt-0.5">{sublabel}</p>}
      <div className="flex items-center gap-1.5">
        <Input
          type="number"
          step={step}
          placeholder={placeholder}
          value={value}
          onChange={(e) => onChange(e.target.value)}
          className={`h-8 text-sm text-right border-2 ${bordas[corBorda]}`}
        />
        <span className="text-xs text-gray-500 w-10 shrink-0">{unidade}</span>
      </div>
    </div>
  );
}

function LinhaResultado({
  label,
  valor,
  unidade,
  destaque = false,
  sublabel,
}: {
  label: string;
  valor: number;
  unidade: string;
  destaque?: boolean;
  sublabel?: string;
}) {
  return (
    <div
      className={`flex items-center justify-between py-1.5 px-3 rounded-lg ${
        destaque
          ? "bg-[var(--color-vinho)]/10 border border-[var(--color-vinho)]/20"
          : "bg-gray-50 border border-gray-100"
      }`}
    >
      <div>
        <span className={`text-xs font-medium ${destaque ? "text-[var(--color-vinho)]" : "text-gray-600"}`}>
          {label}
        </span>
        {sublabel && <p className="text-[10px] text-gray-400">{sublabel}</p>}
      </div>
      <span className={`text-sm font-bold tabular-nums ${destaque ? "text-[var(--color-vinho)]" : "text-gray-800"}`}>
        {valor.toFixed(2)} <span className="text-xs font-normal">{unidade}</span>
      </span>
    </div>
  );
}

interface CalculadoraBaumeEnvasilhamentoProps {
  /** Volume da cuba em litros (pré-preenche o campo de mosto fresco) */
  volumeCuba?: number;
}

export default function CalculadoraBaumeEnvasilhamento({
  volumeCuba,
}: CalculadoraBaumeEnvasilhamentoProps) {
  const [mostoFresco, setMostoFresco] = useState(volumeCuba ? String(volumeCuba) : "");
  const [beLagrima, setBeLagrima] = useState("");
  const [alcool, setAlcool] = useState("");
  const [beActual, setBeActual] = useState("");
  const [grauVinica, setGrauVinica] = useState("77");

  const { resultado, erro } = calcular(
    parseFloat(mostoFresco),
    parseFloat(beLagrima),
    parseFloat(alcool),
    parseFloat(beActual),
    parseFloat(grauVinica)
  );

  return (
    <Card className="border-amber-300/50 bg-amber-50/30">
      <CardHeader className="pb-3">
        <CardTitle className="text-base text-[var(--color-vinho)] flex items-center gap-2">
          <Wine size={18} />
          Calculadora de Baumé de Envasilhamento
        </CardTitle>
        <p className="text-xs text-gray-500 mt-0.5">
          Calcula o Bé a abafar, a aguardente necessária e o volume final de vinho do porto.
        </p>
      </CardHeader>
      <CardContent className="space-y-5">
        {/* Inputs */}
        <div>
          <p className="text-xs font-semibold text-gray-500 uppercase tracking-wide mb-3">Dados de entrada</p>
          <div className="grid grid-cols-2 gap-3">
            <CampoInput
              label="Mosto Fresco"
              sublabel="Volume total da cuba"
              value={mostoFresco}
              onChange={setMostoFresco}
              step="1"
              placeholder="ex: 34400"
              unidade="L"
              corBorda="azul"
            />
            <CampoInput
              label="Bé Lágrima Mosto Fresco"
              sublabel="Baumé da lágrima do mosto"
              value={beLagrima}
              onChange={setBeLagrima}
              step="0.01"
              placeholder="ex: 4.85"
              unidade="°Bé"
              corBorda="laranja"
            />
            <CampoInput
              label="Álcool V/V"
              sublabel="Teor alcoólico actual"
              value={alcool}
              onChange={setAlcool}
              step="0.01"
              placeholder="ex: 18.5"
              unidade="%"
              corBorda="amarelo"
            />
            <CampoInput
              label="Bé actual"
              sublabel="Baumé actual da cuba"
              value={beActual}
              onChange={setBeActual}
              step="0.01"
              placeholder="ex: 3.5"
              unidade="°Bé"
              corBorda="verde"
            />
            <div className="col-span-2">
              <CampoInput
                label="Grau Vínica"
                sublabel="Grau alcoólico da aguardente (por defeito 77%)"
                value={grauVinica}
                onChange={setGrauVinica}
                step="0.1"
                placeholder="77"
                unidade="%"
                corBorda="azul"
              />
            </div>
          </div>
        </div>

        {/* Resultados */}
        {erro && (
          <div className="p-3 rounded-lg bg-red-50 border border-red-200 text-red-700 text-sm">
            ⚠ {erro}
          </div>
        )}

        {resultado && !erro && (
          <div className="space-y-3">
            {/* Bé a abafar */}
            <div>
              <p className="text-xs font-semibold text-gray-500 uppercase tracking-wide mb-2">
                Bé a abafar
              </p>
              <div className="space-y-1.5">
                <LinhaResultado
                  label="Bé a abafar — valor final"
                  sublabel="Baumé no momento do envasilhamento"
                  valor={resultado.Q}
                  unidade="°Bé"
                  destaque
                />
                <LinhaResultado
                  label="Bé Lágrima Pretendido"
                  sublabel="Bé lágrima calculado"
                  valor={resultado.O}
                  unidade="°Bé"
                />
              </div>
            </div>

            {/* Aguardente */}
            <div>
              <p className="text-xs font-semibold text-gray-500 uppercase tracking-wide mb-2">
                Aguardente (AD)
              </p>
              <div className="space-y-1.5">
                <LinhaResultado
                  label="AD Necessária"
                  sublabel="Total de aguardente a adicionar"
                  valor={resultado.I}
                  unidade="L"
                  destaque
                />
                <LinhaResultado
                  label="AD a aplicar por pipa"
                  sublabel="Aguardente por pipa de 550 L"
                  valor={resultado.J}
                  unidade="L/pipa"
                />
              </div>
            </div>

            {/* Volume final */}
            <div>
              <p className="text-xs font-semibold text-gray-500 uppercase tracking-wide mb-2">
                Volume final
              </p>
              <div className="space-y-1.5">
                <LinhaResultado
                  label="Volume Vinho Final"
                  sublabel="Mosto + aguardente"
                  valor={resultado.K}
                  unidade="L"
                  destaque
                />
                <LinhaResultado
                  label="Pipas Finais"
                  sublabel="Número de pipas de 550 L"
                  valor={resultado.L}
                  unidade="pipas"
                />
              </div>
            </div>
          </div>
        )}

        {!resultado && !erro && (
          <div className="p-4 rounded-lg bg-gray-50 border border-gray-200 text-gray-400 text-sm text-center">
            Preencha todos os campos para calcular.
          </div>
        )}
      </CardContent>
    </Card>
  );
}
