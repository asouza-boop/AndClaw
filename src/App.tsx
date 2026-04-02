import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { BrowserRouter, Route, Routes, Navigate } from "react-router-dom";
import { useAuthStore } from "./stores/authStore";
import { LoginModal } from "./components/LoginModal";
import { ToastContainer } from "./components/ToastContainer";
import { AppShell } from "./components/AppShell";
import Dashboard from "./pages/Dashboard";
import AgendaPage from "./pages/AgendaPage";
import InboxPage from "./pages/InboxPage";
import ChatPage from "./pages/ChatPage";
import AgentsPage from "./pages/AgentsPage";
import SkillsPage from "./pages/SkillsPage";
import SettingsPage from "./pages/SettingsPage";
import MeetingsPage from "./pages/MeetingsPage";
import PlaceholderPage from "./pages/PlaceholderPage";
import ProjectsPage from "./pages/ProjectsPage";
import NotFound from "./pages/NotFound";

const queryClient = new QueryClient();

const App = () => {
  const isAuthenticated = useAuthStore((s) => s.isAuthenticated);

  return (
    <QueryClientProvider client={queryClient}>
      <ToastContainer />
      {!isAuthenticated ? (
        <LoginModal />
      ) : (
        <BrowserRouter>
          <Routes>
            <Route path="/" element={<AppShell />}>
              <Route index element={<Navigate to="/dashboard" replace />} />
              <Route path="dashboard" element={<Dashboard />} />
              <Route path="inbox" element={<InboxPage />} />
              <Route path="chat" element={<ChatPage />} />
              <Route path="agents" element={<AgentsPage />} />
              <Route path="skills" element={<SkillsPage />} />
              <Route path="settings" element={<SettingsPage />} />
              <Route path="agenda" element={<AgendaPage />} />
              <Route path="projetos" element={<ProjectsPage />} />
              <Route path="reunioes" element={<MeetingsPage />} />
              <Route path="favoritos" element={<PlaceholderPage title="Favoritos" />} />
              <Route path="conhecimento" element={<PlaceholderPage title="Conhecimento" />} />
              <Route path="arquivo" element={<PlaceholderPage title="Arquivo" />} />
              <Route path="*" element={<NotFound />} />
            </Route>
          </Routes>
        </BrowserRouter>
      )}
    </QueryClientProvider>
  );
};

export default App;
