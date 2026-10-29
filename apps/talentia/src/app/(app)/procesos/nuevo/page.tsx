import Link from "next/link";
import { redirect } from "next/navigation";
import { exigirSesionAccion } from "@/lib/sesion-servidor";
import { crearProceso, ETAPAS_PLANTILLA } from "@/modules/servicio";
import { PRIORIDADES } from "@/modules/procesos";

const hoyBogota = () => new Intl.DateTimeFormat("en-CA", { timeZone: "America/Bogota" }).format(new Date());

export const metadata = { title: "Nuevo proceso" };

async function crear(formData: FormData) {
  "use server";
  await exigirSesionAccion();
  const valores = {
    nombre: String(formData.get("nombre") ?? ""),
    area: String(formData.get("area") ?? ""),
    ciudad: String(formData.get("ciudad") ?? ""),
    prioridad: String(formData.get("prioridad") ?? "Media"),
    fechaInicio: String(formData.get("fechaInicio") ?? ""),
  };
  const r = await crearProceso(valores);
  if (!r.ok) redirect(`/procesos/nuevo?${new URLSearchParams({ error: Object.values(r.errores)[0], ...valores })}`);
  redirect(`/procesos/${r.id}?creado=1`);
}

export default async function NuevoProceso({ searchParams }: { searchParams: Promise<Record<string, string | undefined>> }) {
  const q = await searchParams;
  return (
    <>
      <nav aria-label="Ruta de navegación" style={{ fontSize: "0.85rem", marginBottom: "0.5rem" }}>
        <Link href="/">Procesos</Link> / <span aria-current="page">Nuevo proceso</span>
      </nav>
      <div className="a-encabezado">
        <h1>Nuevo proceso de selección</h1>
      </div>
      <section className="a-ficha" style={{ maxWidth: 640 }}>
        {q.error && (
          <div className="alerta alerta-error" role="alert">
            {q.error}
          </div>
        )}
        <form action={crear}>
          {[
            { id: "nombre", etiqueta: "Nombre del proceso" },
            { id: "area", etiqueta: "Área" },
            { id: "ciudad", etiqueta: "Ciudad" },
          ].map((c) => (
            <div key={c.id} style={{ marginBottom: "0.8rem" }}>
              <label htmlFor={c.id} style={{ display: "block", fontWeight: 600, marginBottom: 4 }}>
                {c.etiqueta}
              </label>
              <input id={c.id} name={c.id} required defaultValue={q[c.id]} className="a-input" />
            </div>
          ))}
          <div style={{ marginBottom: "0.8rem" }}>
            <label htmlFor="prioridad" style={{ display: "block", fontWeight: 600, marginBottom: 4 }}>
              Prioridad
            </label>
            <select id="prioridad" name="prioridad" defaultValue={q.prioridad ?? "Media"} className="a-input">
              {PRIORIDADES.map((p) => (
                <option key={p}>{p}</option>
              ))}
            </select>
          </div>
          <div style={{ marginBottom: "0.8rem" }}>
            <label htmlFor="fechaInicio" style={{ display: "block", fontWeight: 600, marginBottom: 4 }}>
              Fecha de inicio
            </label>
            <input id="fechaInicio" name="fechaInicio" type="date" required defaultValue={q.fechaInicio ?? hoyBogota()} className="a-input" />
          </div>
          <p className="a-sub">
            Estado inicial: Iniciado. Etapas: {ETAPAS_PLANTILLA.join(" · ")}. El identificador se asigna automáticamente.
          </p>
          <button type="submit" className="a-boton" style={{ marginTop: "0.5rem" }}>
            Crear proceso
          </button>
        </form>
      </section>
    </>
  );
}
