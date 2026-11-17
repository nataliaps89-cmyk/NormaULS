import { useState } from 'react';
import {
  AlertTriangle,
  BookOpen,
  Check,
  Copy,
  Download,
  FileText,
  Printer,
  Scale,
  ShieldAlert,
} from 'lucide-react';
import type { CitationRef, StructuredNormativeResponse } from '../shared/types.ts';
import { exportResponseToPdf, formatResponseAsPlainText } from '../utils/pdfExport.ts';
import { OriginalArticleModal } from './OriginalArticleModal.tsx';

interface AnswerViewProps {
  response: StructuredNormativeResponse;
}

export function AnswerView({ response }: AnswerViewProps) {
  const [copied, setCopied] = useState(false);
  const [modalOpen, setModalOpen] = useState(false);
  const [selectedChunkId, setSelectedChunkId] = useState<string | null>(null);

  const handleCopy = async () => {
    try {
      await navigator.clipboard.writeText(formatResponseAsPlainText(response));
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    } catch {
      setCopied(false);
    }
  };

  const handleOpenCitation = (chunkId?: string) => {
    setSelectedChunkId(chunkId || response.citations[0]?.chunkId || null);
    setModalOpen(true);
  };

  const formattedDate = new Date(response.timestamp).toLocaleString('es-CL', {
    dateStyle: 'medium',
    timeStyle: 'short',
  });

  return (
    <div className="print-container space-y-6">
      {/* Main Answer Card */}
      <article className="bg-white border border-[#DDE3EC] rounded-xl overflow-hidden">
        {/* Top Metadata & Action Toolbar */}
        <div className="px-6 py-4 bg-[#F3F5F8] border-b border-[#DDE3EC] flex flex-wrap items-center justify-between gap-4">
          <div className="flex flex-wrap items-center gap-2 text-xs text-slate-600">
            <span className="font-semibold text-[#8B1838]">
              {response.mode === 'caso' ? 'Consulta por un caso' : 'Consulta por una norma'}
            </span>
            <span aria-hidden="true" className="text-slate-400">·</span>
            <span className="text-[#003A80] font-medium">{response.scopeDetected}</span>
            <span aria-hidden="true" className="text-slate-400">·</span>
            <span className="font-mono tabular-nums">{formattedDate}</span>
          </div>

          <div className="no-print flex flex-wrap items-center gap-2">
            {response.citations.length > 0 && (
              <button
                type="button"
                onClick={() => handleOpenCitation()}
                className="inline-flex items-center gap-1.5 px-3 py-1.5 text-xs font-semibold text-white bg-[#003A80] hover:bg-[#002B60] rounded-lg transition-colors whitespace-nowrap"
              >
                <BookOpen className="w-3.5 h-3.5" />
                Ver artículo original ({response.citations.length})
              </button>
            )}

            <button
              type="button"
              onClick={handleCopy}
              className="inline-flex items-center gap-1.5 px-3 py-1.5 text-xs font-medium text-[#003A80] bg-white border border-[#DDE3EC] hover:border-[#003A80] rounded-lg transition-colors whitespace-nowrap"
            >
              {copied ? <Check className="w-3.5 h-3.5 text-emerald-700" /> : <Copy className="w-3.5 h-3.5" />}
              {copied ? 'Copiado' : 'Copiar'}
            </button>

            <button
              type="button"
              onClick={() => window.print()}
              className="inline-flex items-center gap-1.5 px-3 py-1.5 text-xs font-medium text-[#003A80] bg-white border border-[#DDE3EC] hover:border-[#003A80] rounded-lg transition-colors whitespace-nowrap"
            >
              <Printer className="w-3.5 h-3.5" />
              Imprimir
            </button>

            <button
              type="button"
              onClick={() => exportResponseToPdf(response)}
              className="inline-flex items-center gap-1.5 px-3 py-1.5 text-xs font-medium text-[#8B1838] bg-white border border-[#DDE3EC] hover:border-[#8B1838] rounded-lg transition-colors whitespace-nowrap"
            >
              <Download className="w-3.5 h-3.5" />
              Descargar PDF
            </button>
          </div>
        </div>

        {/* Question Echo */}
        <div className="px-6 py-4 border-b border-[#DDE3EC] bg-white">
          <p className="text-xs font-semibold uppercase tracking-wider text-[#8B1838] mb-1">
            Consulta del docente
          </p>
          <p className="text-sm sm:text-base font-medium text-slate-900 leading-relaxed">
            {response.question}
          </p>
        </div>

        {/* Evidence Warning if insufficient */}
        {!response.hasSufficientEvidence && (
          <div className="mx-6 mt-5 p-4 rounded-lg bg-[#8B1838]/5 border border-[#8B1838]/30 flex items-start gap-3">
            <AlertTriangle className="w-5 h-5 text-[#8B1838] shrink-0 mt-0.5" />
            <div className="text-sm text-[#8B1838]">
              <p className="font-semibold">Sin evidencia documental suficiente</p>
              <p className="mt-0.5 text-slate-800">
                La respuesta no se encuentra respaldada por disposiciones cargadas actualmente o requiere documentos aún pendientes de incorporación.
              </p>
            </div>
          </div>
        )}

        {/* 4 Mandatory Structured Sections */}
        <div className="p-6 space-y-6">
          {/* 1. RESPUESTA */}
          <section>
            <h3 className="text-xs font-mono font-semibold uppercase tracking-wider text-[#003A80] mb-2">
              RESPUESTA
            </h3>
            <p className="text-[15px] leading-relaxed text-slate-900 whitespace-pre-line max-w-[72ch]">
              {response.respuesta}
            </p>
          </section>

          <hr className="border-[#DDE3EC]" />

          {/* 2. FUNDAMENTO NORMATIVO */}
          <section>
            <h3 className="text-xs font-mono font-semibold uppercase tracking-wider text-[#003A80] mb-2">
              FUNDAMENTO NORMATIVO
            </h3>
            <p className="text-[15px] leading-relaxed text-slate-800 whitespace-pre-line max-w-[72ch]">
              {response.fundamentoNormativo}
            </p>
          </section>

          <hr className="border-[#DDE3EC]" />

          {/* 3. CÓMO PROCEDER */}
          <section>
            <h3 className="text-xs font-mono font-semibold uppercase tracking-wider text-[#003A80] mb-2.5">
              CÓMO PROCEDER
            </h3>
            {response.comoProceder.length > 0 ? (
              <ol className="space-y-2.5 text-[15px] leading-relaxed text-slate-900 max-w-[72ch]">
                {response.comoProceder.map((step, idx) => (
                  <li key={idx} className="flex items-start gap-3">
                    <span className="font-mono text-xs font-semibold text-[#003A80] bg-[#F3F5F8] border border-[#DDE3EC] rounded w-6 h-6 flex items-center justify-center shrink-0 mt-0.5 tabular-nums">
                      {idx + 1}
                    </span>
                    <span>{step}</span>
                  </li>
                ))}
              </ol>
            ) : (
              <p className="text-sm text-slate-600">
                Esta consulta es de carácter informativo y no exige una actuación procedimental específica, salvo las consideraciones indicadas más abajo.
              </p>
            )}

            {/* Case-specific distinction: Authority intervention & Obligation vs Recommendation */}
            {(response.requiereAutoridad || response.obligacionVsRecomendacion) && (
              <div className="mt-5 grid grid-cols-1 md:grid-cols-2 gap-4">
                {response.requiereAutoridad && (
                  <div className="p-4 rounded-lg bg-[#F3F5F8] border border-[#DDE3EC]">
                    <div className="flex items-center gap-2 text-xs font-semibold text-[#003A80] mb-1.5">
                      <ShieldAlert className="w-4 h-4 shrink-0 text-[#8B1838]" />
                      Intervención de autoridad universitaria
                    </div>
                    <p className="text-sm leading-relaxed text-slate-700">
                      {response.requiereAutoridad}
                    </p>
                  </div>
                )}
                {response.obligacionVsRecomendacion && (
                  <div className="p-4 rounded-lg bg-[#F3F5F8] border border-[#DDE3EC]">
                    <div className="flex items-center gap-2 text-xs font-semibold text-[#003A80] mb-1.5">
                      <Scale className="w-4 h-4 shrink-0 text-[#8B1838]" />
                      Obligación normativa vs. recomendación
                    </div>
                    <p className="text-sm leading-relaxed text-slate-700">
                      {response.obligacionVsRecomendacion}
                    </p>
                  </div>
                )}
              </div>
            )}
          </section>

          <hr className="border-[#DDE3EC]" />

          {/* 4. CONSIDERACIONES */}
          <section>
            <h3 className="text-xs font-mono font-semibold uppercase tracking-wider text-[#003A80] mb-2.5">
              CONSIDERACIONES
            </h3>
            {response.consideraciones.length > 0 ? (
              <ul className="space-y-2 text-[15px] leading-relaxed text-slate-800 max-w-[72ch]">
                {response.consideraciones.map((item, idx) => (
                  <li key={idx} className="flex items-start gap-2.5">
                    <span className="text-[#8B1838] mt-1.5 text-xs" aria-hidden="true">
                      •
                    </span>
                    <span>{item}</span>
                  </li>
                ))}
              </ul>
            ) : (
              <p className="text-sm text-slate-600">
                Verifique siempre la vigencia actual del decreto en Secretaría General o Dirección de Docencia.
              </p>
            )}

            {response.conflictosNormativos && (
              <div className="mt-4 p-4 rounded-lg bg-[#F3F5F8] border border-[#DDE3EC]">
                <p className="text-xs font-semibold text-[#8B1838] mb-1">
                  Concurrencia o aparente contradicción entre disposiciones
                </p>
                <p className="text-sm leading-relaxed text-slate-700">
                  {response.conflictosNormativos}
                </p>
              </div>
            )}
          </section>

          {/* Verified Citations List */}
          {response.citations.length > 0 && (
            <>
              <hr className="border-[#DDE3EC]" />
              <section>
                <div className="flex flex-wrap items-center justify-between gap-4 mb-3">
                  <h3 className="text-xs font-mono font-semibold uppercase tracking-wider text-[#003A80]">
                    Referencias normativas verificadas
                  </h3>
                  <span className="text-xs text-slate-500">
                    Haga clic en un fragmento para leer el texto literal del PDF
                  </span>
                </div>
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                  {response.citations.map((cit: CitationRef) => (
                    <button
                      key={cit.chunkId}
                      type="button"
                      onClick={() => handleOpenCitation(cit.chunkId)}
                      className="text-left p-3.5 rounded-lg border border-[#DDE3EC] hover:border-[#003A80] bg-[#F3F5F8]/60 hover:bg-white transition-colors group"
                    >
                      <div className="flex items-center justify-between gap-2 text-xs font-mono tabular-nums">
                        <span className="text-[#8B1838] font-medium">Decreto {cit.decreeNumber}</span>
                        <span className="text-slate-500">Pág. {cit.pageNumber}</span>
                      </div>
                      <p className="text-sm font-semibold text-[#003A80] mt-1 group-hover:underline">
                        {cit.articleNumber}
                      </p>
                      <p className="text-xs text-slate-600 mt-0.5 line-clamp-1">
                        {cit.documentTitle}
                      </p>
                      <p className="text-xs text-slate-500 mt-2 line-clamp-2">
                        {cit.excerpt}
                      </p>
                    </button>
                  ))}
                </div>
              </section>
            </>
          )}
        </div>

        {/* Institutional Disclaimer */}
        <div className="px-6 py-4 bg-[#F3F5F8] border-t border-[#DDE3EC] text-xs text-slate-600 flex items-start gap-2.5">
          <FileText className="w-4 h-4 shrink-0 mt-0.5 text-[#003A80]" />
          <p>{response.disclaimer}</p>
        </div>
      </article>

      {modalOpen && (
        <OriginalArticleModal
          citations={response.citations}
          selectedChunkId={selectedChunkId}
          onSelectChunk={setSelectedChunkId}
          onClose={() => setModalOpen(false)}
        />
      )}
    </div>
  );
}
