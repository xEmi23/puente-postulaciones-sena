import Link from "next/link";

export default function Inicio() {
  return (
    <main id="contenido" className="indice">
      <h1>talent-bridge</h1>
      <p>
        Prototipo que traslada automáticamente las postulaciones de un portal de empleo a un ATS, sin descargar ni re-digitar
        hojas de vida. Los dos extremos están simulados; el puente es el componente que se propone.
      </p>
      <div className="indice-grid">
        <Link className="indice-tarjeta" href="/origen">
          <span className="indice-etiqueta" style={{ background: "#ccfbf1", color: "#115e59" }}>
            1 · Origen simulado
          </span>
          <h2>Portal de empleo</h2>
          <p>Vacantes publicadas y postulación sin cuenta con CV en PDF. Entrega con el contrato de Apply Connect.</p>
        </Link>
        <Link className="indice-tarjeta" href="/puente">
          <span className="indice-etiqueta" style={{ background: "#e2e8f0", color: "#1e293b" }}>
            2 · Puente
          </span>
          <h2>Panel de integración</h2>
          <p>Recepciones, pasos, reintentos, correspondencias de vacantes y métricas medidas.</p>
        </Link>
        <Link className="indice-tarjeta" href="/ats">
          <span className="indice-etiqueta" style={{ background: "#ede9fe", color: "#5b21b6" }}>
            3 · Destino simulado
          </span>
          <h2>ATS de selección</h2>
          <p>Procesos con tablero por etapas. Las postulaciones llegan a «Postulantes» sin intervención manual.</p>
        </Link>
      </div>
      <p className="indice-flujo">
        Flujo: postulación en el portal → webhook firmado al puente → descarga del CV → candidato, documento y postulación en el
        ATS.
      </p>
    </main>
  );
}
