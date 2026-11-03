import "../../empleo.css";
import { formatoReferencia } from "@/entradas/formulario/campos";
import { vacantePublica } from "@/entradas/formulario/servicio";

export const dynamic = "force-dynamic";
export const metadata = { title: "Postulación enviada" };

// La misma página para una postulación nueva o repetida: no revela si el correo ya se había postulado.
export default async function Enviado({ params, searchParams }: { params: Promise<{ codigo: string }>; searchParams: Promise<{ ref?: string }> }) {
  const { codigo } = await params;
  const { ref } = await searchParams;
  const referencia = ref && formatoReferencia.test(ref) ? ref : null;
  const vacante = await vacantePublica(codigo);
  return (
    <main id="contenido" className="empleo">
      <header className="empleo-cabecera">
        <div className="empleo-cabecera-interior">
          <p className="empleo-antetitulo">Postulación enviada</p>
          <h1>Recibimos tu postulación</h1>
          {vacante && <p style={{ margin: 0 }}>{vacante.ficha.titulo}</p>}
        </div>
      </header>
      <div className="empleo-cuerpo">
        <section className="empleo-tarjeta" aria-labelledby="t-confirmacion">
          <h2 id="t-confirmacion">Gracias por postularte</h2>
          <p data-testid="confirmacion">Tu postulación quedó registrada y llegará al equipo de selección.</p>
          {referencia && (
            <p>
              Número de referencia: <span className="e-referencia" data-testid="referencia">{referencia}</span>
              <br />
              <span className="empleo-nota">Guárdalo: sirve para consultar o pedir que borremos tus datos.</span>
            </p>
          )}
          <h2>Qué pasa después</h2>
          <ol className="e-pasos">
            <li>El equipo de selección revisa tu hoja de vida.</li>
            <li>Si tu perfil avanza, te contactarán por correo o teléfono.</li>
            <li>Si ya te habías postulado a esta vacante, conservamos una sola postulación.</li>
          </ol>
          <p className="empleo-nota">
            Consulta cómo tratamos tus datos en el <a href="/privacidad">aviso de privacidad</a>.
          </p>
        </section>
      </div>
    </main>
  );
}
