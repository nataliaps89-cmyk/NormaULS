import { useCallback, useEffect, useState } from 'react';
import type { RepositoryStatusResponse, StructuredNormativeResponse } from './shared/types.ts';
import { AdminPanel } from './components/AdminPanel.tsx';
import { DocumentsView } from './components/DocumentsView.tsx';
import { GuideView } from './components/GuideView.tsx';
import { QueryWorkspace } from './components/QueryWorkspace.tsx';
import { TopBar, type AppView } from './components/TopBar.tsx';

const SESSION_HISTORY_KEY = 'uls_normativa_session_history_v1';

export default function App() {
  const [activeView, setActiveView] = useState<AppView>('consultar');
  const [repoStatus, setRepoStatus] = useState<RepositoryStatusResponse | null>(null);
  const [history, setHistory] = useState<StructuredNormativeResponse[]>(() => {
    try {
      const saved = sessionStorage.getItem(SESSION_HISTORY_KEY);
      return saved ? (JSON.parse(saved) as StructuredNormativeResponse[]) : [];
    } catch {
      return [];
    }
  });
  const [activeResponse, setActiveResponse] = useState<StructuredNormativeResponse | null>(null);

  const loadRepoStatus = useCallback(async () => {
    try {
      const res = await fetch('/api/repository/status');
      if (res.ok) {
        const data = (await res.json()) as RepositoryStatusResponse;
        setRepoStatus(data);
      }
    } catch {
      // Keep previous status if offline temporarily
    }
  }, []);

  useEffect(() => {
    void loadRepoStatus();
  }, [loadRepoStatus]);

  useEffect(() => {
    try {
      sessionStorage.setItem(SESSION_HISTORY_KEY, JSON.stringify(history.slice(0, 20)));
    } catch {
      // Ignore storage quota errors
    }
  }, [history]);

  const handleNewResponse = (item: StructuredNormativeResponse) => {
    setActiveResponse(item);
    setHistory((prev) => [item, ...prev.filter((p) => p.id !== item.id)].slice(0, 20));
  };

  const handleClearHistory = () => {
    setHistory([]);
    setActiveResponse(null);
    try {
      sessionStorage.removeItem(SESSION_HISTORY_KEY);
    } catch {
      // ignore
    }
  };

  return (
    <div className="min-h-screen flex flex-col bg-white text-[#0F172A]">
      <TopBar
        activeView={activeView}
        onNavigate={setActiveView}
        onResetQuery={() => setActiveResponse(null)}
      />

      <main className="flex-1 w-full max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8 sm:py-10">
        {activeView === 'consultar' && (
          <QueryWorkspace
            repoStatus={repoStatus}
            history={history}
            activeResponse={activeResponse}
            onSelectResponse={(item) => setActiveResponse(item)}
            onNewResponse={handleNewResponse}
            onClearHistory={handleClearHistory}
            onNavigate={setActiveView}
          />
        )}

        {activeView === 'documentos' && (
          <DocumentsView repoStatus={repoStatus} onNavigate={setActiveView} />
        )}

        {activeView === 'guia' && <GuideView />}

        {activeView === 'admin' && (
          <AdminPanel onRepositoryUpdated={() => void loadRepoStatus()} />
        )}
      </main>

      <footer className="no-print border-t border-[#DDE3EC] bg-[#F3F5F8] mt-auto">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-5 flex flex-col sm:flex-row items-start sm:items-center justify-between gap-3 text-xs text-slate-600">
          <div className="flex items-center gap-2.5">
            <img
              src="/assets/aistudio/OIP_3eb5edab.webp"
              alt="Universidad de La Serena"
              className="w-7 h-7 object-contain shrink-0 rounded-full"
            />
            <p className="font-medium text-[#003A80]">
              NormaULS · Asistente de apoyo reglamentario para docentes de la Universidad de La Serena.
            </p>
          </div>
          <p>
            Respuestas orientativas basadas exclusivamente en los documentos oficiales cargados.
          </p>
        </div>
      </footer>
    </div>
  );
}
