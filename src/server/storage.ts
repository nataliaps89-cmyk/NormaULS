import fs from 'fs';
import path from 'path';
import type {
  DocumentScope,
  ExpectedOfficialSlot,
  RegulationChunk,
  RegulationDocument,
  RepositoryStatusResponse,
} from '../shared/types.ts';
import { buildRegulationChunks, extractPdfPages } from './pdfProcessor.ts';

const DATA_DIR = path.resolve(process.cwd(), 'data');
const PDF_DIR = path.join(DATA_DIR, 'pdfs');
const REPO_FILE = path.join(DATA_DIR, 'repository.json');

interface PersistedRepository {
  documents: RegulationDocument[];
  chunks: RegulationChunk[];
  lastUpdatedAt: string | null;
}

export interface BundledOfficialDocSpec {
  id: string;
  slotKey: string;
  assetRelativePath: string;
  title: string;
  decreeNumber: string;
  decreeDate: string;
  version: string;
  scope: DocumentScope;
  description: string;
  notes: string;
}

export const BUNDLED_OFFICIAL_DOCS: BundledOfficialDocSpec[] = [
  {
    id: 'doc_uls_245_2025',
    slotKey: 'uls-245-2025',
    assetRelativePath: 'public/assets/aistudio/reglamento_regimen_estudios_N_245_85dc5967.pdf',
    title: 'Reglamento de Régimen de Estudio de la Universidad de La Serena',
    decreeNumber: '245/2025',
    decreeDate: '21 de abril de 2025',
    version: '2025.1',
    scope: 'general',
    description:
      'Aprueba modificaciones al Decreto Exento N.º 028/2010 y fija texto refundido del Reglamento Régimen de Estudio (evaluaciones, plazos de notas, asistencia, justificativos, eliminación, suspensión y ajustes razonables).',
    notes: 'Texto refundido vigente aprobado mediante Decreto Exento N.º 245 de fecha 21 de abril de 2025.',
  },
  {
    id: 'doc_uls_417_2022',
    slotKey: 'uls-417-2022',
    assetRelativePath: 'public/assets/aistudio/N_417__REGLAMENTO_CARRERAS_SALUD__2__1e12c1ab.pdf',
    title: 'Reglamento de Régimen de Estudio Específico para las Carreras del Área de la Salud',
    decreeNumber: '417/2022',
    decreeDate: '16 de agosto de 2022',
    version: '2022.1',
    scope: 'salud',
    description:
      'Normativa complementaria para las carreras de Enfermería, Kinesiología y Odontología de la Facultad de Ciencias (prácticas clínicas, laboratorios, preclínicos, asistencia, evaluación, presentación personal y responsabilidad disciplinaria).',
    notes: 'Regulariza y aprueba el Reglamento Específico para las Carreras del Área de la Salud de la Facultad de Ciencias.',
  },
];

function ensureDirs(): void {
  if (!fs.existsSync(DATA_DIR)) {
    fs.mkdirSync(DATA_DIR, { recursive: true });
  }
  if (!fs.existsSync(PDF_DIR)) {
    fs.mkdirSync(PDF_DIR, { recursive: true });
  }
}

let state: PersistedRepository = {
  documents: [],
  chunks: [],
  lastUpdatedAt: null,
};

function loadFromDisk(): void {
  ensureDirs();
  if (!fs.existsSync(REPO_FILE)) {
    saveToDisk();
    return;
  }
  try {
    const raw = fs.readFileSync(REPO_FILE, 'utf8');
    const parsed = JSON.parse(raw) as PersistedRepository;
    state = {
      documents: Array.isArray(parsed.documents) ? parsed.documents : [],
      chunks: Array.isArray(parsed.chunks) ? parsed.chunks : [],
      lastUpdatedAt: parsed.lastUpdatedAt || null,
    };
  } catch {
    state = { documents: [], chunks: [], lastUpdatedAt: null };
  }
}

export function saveToDisk(): void {
  ensureDirs();
  const tmpFile = `${REPO_FILE}.tmp`;
  fs.writeFileSync(tmpFile, JSON.stringify(state), 'utf8');
  fs.renameSync(tmpFile, REPO_FILE);
}

loadFromDisk();

export async function bootstrapOfficialDocuments(forceReindex = false): Promise<void> {
  ensureDirs();
  let changed = false;

  for (const spec of BUNDLED_OFFICIAL_DOCS) {
    const existing = state.documents.find((d) => d.id === spec.id || d.slotKey === spec.slotKey);
    if (existing && existing.processingStatus === 'procesado' && !forceReindex) {
      // Ensure PDF copy exists in storage
      const targetPdf = getPdfPath(existing.id);
      const sourcePath = path.resolve(process.cwd(), spec.assetRelativePath);
      if (!fs.existsSync(targetPdf) && fs.existsSync(sourcePath)) {
        fs.copyFileSync(sourcePath, targetPdf);
      }
      continue;
    }

    const fullPath = path.resolve(process.cwd(), spec.assetRelativePath);
    if (!fs.existsSync(fullPath)) {
      console.error(`Archivo oficial no encontrado en ${fullPath}`);
      continue;
    }

    const buffer = fs.readFileSync(fullPath);
    const extraction = await extractPdfPages(buffer);
    const now = new Date().toISOString();

    // Remove previous copy of this bundled doc if re-indexing
    state.documents = state.documents.filter((d) => d.id !== spec.id && d.slotKey !== spec.slotKey);
    state.chunks = state.chunks.filter((c) => c.documentId !== spec.id);

    if (!extraction.ok) {
      state.documents.push({
        id: spec.id,
        slotKey: spec.slotKey,
        title: spec.title,
        decreeNumber: spec.decreeNumber,
        decreeDate: spec.decreeDate,
        version: spec.version,
        scope: spec.scope,
        status: 'error',
        processingStatus: 'error',
        processingError: extraction.error,
        sourceType: 'upload',
        sourceRef: spec.assetRelativePath,
        pageCount: extraction.pageCount,
        chunkCount: 0,
        articleCount: 0,
        extractedChars: extraction.extractedChars,
        uploadedAt: now,
        updatedAt: now,
        notes: spec.notes,
        hasPdfFile: false,
      });
      changed = true;
      continue;
    }

    const { chunks, articleCount } = buildRegulationChunks({
      documentId: spec.id,
      documentTitle: spec.title,
      decreeNumber: spec.decreeNumber,
      decreeDate: spec.decreeDate,
      version: spec.version,
      scope: spec.scope,
      pages: extraction.pages,
    });

    savePdfFile(spec.id, buffer);

    state.documents.push({
      id: spec.id,
      slotKey: spec.slotKey,
      title: spec.title,
      decreeNumber: spec.decreeNumber,
      decreeDate: spec.decreeDate,
      version: spec.version,
      scope: spec.scope,
      status: existing?.status === 'obsoleto' ? 'obsoleto' : 'vigente',
      processingStatus: 'procesado',
      sourceType: 'upload',
      sourceRef: path.basename(spec.assetRelativePath),
      pageCount: extraction.pageCount,
      chunkCount: chunks.length,
      articleCount,
      extractedChars: extraction.extractedChars,
      uploadedAt: existing?.uploadedAt || now,
      updatedAt: now,
      notes: spec.notes,
      hasPdfFile: true,
    });

    state.chunks.push(...chunks);
    state.lastUpdatedAt = now;
    changed = true;
  }

  if (changed) {
    saveToDisk();
  }
}

export function getPdfPath(documentId: string): string {
  return path.join(PDF_DIR, `${documentId}.pdf`);
}

export function savePdfFile(documentId: string, buffer: Buffer): void {
  ensureDirs();
  fs.writeFileSync(getPdfPath(documentId), buffer);
}

export function getAllDocuments(): RegulationDocument[] {
  return [...state.documents].sort((a, b) => a.decreeNumber.localeCompare(b.decreeNumber));
}

export function getActiveDocuments(): RegulationDocument[] {
  return getAllDocuments().filter((d) => d.status === 'vigente' && d.processingStatus === 'procesado');
}

export function getDocumentById(id: string): RegulationDocument | undefined {
  return state.documents.find((d) => d.id === id);
}

export function getChunksByDocumentId(documentId: string): RegulationChunk[] {
  return state.chunks.filter((c) => c.documentId === documentId);
}

export function getActiveChunks(): RegulationChunk[] {
  const activeIds = new Set(getActiveDocuments().map((d) => d.id));
  return state.chunks.filter((c) => activeIds.has(c.documentId));
}

export function getUnembeddedChunks(): RegulationChunk[] {
  return state.chunks.filter((c) => !Array.isArray(c.embedding) || c.embedding.length === 0);
}

export function updateDocumentMetadata(
  documentId: string,
  updates: Partial<
    Pick<
      RegulationDocument,
      'title' | 'decreeNumber' | 'decreeDate' | 'version' | 'scope' | 'status' | 'notes' | 'slotKey'
    >
  >
): RegulationDocument | null {
  const doc = state.documents.find((d) => d.id === documentId);
  if (!doc) return null;

  Object.assign(doc, updates, { updatedAt: new Date().toISOString() });

  for (const chunk of state.chunks) {
    if (chunk.documentId === documentId) {
      chunk.documentTitle = doc.title;
      chunk.decreeNumber = doc.decreeNumber;
      chunk.decreeDate = doc.decreeDate;
      chunk.version = doc.version;
      chunk.scope = doc.scope;
    }
  }

  state.lastUpdatedAt = new Date().toISOString();
  saveToDisk();
  return doc;
}

export function getRepositoryStatus(): RepositoryStatusResponse {
  const allDocs = getAllDocuments();
  const activeDocs = getActiveDocuments();

  const expectedSlots: ExpectedOfficialSlot[] = BUNDLED_OFFICIAL_DOCS.map((spec) => {
    const match =
      activeDocs.find((d) => d.slotKey === spec.slotKey || d.id === spec.id) ||
      allDocs.find((d) => d.slotKey === spec.slotKey || d.id === spec.id);

    return {
      slotKey: spec.slotKey,
      decreeNumber: spec.decreeNumber,
      expectedTitle: spec.title,
      scope: spec.scope,
      description: spec.description,
      loadedDocument: match,
    };
  });

  return {
    activeDocuments: activeDocs,
    allDocuments: allDocs,
    expectedSlots,
    totalActiveChunks: getActiveChunks().length,
    lastUpdatedAt: state.lastUpdatedAt,
  };
}
