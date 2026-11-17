import crypto from 'crypto';
import path from 'path';
import { pathToFileURL } from 'url';
import * as pdfjsLib from 'pdfjs-dist/legacy/build/pdf.mjs';
import type { DocumentScope, RegulationChunk } from '../shared/types.ts';

const workerPath = path.resolve(process.cwd(), 'node_modules/pdfjs-dist/legacy/build/pdf.worker.mjs');
pdfjsLib.GlobalWorkerOptions.workerSrc = pathToFileURL(workerPath).href;

export interface ExtractedPage {
  pageNumber: number;
  text: string;
  lines: string[];
}

export interface PdfExtractionResult {
  ok: boolean;
  pageCount: number;
  extractedChars: number;
  pages: ExtractedPage[];
  detectedDecreeNumber?: string;
  detectedTitle?: string;
  detectedDate?: string;
  error?: string;
}

export function normalizeSpanishText(input: string): string {
  return input
    .toLowerCase()
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .replace(/[^\p{L}\p{N}\s°º.-]/gu, ' ')
    .replace(/\s+/g, ' ')
    .trim();
}

export async function extractPdfPages(buffer: Buffer): Promise<PdfExtractionResult> {
  if (!buffer || buffer.length < 16 || buffer.subarray(0, 5).toString('ascii') !== '%PDF-') {
    return {
      ok: false,
      pageCount: 0,
      extractedChars: 0,
      pages: [],
      error: 'El archivo proporcionado no corresponde a un documento PDF válido (encabezado %PDF- ausente).',
    };
  }

  try {
    const loadingTask = pdfjsLib.getDocument({
      data: new Uint8Array(buffer),
      useSystemFonts: true,
      disableFontFace: true,
      verbosity: 0,
    });

    const pdf = await loadingTask.promise;
    const pageCount = pdf.numPages;
    const pages: ExtractedPage[] = [];
    let totalChars = 0;

    for (let pageNum = 1; pageNum <= pageCount; pageNum++) {
      const page = await pdf.getPage(pageNum);
      const textContent = await page.getTextContent();

      interface PositionedItem {
        str: string;
        x: number;
        y: number;
      }

      const items: PositionedItem[] = [];
      for (const rawItem of textContent.items) {
        if ('str' in rawItem && typeof rawItem.str === 'string') {
          const tx = rawItem.transform as number[] | undefined;
          const x = tx ? tx[4] : 0;
          const y = tx ? tx[5] : 0;
          items.push({ str: rawItem.str, x, y });
        }
      }

      items.sort((a, b) => {
        if (Math.abs(a.y - b.y) > 3.5) return b.y - a.y;
        return a.x - b.x;
      });

      const lines: string[] = [];
      let currentLineY: number | null = null;
      let currentTokens: PositionedItem[] = [];

      const flushLine = () => {
        if (currentTokens.length === 0) return;
        currentTokens.sort((a, b) => a.x - b.x);
        let lineText = '';
        let prevEndX = -Infinity;
        for (const tok of currentTokens) {
          const piece = tok.str;
          if (!piece) continue;
          if (lineText.length > 0 && !lineText.endsWith(' ') && !piece.startsWith(' ')) {
            if (tok.x - prevEndX > 2.5) {
              lineText += ' ';
            }
          }
          lineText += piece;
          prevEndX = tok.x + piece.length * 4.2;
        }
        const cleaned = lineText.replace(/\s+/g, ' ').trim();
        if (cleaned) lines.push(cleaned);
        currentTokens = [];
      };

      for (const item of items) {
        if (currentLineY === null || Math.abs(item.y - currentLineY) <= 3.5) {
          if (currentLineY === null) currentLineY = item.y;
          currentTokens.push(item);
        } else {
          flushLine();
          currentLineY = item.y;
          currentTokens.push(item);
        }
      }
      flushLine();

      const pageText = lines.join('\n');
      totalChars += pageText.length;
      pages.push({ pageNumber: pageNum, text: pageText, lines });
    }

    if (typeof pdf.cleanup === 'function') {
      await pdf.cleanup();
    }

    if (pageCount === 0 || totalChars < 80) {
      return {
        ok: false,
        pageCount,
        extractedChars: totalChars,
        pages,
        error:
          'El PDF fue leído pero no contiene suficiente texto seleccionable (posible documento escaneado como imagen sin OCR).',
      };
    }

    const headText = pages
      .slice(0, 2)
      .map((p) => p.text)
      .join('\n');

    const decreeMatch = headText.match(/DECRETO\s+(?:EXENTO\s+)?N[°º.]?\s*(\d{2,4}(?:\s*\/\s*\d{4})?)/i);

    return {
      ok: true,
      pageCount,
      extractedChars: totalChars,
      pages,
      detectedDecreeNumber: decreeMatch ? decreeMatch[1].replace(/\s+/g, '') : undefined,
    };
  } catch (err) {
    const message = err instanceof Error ? err.message : 'Error desconocido al analizar el archivo PDF.';
    return {
      ok: false,
      pageCount: 0,
      extractedChars: 0,
      pages: [],
      error: `Error al procesar el PDF: ${message}`,
    };
  }
}

interface BuildingArticle {
  titleSection: string;
  chapterSection: string;
  articleNumber: string;
  articleTitle: string;
  pageStart: number;
  pageEnd: number;
  lines: string[];
}

const TITLE_REGEX = /^(T[ÍI]TULO\s+[IVXLCDM\d]+(?:\s*[:.\-–]?\s*.*)?)$/i;
const CHAPTER_REGEX = /^(CAP[ÍI]TULO\s+[IVXLCDM\d]+(?:\s*[:.\-–]?\s*.*)?|P[ÁA]RRAFO\s+[IVXLCDM\d]+(?:\s*[:.\-–]?\s*.*)?)$/i;
const ARTICLE_REGEX =
  /^(?:ART[ÍI]CULO|Art[íi]culo|ARTICULO)\s+(?:N[°º.]?\s*)?(\d+(?:\s*(?:bis|ter|quater))?|[ÚU]NICO|[Pp]rimero|[Ss]egundo|[Tt]ercero|[Cc]uarto|[Qq]uinto)\s*(?:[°º]\s*[:.\-–]?|[:.\-–])\s*(.*)$/;
const CLAUSE_REGEX = /^(?:([a-z]|[ivx]{1,4})\)|(\d{1,2})\.-|\(([a-z]|\d{1,2})\)|Inciso\s+\w+)/i;

function isRunningHeaderOrPageNumber(line: string, pageNumber: number): boolean {
  if (/^(?:p[áa]gina\s+\d+(?:\s+de\s+\d+)?|[-–—]?\s*\d{1,3}\s*[-–—]?)$/i.test(line)) {
    return true;
  }
  if (pageNumber > 1 && /^Decreto\s+Exento\s+N[°º.]?\s*245,\s*de\s+fecha\s+21\s+de\s+abril\s+de\s+2025$/i.test(line)) {
    return true;
  }
  return false;
}

function isTitleSubtitleLine(line: string): boolean {
  if (line.length > 90) return false;
  if (ARTICLE_REGEX.test(line) || TITLE_REGEX.test(line) || CHAPTER_REGEX.test(line)) return false;
  const letters = line.replace(/[^A-Za-zÁÉÍÓÚÜÑáéíóúüñ]/g, '');
  if (letters.length < 4) return false;
  return line === line.toUpperCase();
}

function detectClauses(lines: string[]): string[] {
  const found = new Set<string>();
  let paragraphIdx = 0;
  for (const line of lines) {
    const match = line.match(CLAUSE_REGEX);
    if (match) {
      if (match[1]) found.add(`Literal ${match[1]})`);
      else if (match[2]) found.add(`Numeral ${match[2]}`);
      else if (match[3]) found.add(`(${match[3]})`);
      else found.add(match[0]);
    } else if (line.length > 40) {
      paragraphIdx++;
    }
  }
  if (found.size === 0 && paragraphIdx > 1) {
    return [`${paragraphIdx} incisos`];
  }
  return Array.from(found).slice(0, 12);
}

export function buildRegulationChunks(params: {
  documentId: string;
  documentTitle: string;
  decreeNumber: string;
  decreeDate: string;
  version: string;
  scope: DocumentScope;
  pages: ExtractedPage[];
}): { chunks: RegulationChunk[]; articleCount: number } {
  const { documentId, documentTitle, decreeNumber, decreeDate, version, scope, pages } = params;

  let currentTitleSection = 'Encabezado y Disposiciones Iniciales';
  let currentChapterSection = '';
  let awaitingTitleSubtitle = false;

  const articles: BuildingArticle[] = [];
  let currentArticle: BuildingArticle | null = null;

  const flushArticle = () => {
    if (currentArticle && currentArticle.lines.join(' ').trim().length > 10) {
      articles.push(currentArticle);
    }
    currentArticle = null;
  };

  for (const page of pages) {
    for (const rawLine of page.lines) {
      const line = rawLine.trim();
      if (!line) continue;

      if (isRunningHeaderOrPageNumber(line, page.pageNumber)) {
        continue;
      }

      if (TITLE_REGEX.test(line) && line.length < 130) {
        flushArticle();
        currentTitleSection = line;
        currentChapterSection = '';
        awaitingTitleSubtitle = true;
        continue;
      }

      if (awaitingTitleSubtitle) {
        if (isTitleSubtitleLine(line)) {
          currentTitleSection = `${currentTitleSection} — ${line}`;
          continue;
        }
        awaitingTitleSubtitle = false;
      }

      if (CHAPTER_REGEX.test(line) && line.length < 130) {
        flushArticle();
        currentChapterSection = line;
        continue;
      }

      const artMatch = line.match(ARTICLE_REGEX);
      if (artMatch) {
        flushArticle();
        const artNum = artMatch[1].trim();
        const remainder = (artMatch[2] || '').trim();
        currentArticle = {
          titleSection: currentTitleSection,
          chapterSection: currentChapterSection,
          articleNumber: `Artículo ${artNum}`,
          articleTitle: remainder.length > 0 && remainder.length < 95 ? remainder : '',
          pageStart: page.pageNumber,
          pageEnd: page.pageNumber,
          lines: [line],
        };
        continue;
      }

      if (!currentArticle) {
        currentArticle = {
          titleSection: currentTitleSection,
          chapterSection: currentChapterSection,
          articleNumber: `Encabezado / Pág. ${page.pageNumber}`,
          articleTitle: '',
          pageStart: page.pageNumber,
          pageEnd: page.pageNumber,
          lines: [line],
        };
      } else {
        currentArticle.pageEnd = page.pageNumber;
        currentArticle.lines.push(line);
      }
    }
  }
  flushArticle();

  const chunks: RegulationChunk[] = [];
  const distinctArticles = new Set<string>();
  const MAX_CHUNK_CHARS = 2400;

  for (const art of articles) {
    if (art.articleNumber.startsWith('Artículo ')) {
      distinctArticles.add(art.articleNumber);
    }
    const fullText = art.lines.join('\n').trim();

    if (fullText.length <= MAX_CHUNK_CHARS) {
      chunks.push({
        id: `${documentId}_c_${chunks.length + 1}_${crypto.randomBytes(3).toString('hex')}`,
        documentId,
        documentTitle,
        decreeNumber,
        decreeDate,
        version,
        scope,
        pageNumber: art.pageStart,
        pageEnd: art.pageEnd,
        titleSection: art.titleSection,
        chapterSection: art.chapterSection,
        articleNumber: art.articleNumber,
        articleTitle: art.articleTitle,
        clauses: detectClauses(art.lines),
        text: fullText,
        normalizedText: normalizeSpanishText(
          `${documentTitle} ${decreeNumber} ${art.titleSection} ${art.chapterSection} ${art.articleNumber} ${fullText}`
        ),
      });
    } else {
      let bufferLines: string[] = [];
      let bufferLen = 0;
      let partIdx = 1;

      for (const ln of art.lines) {
        if (bufferLen + ln.length > MAX_CHUNK_CHARS && bufferLines.length > 0) {
          const partText = bufferLines.join('\n').trim();
          chunks.push({
            id: `${documentId}_c_${chunks.length + 1}_${crypto.randomBytes(3).toString('hex')}`,
            documentId,
            documentTitle,
            decreeNumber,
            decreeDate,
            version,
            scope,
            pageNumber: art.pageStart,
            pageEnd: art.pageEnd,
            titleSection: art.titleSection,
            chapterSection: art.chapterSection,
            articleNumber: `${art.articleNumber} (Parte ${partIdx})`,
            articleTitle: art.articleTitle,
            clauses: detectClauses(bufferLines),
            text: partText,
            normalizedText: normalizeSpanishText(
              `${documentTitle} ${decreeNumber} ${art.titleSection} ${art.chapterSection} ${art.articleNumber} ${partText}`
            ),
          });
          partIdx++;
          bufferLines = [];
          bufferLen = 0;
        }
        bufferLines.push(ln);
        bufferLen += ln.length + 1;
      }

      if (bufferLines.length > 0) {
        const partText = bufferLines.join('\n').trim();
        chunks.push({
          id: `${documentId}_c_${chunks.length + 1}_${crypto.randomBytes(3).toString('hex')}`,
          documentId,
          documentTitle,
          decreeNumber,
          decreeDate,
          version,
          scope,
          pageNumber: art.pageStart,
          pageEnd: art.pageEnd,
          titleSection: art.titleSection,
          chapterSection: art.chapterSection,
          articleNumber: `${art.articleNumber} (Parte ${partIdx})`,
          articleTitle: art.articleTitle,
          clauses: detectClauses(bufferLines),
          text: partText,
          normalizedText: normalizeSpanishText(
            `${documentTitle} ${decreeNumber} ${art.titleSection} ${art.chapterSection} ${art.articleNumber} ${partText}`
          ),
        });
      }
    }
  }

  return {
    chunks,
    articleCount: distinctArticles.size || articles.length,
  };
}
