import "../../../puente.css";
import Link from "next/link";

export const metadata = { title: "Postulación enviada" };

// La misma página para una postulación nueva o repetida: no revela si el correo ya se había postulado.
export default function Enviado() {
  return (
    <main id="contenido" className="m-puente publico">
      <section className="p-tarjeta publico-tarjeta" aria-labelledby="t-enviado">
        <h1 id="t-enviado">Recibimos tu postulación</h1>
        <p data-testid="confirmacion">Gracias. Tu postulación quedó registrada y el equipo de selección la revisará. Si te preseleccionan, te contactarán por correo o teléfono.</p>
        <p className="p-nota">
          Puedes consultar cómo tratamos tus datos en el <Link href="/privacidad">aviso de privacidad</Link>.
        </p>
      </section>
    </main>
  );
}
