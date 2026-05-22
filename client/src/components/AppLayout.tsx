import { useAuth } from "@/_core/hooks/useAuth";
import { getLoginUrl } from "@/const";
import { trpc } from "@/lib/trpc";
import {
  BarChart3,
  ChevronDown,
  ChevronRight,
  FlaskConical,
  LogOut,
  Menu,
  User,
  X,
} from "lucide-react";
import { useState } from "react";
import { Link, useLocation } from "wouter";

interface AppLayoutProps {
  children: React.ReactNode;
}

export default function AppLayout({ children }: AppLayoutProps) {
  const { user, isAuthenticated } = useAuth();
  const [location] = useLocation();
  const [sidebarOpen, setSidebarOpen] = useState(false);
  const [cubasExpanded, setCubasExpanded] = useState(false);
  const logoutMutation = trpc.auth.logout.useMutation({
    onSuccess: () => (window.location.href = "/"),
  });

  const cubaGroups = [
    { label: "cf1 – cf20", range: Array.from({ length: 20 }, (_, i) => i + 1) },
    { label: "cf21 – cf40", range: Array.from({ length: 20 }, (_, i) => i + 21) },
    { label: "cf41 – cf60", range: Array.from({ length: 20 }, (_, i) => i + 41) },
    { label: "cf61 – cf84", range: Array.from({ length: 24 }, (_, i) => i + 61) },
  ];

  const navLink = (href: string, label: string, icon: React.ReactNode) => {
    const active = location === href;
    return (
      <Link
        href={href}
        onClick={() => setSidebarOpen(false)}
        className={`flex items-center gap-3 px-4 py-2.5 rounded-lg text-sm font-medium transition-all duration-150 ${
          active
            ? "bg-[var(--color-dourado)] text-[var(--color-vinho)] shadow-sm"
            : "text-[var(--color-dourado-light)] hover:bg-white/10 hover:text-white"
        }`}
      >
        {icon}
        {label}
      </Link>
    );
  };

  const sidebar = (
    <div className="flex flex-col h-full">
      {/* Logo */}
      <div className="px-5 py-5 border-b border-white/10">
        <div className="flex items-center gap-3">
          <div className="w-9 h-9 rounded-lg bg-[var(--color-dourado)] flex items-center justify-center">
            <FlaskConical size={20} className="text-[var(--color-vinho)]" />
          </div>
          <div>
            <p className="text-white font-semibold text-sm leading-tight" style={{ fontFamily: "var(--font-serif)" }}>
              Controlo de
            </p>
            <p className="text-[var(--color-dourado)] font-bold text-sm leading-tight" style={{ fontFamily: "var(--font-serif)" }}>
              Fermentação
            </p>
          </div>
        </div>
      </div>

      {/* Navegação */}
      <nav className="flex-1 px-3 py-4 space-y-1 overflow-y-auto">
        {navLink("/", "Dashboard", <BarChart3 size={16} />)}

        {/* Cubas expandível */}
        <div>
          <button
            onClick={() => setCubasExpanded(!cubasExpanded)}
            className="w-full flex items-center gap-3 px-4 py-2.5 rounded-lg text-sm font-medium text-[var(--color-dourado-light)] hover:bg-white/10 hover:text-white transition-all duration-150"
          >
            <FlaskConical size={16} />
            <span className="flex-1 text-left">Cubas</span>
            {cubasExpanded ? <ChevronDown size={14} /> : <ChevronRight size={14} />}
          </button>

          {cubasExpanded && (
            <div className="ml-4 mt-1 space-y-0.5 animate-fade-in">
              {cubaGroups.map((group) => (
                <CubaGroupNav
                  key={group.label}
                  label={group.label}
                  range={group.range}
                  currentLocation={location}
                  onNavigate={() => setSidebarOpen(false)}
                />
              ))}
            </div>
          )}
        </div>
      </nav>

      {/* Utilizador */}
      <div className="px-3 py-4 border-t border-white/10">
        {isAuthenticated ? (
          <div className="space-y-2">
            <div className="flex items-center gap-3 px-4 py-2">
              <div className="w-7 h-7 rounded-full bg-[var(--color-dourado)] flex items-center justify-center">
                <User size={14} className="text-[var(--color-vinho)]" />
              </div>
              <div className="flex-1 min-w-0">
                <p className="text-white text-xs font-medium truncate">{user?.name ?? "Utilizador"}</p>
                <p className="text-white/50 text-xs truncate">{user?.email ?? ""}</p>
              </div>
            </div>
            <button
              onClick={() => logoutMutation.mutate()}
              className="w-full flex items-center gap-3 px-4 py-2 rounded-lg text-sm text-white/60 hover:text-white hover:bg-white/10 transition-all"
            >
              <LogOut size={14} />
              Terminar sessão
            </button>
          </div>
        ) : (
          <a
            href={getLoginUrl()}
            className="flex items-center justify-center gap-2 w-full px-4 py-2.5 rounded-lg bg-[var(--color-dourado)] text-[var(--color-vinho)] text-sm font-semibold hover:opacity-90 transition-opacity"
          >
            <User size={14} />
            Iniciar sessão
          </a>
        )}
      </div>
    </div>
  );

  return (
    <div className="flex h-screen overflow-hidden bg-[var(--color-creme)]">
      {/* Sidebar desktop */}
      <aside className="hidden lg:flex flex-col w-60 bg-[var(--color-vinho)] flex-shrink-0">
        {sidebar}
      </aside>

      {/* Sidebar mobile — overlay */}
      {sidebarOpen && (
        <div className="lg:hidden fixed inset-0 z-50 flex">
          <div
            className="absolute inset-0 bg-black/50"
            onClick={() => setSidebarOpen(false)}
          />
          <aside className="relative flex flex-col w-72 bg-[var(--color-vinho)] h-full shadow-2xl">
            <button
              onClick={() => setSidebarOpen(false)}
              className="absolute top-4 right-4 text-white/60 hover:text-white"
            >
              <X size={20} />
            </button>
            {sidebar}
          </aside>
        </div>
      )}

      {/* Conteúdo principal */}
      <div className="flex-1 flex flex-col min-w-0 overflow-hidden">
        {/* Topbar mobile */}
        <header className="lg:hidden flex items-center gap-3 px-4 py-3 bg-[var(--color-vinho)] shadow-sm">
          <button
            onClick={() => setSidebarOpen(true)}
            className="text-white p-1"
          >
            <Menu size={22} />
          </button>
          <div className="flex items-center gap-2">
            <FlaskConical size={18} className="text-[var(--color-dourado)]" />
            <span className="text-white font-semibold text-sm" style={{ fontFamily: "var(--font-serif)" }}>
              Controlo de Fermentação
            </span>
          </div>
        </header>

        <main className="flex-1 overflow-y-auto">
          {children}
        </main>
      </div>
    </div>
  );
}

// Componente auxiliar para grupo de cubas na sidebar
function CubaGroupNav({
  label,
  range,
  currentLocation,
  onNavigate,
}: {
  label: string;
  range: number[];
  currentLocation: string;
  onNavigate: () => void;
}) {
  const [expanded, setExpanded] = useState(false);

  return (
    <div>
      <button
        onClick={() => setExpanded(!expanded)}
        className="w-full flex items-center gap-2 px-3 py-1.5 rounded text-xs text-white/50 hover:text-white/80 transition-colors"
      >
        {expanded ? <ChevronDown size={11} /> : <ChevronRight size={11} />}
        {label}
      </button>
      {expanded && (
        <div className="ml-3 grid grid-cols-4 gap-0.5 animate-fade-in">
          {range.map((n) => {
            const href = `/cuba/cf${n}`;
            const active = currentLocation === href;
            return (
              <Link
                key={n}
                href={href}
                onClick={onNavigate}
                className={`text-center py-1 rounded text-xs transition-all ${
                  active
                    ? "bg-[var(--color-dourado)] text-[var(--color-vinho)] font-bold"
                    : "text-white/60 hover:text-white hover:bg-white/10"
                }`}
              >
                {n}
              </Link>
            );
          })}
        </div>
      )}
    </div>
  );
}
