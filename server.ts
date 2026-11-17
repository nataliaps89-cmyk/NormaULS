import 'dotenv/config';
import fs from 'fs';
import path from 'path';
import express from 'express';
import { createServer as createViteServer } from 'vite';
import type { QueryMode, ScopeFilter } from './src/shared/types.ts';
import {
  clearAdminSessionCookie,
  createSessionToken,
  isAdminAuthenticated,
  requireAdminAuth,
  setAdminSessionCookie,
  verifyAdminPassword,
} from './src/server/auth.ts';
import { normalizeSpanishText } from './src/server/pdfProcessor.ts';
import { embedChunksBatch, runNormativeQuery } from './src/server/ragEngine.ts';
import {
  bootstrapOfficialDocuments,
  getActiveDocuments,
  getAllDocuments,
  getChunksByDocumentId,
  getDocumentById,
  getPdfPath,
  getRepositoryStatus,
  getUnembeddedChunks,
  saveToDisk,
  updateDocumentMetadata,
} from './src/server/storage.ts';

const PORT = Number(process.env.PORT) || 3000;
const app = express();

app.use(express.json({ limit: '2mb' }));

// ========================
// PUBLIC API ROUTES
// ========================

app.get('/api/health', (_req, res) => {
  const status = getRepositoryStatus();
  res.json({
    ok: true,
    activeDocuments: status.activeDocuments.length,
    totalActiveChunks: status.totalActiveChunks,
  });
});

app.get('/api/repository/status', (_req, res) => {
  res.json(getRepositoryStatus());
});

app.get('/api/documents/active', (_req, res) => {
  res.json({ documents: getActiveDocuments() });
});

app.get('/api/documents/:id/chunks', (req, res) => {
  const doc = getDocumentById(req.params.id);
  if (!doc) {
    res.status(404).json({ error: 'Documento no encontrado.' });
    return;
  }
  if (doc.status !== 'vigente' && !isAdminAuthenticated(req)) {
    res.status(403).json({ error: 'Este documento no está vigente.' });
    return;
  }
  const q = typeof req.query.q === 'string' ? normalizeSpanishText(req.query.q) : '';
  const allChunks = getChunksByDocumentId(doc.id).map(({ embedding: _emb, normalizedText, ...rest }) => ({
    ...rest,
    _norm: normalizedText,
  }));

  const filtered = q ? allChunks.filter((c) => c._norm.includes(q)) : allChunks;

  res.json({
    document: doc,
    chunks: filtered.map(({ _norm, ...rest }) => rest),
  });
});

app.get('/api/documents/:id/pdf', (req, res) => {
  const doc = getDocumentById(req.params.id);
  if (!doc) {
    res.status(404).json({ error: 'Documento no encontrado.' });
    return;
  }
  if (doc.status !== 'vigente' && !isAdminAuthenticated(req)) {
    res.status(403).json({ error: 'Documento no disponible públicamente.' });
    return;
  }
  const pdfPath = getPdfPath(doc.id);
  if (!fs.existsSync(pdfPath)) {
    res.status(404).json({ error: 'Archivo PDF original no encontrado en el almacenamiento.' });
    return;
  }
  res.setHeader('Content-Type', 'application/pdf');
  res.setHeader(
    'Content-Disposition',
    `inline; filename="${encodeURIComponent(doc.decreeNumber || doc.id)}.pdf"`
  );
  fs.createReadStream(pdfPath).pipe(res);
});

app.post('/api/query', async (req, res) => {
  try {
    const rawQuestion = typeof req.body?.question === 'string' ? req.body.question.trim() : '';
    const mode: QueryMode = req.body?.mode === 'caso' ? 'caso' : 'consulta';
    const scopeFilter: ScopeFilter =
      req.body?.scopeFilter === 'general' || req.body?.scopeFilter === 'salud'
        ? req.body.scopeFilter
        : 'todos';

    if (!rawQuestion || rawQuestion.length < 4) {
      res.status(400).json({ error: 'Ingrese una pregunta o descripción de caso válida (mínimo 4 caracteres).' });
      return;
    }

    if (rawQuestion.length > 4000) {
      res.status(400).json({ error: 'La consulta excede el límite máximo de 4.000 caracteres.' });
      return;
    }

    const result = await runNormativeQuery({
      question: rawQuestion,
      mode,
      scopeFilter,
    });

    res.json(result);
  } catch (err) {
    console.error('Error en /api/query:', err);
    const message = err instanceof Error ? err.message : 'Error interno al procesar la consulta normativa.';
    res.status(500).json({ error: message });
  }
});

// ========================
// ADMIN AUTHENTICATION
// ========================

app.get('/api/admin/session', (req, res) => {
  res.json({ authenticated: isAdminAuthenticated(req) });
});

app.post('/api/admin/login', (req, res) => {
  const code = typeof req.body?.accessCode === 'string' ? req.body.accessCode : '';
  if (!verifyAdminPassword(code)) {
    res.status(401).json({ error: 'Código de acceso administrativo incorrecto.' });
    return;
  }
  const token = createSessionToken();
  setAdminSessionCookie(res, token);
  res.json({ authenticated: true });
});

app.post('/api/admin/logout', (_req, res) => {
  clearAdminSessionCookie(res);
  res.json({ authenticated: false });
});

// ========================
// PROTECTED ADMIN ROUTES
// ========================

app.get('/api/admin/documents', requireAdminAuth, (_req, res) => {
  res.json(getRepositoryStatus());
});

app.post('/api/admin/documents/reindex', requireAdminAuth, async (_req, res) => {
  try {
    await bootstrapOfficialDocuments(true);
    const pending = getUnembeddedChunks();
    let embedded = 0;
    if (pending.length > 0) {
      embedded = await embedChunksBatch(pending);
      if (embedded > 0) saveToDisk();
    }
    res.json({
      ok: true,
      embeddedChunks: embedded,
      status: getRepositoryStatus(),
    });
  } catch (err) {
    const msg = err instanceof Error ? err.message : 'Error al reprocesar los reglamentos.';
    res.status(500).json({ error: msg });
  }
});

app.patch('/api/admin/documents/:id', requireAdminAuth, (req, res) => {
  const allowed = ['title', 'decreeNumber', 'decreeDate', 'version', 'scope', 'status', 'notes'] as const;
  const updates: Record<string, unknown> = {};
  for (const key of allowed) {
    if (req.body?.[key] !== undefined) {
      updates[key] = req.body[key];
    }
  }
  const updated = updateDocumentMetadata(req.params.id, updates);
  if (!updated) {
    res.status(404).json({ error: 'Documento no encontrado.' });
    return;
  }
  res.json({ document: updated });
});

app.get('/api/admin/verify-citations', requireAdminAuth, (req, res) => {
  const q = typeof req.query.q === 'string' ? normalizeSpanishText(req.query.q) : '';
  const docs = getAllDocuments();
  const matches: Array<{
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
  }> = [];

  for (const doc of docs) {
    const chunks = getChunksByDocumentId(doc.id);
    for (const c of chunks) {
      if (!q || c.normalizedText.includes(q)) {
        matches.push({
          chunkId: c.id,
          documentId: doc.id,
          documentTitle: doc.title,
          decreeNumber: doc.decreeNumber,
          version: doc.version,
          status: doc.status,
          articleNumber: c.articleNumber,
          pageNumber: c.pageNumber,
          sectionHierarchy: [c.titleSection, c.chapterSection].filter(Boolean).join(' · '),
          text: c.text,
        });
      }
      if (matches.length >= 60) break;
    }
    if (matches.length >= 60) break;
  }

  res.json({ matches });
});

async function startServer() {
  await bootstrapOfficialDocuments(false);

  const pending = getUnembeddedChunks();
  if (pending.length > 0) {
    const count = await embedChunksBatch(pending);
    if (count > 0) {
      saveToDisk();
      console.log(`Embeddings semánticos indexados para ${count} fragmentos normativos.`);
    }
  }

  if (process.env.NODE_ENV !== 'production') {
    const vite = await createViteServer({
      server: { middlewareMode: true },
      appType: 'spa',
    });
    app.use(vite.middlewares);
  } else {
    const distDir = path.resolve(process.cwd(), 'dist');
    app.use(express.static(distDir));
    app.get('*', (_req, res) => {
      res.sendFile(path.join(distDir, 'index.html'));
    });
  }

  app.listen(PORT, '0.0.0.0', () => {
    const status = getRepositoryStatus();
    console.log(
      `NormaULS activo en http://0.0.0.0:${PORT} (${status.activeDocuments.length} reglamentos vigentes, ${status.totalActiveChunks} fragmentos)`
    );
  });
}

startServer();
