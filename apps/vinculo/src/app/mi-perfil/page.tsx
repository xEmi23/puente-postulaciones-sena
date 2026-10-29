import Link from "next/link";
import { redirect } from "next/navigation";
import { revalidatePath } from "next/cache";
import { z } from "zod";
import { prisma } from "@/lib/db";
import { exigirUsuario, exigirUsuarioAccion } from "@/lib/sesion-servidor";
import { formatoTamano, nombreArchivoSeguro, sha256Hex } from "@/lib/archivos";
import { validarCv } from "@/modules/postulacion";

export const dynamic = "force-dynamic";
export const metadata = { title: "Mi perfil" };

const esquemaPerfil = z.object({
  titular: z.string().trim().max(120, "El titular admite máximo 120 caracteres."),
  ciudad: z.string().trim().max(60),
  telefono: z
    .string()
    .trim()
    .transform((v) => v.replace(/[\s()-]/g, ""))
    .pipe(z.union([z.literal(""), z.string().regex(/^\+?\d{7,15}$/, "El teléfono debe tener entre 7 y 15 dígitos.")])),
  acercaDe: z.string().trim().max(2000, "«Acerca de» admite máximo 2000 caracteres."),
  habilidades: z
    .string()
    .max(500)
    .transform((v) => [...new Set(v.split(",").map((h) => h.trim()).filter(Boolean))].slice(0, 20)),
});
const mesValido = z.string().regex(/^\d{4}-\d{2}$/, "Usa el formato AAAA-MM.");

const volver = (params: Record<string, string>) => redirect(`/mi-perfil?${new URLSearchParams(params)}`);

async function guardar(formData: FormData) {
  "use server";
  const u = await exigirUsuarioAccion();
  const r = esquemaPerfil.safeParse(Object.fromEntries(formData));
  if (!r.success) volver({ error: r.error.issues[0].message });
  else {
    await prisma.perfil.update({ where: { userId: u.id }, data: { ...r.data, telefono: r.data.telefono || null } });
    revalidatePath("/mi-perfil");
    volver({ ok: "Perfil actualizado." });
  }
}

async function subirCv(formData: FormData) {
  "use server";
  const u = await exigirUsuarioAccion();
  const f = formData.get("cv");
  const archivo = f instanceof File && f.size > 0 ? { nombre: f.name, bytes: new Uint8Array(await f.arrayBuffer()) } : null;
  const error = validarCv(archivo);
  if (error || !archivo) return volver({ error: error ?? "Adjunta un PDF." });
  await prisma.$transaction(async (tx) => {
    const nuevo = await tx.archivoCv.create({
      data: { nombreArchivo: nombreArchivoSeguro(archivo.nombre), mime: "application/pdf", tamano: archivo.bytes.length, sha256: sha256Hex(archivo.bytes), contenido: Buffer.from(archivo.bytes) },
    });
    const anterior = await tx.perfil.findUnique({ where: { userId: u.id }, select: { cvId: true } });
    await tx.perfil.update({ where: { userId: u.id }, data: { cvId: nuevo.id } });
    if (anterior?.cvId) await tx.archivoCv.delete({ where: { id: anterior.cvId } });
  });
  volver({ ok: "Hoja de vida actualizada." });
}

async function agregarExperiencia(formData: FormData) {
  "use server";
  const u = await exigirUsuarioAccion();
  const r = z
    .object({ cargo: z.string().trim().min(2, "Indica el cargo."), empresa: z.string().trim().min(2, "Indica la empresa."), desde: mesValido, hasta: z.union([z.literal(""), mesValido]), descripcion: z.string().trim().max(600) })
    .safeParse(Object.fromEntries(formData));
  if (!r.success) return volver({ error: r.error.issues[0].message });
  const perfil = await prisma.perfil.findUniqueOrThrow({ where: { userId: u.id } });
  await prisma.experiencia.create({ data: { perfilId: perfil.id, ...r.data, hasta: r.data.hasta || null } });
  volver({ ok: "Experiencia agregada." });
}

async function quitarExperiencia(formData: FormData) {
  "use server";
  const u = await exigirUsuarioAccion();
  await prisma.experiencia.deleteMany({ where: { id: String(formData.get("id")), perfil: { userId: u.id } } });
  volver({ ok: "Experiencia eliminada." });
}

async function agregarEducacion(formData: FormData) {
  "use server";
  const u = await exigirUsuarioAccion();
  const r = z
    .object({ institucion: z.string().trim().min(2, "Indica la institución."), titulo: z.string().trim().min(2, "Indica el título."), desde: mesValido, hasta: z.union([z.literal(""), mesValido]) })
    .safeParse(Object.fromEntries(formData));
  if (!r.success) return volver({ error: r.error.issues[0].message });
  const perfil = await prisma.perfil.findUniqueOrThrow({ where: { userId: u.id } });
  await prisma.educacion.create({ data: { perfilId: perfil.id, ...r.data, hasta: r.data.hasta || null } });
  volver({ ok: "Estudio agregado." });
}

export default async function MiPerfil({ searchParams }: { searchParams: Promise<{ ok?: string; error?: string }> }) {
  const u = await exigirUsuario("/mi-perfil");
  const { ok, error } = await searchParams;
  const p = await prisma.perfil.findUnique({
    where: { userId: u.id },
    include: { cv: { omit: { contenido: true } }, experiencia: { orderBy: { orden: "asc" } }, educacion: { orderBy: { orden: "asc" } } },
  });
  if (!p) return <p className="v-tarjeta">Tu perfil aún no está listo. Recarga la página.</p>;
  return (
    <div style={{ maxWidth: 820, margin: "0 auto" }}>
      <div className="v-linea">
        <h1>Mi perfil</h1>
        <Link href={`/in/${p.slug}`}>Ver mi perfil público</Link>
      </div>
      <div role="status" aria-live="polite">
        {ok && <div className="alerta alerta-exito">{ok}</div>}
        {error && <div className="alerta alerta-error">{error}</div>}
      </div>

      <form action={guardar} className="v-tarjeta" aria-labelledby="t-datos">
        <h2 id="t-datos">Datos del perfil</h2>
        <div className="v-campo">
          <label htmlFor="titular">Titular</label>
          <input id="titular" name="titular" defaultValue={p.titular} placeholder="Por ejemplo: Desarrolladora frontend React" />
        </div>
        <div className="v-filtros">
          <div className="v-campo">
            <label htmlFor="ciudad">Ciudad</label>
            <input id="ciudad" name="ciudad" defaultValue={p.ciudad} />
          </div>
          <div className="v-campo">
            <label htmlFor="telefono">Teléfono (solo lo ve la empresa al postularte)</label>
            <input id="telefono" name="telefono" type="tel" defaultValue={p.telefono ?? ""} />
          </div>
        </div>
        <div className="v-campo">
          <label htmlFor="acercaDe">Acerca de</label>
          <textarea id="acercaDe" name="acercaDe" rows={4} defaultValue={p.acercaDe} />
        </div>
        <div className="v-campo">
          <label htmlFor="habilidades">Habilidades (separadas por comas)</label>
          <input id="habilidades" name="habilidades" defaultValue={p.habilidades.join(", ")} />
        </div>
        <button type="submit" className="v-boton">
          Guardar perfil
        </button>
      </form>

      <form action={subirCv} className="v-tarjeta" aria-labelledby="t-cv">
        <h2 id="t-cv">Hoja de vida</h2>
        <p data-testid="cv-perfil">{p.cv ? `Actual: ${p.cv.nombreArchivo} (${formatoTamano(p.cv.tamano)})` : "Aún no has subido tu hoja de vida."}</p>
        <div className="v-campo">
          <label htmlFor="cv">Subir hoja de vida (PDF, máximo 5 MB)</label>
          <input id="cv" name="cv" type="file" accept="application/pdf,.pdf" required />
        </div>
        <button type="submit" className="v-boton v-boton-borde">
          Subir PDF
        </button>
      </form>

      <section className="v-tarjeta" aria-labelledby="t-exp">
        <h2 id="t-exp">Experiencia</h2>
        <ul>
          {p.experiencia.map((e) => (
            <li key={e.id}>
              {e.cargo} · {e.empresa} ({e.desde} – {e.hasta ?? "actual"}){" "}
              <form action={quitarExperiencia} style={{ display: "inline" }}>
                <input type="hidden" name="id" value={e.id} />
                <button type="submit" className="v-enlace-boton" aria-label={`Eliminar ${e.cargo} en ${e.empresa}`}>
                  Eliminar
                </button>
              </form>
            </li>
          ))}
        </ul>
        <form action={agregarExperiencia}>
          <div className="v-filtros">
            <div className="v-campo">
              <label htmlFor="exp-cargo">Cargo</label>
              <input id="exp-cargo" name="cargo" required />
            </div>
            <div className="v-campo">
              <label htmlFor="exp-empresa">Empresa</label>
              <input id="exp-empresa" name="empresa" required />
            </div>
            <div className="v-campo">
              <label htmlFor="exp-desde">Desde (AAAA-MM)</label>
              <input id="exp-desde" name="desde" required pattern="\d{4}-\d{2}" />
            </div>
            <div className="v-campo">
              <label htmlFor="exp-hasta">Hasta (vacío si es actual)</label>
              <input id="exp-hasta" name="hasta" pattern="\d{4}-\d{2}" />
            </div>
          </div>
          <div className="v-campo">
            <label htmlFor="exp-desc">Descripción</label>
            <textarea id="exp-desc" name="descripcion" rows={2} />
          </div>
          <button type="submit" className="v-boton v-boton-borde">
            Agregar experiencia
          </button>
        </form>
      </section>

      <section className="v-tarjeta" aria-labelledby="t-edu">
        <h2 id="t-edu">Educación</h2>
        <ul>
          {p.educacion.map((e) => (
            <li key={e.id}>
              {e.titulo} · {e.institucion}
            </li>
          ))}
        </ul>
        <form action={agregarEducacion}>
          <div className="v-filtros">
            <div className="v-campo">
              <label htmlFor="edu-inst">Institución</label>
              <input id="edu-inst" name="institucion" required />
            </div>
            <div className="v-campo">
              <label htmlFor="edu-titulo">Título</label>
              <input id="edu-titulo" name="titulo" required />
            </div>
            <div className="v-campo">
              <label htmlFor="edu-desde">Desde (AAAA-MM)</label>
              <input id="edu-desde" name="desde" required pattern="\d{4}-\d{2}" />
            </div>
            <div className="v-campo">
              <label htmlFor="edu-hasta">Hasta (AAAA-MM)</label>
              <input id="edu-hasta" name="hasta" pattern="\d{4}-\d{2}" />
            </div>
          </div>
          <button type="submit" className="v-boton v-boton-borde">
            Agregar estudio
          </button>
        </form>
      </section>
    </div>
  );
}
