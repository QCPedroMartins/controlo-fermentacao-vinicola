import { useState } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Calculator, Droplets, FlaskConical } from "lucide-react";

// ── Fórmulas ─────────────────────────────────────────────────────────────────
// Correcção com Água/AD (para BAIXAR o álcool):
//   Litros = ((Álcool actual - Álcool pretendido) × Volume) / (Álcool pretendido - Álcool água/AD)
//
// Correcção com Adjuvante (para SUBIR o álcool):
//   Litros = ((Álcool actual - Álcool pretendido) × Volume) / (Álcool pretendido - Álcool adjuvante)
//
// Nota: quando o resultado é positivo, significa que se adiciona o produto.
//       quando é negativo, a direcção está invertida (ex: pretendido > actual na água).
// ─────────────────────────────────────────────────────────────────────────────

function calcularCorrecao(
  alcoolActual: number,
  alcoolPretendido: number,
  volume: number,
  alcoolProduto: number
): { litros: number | null; erro: string | null } {
  if (isNaN(alcoolActual) || isNaN(alcoolPretendido) || isNaN(volume) || isNaN(alcoolProduto)) {
    return { litros: null, erro: null };
  }
  if (volume <= 0) return { litros: null, erro: "O volume deve ser maior que zero." };
  const denominador = alcoolPretendido - alcoolProduto;
  if (Math.abs(denominador) < 0.001) {
    return { litros: null, erro: "O álcool do produto não pode ser igual ao álcool pretendido." };
  }
  const litros = ((alcoolActual - alcoolPretendido) * volume) / denominador;
  return { litros, erro: null };
}

function CampoNumerico({
  label,
  value,
  onChange,
  step = "0.01",
  placeholder = "0",
  unidade,
}: {
  label: string;
  value: string;
  onChange: (v: string) => void;
  step?: string;
  placeholder?: string;
  unidade: string;
}) {
  return (
    <div className="space-y-1">
      <Label className="text-xs font-medium text-gray-600">{label}</Label>
      <div className="flex items-center gap-1.5">
        <Input
          type="number"
          step={step}
          placeholder={placeholder}
          value={value}
          onChange={(e) => onChange(e.target.value)}
          className="h-8 text-sm text-right"
        />
        <span className="text-xs text-gray-500 w-8 shrink-0">{unidade}</span>
      </div>
    </div>
  );
}

function ResultadoCorrecao({
  litros,
  erro,
  tipoPositivo,
  tipoNegativo,
}: {
  litros: number | null;
  erro: string | null;
  tipoPositivo: string;
  tipoNegativo: string;
}) {
  if (erro) {
    return (
      <div className="mt-4 p-3 rounded-lg bg-red-50 border border-red-200 text-red-700 text-sm">
        ⚠ {erro}
      </div>
    );
  }
  if (litros === null) {
    return (
      <div className="mt-4 p-3 rounded-lg bg-gray-50 border border-gray-200 text-gray-400 text-sm text-center">
        Preencha todos os campos para calcular.
      </div>
    );
  }
  const absLitros = Math.abs(litros);
  const positivo = litros > 0;
  const tipo = positivo ? tipoPositivo : tipoNegativo;
  const corBg = positivo ? "bg-green-50 border-green-200" : "bg-amber-50 border-amber-200";
  const corTexto = positivo ? "text-green-800" : "text-amber-800";
  const corValor = positivo ? "text-green-700" : "text-amber-700";

  return (
    <div className={`mt-4 p-4 rounded-lg border ${corBg}`}>
      <div className="flex items-center justify-between gap-3">
        <div>
          <p className={`text-xs font-medium ${corTexto} mb-1`}>{tipo}</p>
          <p className={`text-2xl font-bold ${corValor}`}>
            {absLitros.toFixed(2)} <span className="text-base font-normal">L</span>
          </p>
        </div>
        <div className={`text-3xl ${corTexto} opacity-60`}>
          {positivo ? "💧" : "⚗️"}
        </div>
      </div>
      {litros < 0 && (
        <p className="text-xs text-amber-600 mt-2 border-t border-amber-200 pt-2">
          ℹ O resultado é negativo — verifique se o álcool actual e o pretendido estão correctos para este tipo de correcção.
        </p>
      )}
    </div>
  );
}

// ── Aba: Correcção com Água/AD ────────────────────────────────────────────────
function CorrecaoAguaAD({ volumeInicial }: { volumeInicial?: number }) {
  const [alcoolActual, setAlcoolActual] = useState("");
  const [alcoolPretendido, setAlcoolPretendido] = useState("");
  const [volume, setVolume] = useState(volumeInicial ? String(volumeInicial) : "");
  const [alcoolAguaAD, setAlcoolAguaAD] = useState("77");

  const { litros, erro } = calcularCorrecao(
    parseFloat(alcoolActual),
    parseFloat(alcoolPretendido),
    parseFloat(volume),
    parseFloat(alcoolAguaAD)
  );

  return (
    <div className="space-y-4">
      <p className="text-xs text-gray-500 leading-relaxed">
        Utilizado para <strong>baixar o teor alcoólico</strong> adicionando água ou álcool diluído (AD).
        Fórmula: <code className="bg-gray-100 px-1 rounded text-[11px]">L = ((A_actual − A_pretendido) × Volume) / (A_pretendido − A_água/AD)</code>
      </p>

      <div className="grid grid-cols-2 gap-3">
        <CampoNumerico
          label="Álcool actual"
          value={alcoolActual}
          onChange={setAlcoolActual}
          step="0.01"
          placeholder="ex: 14.5"
          unidade="%"
        />
        <CampoNumerico
          label="Álcool pretendido"
          value={alcoolPretendido}
          onChange={setAlcoolPretendido}
          step="0.01"
          placeholder="ex: 15.0"
          unidade="%"
        />
        <CampoNumerico
          label="Volume da cuba"
          value={volume}
          onChange={setVolume}
          step="1"
          placeholder="ex: 34400"
          unidade="L"
        />
        <CampoNumerico
          label="Álcool da Água/AD"
          value={alcoolAguaAD}
          onChange={setAlcoolAguaAD}
          step="0.1"
          placeholder="ex: 77"
          unidade="%"
        />
      </div>

      <ResultadoCorrecao
        litros={litros}
        erro={erro}
        tipoPositivo="Adicionar Água/AD"
        tipoNegativo="Resultado negativo — verifique os valores"
      />
    </div>
  );
}

// ── Aba: Correcção com Adjuvante ──────────────────────────────────────────────
function CorrecaoAdjuvante({ volumeInicial }: { volumeInicial?: number }) {
  const [alcoolActual, setAlcoolActual] = useState("");
  const [alcoolPretendido, setAlcoolPretendido] = useState("");
  const [volume, setVolume] = useState(volumeInicial ? String(volumeInicial) : "");
  const [alcoolAdjuvante, setAlcoolAdjuvante] = useState("39");

  const { litros, erro } = calcularCorrecao(
    parseFloat(alcoolActual),
    parseFloat(alcoolPretendido),
    parseFloat(volume),
    parseFloat(alcoolAdjuvante)
  );

  return (
    <div className="space-y-4">
      <p className="text-xs text-gray-500 leading-relaxed">
        Utilizado para <strong>subir o teor alcoólico</strong> adicionando um adjuvante de alta graduação.
        Fórmula: <code className="bg-gray-100 px-1 rounded text-[11px]">L = ((A_actual − A_pretendido) × Volume) / (A_pretendido − A_adjuvante)</code>
      </p>

      <div className="grid grid-cols-2 gap-3">
        <CampoNumerico
          label="Álcool actual"
          value={alcoolActual}
          onChange={setAlcoolActual}
          step="0.01"
          placeholder="ex: 17.85"
          unidade="%"
        />
        <CampoNumerico
          label="Álcool pretendido"
          value={alcoolPretendido}
          onChange={setAlcoolPretendido}
          step="0.01"
          placeholder="ex: 18.2"
          unidade="%"
        />
        <CampoNumerico
          label="Volume da cuba"
          value={volume}
          onChange={setVolume}
          step="1"
          placeholder="ex: 34400"
          unidade="L"
        />
        <CampoNumerico
          label="Álcool do Adjuvante"
          value={alcoolAdjuvante}
          onChange={setAlcoolAdjuvante}
          step="0.1"
          placeholder="ex: 39"
          unidade="%"
        />
      </div>

      <ResultadoCorrecao
        litros={litros}
        erro={erro}
        tipoPositivo="Adicionar Adjuvante"
        tipoNegativo="Resultado negativo — verifique os valores"
      />
    </div>
  );
}

// ── Componente principal ──────────────────────────────────────────────────────
interface CalculadoraCorrecaoProps {
  /** Volume da cuba em litros (pré-preenche o campo de volume) */
  volumeCuba?: number;
}

export default function CalculadoraCorrecao({ volumeCuba }: CalculadoraCorrecaoProps) {
  return (
    <Card className="border-[var(--color-dourado)]/30">
      <CardHeader className="pb-3">
        <CardTitle className="text-base text-[var(--color-vinho)] flex items-center gap-2">
          <Calculator size={18} />
          Calculadoras de Correcção de Álcool
        </CardTitle>
      </CardHeader>
      <CardContent>
        <Tabs defaultValue="agua">
          <TabsList className="w-full mb-4">
            <TabsTrigger value="agua" className="flex-1 gap-1.5 text-xs">
              <Droplets size={13} />
              Correcção com Água/AD
            </TabsTrigger>
            <TabsTrigger value="adjuvante" className="flex-1 gap-1.5 text-xs">
              <FlaskConical size={13} />
              Correcção com Adjuvante
            </TabsTrigger>
          </TabsList>
          <TabsContent value="agua">
            <CorrecaoAguaAD volumeInicial={volumeCuba} />
          </TabsContent>
          <TabsContent value="adjuvante">
            <CorrecaoAdjuvante volumeInicial={volumeCuba} />
          </TabsContent>
        </Tabs>
      </CardContent>
    </Card>
  );
}
