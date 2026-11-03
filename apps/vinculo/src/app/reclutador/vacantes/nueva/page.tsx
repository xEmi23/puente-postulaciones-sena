import { redirect } from "next/navigation";
import { prisma } from "@/lib/db";
import { apiHabilitada } from "@/lib/config";
import { exigirUsuario, exigirUsuarioAccion } from "@/lib/sesion-servidor";
import { crearVacante, type ErroresVacante } from "@/modules/vacantes";
import { CamposVacante } from "../../formulario-vacante";

export const dynamic = "force-dynamic";
export const metadata = { title: "Publicar vacante" };

async function crear(formData: FormData) {
  "use server";
  const u = await exigirUsuarioAccion("RECLUTADOR");
  if (!u.empresaId) throw new Error("Tu cuenta no pertenece a una empresa.");
  const valores = Object.fromEntries(formData) as Record<string, string>;
  const r = await crearVacante(u.empresaId, valores, formData.get("accion") !== "borrador");
  if (!r.ok) redirect(`/reclutador/vacantes/nueva?${new URLSearchParams({ ...valores, errores: JSON.stringify(r.errores) })}`);
  const aviso = r.vacante.motivoSinSolicitud ? ` Aviso: ${r.vacante.motivoSinSolicitud}` : "";
  redirect(`/reclutador?mensaje=${encodeURIComponent(`Vacante ${r.vacante.externalJobId} ${r.vacante.estado === "PUBLICADA" ? "publicada" : "guardada como borrador"}.${aviso}`)}`);
}

export default async function NuevaVacante({ searchParams }: { searchParams: Promise<Record<string, string>> }) {
  const u = await exigirUsuario("/reclutador/vacantes/nueva", "RECLUTADOR");
  const q = await searchParams;
  let errores: ErroresVacante = {};
  try {
    errores = q.errores ? JSON.parse(q.errores) : {};
  } catch {
    errores = {};
  }
  const aplicaciones = await prisma.aplicacionDev.findMany({
    where: { revocadaEn: null, autorizaciones: { some: { empresaId: u.empresaId ?? "", revocadaEn: null } } },
    select: { id: true, nombre: true },
  });
  return (
    <form action={crear} className="v-tarjeta" style={{ maxWidth: 760 }} aria-labelledby="t-nueva">
      <h1 id="t-nueva" style={{ marginTop: 0 }}>
        Publicar vacante
      </h1>
      {Object.keys(errores).length > 0 && (
        <div className="alerta alerta-error" role="alert">
          {errores.general ?? "Revisa los campos marcados."}
        </div>
      )}
      <CamposVacante valores={q} errores={errores} aplicaciones={apiHabilitada() ? aplicaciones : null} />
      <div style={{ display: "flex", gap: "0.5rem", flexWrap: "wrap" }}>
        <button type="submit" name="accion" value="publicar" className="v-boton">
          Publicar vacante
        </button>
        <button type="submit" name="accion" value="borrador" className="v-boton v-boton-borde">
          Guardar como borrador
        </button>
      </div>
    </form>
  );
}
