import { notFound, redirect } from "next/navigation";
import { prisma } from "@/lib/db";
import { exigirSesionAccion } from "@/lib/sesion-servidor";
import { editarVacante } from "@/modules/origen/vacantes";
import { FormularioVacante, type EstadoVacante } from "../../formulario-vacante";

export const dynamic = "force-dynamic";
export const metadata = { title: "Editar vacante" };

export default async function EditarVacante({ params }: { params: Promise<{ codigo: string }> }) {
  const { codigo } = await params;
  const v = await prisma.vacante.findUnique({ where: { codigo: decodeURIComponent(codigo) } });
  if (!v) notFound();

  async function guardar(_previo: EstadoVacante, formData: FormData): Promise<EstadoVacante> {
    "use server";
    await exigirSesionAccion();
    const valores = Object.fromEntries(["titulo", "area", "ciudad", "modalidad", "descripcion"].map((k) => [k, String(formData.get(k) ?? "")]));
    const r = await editarVacante(v!.codigo, valores);
    if (!r.ok) return { errores: r.errores, valores };
    redirect(`/origen/admin?mensaje=${encodeURIComponent(`Vacante ${v!.codigo} actualizada.`)}`);
  }

  return (
    <section className="o-panel" style={{ maxWidth: 720 }}>
      <h1 style={{ marginTop: 0, fontSize: "1.4rem" }}>
        Editar vacante <code>{v.codigo}</code>
      </h1>
      <p className="o-ayuda">El código no cambia: es la referencia (externalJobId) que usa el puente para encontrar el proceso del ATS.</p>
      <FormularioVacante
        accion={guardar}
        inicial={{ titulo: v.titulo, area: v.area, ciudad: v.ciudad, modalidad: v.modalidad, descripcion: v.descripcion }}
        textoBoton="Guardar cambios"
      />
    </section>
  );
}
