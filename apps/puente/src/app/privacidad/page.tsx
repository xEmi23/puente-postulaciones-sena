import "../puente.css";
import { ROTULO_BORRADOR, VERSION_AVISO, correoPrivacidad, diasRetencion } from "@/entradas/formulario/aviso";

export const dynamic = "force-dynamic";
export const metadata = { title: "Aviso de privacidad" };

export default function Privacidad() {
  const correo = correoPrivacidad();
  const dias = diasRetencion();
  return (
    <main id="contenido" className="m-puente publico">
      <article className="p-tarjeta publico-tarjeta">
        <p className="alerta alerta-aviso" data-testid="rotulo-borrador">
          <strong>{ROTULO_BORRADOR}.</strong> Este texto todavía no ha sido revisado por un abogado y puede cambiar.
        </p>
        <h1>Aviso de privacidad del formulario de postulación</h1>
        <p className="p-nota">Versión {VERSION_AVISO}</p>

        <h2>Quién es el responsable</h2>
        <p>
          El responsable del tratamiento es la empresa que publica la vacante a la que te postulas. Sus datos de identificación (razón social, NIT y domicilio) están
          pendientes de completar en este borrador. El Puente de postulaciones es la herramienta que recibe tu postulación y la entrega al sistema de selección de esa
          empresa; en este prototipo académico ese sistema es el Simulador BUK.
        </p>

        <h2>Para qué usamos tus datos</h2>
        <ul>
          <li>Registrar tu postulación a la vacante que elegiste y entregarla al sistema de selección de la empresa.</li>
          <li>Que el equipo de selección revise tu hoja de vida y te contacte durante el proceso de esa vacante.</li>
          <li>Evitar postulaciones repetidas y llevar un registro de lo que pasó con cada envío.</li>
        </ul>
        <p>No vendemos tus datos ni los usamos para publicidad.</p>

        <h2>Qué datos recogemos</h2>
        <ul>
          <li>Nombres, apellidos, correo y teléfono.</li>
          <li>Tu hoja de vida en PDF y su huella SHA-256 (un código que permite comprobar que el archivo no cambió).</li>
          <li>
            La prueba de tu autorización: fecha y hora, la versión de este aviso y un resumen cifrado de la dirección desde la que enviaste el formulario (no se guarda
            la dirección en claro).
          </li>
        </ul>

        <h2>Tus derechos</h2>
        <p>
          Como titular puedes conocer, actualizar y rectificar tus datos; pedir prueba de la autorización que diste; saber cómo se han usado; revocar la autorización o
          pedir que los borremos cuando no exista un deber legal de conservarlos; y presentar quejas ante la Superintendencia de Industria y Comercio.
        </p>
        <p data-testid="canal-contacto">
          {correo ? (
            <>
              Para ejercerlos escribe a <a href={`mailto:${correo}`}>{correo}</a>.
            </>
          ) : (
            <>El canal de contacto para ejercer tus derechos está pendiente de configurar por la empresa responsable.</>
          )}
        </p>

        <h2>Cuánto tiempo los conservamos</h2>
        <ul>
          <li>Tu hoja de vida se borra del Puente en cuanto el sistema de selección la recibe.</li>
          <li>Si el sistema de selección no la recibe, el Puente la borra a más tardar {dias} días después de cerrar el envío.</li>
          <li>
            Tus datos de contacto y el registro del envío se conservan en el Puente para dar trazabilidad hasta que pidas su supresión. En el sistema de selección se
            conservan según la política de la empresa responsable.
          </li>
        </ul>

        <h2>Autorización</h2>
        <p>
          Al marcar la casilla del formulario autorizas el tratamiento descrito en este aviso. La autorización es voluntaria, pero sin ella no podemos recibir tu
          postulación.
        </p>
      </article>
    </main>
  );
}
