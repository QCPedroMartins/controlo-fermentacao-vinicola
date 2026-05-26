import { Toaster } from "@/components/ui/sonner";
import { TooltipProvider } from "@/components/ui/tooltip";
import NotFound from "@/pages/NotFound";
import { Route, Switch } from "wouter";
import ErrorBoundary from "./components/ErrorBoundary";
import { ThemeProvider } from "./contexts/ThemeContext";
import Dashboard from "./pages/Dashboard";
import CubaPage from "./pages/CubaPage";
import LoginPage from "./pages/LoginPage";
import AppLayout from "./components/AppLayout";
import RegistoRapido from "./pages/RegistoRapido";
import ArquivoDetalhe from "./pages/ArquivoDetalhe";

function Router() {
  return (
    <Switch>
      <Route path="/" component={Dashboard} />
      <Route path="/cuba/:codigo/arquivo/:fermentacaoNum" component={ArquivoDetalhe} />
      <Route path="/cuba/:codigo" component={CubaPage} />
      <Route path="/registo-rapido" component={RegistoRapido} />
      <Route path="/login" component={LoginPage} />
      <Route path="/404" component={NotFound} />
      <Route component={NotFound} />
    </Switch>
  );
}

function App() {
  return (
    <ErrorBoundary>
      <ThemeProvider defaultTheme="light">
        <TooltipProvider>
          <Toaster position="top-right" />
          <AppLayout>
            <Router />
          </AppLayout>
        </TooltipProvider>
      </ThemeProvider>
    </ErrorBoundary>
  );
}

export default App;
