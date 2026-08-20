import { useAuth } from "@/_core/hooks/useAuth";
import { getLoginUrl } from "@/const";
import { trpc } from "@/lib/trpc";
import {
  BarChart3,
  ChevronDown,
  ChevronRight,
  ClipboardList,
  FlaskConical,
  LogOut,
  Menu,
  User,
  X,
  Grape,
  Wine,
} from "lucide-react";
import { Truck } from "lucide-react";
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

  const TODAS_CUBAS = [
    'CF1','CF2','CF3','CF4','CF5','CF6','CF7','CF8','CF9','CF10',
    'CF11','CF12','CF13','CF14','CF15','CF16','CF17','CF18','CF19','CF20',
    'CF21','CF22','CF23','CF24','CF25','CF26','CF27','CF28','CF29','CF30',
    'CF31','CF32','CF33','CF34','CF35','CF36',
    'LF37','LF38',
    'CF80','CF81','CF82','CF83','CF84','CF85',
    'CF93','CF94',
    'CF200','CF201','CF202','CF203','CF204','CF205','CF206','CF207','CF208','CF209','CF210',
  ];

  const VP_CUBAS = ['VP01','VP02','VP03','VP04','VP05'];

  const cubaGroups = [
    { label: "CF1 – CF20", codes: TODAS_CUBAS.slice(0, 20) },
    { label: "CF21 – CF36, LF37, LF38", codes: TODAS_CUBAS.slice(20, 38) },
    { label: "CF80 – CF94", codes: TODAS_CUBAS.slice(38, 46) },
    { label: "CF200 – CF210", codes: TODAS_CUBAS.slice(46) },
    { label: "VP01 – VP05 (Vinho do Porto)", codes: VP_CUBAS },
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
        {navLink("/registo-rapido", "Registo Rápido", <ClipboardList size={16} />)}
        {navLink("/campanhas", "Campanhas de Vindima", <Grape size={16} />)}
        {navLink("/recepcoes", "Recepção de Uvas", <Truck size={16} />)}
        {navLink("/protocolos", "Protocolos", <ClipboardList size={16} />)}
        {navLink("/barricas", "Barricas", <Wine size={16} />)}

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
                  codes={group.codes}
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
            href="/login"
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
  codes,
  currentLocation,
  onNavigate,
}: {
  label: string;
  codes: string[];
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
        <div className="ml-3 grid grid-cols-3 gap-0.5 animate-fade-in">
          {codes.map((codigo) => {
            const href = `/cuba/${codigo.toLowerCase()}`;
            const active = currentLocation === href;
            return (
              <Link
                key={codigo}
                href={href}
                onClick={onNavigate}
                className={`text-center py-1 px-0.5 rounded text-xs transition-all ${
                  active
                    ? "bg-[var(--color-dourado)] text-[var(--color-vinho)] font-bold"
                    : "text-white/60 hover:text-white hover:bg-white/10"
                }`}
              >
                {codigo}
              </Link>
            );
          })}
        </div>
      )}
    </div>
  );
}
