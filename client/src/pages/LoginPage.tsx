import { getLoginUrl } from "@/const";
import { FlaskConical } from "lucide-react";
import { useEffect } from "react";
import { useAuth } from "@/_core/hooks/useAuth";
import { useLocation } from "wouter";

export default function LoginPage() {
  const { isAuthenticated, loading } = useAuth();
  const [, navigate] = useLocation();

  useEffect(() => {
    if (!loading && isAuthenticated) navigate("/");
  }, [isAuthenticated, loading, navigate]);

  return (
    <div className="min-h-screen flex items-center justify-center bg-[var(--color-vinho)] px-4">
      <div className="w-full max-w-sm">
        <div className="text-center mb-8">
          <div className="inline-flex items-center justify-center w-16 h-16 rounded-2xl bg-[var(--color-dourado)] mb-4 shadow-lg">
            <FlaskConical size={32} className="text-[var(--color-vinho)]" />
          </div>
          <h1 className="text-3xl font-bold text-white" style={{ fontFamily: "var(--font-serif)" }}>
            Controlo de Fermentação
          </h1>
          <p className="text-white/60 mt-2 text-sm">Gestão vinícola · Acesso seguro</p>
        </div>

        <div className="bg-white rounded-2xl p-8 shadow-2xl">
          <h2 className="text-xl font-semibold text-[var(--color-vinho)] mb-2" style={{ fontFamily: "var(--font-serif)" }}>
            Bem-vindo
          </h2>
          <p className="text-gray-500 text-sm mb-6">
            Inicie sessão para aceder ao controlo das cubas de fermentação.
          </p>
          <a
            href={getLoginUrl()}
            className="flex items-center justify-center w-full py-3 px-6 rounded-xl bg-[var(--color-vinho)] text-white font-semibold text-sm hover:bg-[var(--color-vinho-light)] transition-colors shadow-sm"
          >
            Iniciar sessão com Manus
          </a>
        </div>
      </div>
    </div>
  );
}
