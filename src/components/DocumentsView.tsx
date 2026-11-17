import { useEffect, useState } from 'react';
import { BookOpen, ExternalLink, FileText, Loader2, Search } from 'lucide-react';
import type { RegulationChunk, RegulationDocument, RepositoryStatusResponse } from '../shared/types.ts';
import type { AppView } from './TopBar.tsx';

interface DocumentsViewProps {
  repoStatus: RepositoryStatusResponse | null;
  onNavigate: (view: AppView) => void;
}

type PublicChunk = Omit<RegulationChunk, 'embedding' | 'normalizedText'>;

export function DocumentsView({ repoStatus }: DocumentsViewProps) {
  const activeDocs = repoStatus?.activeDocuments ?? [];

  const [selectedDoc, setSelectedDoc] = useState<RegulationDocument | null>(null);
  const [chunks, setChunks] = useState<PublicChunk[]>([]);
  const [searchTerm, setSearchTerm] = useState('');
  const [loadingChunks, setLoadingChunks] = useState(false);

  useEffect(() => {
    if (!selectedDoc && activeDocs.length > 0) {
      setSelectedDoc(activeDocs[0]);
    } else if (selectedDoc && !activeDocs.some((d) => d.id === selectedDoc.id)) {
      setSelectedDoc(activeDocs[0] || null);
    }
  }, [activeDocs, selectedDoc]);

  useEffect(() => {
    if (!selectedDoc) {
      setChunks([]);
      return;
    }

    let cancelled = false;
    const loadChunks = async () => {
      setLoadingChunks(true);
      try {
        const params = searchTerm.trim() ? `?q=${encodeURIComponent(searchTerm.trim())}` : '';
        const res = await fetch(`/api/documents/${encodeURIComponent(selectedDoc.id)}/chunks${params}`);
        if (res.ok) {
          const data = await res.json();
          if (!cancelled) {
            setChunks(data.chunks || []);
          }
        }
      } finally {
        if (!cancelled) setLoadingChunks(false);
      }
    };

    const timer = setTimeout(loadChunks, 200);
    return () => {
      cancelled = true;
      clearTimeout(timer);
    };
  }, [selectedDoc, searchTerm]);

  const scopeLabel = (scope: RegulationDocument['scope']) => {
    if (scope === 'salud') return 'Carreras del Área de la Salud';
    if (scope === 'general') return 'General (Régimen de Estudio)';
    return 'Normativa Complementaria';
  };

  return (
    <div className="space-y-8">
      <section className="border-b border-[#DDE3EC] pb-6">
        <p className="text-xs font-semibold uppercase tracking-widest text-[#8B1838]">
          Fuentes oficiales verificables
        </p>
        <h1 className="font-serif text-3xl font-semibold text-[#003A80] mt-2">
          Documentos normativos vigentes
        </h1>
        <p className="text-sm sm:text-base text-slate-600 mt-1.5 max-w-2xl">
          Explore el texto íntegro, los artículos y las páginas de los reglamentos oficiales de la Universidad de La Serena incorporados en el sistema.
        </p>
      </section>

      {activeDocs.length === 0 ? (
        <section className="bg-[#F3F5F8] border border-[#DDE3EC] rounded-xl p-10 text-center space-y-3">
          <BookOpen className="w-8 h-8 text-[#003A80] mx-auto" />
          <h3 className="text-base font-semibold text-[#003A80]">
            No hay reglamentos activos disponibles en este momento
          </h3>
          <p className="text-sm text-slate-600 max-w-md mx-auto">
            Si un administrador desactivó temporalmente la vigencia de los decretos, puede reactivarla desde el panel de Administración.
          </p>
        </section>
      ) : (
        <div className="grid grid-cols-1 lg:grid-cols-12 gap-6 items-start">
          {/* Document List */}
          <aside className="lg:col-span-4 space-y-3">
            <h3 className="text-xs font-semibold uppercase tracking-wider text-[#003A80]">
              Reglamentos vigentes ({activeDocs.length})
            </h3>
            <div className="space-y-2.5">
              {activeDocs.map((doc) => {
                const active = selectedDoc?.id === doc.id;
                return (
                  <button
                    key={doc.id}
                    type="button"
                    onClick={() => setSelectedDoc(doc)}
                    className={`w-full text-left p-4 rounded-xl border transition-colors ${
                      active
                        ? 'bg-white border-[#003A80] ring-1 ring-[#003A80]'
                        : 'bg-[#F3F5F8] border-[#DDE3EC] hover:border-[#003A80]/50 hover:bg-white'
                    }`}
                  >
                    <div className="flex items-center justify-between gap-2 text-xs font-mono tabular-nums">
                      <span className={active ? 'text-[#8B1838] font-medium' : 'text-slate-500'}>
                        Decreto Exento N.º {doc.decreeNumber}
                      </span>
                      <span className="text-slate-500">v{doc.version}</span>
                    </div>
                    <p className="text-sm font-semibold text-[#003A80] mt-1">{doc.title}</p>
                    <p className="text-xs text-slate-600 mt-1.5">
                      {scopeLabel(doc.scope)} · {doc.pageCount} págs. · {doc.articleCount} arts.
                    </p>
                  </button>
                );
              })}
            </div>
          </aside>

          {/* Article / Chunk Viewer */}
          <section className="lg:col-span-8 bg-white border border-[#DDE3EC] rounded-xl overflow-hidden">
            {selectedDoc && (
              <>
                <div className="p-5 border-b border-[#DDE3EC] bg-[#F3F5F8] flex flex-col sm:flex-row sm:items-center justify-between gap-4">
                  <div>
                    <p className="text-xs font-mono font-medium text-[#8B1838]">
                      Decreto Exento N.º {selectedDoc.decreeNumber} · Versión {selectedDoc.version}
                      {selectedDoc.decreeDate ? ` · ${selectedDoc.decreeDate}` : ''}
                    </p>
                    <h2 className="font-serif text-xl font-semibold text-[#003A80] mt-0.5">
                      {selectedDoc.title}
                    </h2>
                    {selectedDoc.notes && (
                      <p className="text-xs text-slate-600 mt-1">{selectedDoc.notes}</p>
                    )}
                  </div>

                  {selectedDoc.hasPdfFile && (
                    <a
                      href={`/api/documents/${encodeURIComponent(selectedDoc.id)}/pdf`}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="inline-flex items-center gap-1.5 px-3.5 py-2 text-xs font-semibold text-[#8B1838] bg-white border border-[#8B1838]/40 hover:bg-[#8B1838] hover:text-white rounded-lg transition-colors whitespace-nowrap shrink-0 self-start sm:self-center"
                    >
                      <FileText className="w-3.5 h-3.5" />
                      Ver PDF original
                      <ExternalLink className="w-3 h-3" />
                    </a>
                  )}
                </div>

                {/* Search within regulation */}
                <div className="p-4 border-b border-[#DDE3EC] bg-white">
                  <div className="relative">
                    <Search className="w-4 h-4 text-[#003A80]/60 absolute left-3.5 top-1/2 -translate-y-1/2" />
                    <input
                      type="text"
                      value={searchTerm}
                      onChange={(e) => setSearchTerm(e.target.value)}
                      placeholder="Buscar por número de artículo o palabra clave dentro del documento..."
                      className="w-full pl-10 pr-4 py-2 text-sm bg-white border border-[#DDE3EC] rounded-lg focus:outline-none focus:border-[#003A80] focus:ring-2 focus:ring-[#003A80]/15"
                    />
                  </div>
                </div>

                {/* Chunk List */}
                <div className="divide-y divide-[#DDE3EC] max-h-[650px] overflow-y-auto bg-white">
                  {loadingChunks ? (
                    <div className="p-10 flex items-center justify-center gap-2 text-sm text-slate-500">
                      <Loader2 className="w-4 h-4 animate-spin text-[#003A80]" />
                      Cargando artículos indexados...
                    </div>
                  ) : chunks.length === 0 ? (
                    <div className="p-8 text-center text-sm text-slate-500">
                      No se encontraron artículos que coincidan con &quot;{searchTerm}&quot;.
                    </div>
                  ) : (
                    chunks.map((chunk) => (
                      <div key={chunk.id} className="p-5 space-y-2 hover:bg-[#F3F5F8]/40 transition-colors">
                        <div className="flex flex-wrap items-center justify-between gap-2 text-xs text-slate-500">
                          <span className="font-medium text-slate-700">
                            {[chunk.titleSection, chunk.chapterSection].filter(Boolean).join(' · ')}
                          </span>
                          <span className="font-mono tabular-nums text-[#8B1838]">
                            Pág. {chunk.pageNumber}
                            {chunk.pageEnd > chunk.pageNumber ? `–${chunk.pageEnd}` : ''}
                          </span>
                        </div>
                        <h4 className="text-sm font-semibold text-[#003A80]">
                          {chunk.articleNumber}
                        </h4>
                        <p className="text-sm leading-relaxed text-slate-800 whitespace-pre-wrap">
                          {chunk.text}
                        </p>
                      </div>
                    ))
                  )}
                </div>
              </>
            )}
          </section>
        </div>
      )}
    </div>
  );
}
