import crypto from 'crypto';
import { GoogleGenAI, ThinkingLevel, Type } from '@google/genai';
import type {
  ActiveDocSummary,
  CitationRef,
  QueryMode,
  RegulationChunk,
  ScopeFilter,
  StructuredNormativeResponse,
} from '../shared/types.ts';
import { normalizeSpanishText } from './pdfProcessor.ts';
import { getActiveChunks, getActiveDocuments } from './storage.ts';

const DISCLAIMER_TEXT =
  'Esta respuesta es de carácter orientativo y se basa exclusivamente en los documentos oficiales vigentes cargados en el repositorio de NormaULS. No sustituye las resoluciones formales de la Dirección de Escuela, Decanatura, Vicerrectoría Académica u otras autoridades universitarias competentes.';

const SPANISH_STOPWORDS = new Set([
  'el', 'la', 'los', 'las', 'un', 'una', 'unos', 'unas', 'de', 'del', 'al', 'a', 'en', 'con',
  'por', 'para', 'sin', 'sobre', 'entre', 'hacia', 'desde', 'hasta', 'que', 'cual', 'cuales',
  'como', 'cuando', 'donde', 'quien', 'quienes', 'cuyo', 'cuya', 'se', 'su', 'sus', 'mi', 'mis',
  'tu', 'tus', 'es', 'son', 'fue', 'fueron', 'ser', 'estar', 'esta', 'estan', 'hay', 'tengo',
  'tiene', 'tienen', 'debo', 'debe', 'deben', 'puede', 'pueden', 'puedo', 'si', 'no', 'ni', 'o',
  'u', 'y', 'e', 'pero', 'mas', 'muy', 'ya', 'tambien', 'solo', 'todo', 'toda', 'todos', 'todas',
  'este', 'esta', 'estos', 'estas', 'ese', 'esa', 'esos', 'esas', 'lo', 'le', 'les', 'me', 'nos',
  'caso', 'estudiante', 'estudiantes', 'docente', 'docentes', 'profesor', 'profesora', 'universidad',
]);

function getGeminiClient(): GoogleGenAI | null {
  const apiKey = process.env.GEMINI_API_KEY;
  if (!apiKey || apiKey === 'MY_GEMINI_API_KEY') return null;
  return new GoogleGenAI({
    apiKey,
    httpOptions: {
      headers: {
        'User-Agent': 'aistudio-build',
      },
    },
  });
}

function tokenizeSpanish(text: string): string[] {
  const norm = normalizeSpanishText(text);
  return norm
    .split(/\s+/)
    .map((t) => t.replace(/^[.-]+|[.-]+$/g, ''))
    .filter((t) => t.length >= 2 && !SPANISH_STOPWORDS.has(t));
}

const ACADEMIC_SYNONYMS: Record<string, string[]> = {
  nota: ['calificacion', 'calificaciones', 'promedio', 'evaluacion'],
  notas: ['calificaciones', 'calificacion', 'resultados', 'evaluativos'],
  calificacion: ['nota', 'notas', 'resultado'],
  calificaciones: ['notas', 'resultados', 'evaluativos'],
  entregar: ['conocer', 'publicar', 'informar', 'plazo'],
  tiempo: ['plazo', 'dias', 'habiles', 'duracion'],
  cuanto: ['plazo', 'dias', 'porcentaje', 'minimo'],
  recuperativa: ['equivalente', 'integrativa', 'recuperar', 'recuperacion', 'pendiente'],
  recuperar: ['recuperativa', 'equivalente', 'recuperacion'],
  justificativo: ['justificacion', 'justificar', 'certificado', 'medico', 'inasistencia'],
  justificativos: ['justificacion', 'justificar', 'certificado', 'medico', 'inasistencia'],
  asistencia: ['asistir', 'inasistencia', 'porcentaje', 'teoricas', 'practicas'],
  inasistencia: ['asistencia', 'ausencia', 'justificar', 'justificacion'],
  reprueba: ['reprobado', 'reprobados', 'eliminacion', 'segunda', 'tercera', 'oportunidad'],
  reprobar: ['reprobado', 'eliminacion', 'oportunidad', 'apelacion'],
  clinica: ['clinicas', 'clinico', 'practica', 'asistencial', 'salud'],
  clinicas: ['clinica', 'practicas', 'asistencial', 'salud'],
  practica: ['practicas', 'preclinico', 'clinica', 'laboratorio'],
  practicas: ['practica', 'preclinico', 'clinicas', 'laboratorio'],
};

function expandTokensWithSynonyms(tokens: string[]): string[] {
  const expanded = new Set<string>(tokens);
  for (const tok of tokens) {
    const syns = ACADEMIC_SYNONYMS[tok];
    if (syns) {
      for (const s of syns) expanded.add(s);
    }
  }
  return Array.from(expanded);
}

function cosineSimilarity(a: number[], b: number[]): number {
  if (!a || !b || a.length !== b.length || a.length === 0) return 0;
  let dot = 0;
  let normA = 0;
  let normB = 0;
  for (let i = 0; i < a.length; i++) {
    dot += a[i] * b[i];
    normA += a[i] * a[i];
    normB += b[i] * b[i];
  }
  const denom = Math.sqrt(normA) * Math.sqrt(normB);
  return denom > 0 ? dot / denom : 0;
}

export async function embedChunksBatch(chunks: RegulationChunk[]): Promise<number> {
  const ai = getGeminiClient();
  if (!ai || chunks.length === 0) return 0;

  let embeddedCount = 0;
  const BATCH_SIZE = 20;

  for (let i = 0; i < chunks.length; i += BATCH_SIZE) {
    const batch = chunks.slice(i, i + BATCH_SIZE);
    const contents = batch.map(
      (c) =>
        `${c.documentTitle} (Decreto ${c.decreeNumber}) - ${c.titleSection} - ${c.articleNumber} (Pág. ${c.pageNumber}):\n${c.text.slice(0, 1800)}`
    );

    try {
      const result = await ai.models.embedContent({
        model: 'gemini-embedding-2',
        contents,
      });

      const embeddings = result.embeddings || [];
      for (let j = 0; j < batch.length; j++) {
        const vec = embeddings[j]?.values;
        if (Array.isArray(vec) && vec.length > 0) {
          batch[j].embedding = vec;
          embeddedCount++;
        }
      }
    } catch (err) {
      console.warn('No se pudieron generar embeddings para un lote; se utilizará búsqueda léxica:', err);
      break;
    }
  }

  return embeddedCount;
}

async function embedQueryText(query: string): Promise<number[] | null> {
  const ai = getGeminiClient();
  if (!ai) return null;
  try {
    const result = await ai.models.embedContent({
      model: 'gemini-embedding-2',
      contents: query,
    });
    const vec = result.embeddings?.[0]?.values;
    return Array.isArray(vec) && vec.length > 0 ? vec : null;
  } catch {
    return null;
  }
}

function detectHealthContext(normalizedQuery: string): boolean {
  const healthTerms = [
    'salud', 'clinica', 'clinico', 'clinicas', 'clinicos', 'hospital', 'asistencial',
    'campo clinico', 'campos clinicos', 'internado', 'enfermeria', 'kinesiologia',
    'medicina', 'odontologia', '417', 'bioseguridad', 'inmunizacion', 'vacuna',
    'rotacion', 'tutor clinico', 'preclinico',
  ];
  return healthTerms.some((term) => normalizedQuery.includes(term));
}

function extractRequestedArticles(normalizedQuery: string): string[] {
  const matches: string[] = [];
  const regex = /(?:articulo|art\.?)\s*(?:n[°º.]?\s*)?(\d+|unico)/g;
  let m: RegExpExecArray | null;
  while ((m = regex.exec(normalizedQuery)) !== null) {
    matches.push(m[1]);
  }
  return matches;
}

function extractRequestedDecrees(normalizedQuery: string): string[] {
  const matches: string[] = [];
  const regex = /(\d{2,4}\s*\/\s*\d{4})/g;
  let m: RegExpExecArray | null;
  while ((m = regex.exec(normalizedQuery)) !== null) {
    matches.push(m[1].replace(/\s+/g, ''));
  }
  return matches;
}

export async function retrieveRelevantChunks(
  question: string,
  scopeFilter: ScopeFilter = 'todos',
  limit = 12
): Promise<{ chunks: RegulationChunk[]; healthMentioned: boolean }> {
  const allActiveChunks = getActiveChunks();
  const candidates = allActiveChunks.filter((c) => {
    if (scopeFilter === 'todos') return true;
    return c.scope === scopeFilter;
  });

  if (candidates.length === 0) {
    return { chunks: [], healthMentioned: false };
  }

  const normalizedQuery = normalizeSpanishText(question);
  const baseTokens = tokenizeSpanish(question);
  const expandedTokens = expandTokensWithSynonyms(baseTokens);
  const baseTokenSet = new Set(baseTokens);
  const healthMentioned = detectHealthContext(normalizedQuery);
  const requestedArticles = extractRequestedArticles(normalizedQuery);
  const requestedDecrees = extractRequestedDecrees(normalizedQuery);

  // Only embed query if at least one candidate has stored embeddings
  const hasEmbeddings = candidates.some((c) => Array.isArray(c.embedding) && c.embedding.length > 0);
  const queryEmbedding = hasEmbeddings ? await embedQueryText(question) : null;

  const scored = candidates.map((chunk) => {
    let lexicalScore = 0;
    const chunkNorm = chunk.normalizedText;
    const articleNorm = normalizeSpanishText(chunk.articleNumber);
    const titleNorm = normalizeSpanishText(`${chunk.titleSection} ${chunk.chapterSection}`);

    for (const token of expandedTokens) {
      const weight = baseTokenSet.has(token) ? 1.0 : 0.65;
      if (chunkNorm.includes(token)) {
        lexicalScore += 1.0 * weight;
        if (titleNorm.includes(token) || articleNorm.includes(token)) {
          lexicalScore += 1.2 * weight;
        }
      } else if (token.length >= 5) {
        const stem = token.slice(0, Math.min(token.length - 1, 6));
        if (chunkNorm.includes(stem)) {
          lexicalScore += 0.45 * weight;
        }
      }
    }

    const normalizedLexical = baseTokens.length > 0 ? lexicalScore / (baseTokens.length * 1.4) : 0;

    // Exact article match boost
    let structuralBoost = 0;
    for (const artNum of requestedArticles) {
      const artRegex = new RegExp(`\\barticulo\\s+${artNum}\\b`);
      if (artRegex.test(articleNorm)) {
        structuralBoost += 2.5;
      }
    }

    // Exact decree match boost
    const chunkDecreeNorm = chunk.decreeNumber.replace(/\s+/g, '');
    for (const dec of requestedDecrees) {
      if (chunkDecreeNorm === dec) {
        structuralBoost += 1.5;
      }
    }

    // Scope relevance boost
    if (healthMentioned && chunk.scope === 'salud') {
      structuralBoost += 0.4;
    }

    // Semantic vector similarity
    const semanticScore =
      queryEmbedding && chunk.embedding ? Math.max(0, cosineSimilarity(queryEmbedding, chunk.embedding)) : 0;

    const totalScore = queryEmbedding
      ? semanticScore * 1.35 + normalizedLexical * 0.9 + structuralBoost
      : normalizedLexical * 1.2 + structuralBoost;

    return { chunk, totalScore };
  });

  scored.sort((a, b) => b.totalScore - a.totalScore);

  const selected: RegulationChunk[] = [];
  const selectedIds = new Set<string>();

  for (const item of scored) {
    if (selected.length >= limit) break;
    if (item.totalScore <= 0 && selected.length >= 4) break;
    selected.push(item.chunk);
    selectedIds.add(item.chunk.id);
  }

  // Pull in sibling parts of split articles (e.g. "Artículo 14 (Parte 1)" -> "Artículo 14 (Parte 2)")
  const baseArticles = new Set(
    selected
      .filter((c) => c.articleNumber.includes('(Parte '))
      .map((c) => `${c.documentId}::${c.articleNumber.replace(/\s*\(Parte \d+\)/, '')}`)
  );

  if (baseArticles.size > 0) {
    for (const c of candidates) {
      const key = `${c.documentId}::${c.articleNumber.replace(/\s*\(Parte \d+\)/, '')}`;
      if (baseArticles.has(key) && !selectedIds.has(c.id) && selected.length < limit + 4) {
        selected.push(c);
        selectedIds.add(c.id);
      }
    }
  }

  return { chunks: selected, healthMentioned };
}

export async function runNormativeQuery(params: {
  question: string;
  mode: QueryMode;
  scopeFilter: ScopeFilter;
}): Promise<StructuredNormativeResponse> {
  const { question, mode, scopeFilter } = params;
  const activeDocs = getActiveDocuments();
  const scopedActiveDocs = activeDocs.filter((d) =>
    scopeFilter === 'todos' ? true : d.scope === scopeFilter
  );

  const activeDocSummaries: ActiveDocSummary[] = scopedActiveDocs.map((d) => ({
    id: d.id,
    title: d.title,
    decreeNumber: d.decreeNumber,
    version: d.version,
    scope: d.scope,
    decreeDate: d.decreeDate,
  }));

  const id = `q_${Date.now()}_${crypto.randomBytes(3).toString('hex')}`;
  const timestamp = new Date().toISOString();

  // Case 1: No active processed regulations in the repository (honesty rule: never simulate!)
  if (scopedActiveDocs.length === 0) {
    const scopeLabel =
      scopeFilter === 'salud'
        ? 'Carreras del Área de la Salud'
        : scopeFilter === 'general'
          ? 'Régimen de Estudio (General)'
          : 'Repositorio Normativo';

    return {
      id,
      timestamp,
      question,
      mode,
      scopeFilter,
      hasSufficientEvidence: false,
      scopeDetected: `Sin documentos cargados (${scopeLabel})`,
      respuesta:
        activeDocs.length === 0
          ? 'Actualmente no existen reglamentos oficiales procesados en el repositorio de NormaULS. Por regla estricta de confiabilidad, el asistente no responde con conocimiento previo ni inventa artículos, plazos o procedimientos sin respaldo documental verificado.'
          : `No existen documentos vigentes cargados para el ámbito seleccionado (${scopeLabel}). Pruebe cambiando el filtro a "Todos los reglamentos vigentes" o cargue la normativa correspondiente en el Panel de Administración.`,
      fundamentoNormativo:
        'Sin respaldo documental disponible: Decreto Exento N.º 245/2025 y/o Decreto Exento N.º 417/2022 pendientes de carga y procesamiento en el repositorio institucional.',
      comoProceder: [
        'Acceda al Panel de Administración (sección Administración en la barra superior).',
        'Cargue los archivos PDF oficiales (Decreto Exento N.º 245/2025 y Decreto Exento N.º 417/2022) desde su equipo o mediante enlace público de Google Drive.',
        'Una vez que el estado figure como "Procesado" y "Vigente", vuelva a ejecutar su consulta.',
      ],
      consideraciones: [
        'Este sistema no simula lectura de PDFs ni utiliza memoria externa para citar artículos.',
        'Si necesita orientación urgente mientras se cargan los reglamentos, consulte directamente con su Dirección de Escuela.',
      ],
      citations: [],
      activeDocumentsUsed: activeDocSummaries,
      disclaimer: DISCLAIMER_TEXT,
    };
  }

  const ai = getGeminiClient();
  if (!ai) {
    throw new Error(
      'La clave del servidor GEMINI_API_KEY no está configurada. Configure GEMINI_API_KEY en el panel Secrets del entorno.'
    );
  }

  const { chunks: retrievedChunks, healthMentioned } = await retrieveRelevantChunks(
    question,
    scopeFilter,
    14
  );

  if (retrievedChunks.length === 0) {
    return {
      id,
      timestamp,
      question,
      mode,
      scopeFilter,
      hasSufficientEvidence: false,
      scopeDetected: 'Sin fragmentos coincidentes',
      respuesta:
        'No se encontraron disposiciones pertinentes en los reglamentos vigentes cargados para responder a esta consulta con evidencia verificable.',
      fundamentoNormativo:
        'No se hallaron artículos coincidentes en los documentos vigentes consultados.',
      comoProceder: [
        'Reformule la consulta utilizando términos reglamentarios más amplios o revise los artículos directamente en la sección Documentos.',
        'Si la situación corresponde a una materia no regulada en los decretos cargados, consulte directamente con su Dirección de Escuela.',
      ],
      consideraciones: [
        'Se revisaron los documentos vigentes del repositorio sin encontrar respaldo expreso para la pregunta.',
      ],
      citations: [],
      activeDocumentsUsed: activeDocSummaries,
      disclaimer: DISCLAIMER_TEXT,
    };
  }

  const chunkMap = new Map<string, RegulationChunk>();
  for (const c of retrievedChunks) {
    chunkMap.set(c.id, c);
  }

  const formattedContext = retrievedChunks
    .map((c, idx) => {
      const sectionPath = [c.titleSection, c.chapterSection].filter(Boolean).join(' > ');
      const scopeText =
        c.scope === 'salud'
          ? 'Específico Área de la Salud'
          : c.scope === 'general'
            ? 'General (Régimen de Estudio)'
            : 'Complementario';
      return [
        `=== FRAGMENTO ${idx + 1} ===`,
        `CHUNK_ID: ${c.id}`,
        `REGLAMENTO: ${c.documentTitle}`,
        `DECRETO: ${c.decreeNumber}${c.decreeDate ? ` (${c.decreeDate})` : ''} | VERSIÓN: ${c.version}`,
        `ÁMBITO: ${scopeText}`,
        `UBICACIÓN: ${sectionPath || 'General'} | ${c.articleNumber} | PDF Pág. ${c.pageNumber}${c.pageEnd > c.pageNumber ? `–${c.pageEnd}` : ''}`,
        `TEXTO VERBATIM:`,
        c.text,
      ].join('\n');
    })
    .join('\n\n');

  const activeCatalogText = scopedActiveDocs
    .map(
      (d) =>
        `- ${d.title} | Decreto ${d.decreeNumber} | Versión ${d.version} | Ámbito: ${d.scope} | Páginas: ${d.pageCount}`
    )
    .join('\n');

  const systemInstruction = `Eres "NormaULS", asistente jurídico-académico de consulta reglamentaria para docentes de la Universidad de La Serena (Chile).

DOCUMENTOS VIGENTES EN REPOSITORIO:
${activeCatalogText}

RELACIÓN NORMATIVA ENTRE DECRETOS CARGADOS:
- El Decreto Exento N.º 245/2025 aprueba las modificaciones al Decreto Exento N.º 028/2010 y fija el texto refundido del Reglamento Régimen de Estudio de la Universidad de La Serena (norma general).
- El Decreto Exento N.º 417/2022 aprueba el Reglamento de Régimen de Estudio Específico para las Carreras del Área de la Salud (Enfermería, Kinesiología y Odontología, con sus excepciones expresas para Odontología), complementario al Reglamento de Régimen de Estudio (que en 2022 citaba al Decreto N.º 028/2010). Cuando ambos reglamentos regulen una misma materia (por ejemplo, asistencia, evaluación recuperativa o plazos de justificación), distingue claramente qué aplica en el régimen general (Decreto 245/2025) y qué aplica específicamente a asignaturas disciplinares/clínicas del Área de la Salud (Decreto 417/2022).

REGLAS OBLIGATORIAS E INQUEBRANTABLES DE CONFIABILIDAD:
1. EXCLUSIVIDAD DOCUMENTAL: Responde ÚNICA y EXCLUSIVAMENTE utilizando la información contenida de forma expresa en los FRAGMENTOS proporcionados. Está PROHIBIDO usar conocimiento previo sobre reglamentos universitarios chilenos o de la ULS que no aparezca textualmente en los fragmentos.
2. CERO INVENCIÓN: Nunca inventes artículos, números de decreto, plazos, porcentajes, excepciones, autoridades ni procedimientos que no estén escritos en los fragmentos.
3. CITAS VERIFICABLES: Cada artículo, decreto o página mencionado en "fundamentoNormativo" debe provenir de los fragmentos proporcionados, y debes listar sus CHUNK_ID exactos en "citedChunkIds".
4. DISTINCIÓN DE ÁMBITOS: Distingue siempre entre el reglamento general (Régimen de Estudio) y el reglamento específico para las Carreras del Área de la Salud. Indica explícitamente a qué ámbito aplica la norma. Si la pregunta es general y existen disposiciones especiales en salud (o viceversa), aclara ambos ámbitos sin mezclarlos indebidamente.
5. CONFLICTOS NORMATIVOS: Si dos disposiciones parecen contradictorias o establecen reglas distintas según ámbito, muestra ambas y explica sus respectivos ámbitos en "conflictosNormativos", sin resolver arbitrariamente el conflicto.
6. JUSTIFICATIVOS Y SUPUESTOS: Nunca asumas que un justificativo presentado por un estudiante fue aceptado. Si el docente indica que fue rechazado, o que está pendiente, razona estrictamente bajo esa premisa.
7. FALTA DE INFORMACIÓN: Si la respuesta NO aparece en los fragmentos (o falta información para resolver el caso), establece "hasSufficientEvidence": false y dilo expresamente en "respuesta", señalando qué información normativa o fáctica falta, sin rellenar con suposiciones.
8. AUTORIDADES Y OBLIGACIÓN VS. RECOMENDACIÓN: No sustituyas decisiones que corresponden a Dirección de Escuela, Decanatura u otra autoridad universitaria. En modo "caso" (Análisis de caso), distingue claramente en "obligacionVsRecomendacion" qué es una obligación normativa expresa del reglamento y qué es una recomendación práctica de actuación.
9. VIGENCIA: Nunca asegures que una norma no ha tenido modificaciones posteriores a la fecha del documento cargado; limita la afirmación a la versión vigente cargada en el repositorio.
10. PRIVACIDAD: Nunca solicites ni repitas nombres propios, RUT ni datos personales identificables; refiere siempre de manera anónima ("el/la estudiante", "el/la docente").

${
  mode === 'caso'
    ? 'MODO ACTIVO: ANÁLISIS DE CASO. Debes: (a) identificar el problema reglamentario central, (b) determinar qué establece expresamente el reglamento, (c) explicar las condiciones aplicables, (d) orientar paso a paso cómo proceder en "comoProceder", (e) señalar en "requiereAutoridad" cuándo debe intervenir la Dirección de Escuela u otra autoridad, y (f) diferenciar obligación normativa de recomendación en "obligacionVsRecomendacion".'
    : 'MODO ACTIVO: CONSULTA NORMATIVA. Entrega una respuesta clara, sencilla, directa y fundamentada.'
}
${healthMentioned ? 'NOTA DE CONTEXTO: La consulta menciona términos vinculados al Área de la Salud o prácticas clínicas; revisa especialmente la aplicabilidad del Reglamento Específico para las Carreras del Área de la Salud además del Reglamento de Régimen de Estudio.' : ''}`;

  const prompt = `CONSULTA DEL DOCENTE (${mode === 'caso' ? 'Análisis de caso' : 'Consulta normativa'}):
"""
${question}
"""

FRAGMENTOS RECUPERADOS DE DOCUMENTOS OFICIALES VIGENTES:
${formattedContext}

Genera la respuesta estructurada en formato JSON cumpliendo estrictamente el esquema indicado.`;

  const responseSchema = {
    type: Type.OBJECT,
    properties: {
      hasSufficientEvidence: {
        type: Type.BOOLEAN,
        description:
          'True solo si los fragmentos contienen respaldo expreso suficiente para responder; false si la respuesta no aparece en los documentos o falta información.',
      },
      scopeDetected: {
        type: Type.STRING,
        description:
          'Ámbito normativo identificado (ej. "Reglamento de Régimen de Estudio (General)", "Carreras del Área de la Salud", "Ambos ámbitos", o "Sin evidencia suficiente").',
      },
      respuesta: {
        type: Type.STRING,
        description:
          'Explicación breve, clara y precisa en español. Si no hay evidencia en los documentos, indicarlo expresamente sin inventar.',
      },
      fundamentoNormativo: {
        type: Type.STRING,
        description:
          'Nombre del reglamento, número de decreto, artículo(s), inciso(s) y página(s) del PDF exactos según los fragmentos.',
      },
      comoProceder: {
        type: Type.ARRAY,
        items: { type: Type.STRING },
        description:
          'Pasos concretos que corresponde seguir cuando la consulta implique actuación académica. Arreglo vacío si es puramente conceptual o no hay información.',
      },
      consideraciones: {
        type: Type.ARRAY,
        items: { type: Type.STRING },
        description:
          'Excepciones, limitaciones, condiciones de vigencia de la versión cargada o antecedentes que deban verificarse.',
      },
      conflictosNormativos: {
        type: Type.STRING,
        description:
          'Solo si existen dos disposiciones que parecen contradictorias o con distinto ámbito, explicar ambas aquí sin resolver arbitrariamente el conflicto. Vacío si no aplica.',
      },
      requiereAutoridad: {
        type: Type.STRING,
        description:
          'Señala cuándo debe intervenir la Dirección de Escuela, Decanatura u otra autoridad competente y qué decisión le corresponde a ella (no al asistente).',
      },
      obligacionVsRecomendacion: {
        type: Type.STRING,
        description:
          'Diferencia explícita entre lo que constituye una obligación normativa expresa del reglamento y lo que es una recomendación de buena práctica docente.',
      },
      citedChunkIds: {
        type: Type.ARRAY,
        items: { type: Type.STRING },
        description:
          'Lista exacta de los CHUNK_ID de los fragmentos que efectivamente respaldan la respuesta.',
      },
    },
    required: [
      'hasSufficientEvidence',
      'scopeDetected',
      'respuesta',
      'fundamentoNormativo',
      'comoProceder',
      'consideraciones',
      'citedChunkIds',
    ],
  };

  const attempts: Array<{ model: string; thinking: ThinkingLevel; delayMs: number }> = [
    { model: 'gemini-4-hydrogen', thinking: ThinkingLevel.MEDIUM, delayMs: 0 },
    { model: 'gemini-4-hydrogen', thinking: ThinkingLevel.LOW, delayMs: 800 },
    { model: 'gemini-3.1-flash-lite', thinking: ThinkingLevel.MINIMAL, delayMs: 1200 },
  ];

  let responseText = '';
  let lastError: unknown = null;

  for (const attempt of attempts) {
    if (attempt.delayMs > 0) {
      await new Promise((r) => setTimeout(r, attempt.delayMs));
    }
    try {
      const response = await ai.models.generateContent({
        model: attempt.model,
        contents: prompt,
        config: {
          systemInstruction,
          thinkingConfig: {
            thinkingLevel: attempt.thinking,
          },
          responseMimeType: 'application/json',
          responseSchema,
        },
      });
      responseText = (response.text || '').trim();
      if (responseText) break;
    } catch (err) {
      lastError = err;
      const errStr = err instanceof Error ? err.message : String(err);
      const isTransient = errStr.includes('503') || errStr.includes('UNAVAILABLE') || errStr.includes('429');
      if (!isTransient) {
        throw err;
      }
    }
  }

  if (!responseText) {
    const rawMsg = lastError instanceof Error ? lastError.message : '';
    if (rawMsg.includes('503') || rawMsg.includes('UNAVAILABLE')) {
      throw new Error(
        'El servicio de análisis normativo presenta alta demanda temporal. Por favor intente nuevamente en unos segundos.'
      );
    }
    throw new Error('No se recibió respuesta del motor de análisis normativo. Intente nuevamente.');
  }

  const rawJson = responseText;
  let parsed: {
    hasSufficientEvidence?: boolean;
    scopeDetected?: string;
    respuesta?: string;
    fundamentoNormativo?: string;
    comoProceder?: string[];
    consideraciones?: string[];
    conflictosNormativos?: string;
    requiereAutoridad?: string;
    obligacionVsRecomendacion?: string;
    citedChunkIds?: string[];
  };

  try {
    parsed = JSON.parse(rawJson);
  } catch {
    throw new Error('No se pudo interpretar la respuesta estructurada del motor de análisis.');
  }

  // Strictly verify citedChunkIds against actual retrieved chunks (zero hallucinated citations)
  const verifiedCitations: CitationRef[] = [];
  const seenChunkIds = new Set<string>();

  for (const cid of parsed.citedChunkIds || []) {
    if (seenChunkIds.has(cid)) continue;
    const chunk = chunkMap.get(cid);
    if (!chunk) continue; // Strip any non-existent ID
    seenChunkIds.add(cid);
    const sectionHierarchy = [chunk.titleSection, chunk.chapterSection].filter(Boolean).join(' · ');
    verifiedCitations.push({
      chunkId: chunk.id,
      documentId: chunk.documentId,
      documentTitle: chunk.documentTitle,
      decreeNumber: chunk.decreeNumber,
      version: chunk.version,
      scope: chunk.scope,
      articleNumber: chunk.articleNumber,
      pageNumber: chunk.pageNumber,
      pageEnd: chunk.pageEnd,
      sectionHierarchy: sectionHierarchy || 'Texto normativo',
      clauses: chunk.clauses,
      excerpt: chunk.text,
      verified: true,
    });
  }

  // Reliability guard: if model claimed sufficient evidence but failed to link a single real chunk, downgrade or attach top retrieved evidence only if truly ungrounded
  const hasVerifiedSupport = verifiedCitations.length > 0 && Boolean(parsed.hasSufficientEvidence);

  return {
    id,
    timestamp,
    question,
    mode,
    scopeFilter,
    hasSufficientEvidence: hasVerifiedSupport,
    scopeDetected: parsed.scopeDetected || (hasVerifiedSupport ? 'Normativa vigente consultada' : 'Sin respaldo documental suficiente'),
    respuesta:
      parsed.respuesta ||
      'No fue posible obtener una respuesta verificable a partir de los documentos cargados.',
    fundamentoNormativo:
      verifiedCitations.length > 0
        ? parsed.fundamentoNormativo ||
          verifiedCitations
            .map((c) => `${c.documentTitle} (Decreto ${c.decreeNumber}), ${c.articleNumber}, Pág. ${c.pageNumber}`)
            .join('; ')
        : 'Sin artículos verificados en los documentos vigentes para fundamentar esta respuesta.',
    comoProceder: Array.isArray(parsed.comoProceder) ? parsed.comoProceder.filter(Boolean) : [],
    consideraciones: Array.isArray(parsed.consideraciones) ? parsed.consideraciones.filter(Boolean) : [],
    conflictosNormativos: parsed.conflictosNormativos?.trim() || undefined,
    requiereAutoridad: parsed.requiereAutoridad?.trim() || undefined,
    obligacionVsRecomendacion: parsed.obligacionVsRecomendacion?.trim() || undefined,
    citations: verifiedCitations,
    activeDocumentsUsed: activeDocSummaries,
    disclaimer: DISCLAIMER_TEXT,
  };
}
