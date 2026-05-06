import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { BrowserRouter, Route, Routes, Navigate } from "react-router-dom";
import { useAuthStore } from "./stores/authStore";
import { lazy, Suspense } from "react";
import { LoginModal } from "./components/LoginModal";
import { ToastContainer } from "./components/ToastContainer";
import { AppShell } from "./components/AppShell";
import Dashboard from "./pages/Dashboard";
import AgendaPage from "./pages/AgendaPage";
import InboxPage from "./pages/InboxPage";
import ChatPage from "./pages/ChatPage";
import AgentsPage from "./pages/AgentsPage";
import SkillsPage from "./pages/SkillsPage";
import SettingsProviders from "./pages/SettingsProviders";
import MeetingsPage from "./pages/MeetingsPage";
import ProjectsPage from "./pages/ProjectsPage";
import NotFound from "./pages/NotFound";
import FavoritesPage from "./pages/FavoritesPage";
import ArchivePage from "./pages/ArchivePage";
import EvolutionDashboard from "./pages/EvolutionDashboard";
import { ErrorBoundary } from "./components/ErrorBoundary";
import { ColdStartBanner } from "./components/ColdStartBanner";
import { Spinner } from "./components/ui/Spinner";

const LearningDashboard = lazy(() => import("./pages/LearningDashboard"));
const KnowledgePage = lazy(() => import("./pages/KnowledgePage"));
const SettingsPage = lazy(() => import("./pages/SettingsPage"));

const queryClient = new QueryClient({
  defaultOptions: {
    queries: {
      retry: 3,
      retryDelay: (attemptIndex) => Math.min(1000 * 2 ** attemptIndex, 15000),
      staleTime: 30000,
    },
  },
});

const App = () => {
  const isAuthenticated = useAuthStore((s) => s.isAuthenticated);

  return (
    <ErrorBoundary>
      <QueryClientProvider client={queryClient}>
        <ColdStartBanner />
        <ToastContainer />
        {!isAuthenticated ? (
          <LoginModal />
        ) : (
          <BrowserRouter>
            <Suspense fallback={<div className="flex h-screen w-full items-center justify-center"><Spinner size="lg" /></div>}>
              <Routes>
                <Route path="/" element={<AppShell />}>
                  <Route index element={<Navigate to="/dashboard" replace />} />
                  <Route path="dashboard" element={<Dashboard />} />
                  <Route path="inbox" element={<InboxPage />} />
                  <Route path="chat" element={<ChatPage />} />
                  <Route path="agents" element={<AgentsPage />} />
                  <Route path="skills" element={<SkillsPage />} />
                  <Route path="settings" element={<SettingsPage />} />
                  <Route path="settings/providers" element={<SettingsProviders />} />
                  <Route path="agenda" element={<AgendaPage />} />
                  <Route path="projetos" element={<ProjectsPage />} />
                  <Route path="reunioes" element={<MeetingsPage />} />
                  <Route path="favoritos" element={<FavoritesPage />} />
                  <Route path="conhecimento" element={<KnowledgePage />} />
                  <Route path="arquivo" element={<ArchivePage />} />
                  <Route path="evolucao" element={<EvolutionDashboard />} />
                  <Route path="aprendizado" element={<LearningDashboard />} />
                  <Route path="*" element={<NotFound />} />
                </Route>
              </Routes>
            </Suspense>
          </BrowserRouter>
        )}
      </QueryClientProvider>
    </ErrorBoundary>
  );
};

export default App;
