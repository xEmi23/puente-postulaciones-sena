import Link from "next/link";
import { redirect } from "next/navigation";
import { exigirUsuarioAccion } from "@/lib/sesion-servidor";
import { crearProceso } from "@/modules/seleccion";
import { ETAPAS_REFERENCIA } from "@/modules/etapas";
import { PRIORIDADES } from "@/modules/procesos";

const hoyBogota = () => new Intl.DateTimeFormat("en-CA", { timeZone: "America/Bogota" }).format(new Date());

export const metadata = { title: "Nuevo proceso" };

async function crear(formData: FormData) {
  "use server";
  await exigirUsuarioAccion();
  const valores = {
    titulo: String(formData.get("titulo") ?? ""),
    area: String(formData.get("area") ?? ""),
    ciudad: String(formData.get("ciudad") ?? ""),
    descripcion: String(formData.get("descripcion") ?? ""),
    prioridad: String(formData.get("prioridad") ?? "Media"),
    fecha_inicio: String(formData.get("fecha_inicio") ?? ""),
  };
  const r = await crearProceso({ ...valores, fecha_inicio: valores.fecha_inicio || undefined });
  if (!r.ok) {
    const campos = (r.detalle?.campos as { mensaje: string }[] | undefined) ?? [];
    redirect(`/seleccion/procesos/nuevo?${new URLSearchParams({ error: campos[0]?.mensaje ?? r.mensaje, ...valores })}`);
  }
  redirect(`/seleccion/procesos/${r.datos.id}?creado=1`);
}

export default async function NuevoProceso({ searchParams }: { searchParams: Promise<Record<string, string | undefined>> }) {
  const q = await searchParams;
  return (
    <>
      <p className="a-migas">
        <Link href="/seleccion/procesos">Procesos</Link> / Nuevo proceso
      </p>
      <div className="a-encabezado">
        <div>
          <h1>Nuevo proceso de selección</h1>
          <p className="a-sub">
            Se crea con las {ETAPAS_REFERENCIA.length} etapas de la plantilla: {ETAPAS_REFERENCIA.map((e) => e.nombre).join(" · ")}.
          </p>
        </div>
      </div>
      {q.error && (
        <div className="alerta alerta-error" role="alert">
          {q.error}
        </div>
      )}
      <form action={crear} className="a-form">
        <div className="a-campo">
          <label htmlFor="titulo">Título del proceso</label>
          <input id="titulo" name="titulo" className="a-input" required minLength={5} maxLength={120} defaultValue={q.titulo} />
        </div>
        <div className="a-campo">
          <label htmlFor="area">Área</label>
          <input id="area" name="area" className="a-input" required defaultValue={q.area} />
        </div>
        <div className="a-campo">
          <label htmlFor="ciudad">Ciudad</label>
          <input id="ciudad" name="ciudad" className="a-input" required defaultValue={q.ciudad} />
        </div>
        <div className="a-campo">
          <label htmlFor="descripcion">Descripción (opcional)</label>
          <textarea id="descripcion" name="descripcion" className="a-input" rows={4} defaultValue={q.descripcion} />
          <p className="a-ayuda">Se usa como descripción de la vacante cuando el puente la publica en Vínculo.</p>
        </div>
        <div className="a-campo">
          <label htmlFor="prioridad">Prioridad</label>
          <select id="prioridad" name="prioridad" className="a-input" defaultValue={q.prioridad ?? "Media"}>
            {PRIORIDADES.map((p) => (
              <option key={p}>{p}</option>
            ))}
          </select>
        </div>
        <div className="a-campo">
          <label htmlFor="fecha_inicio">Fecha de inicio</label>
          <input id="fecha_inicio" name="fecha_inicio" type="date" className="a-input" defaultValue={q.fecha_inicio || hoyBogota()} />
        </div>
        <button type="submit" className="a-boton">
          Crear proceso
        </button>
      </form>
    </>
  );
}
