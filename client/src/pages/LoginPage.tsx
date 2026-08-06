import { getLoginUrl } from "@/const";
import { FlaskConical, Mail, Lock, Eye, EyeOff } from "lucide-react";
import { useEffect, useState } from "react";
import { useAuth } from "@/_core/hooks/useAuth";
import { useLocation } from "wouter";
import { trpc } from "@/lib/trpc";
import { toast } from "sonner";

export default function LoginPage() {
  const { isAuthenticated, loading, refresh } = useAuth();
  const [, navigate] = useLocation();

  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [showPass, setShowPass] = useState(false);
  const [tab, setTab] = useState<"local" | "manus">("local");

  const loginMutation = trpc.localAuth.login.useMutation({
    onSuccess: async () => {
      // Forçar recarga completa para o browser ler o novo cookie de sessão
      window.location.href = "/";
    },
    onError: (err) => toast.error(err.message),
  });

  useEffect(() => {
    if (!loading && isAuthenticated) navigate("/");
  }, [isAuthenticated, loading, navigate]);

  return (
    <div className="min-h-screen flex items-center justify-center bg-[var(--color-vinho)] px-4">
      <div className="w-full max-w-sm">
        {/* Logo */}
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
          <h2 className="text-xl font-semibold text-[var(--color-vinho)] mb-5" style={{ fontFamily: "var(--font-serif)" }}>
            Bem-vindo
          </h2>

          {/* Tabs */}
          <div className="flex gap-1 mb-6 bg-gray-100 rounded-xl p-1">
            <button
              onClick={() => setTab("local")}
              className={`flex-1 py-2 rounded-lg text-sm font-medium transition-colors ${tab === "local" ? "bg-white text-[var(--color-vinho)] shadow-sm" : "text-gray-500 hover:text-gray-700"}`}
            >
              Email / Password
            </button>
            <button
              onClick={() => setTab("manus")}
              className={`flex-1 py-2 rounded-lg text-sm font-medium transition-colors ${tab === "manus" ? "bg-white text-[var(--color-vinho)] shadow-sm" : "text-gray-500 hover:text-gray-700"}`}
            >
              Conta Manus
            </button>
          </div>

          {tab === "local" ? (
            <form
              onSubmit={(e) => {
                e.preventDefault();
                if (!email || !password) return;
                loginMutation.mutate({ email, password });
              }}
              className="space-y-4"
            >
              <div>
                <label className="block text-xs font-medium text-gray-600 mb-1">Email</label>
                <div className="relative">
                  <Mail size={15} className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400" />
                  <input
                    type="email"
                    value={email}
                    onChange={(e) => setEmail(e.target.value)}
                    placeholder="email@castelares.com"
                    required
                    className="w-full pl-9 pr-3 py-2.5 border border-gray-200 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-[var(--color-vinho)]/30"
                  />
                </div>
              </div>
              <div>
                <label className="block text-xs font-medium text-gray-600 mb-1">Password</label>
                <div className="relative">
                  <Lock size={15} className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400" />
                  <input
                    type={showPass ? "text" : "password"}
                    value={password}
                    onChange={(e) => setPassword(e.target.value)}
                    placeholder="••••••••"
                    required
                    className="w-full pl-9 pr-9 py-2.5 border border-gray-200 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-[var(--color-vinho)]/30"
                  />
                  <button
                    type="button"
                    onClick={() => setShowPass(!showPass)}
                    className="absolute right-3 top-1/2 -translate-y-1/2 text-gray-400 hover:text-gray-600"
                  >
                    {showPass ? <EyeOff size={15} /> : <Eye size={15} />}
                  </button>
                </div>
              </div>
              <button
                type="submit"
                disabled={loginMutation.isPending}
                className="w-full py-3 px-6 rounded-xl bg-[var(--color-vinho)] text-white font-semibold text-sm hover:bg-[var(--color-vinho-light)] transition-colors shadow-sm disabled:opacity-60"
              >
                {loginMutation.isPending ? "A entrar..." : "Entrar"}
              </button>
            </form>
          ) : (
            <div>
              <p className="text-gray-500 text-sm mb-5">
                Para o proprietário do projecto — inicie sessão com a sua conta Manus.
              </p>
              <a
                href={getLoginUrl()}
                className="flex items-center justify-center w-full py-3 px-6 rounded-xl bg-[var(--color-vinho)] text-white font-semibold text-sm hover:bg-[var(--color-vinho-light)] transition-colors shadow-sm"
              >
                Iniciar sessão com Manus
              </a>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
