import { BookCheck, FileSearch, Scale, ShieldAlert } from 'lucide-react';

export function GuideView() {
  return (
    <div className="space-y-8 max-w-4xl">
      <section className="border-b border-[#DDE3EC] pb-6">
        <p className="text-xs font-semibold uppercase tracking-widest text-[#8B1838]">
          Orientación para el cuerpo docente
        </p>
        <h1 className="font-serif text-3xl font-semibold text-[#003A80] mt-2">
          Cómo utilizar NormaULS
        </h1>
        <p className="text-sm sm:text-base text-slate-600 mt-1.5">
          Recomendaciones prácticas para consultar reglamentos universitarios con precisión, trazabilidad y resguardo de datos personales.
        </p>
      </section>

      <div className="grid grid-cols-1 md:grid-cols-2 gap-5">
        <article className="bg-[#F3F5F8] border border-[#DDE3EC] rounded-xl p-6 space-y-2.5">
          <div className="flex items-center gap-2.5 text-[#003A80]">
            <FileSearch className="w-5 h-5 text-[#8B1838]" />
            <h2 className="font-semibold text-base">1. Consulta por una norma</h2>
          </div>
          <p className="text-sm text-slate-700 leading-relaxed">
            Ideal para preguntas puntuales sobre plazos, porcentajes de asistencia, evaluaciones recuperativas, escalas o competencias. Puede escribir en lenguaje natural o consultar un número de artículo específico.
          </p>
        </article>

        <article className="bg-[#F3F5F8] border border-[#DDE3EC] rounded-xl p-6 space-y-2.5">
          <div className="flex items-center gap-2.5 text-[#003A80]">
            <Scale className="w-5 h-5 text-[#8B1838]" />
            <h2 className="font-semibold text-base">2. Consulta por un caso</h2>
          </div>
          <p className="text-sm text-slate-700 leading-relaxed">
            Describa los hechos relevantes de una situación real (por ejemplo, rechazo previo de justificativo, inasistencia a práctica clínica o solicitud fuera de plazo). El asistente identificará la norma aplicable, los pasos a seguir y cuándo debe intervenir la Dirección de Escuela.
          </p>
        </article>

        <article className="bg-[#F3F5F8] border border-[#DDE3EC] rounded-xl p-6 space-y-2.5">
          <div className="flex items-center gap-2.5 text-[#003A80]">
            <BookCheck className="w-5 h-5 text-[#8B1838]" />
            <h2 className="font-semibold text-base">3. Trazabilidad y verificación</h2>
          </div>
          <p className="text-sm text-slate-700 leading-relaxed">
            Cada respuesta muestra el reglamento, número de decreto, artículo y página del PDF que la fundamenta. Utilice siempre el botón <strong className="text-[#003A80]">Ver artículo original</strong> para revisar el texto literal antes de adoptar una decisión formal.
          </p>
        </article>

        <article className="bg-[#F3F5F8] border border-[#DDE3EC] rounded-xl p-6 space-y-2.5">
          <div className="flex items-center gap-2.5 text-[#003A80]">
            <ShieldAlert className="w-5 h-5 text-[#8B1838]" />
            <h2 className="font-semibold text-base">4. Privacidad y alcance institucional</h2>
          </div>
          <p className="text-sm text-slate-700 leading-relaxed">
            No incluya nombres, RUT, correos ni antecedentes identificables de estudiantes o docentes. NormaULS es una herramienta de apoyo interpretativo y no reemplaza las resoluciones de la Dirección de Escuela ni de las autoridades universitarias.
          </p>
        </article>
      </div>

      <section className="bg-white border border-[#DDE3EC] rounded-xl p-6 space-y-3">
        <h2 className="font-serif text-xl font-semibold text-[#003A80]">
          Principios de confiabilidad del asistente
        </h2>
        <ul className="space-y-2 text-sm text-slate-700 leading-relaxed">
          <li>• Solo cita artículos y disposiciones que se encuentran efectivamente cargadas y vigentes en el repositorio.</li>
          <li>• Distingue entre el Reglamento de Régimen de Estudio (general) y el Reglamento Específico para las Carreras del Área de la Salud.</li>
          <li>• Si dos normas parecen entrar en tensión o regulan ámbitos distintos, expone ambas sin resolver arbitrariamente el conflicto.</li>
          <li>• Si una situación no está contemplada en los reglamentos cargados, lo indica expresamente sin inventar plazos ni procedimientos.</li>
        </ul>
      </section>
    </div>
  );
}
