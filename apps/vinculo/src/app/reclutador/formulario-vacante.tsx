import { MODALIDADES, NIVELES, TIPOS_EMPLEO, type ErroresVacante } from "@/modules/vacantes";

export interface ValoresVacante {
  titulo?: string;
  descripcion?: string;
  ciudad?: string;
  modalidad?: string;
  nivel?: string;
  tipoEmpleo?: string;
  recepcion?: string;
  aplicacionId?: string;
  urlEmpresa?: string;
}

/**
 * Campos de la vacante (crear y editar). Las aplicaciones listadas son las que la empresa autorizó.
 * aplicaciones = null: la API de Vínculo está apagada (VINCULO_API_HABILITADA) y no se ofrece entregar a un ATS.
 */
export function CamposVacante({ valores, errores, aplicaciones, mostrarRecepcion = true }: { valores: ValoresVacante; errores: ErroresVacante; aplicaciones: { id: string; nombre: string }[] | null; mostrarRecepcion?: boolean }) {
  const campo = (id: keyof ValoresVacante, etiqueta: string, control: React.ReactNode, ayuda?: string) => (
    <div className="v-campo">
      <label htmlFor={id}>{etiqueta}</label>
      {control}
      {ayuda && <p className="v-ayuda">{ayuda}</p>}
      {errores[id as keyof ErroresVacante] && <p className="mensaje-error">{errores[id as keyof ErroresVacante]}</p>}
    </div>
  );
  const invalido = (id: keyof ErroresVacante) => (errores[id] ? true : undefined);
  return (
    <>
      {campo("titulo", "Título del cargo", <input id="titulo" name="titulo" required defaultValue={valores.titulo} aria-invalid={invalido("titulo")} />)}
      {campo("descripcion", "Descripción", <textarea id="descripcion" name="descripcion" rows={6} required defaultValue={valores.descripcion} aria-invalid={invalido("descripcion")} />, "Mínimo 60 caracteres.")}
      <div className="v-filtros">
        {campo("ciudad", "Ciudad", <input id="ciudad" name="ciudad" required defaultValue={valores.ciudad} aria-invalid={invalido("ciudad")} />)}
        {campo(
          "modalidad",
          "Modalidad",
          <select id="modalidad" name="modalidad" defaultValue={valores.modalidad ?? "HIBRIDO"}>
            {Object.entries(MODALIDADES).map(([k, v]) => (
              <option key={k} value={k}>
                {v}
              </option>
            ))}
          </select>,
        )}
        {campo(
          "nivel",
          "Nivel",
          <select id="nivel" name="nivel" defaultValue={valores.nivel ?? "SEMI_SENIOR"}>
            {Object.entries(NIVELES).map(([k, v]) => (
              <option key={k} value={k}>
                {v}
              </option>
            ))}
          </select>,
        )}
        {campo(
          "tipoEmpleo",
          "Tipo de empleo",
          <select id="tipoEmpleo" name="tipoEmpleo" defaultValue={valores.tipoEmpleo ?? "TIEMPO_COMPLETO"}>
            {Object.entries(TIPOS_EMPLEO).map(([k, v]) => (
              <option key={k} value={k}>
                {v}
              </option>
            ))}
          </select>,
        )}
      </div>
      {mostrarRecepcion && (
        <>
          {campo(
            "recepcion",
            "¿Dónde se reciben las postulaciones?",
            <select id="recepcion" name="recepcion" defaultValue={valores.recepcion ?? "VINCULO"}>
              <option value="VINCULO">En el Simulador LinkedIn, con «Solicitud sencilla»</option>
              <option value="SITIO_EMPRESA">En el sitio de la empresa (enlace)</option>
            </select>,
          )}
          {aplicaciones !== null &&
            campo(
              "aplicacionId",
              "Entregar las solicitudes a un ATS conectado",
              <select id="aplicacionId" name="aplicacionId" defaultValue={valores.aplicacionId ?? ""} aria-invalid={invalido("aplicacionId")}>
                <option value="">No: las reviso en el Simulador LinkedIn y descargo los CV</option>
                {aplicaciones.map((a) => (
                  <option key={a.id} value={a.id}>
                    {a.nombre}
                  </option>
                ))}
              </select>,
              "Solo aparecen las aplicaciones autorizadas en Integraciones. El Simulador LinkedIn valida su webhook antes de publicar.",
            )}
        </>
      )}
      {campo("urlEmpresa", "Enlace del sitio de la empresa (opcional)", <input id="urlEmpresa" name="urlEmpresa" type="url" defaultValue={valores.urlEmpresa} aria-invalid={invalido("urlEmpresa")} />)}
    </>
  );
}
