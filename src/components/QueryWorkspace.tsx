import { useState } from 'react';
import {
  AlertCircle,
  ArrowRight,
  Clock,
  Loader2,
  Scale,
  Search,
  ShieldCheck,
  Trash2,
} from 'lucide-react';
import type {
  QueryMode,
  RepositoryStatusResponse,
  ScopeFilter,
  StructuredNormativeResponse,
} from '../shared/types.ts';
import { AnswerView } from './AnswerView.tsx';
import type { AppView } from './TopBar.tsx';

interface QueryWorkspaceProps {
  repoStatus: RepositoryStatusResponse | null;
  history: StructuredNormativeResponse[];
  activeResponse: StructuredNormativeResponse | null;
  onSelectResponse: (item: StructuredNormativeResponse) => void;
  onNewResponse: (item: StructuredNormativeResponse) => void;
  onClearHistory: () => void;
  onNavigate: (view: AppView) => void;
}

interface FaqItem {
  id: string;
  mode: QueryMode;
  scope: ScopeFilter;
  category: string;
  question: string;
}

const FAQ_ITEMS: FaqItem[] = [
  {
    id: 'faq-notas',
    mode: 'consulta',
    scope: 'todos',
    category: 'Evaluación y calificaciones',
    question: '¿Cuánto tiempo tengo para entregar las notas?',
  },
  {
    id: 'faq-recuperativa',
    mode: 'consulta',
    scope: 'todos',
    category: 'Evaluación recuperativa',
    question: '¿Cuándo corresponde una evaluación recuperativa?',
  },
  {
    id: 'faq-asistencia',
    mode: 'consulta',
    scope: 'todos',
    category: 'Asistencia mínima',
    question: '¿Cuál es el porcentaje mínimo de asistencia?',
  },
  {
    id: 'faq-justificativos',
    mode: 'consulta',
    scope: 'todos',
    category: 'Justificativos',
    question: '¿Quién valida los justificativos de inasistencia?',
  },
  {
    id: 'faq-reprobacion',
    mode: 'consulta',
    scope: 'todos',
    category: 'Rendimiento académico',
    question: '¿Qué ocurre si un estudiante reprueba una asignatura?',
  },
  {
    id: 'faq-clinicas',
    mode: 'consulta',
    scope: 'salud',
    category: 'Área de la Salud',
    question: '¿Qué normativa se aplica a las prácticas clínicas?',
  },
];

const CASE_EXAMPLE =
  'Un estudiante no asistió a una evaluación, presentó un justificativo que fue rechazado por Escuela y solicita una evaluación recuperativa. ¿Cómo debo proceder?';

export function QueryWorkspace({
  repoStatus,
  history,
  activeResponse,
  onSelectResponse,
  onNewResponse,
  onClearHistory,
  onNavigate,
}: QueryWorkspaceProps) {
  const [question, setQuestion] = useState('');
  const [mode, setMode] = useState<QueryMode>('consulta');
  const [scopeFilter, setScopeFilter] = useState<ScopeFilter>('todos');
  const [loading, setLoading] = useState(false);
  const [errorMsg, setErrorMsg] = useState<string | null>(null);

  const activeDocs = repoStatus?.activeDocuments ?? [];

  const submitQuery = async (
    overrideQuestion?: string,
    overrideMode?: QueryMode,
    overrideScope?: ScopeFilter
  ) => {
    const q = (overrideQuestion ?? question).trim();
    const m = overrideMode ?? mode;
    const s = overrideScope ?? scopeFilter;

    if (q.length < 4) {
      setErrorMsg('Escriba una consulta o descripción de caso (mínimo 4 caracteres).');
      return;
    }

    setErrorMsg(null);
    setLoading(true);

    try {
      const res = await fetch('/api/query', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ question: q, mode: m, scopeFilter: s }),
      });

      const data = await res.json();
      if (!res.ok) {
        setErrorMsg(data.error || 'No se pudo procesar la consulta reglamentaria.');
        return;
      }

      onNewResponse(data as StructuredNormativeResponse);
    } catch {
      setErrorMsg('Error de conexión con el servidor. Intente nuevamente.');
    } finally {
      setLoading(false);
    }
  };

  const handleFaqClick = (faq: FaqItem) => {
    setQuestion(faq.question);
    setMode(faq.mode);
    setScopeFilter(faq.scope);
    void submitQuery(faq.question, faq.mode, faq.scope);
  };

  const handleCaseTemplate = () => {
    setQuestion(CASE_EXAMPLE);
    setMode('caso');
    setScopeFilter('todos');
  };

  return (
    <div className="space-y-8">
      {/* Institutional Header Band */}
      <section className="no-print border-b border-[#DDE3EC] pb-6">
        <p className="text-xs font-semibold uppercase tracking-widest text-[#8B1838]">
          Universidad de La Serena · Apoyo Docente
        </p>
        <h1 className="font-serif text-3xl sm:text-4xl font-semibold text-[#003A80] mt-2 tracking-tight">
          NormaULS
        </h1>
        <p className="text-base sm:text-lg text-slate-600 mt-1.5 max-w-2xl">
          Asistente inteligente de consulta reglamentaria para docentes.
        </p>

        {/* Unboxed Repository Metadata Strip */}
        <div className="mt-4 flex flex-wrap items-center gap-x-3 gap-y-1 text-xs text-slate-600">
          <span className="font-semibold text-[#003A80]">
            Reglamentos vigentes: <span className="font-mono tabular-nums">{activeDocs.length}</span>
          </span>
          {activeDocs.length > 0 && (
            <>
              <span aria-hidden="true">·</span>
              <span className="font-mono text-slate-700">
                {activeDocs
                  .map((d) => `Decreto Exento N.º ${d.decreeNumber} (${d.pageCount} págs.)`)
                  .join(' · ')}
              </span>
            </>
          )}
          <span aria-hidden="true">·</span>
          <button
            type="button"
            onClick={() => onNavigate('documentos')}
            className="text-[#8B1838] font-semibold hover:underline"
          >
            Consultar documentos fuente
          </button>
        </div>
      </section>

      {/* Central Query Composer */}
      <section className="no-print bg-[#F3F5F8] border border-[#DDE3EC] rounded-xl p-5 sm:p-7">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 pb-4 border-b border-[#DDE3EC]">
          {/* Mode Segmented Selector */}
          <div
            className="inline-flex items-center p-1 bg-white border border-[#DDE3EC] rounded-lg self-start"
            role="tablist"
            aria-label="Modalidad de consulta"
          >
            <button
              type="button"
              role="tab"
              aria-selected={mode === 'consulta'}
              onClick={() => setMode('consulta')}
              className={`px-4 py-2 text-xs sm:text-sm font-medium rounded-md transition-colors whitespace-nowrap ${
                mode === 'consulta'
                  ? 'bg-[#003A80] text-white shadow-sm font-semibold'
                  : 'text-slate-600 hover:text-[#003A80]'
              }`}
            >
              Consulta por una norma
            </button>
            <button
              type="button"
              role="tab"
              aria-selected={mode === 'caso'}
              onClick={() => setMode('caso')}
              className={`px-4 py-2 text-xs sm:text-sm font-medium rounded-md transition-colors whitespace-nowrap ${
                mode === 'caso'
                  ? 'bg-[#003A80] text-white shadow-sm font-semibold'
                  : 'text-slate-600 hover:text-[#003A80]'
              }`}
            >
              Consulta por un caso
            </button>
          </div>

          {/* Scope Selector */}
          <div className="flex items-center gap-2">
            <label htmlFor="scope-select" className="text-xs font-semibold text-slate-600 whitespace-nowrap">
              Ámbito:
            </label>
            <select
              id="scope-select"
              value={scopeFilter}
              onChange={(e) => setScopeFilter(e.target.value as ScopeFilter)}
              className="text-xs sm:text-sm bg-white border border-[#DDE3EC] rounded-lg px-3 py-2 text-slate-800 focus:outline-none focus:ring-2 focus:ring-[#003A80]"
            >
              <option value="todos">Todos los reglamentos vigentes</option>
              <option value="general">Régimen de Estudio (General)</option>
              <option value="salud">Carreras del Área de la Salud</option>
            </select>
          </div>
        </div>

        <form
          onSubmit={(e) => {
            e.preventDefault();
            void submitQuery();
          }}
          className="mt-4 space-y-4"
        >
          <div>
            <label htmlFor="query-input" className="sr-only">
              Escriba su consulta normativa o descripción del caso académico
            </label>
            <textarea
              id="query-input"
              rows={mode === 'caso' ? 5 : 4}
              value={question}
              onChange={(e) => setQuestion(e.target.value)}
              placeholder={
                mode === 'caso'
                  ? 'Describa la situación académica de forma anónima (sin nombres ni RUT). Ej.: Un estudiante no asistió a una evaluación, presentó un justificativo rechazado por Escuela y solicita evaluación recuperativa...'
                  : 'Escriba su pregunta reglamentaria en lenguaje natural. Ej.: ¿Cuánto tiempo tengo para entregar las notas? o ¿Cuál es el porcentaje mínimo de asistencia?'
              }
              className="w-full rounded-xl border border-[#DDE3EC] bg-white px-4 py-3.5 text-sm sm:text-base text-slate-900 placeholder:text-slate-400 focus:outline-none focus:border-[#003A80] focus:ring-2 focus:ring-[#003A80]/15 resize-y"
            />
          </div>

          {/* Privacy Anonymization Notice */}
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
            <div className="flex items-start gap-2 text-xs text-slate-600">
              <ShieldCheck className="w-4 h-4 text-[#003A80] shrink-0 mt-0.5" />
              <span>
                <strong className="text-[#003A80]">Aviso de privacidad:</strong> No ingrese nombres, RUT ni datos personales identificables de estudiantes o docentes. Describa cada caso de forma anónima.
              </span>
            </div>

            {mode === 'caso' && !question.trim() && (
              <button
                type="button"
                onClick={handleCaseTemplate}
                className="text-xs font-semibold text-[#8B1838] hover:underline whitespace-nowrap self-start sm:self-center"
              >
                Cargar ejemplo de caso
              </button>
            )}
          </div>

          {errorMsg && (
            <div className="p-3 rounded-lg bg-[#8B1838]/5 border border-[#8B1838]/30 text-xs sm:text-sm text-[#8B1838] flex items-center gap-2">
              <AlertCircle className="w-4 h-4 shrink-0" />
              <span>{errorMsg}</span>
            </div>
          )}

          <div className="flex flex-wrap items-center justify-between gap-3 pt-1">
            <span className="text-xs text-slate-600">
              {mode === 'consulta'
                ? 'Entrega respuesta breve, artículo exacto, pasos y consideraciones.'
                : 'Identifica problema, norma aplicable, autoridad competente y distingue obligación de recomendación.'}
            </span>

            <button
              type="submit"
              disabled={loading}
              className="inline-flex items-center justify-center gap-2 px-6 py-2.5 text-sm font-semibold text-white bg-[#003A80] hover:bg-[#002B60] disabled:opacity-60 rounded-lg transition-colors whitespace-nowrap shrink-0 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-offset-2 focus-visible:ring-[#003A80]"
            >
              {loading ? (
                <>
                  <Loader2 className="w-4 h-4 animate-spin" />
                  Consultando normativa...
                </>
              ) : (
                <>
                  <Search className="w-4 h-4" />
                  Consultar reglamento
                </>
              )}
            </button>
          </div>
        </form>
      </section>

      {/* Main Content Split: Response + Margin History Rail, OR FAQ Cards when idle */}
      {activeResponse ? (
        <div className="grid grid-cols-1 lg:grid-cols-12 gap-8 items-start">
          <div className="lg:col-span-8">
            <AnswerView response={activeResponse} />
          </div>

          {/* Right Margin Rail: Session History & Quick Re-queries */}
          <aside className="no-print lg:col-span-4 space-y-6">
            <div className="bg-[#F3F5F8] border border-[#DDE3EC] rounded-xl p-5">
              <div className="flex items-center justify-between gap-2 pb-3 border-b border-[#DDE3EC]">
                <div className="flex items-center gap-2">
                  <Clock className="w-4 h-4 text-[#003A80]" />
                  <h3 className="text-sm font-semibold text-[#003A80]">
                    Historial de la sesión
                  </h3>
                </div>
                {history.length > 0 && (
                  <button
                    type="button"
                    onClick={onClearHistory}
                    className="inline-flex items-center gap-1 text-xs font-medium text-slate-600 hover:text-[#8B1838] transition-colors"
                    title="Limpiar historial"
                  >
                    <Trash2 className="w-3.5 h-3.5" />
                    Limpiar
                  </button>
                )}
              </div>

              {history.length === 0 ? (
                <p className="text-xs text-slate-500 pt-3">
                  Sus consultas realizadas en esta sesión aparecerán aquí.
                </p>
              ) : (
                <ul className="divide-y divide-[#DDE3EC] mt-2 max-h-[380px] overflow-y-auto">
                  {history.map((item) => {
                    const isCurrent = item.id === activeResponse.id;
                    return (
                      <li key={item.id}>
                        <button
                          type="button"
                          onClick={() => onSelectResponse(item)}
                          className={`w-full text-left py-3 px-2.5 rounded-lg transition-colors ${
                            isCurrent ? 'bg-white border border-[#003A80]/25' : 'hover:bg-white/70'
                          }`}
                        >
                          <div className="flex items-center justify-between gap-2 text-[11px] font-mono text-slate-500">
                            <span className={isCurrent ? 'text-[#8B1838] font-semibold' : ''}>
                              {item.mode === 'caso' ? 'Caso' : 'Consulta'}
                            </span>
                            <span className="tabular-nums">
                              {new Date(item.timestamp).toLocaleTimeString('es-CL', {
                                hour: '2-digit',
                                minute: '2-digit',
                              })}
                            </span>
                          </div>
                          <p
                            className={`text-xs mt-1 line-clamp-2 ${
                              isCurrent ? 'font-semibold text-[#003A80]' : 'text-slate-700'
                            }`}
                          >
                            {item.question}
                          </p>
                        </button>
                      </li>
                    );
                  })}
                </ul>
              )}
            </div>

            <div className="bg-[#F3F5F8] border border-[#DDE3EC] rounded-xl p-5">
              <div className="flex items-center gap-2 pb-3 border-b border-[#DDE3EC]">
                <Scale className="w-4 h-4 text-[#8B1838]" />
                <h3 className="text-sm font-semibold text-[#003A80]">
                  Preguntas frecuentes
                </h3>
              </div>
              <div className="mt-3 space-y-2">
                {FAQ_ITEMS.map((faq) => (
                  <button
                    key={faq.id}
                    type="button"
                    onClick={() => handleFaqClick(faq)}
                    className="w-full text-left p-2.5 rounded-lg bg-white border border-[#DDE3EC] hover:border-[#003A80] text-xs text-slate-700 hover:text-[#003A80] transition-colors"
                  >
                    {faq.question}
                  </button>
                ))}
              </div>
            </div>
          </aside>
        </div>
      ) : (
        <div className="no-print space-y-8">
          <section>
            <div className="flex flex-wrap items-baseline justify-between gap-2 mb-4">
              <h2 className="font-serif text-xl font-semibold text-[#003A80]">
                Preguntas frecuentes docentes
              </h2>
              <span className="text-xs text-slate-500">
                Seleccione una tarjeta para consultar directamente
              </span>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
              {FAQ_ITEMS.map((faq) => (
                <button
                  key={faq.id}
                  type="button"
                  onClick={() => handleFaqClick(faq)}
                  className="text-left bg-[#F3F5F8] hover:bg-white border border-[#DDE3EC] hover:border-[#003A80] rounded-xl p-5 transition-colors flex flex-col justify-between gap-4 group"
                >
                  <div>
                    <p className="text-xs font-semibold text-[#8B1838]">{faq.category}</p>
                    <p className="text-sm sm:text-base font-semibold text-slate-900 mt-1.5 group-hover:text-[#003A80]">
                      {faq.question}
                    </p>
                  </div>
                  <div className="flex items-center justify-between text-xs text-[#003A80] font-semibold pt-2 border-t border-[#DDE3EC]">
                    <span>Consultar ahora</span>
                    <ArrowRight className="w-3.5 h-3.5 transition-transform group-hover:translate-x-0.5 text-[#8B1838]" />
                  </div>
                </button>
              ))}
            </div>

            {/* Case Analysis Starter Card */}
            <div className="mt-4 bg-[#F3F5F8] border border-[#DDE3EC] rounded-xl p-5 flex flex-col sm:flex-row sm:items-center justify-between gap-4">
              <div>
                <p className="text-xs font-semibold text-[#8B1838]">Ejemplo de Consulta por un caso</p>
                <p className="text-sm font-medium text-slate-900 mt-1">{CASE_EXAMPLE}</p>
              </div>
              <button
                type="button"
                onClick={() => {
                  setQuestion(CASE_EXAMPLE);
                  setMode('caso');
                  setScopeFilter('todos');
                  void submitQuery(CASE_EXAMPLE, 'caso', 'todos');
                }}
                className="px-4 py-2 text-xs font-semibold text-[#8B1838] bg-white border border-[#8B1838]/40 hover:bg-[#8B1838] hover:text-white rounded-lg transition-colors whitespace-nowrap shrink-0 self-start sm:self-center"
              >
                Probar consulta por un caso
              </button>
            </div>
          </section>

          {history.length > 0 && (
            <section className="bg-[#F3F5F8] border border-[#DDE3EC] rounded-xl p-5">
              <div className="flex items-center justify-between gap-2 pb-3 border-b border-[#DDE3EC]">
                <h3 className="text-sm font-semibold text-[#003A80]">
                  Consultas recientes en esta sesión ({history.length})
                </h3>
                <button
                  type="button"
                  onClick={onClearHistory}
                  className="text-xs font-medium text-slate-600 hover:text-[#8B1838]"
                >
                  Limpiar historial
                </button>
              </div>
              <div className="divide-y divide-[#DDE3EC] mt-1">
                {history.map((item) => (
                  <button
                    key={item.id}
                    type="button"
                    onClick={() => onSelectResponse(item)}
                    className="w-full text-left py-3 px-2 hover:bg-white rounded-lg flex items-center justify-between gap-4 transition-colors"
                  >
                    <div className="min-w-0">
                      <p className="text-sm font-medium text-slate-900 truncate">{item.question}</p>
                      <p className="text-xs text-slate-500 mt-0.5">
                        <span className="text-[#8B1838] font-medium">
                          {item.mode === 'caso' ? 'Consulta por un caso' : 'Consulta por una norma'}
                        </span>{' '}
                        · {item.scopeDetected}
                      </p>
                    </div>
                    <ArrowRight className="w-4 h-4 text-[#003A80] shrink-0" />
                  </button>
                ))}
              </div>
            </section>
          )}
        </div>
      )}
    </div>
  );
}
