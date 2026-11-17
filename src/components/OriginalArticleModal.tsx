import { useEffect } from 'react';
import { ExternalLink, FileText, X } from 'lucide-react';
import type { CitationRef } from '../shared/types.ts';

interface OriginalArticleModalProps {
  citations: CitationRef[];
  selectedChunkId: string | null;
  onSelectChunk: (chunkId: string) => void;
  onClose: () => void;
}

export function OriginalArticleModal({
  citations,
  selectedChunkId,
  onSelectChunk,
  onClose,
}: OriginalArticleModalProps) {
  useEffect(() => {
    const handleKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') onClose();
    };
    window.addEventListener('keydown', handleKey);
    return () => window.removeEventListener('keydown', handleKey);
  }, [onClose]);

  if (citations.length === 0) return null;

  const activeCitation =
    citations.find((c) => c.chunkId === selectedChunkId) || citations[0];

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-end bg-slate-950/45 backdrop-blur-[1px]"
      role="dialog"
      aria-modal="true"
      aria-label="Artículo original del reglamento"
      onClick={onClose}
    >
      <div
        className="relative w-full max-w-2xl h-full bg-white border-l border-[#DDE3EC] flex flex-col shadow-2xl"
        onClick={(e) => e.stopPropagation()}
      >
        {/* Header */}
        <div className="px-6 py-5 border-b border-[#DDE3EC] flex items-start justify-between gap-4 bg-white">
          <div className="min-w-0">
            <p className="text-xs font-mono font-medium uppercase tracking-wider text-[#8B1838]">
              Fuente documental verificada
            </p>
            <h3 className="font-serif text-xl font-semibold text-[#003A80] mt-1">
              Artículo original del reglamento
            </h3>
          </div>
          <button
            type="button"
            onClick={onClose}
            className="p-2 rounded-lg text-slate-500 hover:text-[#003A80] hover:bg-[#F3F5F8] transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#003A80]"
            aria-label="Cerrar visor"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Selector tabs if multiple citations */}
        {citations.length > 1 && (
          <div className="px-6 py-3 bg-[#F3F5F8] border-b border-[#DDE3EC] flex items-center gap-2 overflow-x-auto">
            {citations.map((cit) => {
              const isSelected = cit.chunkId === activeCitation.chunkId;
              return (
                <button
                  key={cit.chunkId}
                  type="button"
                  onClick={() => onSelectChunk(cit.chunkId)}
                  className={`px-3 py-1.5 text-xs font-medium rounded-md whitespace-nowrap shrink-0 transition-colors ${
                    isSelected
                      ? 'bg-[#003A80] text-white'
                      : 'bg-white border border-[#DDE3EC] text-[#003A80] hover:border-[#003A80]'
                  }`}
                >
                  {cit.articleNumber} · Pág. {cit.pageNumber}
                </button>
              );
            })}
          </div>
        )}

        {/* Body */}
        <div className="flex-1 overflow-y-auto px-6 py-6 space-y-6 bg-white">
          {/* Structured accession metadata */}
          <dl className="grid grid-cols-1 sm:grid-cols-2 gap-4 pb-5 border-b border-[#DDE3EC] text-sm">
            <div>
              <dt className="text-xs text-slate-500">Reglamento oficial</dt>
              <dd className="font-semibold text-[#003A80] mt-0.5">{activeCitation.documentTitle}</dd>
            </div>
            <div>
              <dt className="text-xs text-slate-500">Decreto y versión</dt>
              <dd className="font-mono text-slate-900 mt-0.5 tabular-nums">
                Decreto {activeCitation.decreeNumber} · v{activeCitation.version}
              </dd>
            </div>
            <div>
              <dt className="text-xs text-slate-500">Ubicación estructural</dt>
              <dd className="text-slate-800 mt-0.5">{activeCitation.sectionHierarchy}</dd>
            </div>
            <div>
              <dt className="text-xs text-slate-500">Artículo y página PDF</dt>
              <dd className="font-mono text-[#8B1838] font-medium mt-0.5 tabular-nums">
                {activeCitation.articleNumber} · Pág. {activeCitation.pageNumber}
                {activeCitation.pageEnd > activeCitation.pageNumber
                  ? `–${activeCitation.pageEnd}`
                  : ''}
              </dd>
            </div>
          </dl>

          {/* Verbatim text */}
          <div>
            <div className="flex items-center justify-between gap-4 mb-3">
              <h4 className="text-xs font-semibold uppercase tracking-wider text-[#003A80]">
                Texto exacto extraído del PDF
              </h4>
              <span className="text-xs font-mono text-slate-500">
                Ámbito:{' '}
                {activeCitation.scope === 'salud'
                  ? 'Área de la Salud'
                  : activeCitation.scope === 'general'
                    ? 'General'
                    : 'Complementario'}
              </span>
            </div>
            <div className="bg-[#F3F5F8] border border-[#DDE3EC] rounded-xl p-5 font-sans text-[15px] leading-relaxed text-slate-900 whitespace-pre-wrap">
              {activeCitation.excerpt}
            </div>
          </div>

          {activeCitation.clauses.length > 0 && (
            <div className="text-xs text-slate-600">
              <span className="font-medium text-[#003A80]">Divisiones / incisos detectados: </span>
              <span>{activeCitation.clauses.join(' · ')}</span>
            </div>
          )}
        </div>

        {/* Footer */}
        <div className="px-6 py-4 border-t border-[#DDE3EC] bg-[#F3F5F8] flex flex-wrap items-center justify-between gap-3">
          <a
            href={`/api/documents/${encodeURIComponent(activeCitation.documentId)}/pdf#page=${activeCitation.pageNumber}`}
            target="_blank"
            rel="noopener noreferrer"
            className="inline-flex items-center gap-2 px-4 py-2 text-xs font-semibold text-[#8B1838] bg-white border border-[#8B1838]/35 hover:bg-[#8B1838] hover:text-white rounded-lg transition-colors whitespace-nowrap"
          >
            <FileText className="w-4 h-4" />
            Abrir PDF original en página {activeCitation.pageNumber}
            <ExternalLink className="w-3.5 h-3.5" />
          </a>
          <button
            type="button"
            onClick={onClose}
            className="px-4 py-2 text-xs font-semibold text-white bg-[#003A80] hover:bg-[#002B60] rounded-lg transition-colors"
          >
            Cerrar
          </button>
        </div>
      </div>
    </div>
  );
}
