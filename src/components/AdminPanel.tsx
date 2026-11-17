import { useCallback, useEffect, useState, type FormEvent } from 'react';
import {
  AlertCircle,
  CheckCircle2,
  Eye,
  ExternalLink,
  Loader2,
  Lock,
  LogOut,
  RefreshCw,
  Search,
  X,
} from 'lucide-react';
import type {
  RegulationChunk,
  RegulationDocument,
  RepositoryStatusResponse,
} from '../shared/types.ts';

interface AdminPanelProps {
  onRepositoryUpdated: () => void;
}

type PublicChunk = Omit<RegulationChunk, 'embedding' | 'normalizedText'>;

interface CitationVerifyMatch {
  chunkId: string;
  documentId: string;
  documentTitle: string;
  decreeNumber: string;
  version: string;
  status: string;
  articleNumber: string;
  pageNumber: number;
  sectionHierarchy: string;
  text: string;
}

export function AdminPanel({ onRepositoryUpdated }: AdminPanelProps) {
  const [authenticated, setAuthenticated] = useState<boolean | null>(null);
  const [accessCode, setAccessCode] = useState('');
  const [loginError, setLoginError] = useState<string | null>(null);
  const [loggingIn, setLoggingIn] = useState(false);

  const [repo, setRepo] = useState<RepositoryStatusResponse | null>(null);
  const [loadingRepo, setLoadingRepo] = useState(false);
  const [reindexing, setReindexing] = useState(false);
  const [adminMsg, setAdminMsg] = useState<{ type: 'ok' | 'error'; text: string } | null>(null);

  // Inspector modal state
  const [inspectDoc, setInspectDoc] = useState<RegulationDocument | null>(null);
  const [inspectChunks, setInspectChunks] = useState<PublicChunk[]>([]);
  const [loadingInspect, setLoadingInspect] = useState(false);

  // Citation verifier state
  const [verifyQuery, setVerifyQuery] = useState('');
  const [verifyResults, setVerifyResults] = useState<CitationVerifyMatch[]>([]);
  const [verifying, setVerifying] = useState(false);

  const checkSession = useCallback(async () => {
    try {
      const res = await fetch('/api/admin/session');
      const data = await res.json();
      setAuthenticated(Boolean(data.authenticated));
    } catch {
      setAuthenticated(false);
    }
  }, []);

  const fetchAdminRepo = useCallback(async () => {
    setLoadingRepo(true);
    try {
      const res = await fetch('/api/admin/documents');
      if (res.status === 401) {
        setAuthenticated(false);
        return;
      }
      if (res.ok) {
        const data = (await res.json()) as RepositoryStatusResponse;
        setRepo(data);
      }
    } finally {
      setLoadingRepo(false);
    }
  }, []);

  useEffect(() => {
    void checkSession();
  }, [checkSession]);

  useEffect(() => {
    if (authenticated) {
      void fetchAdminRepo();
    }
  }, [authenticated, fetchAdminRepo]);

  const handleLogin = async (e: FormEvent) => {
    e.preventDefault();
    setLoginError(null);
    setLoggingIn(true);
    try {
      const res = await fetch('/api/admin/login', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ accessCode }),
      });
      const data = await res.json();
      if (!res.ok) {
        setLoginError(data.error || 'No se pudo iniciar sesión.');
        return;
      }
      setAccessCode('');
      setAuthenticated(true);
    } catch {
      setLoginError('Error de conexión con el servidor.');
    } finally {
      setLoggingIn(false);
    }
  };

  const handleLogout = async () => {
    await fetch('/api/admin/logout', { method: 'POST' });
    setAuthenticated(false);
    setRepo(null);
  };

  const handleReindex = async () => {
    setReindexing(true);
    setAdminMsg(null);
    try {
      const res = await fetch('/api/admin/documents/reindex', { method: 'POST' });
      const data = await res.json();
      if (!res.ok) {
        setAdminMsg({ type: 'error', text: data.error || 'Error al reprocesar los documentos.' });
        return;
      }
      setRepo(data.status as RepositoryStatusResponse);
      setAdminMsg({
        type: 'ok',
        text: `Verificación e indexación completada correctamente (${data.status.totalActiveChunks} fragmentos activos).`,
      });
      onRepositoryUpdated();
    } catch {
      setAdminMsg({ type: 'error', text: 'Error de conexión al reprocesar.' });
    } finally {
      setReindexing(false);
    }
  };

  const handleToggleStatus = async (doc: RegulationDocument) => {
    const nextStatus = doc.status === 'vigente' ? 'obsoleto' : 'vigente';
    const res = await fetch(`/api/admin/documents/${encodeURIComponent(doc.id)}`, {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ status: nextStatus }),
    });
    if (res.ok) {
      await fetchAdminRepo();
      onRepositoryUpdated();
    }
  };

  const handleInspect = async (doc: RegulationDocument) => {
    setInspectDoc(doc);
    setLoadingInspect(true);
    try {
      const res = await fetch(`/api/documents/${encodeURIComponent(doc.id)}/chunks`);
      if (res.ok) {
        const data = await res.json();
        setInspectChunks(data.chunks || []);
      }
    } finally {
      setLoadingInspect(false);
    }
  };

  const handleVerifySearch = async (e: FormEvent) => {
    e.preventDefault();
    setVerifying(true);
    try {
      const res = await fetch(
        `/api/admin/verify-citations?q=${encodeURIComponent(verifyQuery.trim())}`
      );
      if (res.ok) {
        const data = await res.json();
        setVerifyResults(data.matches || []);
      }
    } finally {
      setVerifying(false);
    }
  };

  if (authenticated === null) {
    return (
      <div className="py-16 flex items-center justify-center gap-2 text-sm text-slate-500">
        <Loader2 className="w-4 h-4 animate-spin" />
        Verificando sesión administrativa...
      </div>
    );
  }

  if (!authenticated) {
    return (
      <div className="max-w-md mx-auto py-10">
        <div className="bg-[#F3F5F8] border border-[#DDE3EC] rounded-xl p-7 space-y-5">
          <div className="space-y-1.5">
            <div className="w-10 h-10 rounded-lg bg-white border border-[#DDE3EC] flex items-center justify-center text-[#003A80]">
              <Lock className="w-5 h-5 text-[#8B1838]" />
            </div>
            <h1 className="font-serif text-2xl font-semibold text-[#003A80] pt-2">
              Administración Documental
            </h1>
            <p className="text-sm text-slate-600">
              Acceso protegido para auditar el procesamiento de los reglamentos oficiales, controlar su vigencia y verificar citas normativas.
            </p>
          </div>

          <form onSubmit={handleLogin} className="space-y-4">
            <div>
              <label htmlFor="admin-code" className="block text-xs font-semibold text-[#003A80] mb-1.5">
                Código de acceso administrativo
              </label>
              <input
                id="admin-code"
                type="password"
                required
                value={accessCode}
                onChange={(e) => setAccessCode(e.target.value)}
                placeholder="Ingrese la clave administrativa"
                className="w-full px-3.5 py-2.5 text-sm bg-white border border-[#DDE3EC] rounded-lg focus:outline-none focus:border-[#003A80] focus:ring-2 focus:ring-[#003A80]/15"
              />
            </div>

            {loginError && (
              <div className="p-3 rounded-lg bg-[#8B1838]/5 border border-[#8B1838]/30 text-xs text-[#8B1838] flex items-center gap-2">
                <AlertCircle className="w-4 h-4 shrink-0" />
                <span>{loginError}</span>
              </div>
            )}

            <button
              type="submit"
              disabled={loggingIn}
              className="w-full py-2.5 px-4 text-sm font-semibold text-white bg-[#003A80] hover:bg-[#002B60] disabled:opacity-60 rounded-lg transition-colors"
            >
              {loggingIn ? 'Verificando...' : 'Ingresar al panel'}
            </button>
          </form>

          <p className="text-xs text-slate-500 border-t border-[#DDE3EC] pt-4">
            La credencial administrativa se valida exclusivamente en el servidor mediante la variable de entorno <code className="font-mono text-[#003A80]">ADMIN_ACCESS_CODE</code>.
          </p>
        </div>
      </div>
    );
  }

  return (
    <div className="space-y-8">
      {/* Header */}
      <section className="border-b border-[#DDE3EC] pb-6 flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <p className="text-xs font-semibold uppercase tracking-widest text-[#8B1838]">
            Auditoría y control documental
          </p>
          <h1 className="font-serif text-3xl font-semibold text-[#003A80] mt-1.5">
            Panel de Administración
          </h1>
          <p className="text-sm text-slate-600 mt-1">
            Supervise el estado de procesamiento, vigencia y trazabilidad de los reglamentos oficiales precargados en la plataforma.
          </p>
        </div>

        <div className="flex flex-wrap items-center gap-2.5 self-start sm:self-center">
          <button
            type="button"
            onClick={handleReindex}
            disabled={reindexing}
            className="inline-flex items-center gap-1.5 px-3.5 py-2 text-xs font-semibold text-white bg-[#003A80] hover:bg-[#002B60] disabled:opacity-60 rounded-lg transition-colors whitespace-nowrap"
          >
            <RefreshCw className={`w-3.5 h-3.5 ${reindexing ? 'animate-spin' : ''}`} />
            {reindexing ? 'Reprocesando...' : 'Comprobar y reindexar PDFs'}
          </button>
          <button
            type="button"
            onClick={() => void fetchAdminRepo()}
            className="inline-flex items-center gap-1.5 px-3 py-2 text-xs font-medium text-[#003A80] bg-white border border-[#DDE3EC] hover:border-[#003A80] rounded-lg transition-colors whitespace-nowrap"
          >
            <RefreshCw className={`w-3.5 h-3.5 ${loadingRepo ? 'animate-spin' : ''}`} />
            Refrescar
          </button>
          <button
            type="button"
            onClick={handleLogout}
            className="inline-flex items-center gap-1.5 px-3 py-2 text-xs font-medium text-[#8B1838] bg-white border border-[#DDE3EC] hover:border-[#8B1838] hover:bg-[#8B1838] hover:text-white rounded-lg transition-colors whitespace-nowrap"
          >
            <LogOut className="w-3.5 h-3.5" />
            Cerrar sesión
          </button>
        </div>
      </section>

      {adminMsg && (
        <div
          className={`p-3.5 rounded-lg border text-xs sm:text-sm flex items-start gap-2.5 ${
            adminMsg.type === 'ok'
              ? 'bg-emerald-50 border-emerald-200 text-emerald-900'
              : 'bg-[#8B1838]/5 border-[#8B1838]/30 text-[#8B1838]'
          }`}
        >
          {adminMsg.type === 'ok' ? (
            <CheckCircle2 className="w-4 h-4 shrink-0 mt-0.5" />
          ) : (
            <AlertCircle className="w-4 h-4 shrink-0 mt-0.5" />
          )}
          <span>{adminMsg.text}</span>
        </div>
      )}

      {/* Repository Table */}
      <section className="bg-white border border-[#DDE3EC] rounded-xl overflow-hidden">
        <div className="px-6 py-4 bg-[#F3F5F8] border-b border-[#DDE3EC] flex flex-wrap items-center justify-between gap-4">
          <div>
            <h2 className="text-base font-semibold text-[#003A80]">
              Reglamentos oficiales cargados en el sistema
            </h2>
            <p className="text-xs text-slate-600 mt-0.5">
              Solo los documentos en estado <strong className="text-[#003A80]">Vigente</strong> son consultados por el asistente docente.
            </p>
          </div>
          <span className="text-xs font-mono text-[#8B1838] font-medium tabular-nums">
            Fragmentos indexados activos: {repo?.totalActiveChunks ?? 0}
          </span>
        </div>

        {!repo || repo.allDocuments.length === 0 ? (
          <div className="p-8 text-center text-sm text-slate-500">
            Cargando estado del repositorio documental...
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-left border-collapse text-sm">
              <thead>
                <tr className="border-b border-[#DDE3EC] bg-[#F3F5F8]/70 text-xs font-semibold text-[#003A80]">
                  <th className="py-3 px-4">Reglamento / Decreto</th>
                  <th className="py-3 px-4">Ámbito</th>
                  <th className="py-3 px-4 text-right">Págs. / Arts.</th>
                  <th className="py-3 px-4">Procesamiento</th>
                  <th className="py-3 px-4">Vigencia</th>
                  <th className="py-3 px-4 text-right">Acciones</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-[#DDE3EC]">
                {repo.allDocuments.map((doc) => (
                  <tr key={doc.id} className="hover:bg-[#F3F5F8]/50 transition-colors">
                    <td className="py-3.5 px-4">
                      <p className="font-semibold text-slate-900">{doc.title}</p>
                      <p className="text-xs font-mono text-slate-500 mt-0.5 tabular-nums">
                        Decreto Exento N.º {doc.decreeNumber} · v{doc.version}
                        {doc.decreeDate ? ` · ${doc.decreeDate}` : ''}
                      </p>
                      {doc.processingError && (
                        <p className="text-xs text-[#8B1838] mt-1">{doc.processingError}</p>
                      )}
                    </td>
                    <td className="py-3.5 px-4 text-xs text-slate-700">
                      {doc.scope === 'salud'
                        ? 'Área de la Salud'
                        : doc.scope === 'general'
                          ? 'General'
                          : 'Complementario'}
                    </td>
                    <td className="py-3.5 px-4 text-right font-mono text-xs text-slate-700 tabular-nums">
                      {doc.pageCount} / {doc.articleCount}
                    </td>
                    <td className="py-3.5 px-4 text-xs">
                      {doc.processingStatus === 'procesado' ? (
                        <span className="text-emerald-800 font-medium">
                          Procesado ({doc.chunkCount} frag.)
                        </span>
                      ) : (
                        <span className="text-[#8B1838] font-medium">Error de lectura</span>
                      )}
                    </td>
                    <td className="py-3.5 px-4 text-xs">
                      {doc.status === 'vigente' ? (
                        <span className="font-semibold text-[#003A80]">Vigente</span>
                      ) : (
                        <span className="text-slate-500">Obsoleto / Inactivo</span>
                      )}
                    </td>
                    <td className="py-3.5 px-4 text-right">
                      <div className="inline-flex items-center gap-2">
                        {doc.processingStatus === 'procesado' && (
                          <>
                            <button
                              type="button"
                              onClick={() => void handleInspect(doc)}
                              className="inline-flex items-center gap-1 px-2.5 py-1 text-xs font-medium text-[#003A80] bg-white border border-[#DDE3EC] hover:border-[#003A80] rounded-md transition-colors"
                            >
                              <Eye className="w-3.5 h-3.5" />
                              Inspeccionar
                            </button>
                            <a
                              href={`/api/documents/${encodeURIComponent(doc.id)}/pdf`}
                              target="_blank"
                              rel="noopener noreferrer"
                              className="inline-flex items-center gap-1 px-2.5 py-1 text-xs font-medium text-[#003A80] bg-white border border-[#DDE3EC] hover:border-[#003A80] rounded-md transition-colors"
                            >
                              PDF
                              <ExternalLink className="w-3 h-3" />
                            </a>
                            <button
                              type="button"
                              onClick={() => void handleToggleStatus(doc)}
                              className="px-2.5 py-1 text-xs font-medium text-[#8B1838] bg-white border border-[#DDE3EC] hover:border-[#8B1838] rounded-md transition-colors"
                            >
                              {doc.status === 'vigente' ? 'Desactivar' : 'Reactivar'}
                            </button>
                          </>
                        )}
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </section>

      {/* Citation & Reference Verifier */}
      <section className="bg-[#F3F5F8] border border-[#DDE3EC] rounded-xl p-6 space-y-4">
        <div>
          <h2 className="text-base font-semibold text-[#003A80]">
            Verificador de citas y referencias
          </h2>
          <p className="text-xs text-slate-600 mt-0.5">
            Busque directamente por número de artículo, decreto o término para auditar el texto exacto indexado en el sistema.
          </p>
        </div>

        <form onSubmit={handleVerifySearch} className="flex flex-col sm:flex-row gap-3">
          <div className="relative flex-1">
            <Search className="w-4 h-4 text-[#003A80]/60 absolute left-3.5 top-1/2 -translate-y-1/2" />
            <input
              type="text"
              value={verifyQuery}
              onChange={(e) => setVerifyQuery(e.target.value)}
              placeholder="Ej.: Artículo 63, asistencia, recuperativa, práctica clínica..."
              className="w-full pl-10 pr-4 py-2 text-sm bg-white border border-[#DDE3EC] rounded-lg focus:outline-none focus:border-[#003A80] focus:ring-2 focus:ring-[#003A80]/15"
            />
          </div>
          <button
            type="submit"
            disabled={verifying}
            className="px-4 py-2 text-xs font-semibold text-white bg-[#003A80] hover:bg-[#002B60] rounded-lg transition-colors whitespace-nowrap"
          >
            {verifying ? 'Buscando...' : 'Verificar referencias'}
          </button>
        </form>

        {verifyResults.length > 0 && (
          <div className="divide-y divide-[#DDE3EC] border-t border-[#DDE3EC] bg-white rounded-lg px-4 max-h-96 overflow-y-auto">
            {verifyResults.map((m) => (
              <div key={m.chunkId} className="py-3.5 space-y-1">
                <div className="flex flex-wrap items-center justify-between gap-2 text-xs font-mono">
                  <span className="text-[#003A80] font-medium">
                    {m.documentTitle} (Decreto {m.decreeNumber}, v{m.version}) · {m.status}
                  </span>
                  <span className="text-[#8B1838]">
                    {m.articleNumber} · Pág. {m.pageNumber}
                  </span>
                </div>
                <p className="text-xs text-slate-800 whitespace-pre-wrap line-clamp-4">{m.text}</p>
              </div>
            ))}
          </div>
        )}
      </section>

      {/* Document Chunk Inspector Modal */}
      {inspectDoc && (
        <div
          className="fixed inset-0 z-50 bg-slate-950/45 flex items-center justify-center p-4"
          onClick={() => setInspectDoc(null)}
        >
          <div
            className="bg-white border border-[#DDE3EC] rounded-xl w-full max-w-3xl max-h-[85vh] flex flex-col overflow-hidden shadow-2xl"
            onClick={(e) => e.stopPropagation()}
          >
            <div className="px-6 py-4 bg-[#F3F5F8] border-b border-[#DDE3EC] flex items-center justify-between gap-4">
              <div>
                <p className="text-xs font-mono text-[#8B1838]">
                  Decreto Exento N.º {inspectDoc.decreeNumber} · v{inspectDoc.version}
                </p>
                <h3 className="font-serif text-lg font-semibold text-[#003A80]">
                  {inspectDoc.title} — Artículos extraídos ({inspectChunks.length})
                </h3>
              </div>
              <button
                type="button"
                onClick={() => setInspectDoc(null)}
                className="p-2 rounded-lg text-slate-500 hover:text-[#003A80] hover:bg-white transition-colors"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            <div className="flex-1 overflow-y-auto divide-y divide-[#DDE3EC] p-6 space-y-4">
              {loadingInspect ? (
                <div className="py-10 flex items-center justify-center gap-2 text-sm text-slate-500">
                  <Loader2 className="w-4 h-4 animate-spin text-[#003A80]" />
                  Cargando fragmentos extraídos...
                </div>
              ) : (
                inspectChunks.map((c) => (
                  <div key={c.id} className="pt-4 first:pt-0 space-y-1.5">
                    <div className="flex items-center justify-between gap-2 text-xs font-mono text-slate-500">
                      <span className="font-semibold text-[#003A80]">{c.articleNumber}</span>
                      <span className="text-[#8B1838]">
                        {[c.titleSection, c.chapterSection].filter(Boolean).join(' · ')} · Pág. {c.pageNumber}
                      </span>
                    </div>
                    <p className="text-sm text-slate-800 whitespace-pre-wrap">{c.text}</p>
                  </div>
                ))
              )}
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
