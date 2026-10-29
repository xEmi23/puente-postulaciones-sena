import { redirect } from "next/navigation";
import { exigirSesionAccion } from "@/lib/sesion-servidor";
import { crearVacante } from "@/modules/vacantes";
import { FormularioVacante, type EstadoVacante } from "../../formulario-vacante";

export const metadata = { title: "Publicar vacante" };

async function publicar(_previo: EstadoVacante, formData: FormData): Promise<EstadoVacante> {
  "use server";
  await exigirSesionAccion();
  const valores = Object.fromEntries(["titulo", "area", "ciudad", "modalidad", "descripcion"].map((k) => [k, String(formData.get(k) ?? "")]));
  const r = await crearVacante(valores);
  if (!r.ok) return { errores: r.errores, valores };
  redirect(`/admin?mensaje=${encodeURIComponent(`Vacante ${r.codigo} publicada. Vincúlala a un proceso del ATS en el panel del puente (Correspondencias).`)}`);
}

export default function NuevaVacante() {
  return (
    <section className="o-panel" style={{ maxWidth: 720 }}>
      <h1 style={{ marginTop: 0, fontSize: "1.4rem" }}>Publicar vacante</h1>
      <p className="o-ayuda">El código (externalJobId) se asigna automáticamente con el formato RT-AAAA-NNN.</p>
      <FormularioVacante accion={publicar} inicial={{}} textoBoton="Publicar vacante" />
    </section>
  );
}
