export type DocumentScope = 'general' | 'salud' | 'complementario';

export type DocumentStatus = 'vigente' | 'obsoleto' | 'error';

export type ProcessingStatus = 'procesado' | 'error' | 'pendiente';

export type QueryMode = 'consulta' | 'caso';

export type ScopeFilter = 'todos' | 'general' | 'salud';

export interface RegulationChunk {
  id: string;
  documentId: string;
  documentTitle: string;
  decreeNumber: string;
  decreeDate: string;
  version: string;
  scope: DocumentScope;
  pageNumber: number;
  pageEnd: number;
  titleSection: string;
  chapterSection: string;
  articleNumber: string;
  articleTitle: string;
  clauses: string[];
  text: string;
  normalizedText: string;
  embedding?: number[];
}

export interface RegulationDocument {
  id: string;
  slotKey?: string;
  title: string;
  decreeNumber: string;
  decreeDate: string;
  version: string;
  scope: DocumentScope;
  status: DocumentStatus;
  processingStatus: ProcessingStatus;
  processingError?: string;
  sourceType: 'upload' | 'google_drive';
  sourceRef: string;
  pageCount: number;
  chunkCount: number;
  articleCount: number;
  extractedChars: number;
  uploadedAt: string;
  updatedAt: string;
  supersededBy?: string;
  notes?: string;
  hasPdfFile: boolean;
}

export interface ExpectedOfficialSlot {
  slotKey: string;
  decreeNumber: string;
  expectedTitle: string;
  scope: DocumentScope;
  description: string;
  loadedDocument?: RegulationDocument;
}

export interface CitationRef {
  chunkId: string;
  documentId: string;
  documentTitle: string;
  decreeNumber: string;
  version: string;
  scope: DocumentScope;
  articleNumber: string;
  pageNumber: number;
  pageEnd: number;
  sectionHierarchy: string;
  clauses: string[];
  excerpt: string;
  verified: boolean;
}

export interface ActiveDocSummary {
  id: string;
  title: string;
  decreeNumber: string;
  version: string;
  scope: DocumentScope;
  decreeDate: string;
}

export interface StructuredNormativeResponse {
  id: string;
  timestamp: string;
  question: string;
  mode: QueryMode;
  scopeFilter: ScopeFilter;
  hasSufficientEvidence: boolean;
  scopeDetected: string;
  respuesta: string;
  fundamentoNormativo: string;
  comoProceder: string[];
  consideraciones: string[];
  conflictosNormativos?: string;
  requiereAutoridad?: string;
  obligacionVsRecomendacion?: string;
  citations: CitationRef[];
  activeDocumentsUsed: ActiveDocSummary[];
  disclaimer: string;
}

export interface RepositoryStatusResponse {
  activeDocuments: RegulationDocument[];
  allDocuments: RegulationDocument[];
  expectedSlots: ExpectedOfficialSlot[];
  totalActiveChunks: number;
  lastUpdatedAt: string | null;
}
