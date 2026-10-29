import { notFound, redirect } from "next/navigation";
import { z } from "zod";
import { prisma } from "@/lib/db";
import { modoPrueba } from "@/lib/config";
import { exigirUsuarioAccion } from "@/lib/sesion-servidor";
import { MODOS_FALLO, RUTAS_FALLO, configurarFallo, limpiarFallos } from "@/modules/fallos";

export const dynamic = "force-dynamic";
export const metadata = { title: "Controles de prueba" };

const DESCRIPCION_MODO: Record<(typeof MODOS_FALLO)[number], string> = {
  NO_DISPONIBLE: "Responde 503 sin llamar (ATS caído).",
  PERDER_RESPUESTA: "Llama al ATS (la escritura ocurre) y la respuesta se pierde como en un corte de red.",
  LENTO: "Llama al ATS y retiene la respuesta más que el tiempo de espera del puente.",
  CREDENCIALES: "Responde 401 sin llamar (credenciales del puente rechazadas).",
  INTERRUMPIR: "Solo «media»: corta la descarga del CV a la mitad.",
};

const esquema = z.object({
  ruta: z.enum(RUTAS_FALLO),
  modo: z.enum(MODOS_FALLO),
  restantes: z.coerce.number().int().min(-1).max(100),
});

async function configurar(formData: FormData) {
  "use server";
  await exigirUsuarioAccion("ADMIN");
  if (!modoPrueba()) notFound();
  const r = esquema.safeParse(Object.fromEntries(formData));
  if (!r.success) redirect("/pruebas?error=Datos%20inv%C3%A1lidos");
  await configurarFallo(r.data.ruta, r.data.modo, r.data.restantes);
  redirect("/pruebas?ok=Fallo%20configurado");
}

async function limpiar() {
  "use server";
  await exigirUsuarioAccion("ADMIN");
  if (!modoPrueba()) notFound();
  await limpiarFallos();
  redirect("/pruebas?ok=Fallos%20eliminados");
}

export default async function ControlesPrueba({ searchParams }: { searchParams: Promise<{ ok?: string; error?: string }> }) {
  // Esta pantalla no existe fuera del modo prueba local.
  if (!modoPrueba()) notFound();
  const { ok, error } = await searchParams;
  const activos = await prisma.falloSimulado.findMany({ orderBy: { ruta: "asc" } });
  return (
    <>
      <h1>Controles de prueba de los conectores</h1>
      <p className="p-sub">
        Solo visibles con PUENTE_MODO_PRUEBAS=1 en entorno local. Provocan fallos en las llamadas que hace el puente para demostrar reintentos,
        reconciliación y errores de autenticación. Nunca se usan en el recorrido normal.
      </p>
      <div role="status" aria-live="polite">
        {ok && <div className="alerta alerta-exito">{ok}</div>}
        {error && <div className="alerta alerta-error">{error}</div>}
      </div>
      <section className="p-tarjeta" aria-labelledby="t-config">
        <h2 id="t-config">Configurar un fallo</h2>
        <form action={configurar} className="p-form-linea">
          <div className="p-campo">
            <label htmlFor="ruta">Operación del ATS</label>
            <select id="ruta" name="ruta">
              {RUTAS_FALLO.map((r) => (
                <option key={r} value={r}>
                  {r}
                </option>
              ))}
            </select>
          </div>
          <div className="p-campo">
            <label htmlFor="modo">Tipo de fallo</label>
            <select id="modo" name="modo">
              {MODOS_FALLO.map((m) => (
                <option key={m} value={m}>
                  {m}: {DESCRIPCION_MODO[m]}
                </option>
              ))}
            </select>
          </div>
          <div className="p-campo">
            <label htmlFor="restantes">Solicitudes afectadas (-1 = indefinido)</label>
            <input id="restantes" name="restantes" type="number" min={-1} max={100} defaultValue={1} />
          </div>
          <div className="p-campo">
            <button className="p-boton" type="submit">
              Aplicar
            </button>
          </div>
        </form>
      </section>
      <section className="p-tarjeta" aria-labelledby="t-activos">
        <h2 id="t-activos">Fallos activos</h2>
        {activos.length === 0 ? (
          <p className="vacio">No hay fallos configurados: el ATS se comporta normalmente.</p>
        ) : (
          <>
            <ul>
              {activos.map((f) => (
                <li key={f.ruta}>
                  <span className="mono">{f.ruta}</span>: {f.modo} · restantes {f.restantes === -1 ? "∞" : f.restantes}
                </li>
              ))}
            </ul>
            <form action={limpiar}>
              <button className="p-boton p-boton-secundario" type="submit">
                Quitar todos los fallos
              </button>
            </form>
          </>
        )}
      </section>
    </>
  );
}
