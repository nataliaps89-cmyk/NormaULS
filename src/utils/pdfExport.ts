import { jsPDF } from 'jspdf';
import type { StructuredNormativeResponse } from '../shared/types.ts';

export function exportResponseToPdf(item: StructuredNormativeResponse): void {
  const doc = new jsPDF({
    orientation: 'portrait',
    unit: 'mm',
    format: 'a4',
  });

  const pageWidth = doc.internal.pageSize.getWidth();
  const pageHeight = doc.internal.pageSize.getHeight();
  const margin = 18;
  const maxWidth = pageWidth - margin * 2;
  let y = 20;

  const ensureSpace = (neededMm: number) => {
    if (y + neededMm > pageHeight - 18) {
      doc.addPage();
      y = 20;
    }
  };

  const writeWrapped = (text: string, fontSize: number, style: 'normal' | 'bold' | 'italic' = 'normal', color: [number, number, number] = [15, 23, 42]) => {
    doc.setFont('helvetica', style);
    doc.setFontSize(fontSize);
    doc.setTextColor(color[0], color[1], color[2]);
    const lines = doc.splitTextToSize(text, maxWidth) as string[];
    const lineHeight = fontSize * 0.44;
    for (const line of lines) {
      ensureSpace(lineHeight + 2);
      doc.text(line, margin, y);
      y += lineHeight;
    }
    y += 2;
  };

  const writeSectionHeader = (title: string) => {
    ensureSpace(12);
    y += 2;
    doc.setDrawColor(221, 227, 236);
    doc.line(margin, y, pageWidth - margin, y);
    y += 5;
    doc.setFont('helvetica', 'bold');
    doc.setFontSize(10);
    doc.setTextColor(0, 58, 128);
    doc.text(title, margin, y);
    y += 5;
  };

  // Header band (ULS Navy + Burgundy hairline accent)
  doc.setFillColor(0, 58, 128);
  doc.rect(0, 0, pageWidth, 24, 'F');
  doc.setFillColor(139, 24, 56);
  doc.rect(0, 24, pageWidth, 1.5, 'F');
  doc.setFont('helvetica', 'bold');
  doc.setFontSize(14);
  doc.setTextColor(255, 255, 255);
  doc.text('NormaULS', margin, 11);
  doc.setFont('helvetica', 'normal');
  doc.setFontSize(9);
  doc.setTextColor(226, 232, 240);
  doc.text('Asistente inteligente de consulta reglamentaria para docentes · Universidad de La Serena', margin, 17);

  y = 34;
  const dateStr = new Date(item.timestamp).toLocaleString('es-CL');
  writeWrapped(
    `Modalidad: ${item.mode === 'caso' ? 'Consulta por un caso' : 'Consulta por una norma'}  |  Ámbito: ${item.scopeDetected}  |  Fecha: ${dateStr}`,
    8.5,
    'normal',
    [71, 85, 105]
  );

  writeSectionHeader('CONSULTA PLANTEADA');
  writeWrapped(item.question, 10, 'italic', [30, 41, 59]);

  writeSectionHeader('RESPUESTA');
  writeWrapped(item.respuesta, 10, 'normal', [15, 23, 42]);

  writeSectionHeader('FUNDAMENTO NORMATIVO');
  writeWrapped(item.fundamentoNormativo, 10, 'normal', [15, 23, 42]);

  if (item.comoProceder.length > 0) {
    writeSectionHeader('CÓMO PROCEDER');
    item.comoProceder.forEach((step, idx) => {
      writeWrapped(`${idx + 1}. ${step}`, 10, 'normal', [15, 23, 42]);
    });
  }

  if (item.requiereAutoridad) {
    writeSectionHeader('INTERVENCIÓN DE AUTORIDAD UNIVERSITARIA');
    writeWrapped(item.requiereAutoridad, 9.5, 'normal', [30, 41, 59]);
  }

  if (item.obligacionVsRecomendacion) {
    writeSectionHeader('OBLIGACIÓN NORMATIVA VS. RECOMENDACIÓN');
    writeWrapped(item.obligacionVsRecomendacion, 9.5, 'normal', [30, 41, 59]);
  }

  if (item.consideraciones.length > 0) {
    writeSectionHeader('CONSIDERACIONES');
    item.consideraciones.forEach((note) => {
      writeWrapped(`• ${note}`, 9.5, 'normal', [30, 41, 59]);
    });
  }

  if (item.conflictosNormativos) {
    writeSectionHeader('ANÁLISIS DE DISPOSICIONES CONCURRENTES');
    writeWrapped(item.conflictosNormativos, 9.5, 'normal', [30, 41, 59]);
  }

  if (item.citations.length > 0) {
    writeSectionHeader('FRAGMENTOS ORIGINALES VERIFICADOS');
    for (const cit of item.citations) {
      writeWrapped(
        `${cit.documentTitle} (Decreto ${cit.decreeNumber}, v${cit.version}) — ${cit.articleNumber} · Pág. ${cit.pageNumber}`,
        9,
        'bold',
        [0, 58, 128]
      );
      writeWrapped(cit.excerpt, 8.5, 'normal', [51, 65, 85]);
    }
  }

  ensureSpace(16);
  y += 4;
  doc.setDrawColor(226, 232, 240);
  doc.line(margin, y, pageWidth - margin, y);
  y += 5;
  writeWrapped(item.disclaimer, 8, 'italic', [100, 116, 139]);

  const filenameSafe = `NormaULS_${item.mode}_${new Date(item.timestamp).toISOString().slice(0, 10)}.pdf`;
  doc.save(filenameSafe);
}

export function formatResponseAsPlainText(item: StructuredNormativeResponse): string {
  const lines: string[] = [
    'NORMAULS — INFORME DE CONSULTA REGLAMENTARIA',
    `Modalidad: ${item.mode === 'caso' ? 'Consulta por un caso' : 'Consulta por una norma'}`,
    `Ámbito identificado: ${item.scopeDetected}`,
    `Fecha: ${new Date(item.timestamp).toLocaleString('es-CL')}`,
    '',
    'CONSULTA:',
    item.question,
    '',
    'RESPUESTA:',
    item.respuesta,
    '',
    'FUNDAMENTO NORMATIVO:',
    item.fundamentoNormativo,
  ];

  if (item.comoProceder.length > 0) {
    lines.push('', 'CÓMO PROCEDER:');
    item.comoProceder.forEach((step, idx) => lines.push(`${idx + 1}. ${step}`));
  }

  if (item.requiereAutoridad) {
    lines.push('', 'INTERVENCIÓN DE AUTORIDAD:', item.requiereAutoridad);
  }

  if (item.obligacionVsRecomendacion) {
    lines.push('', 'OBLIGACIÓN NORMATIVA VS. RECOMENDACIÓN:', item.obligacionVsRecomendacion);
  }

  if (item.consideraciones.length > 0) {
    lines.push('', 'CONSIDERACIONES:');
    item.consideraciones.forEach((c) => lines.push(`- ${c}`));
  }

  if (item.conflictosNormativos) {
    lines.push('', 'DISPOSICIONES CONCURRENTES:', item.conflictosNormativos);
  }

  if (item.citations.length > 0) {
    lines.push('', 'REFERENCIAS VERIFICADAS:');
    item.citations.forEach((cit) => {
      lines.push(
        `- ${cit.documentTitle} (Decreto ${cit.decreeNumber}, v${cit.version}), ${cit.articleNumber}, Pág. ${cit.pageNumber}`
      );
    });
  }

  lines.push('', 'NOTA:', item.disclaimer);
  return lines.join('\n');
}
