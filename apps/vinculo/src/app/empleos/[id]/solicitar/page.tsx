import Link from "next/link";
import { notFound, redirect } from "next/navigation";
import { prisma } from "@/lib/db";
import { apiHabilitada, config } from "@/lib/config";
import { formatoTamano } from "@/lib/archivos";
import { exigirUsuario } from "@/lib/sesion-servidor";
import { FormularioSolicitud } from "./formulario";

export const dynamic = "force-dynamic";
export const metadata = { title: "Solicitud sencilla" };

export default async function Solicitar({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const u = await exigirUsuario(`/empleos/${id}/solicitar`, "CANDIDATO");
  if (!/^[0-9a-f-]{36}$/.test(id)) notFound();
  const v = await prisma.vacante.findUnique({ where: { id }, include: { empresa: true } });
  if (!v || v.estado === "BORRADOR") notFound();
  if (await prisma.postulacion.findUnique({ where: { vacanteId_candidatoId: { vacanteId: id, candidatoId: u.id } } })) redirect(`/empleos/${id}`);
  if (v.estado !== "PUBLICADA" || !v.solicitudSencilla) {
    return (
      <div className="v-tarjeta">
        <h1>No es posible postularse aquí</h1>
        <p>{v.estado !== "PUBLICADA" ? "Esta vacante ya no recibe postulaciones." : "Esta empresa recibe las postulaciones en su propio sitio."}</p>
        <Link href={`/empleos/${id}`}>Volver a la vacante</Link>
      </div>
    );
  }
  const perfil = await prisma.perfil.findUnique({ where: { userId: u.id }, include: { cv: { omit: { contenido: true } } } });
  const [nombre, ...resto] = u.nombre.split(" ");
  // Nombres compuestos («Juan Pablo»): si el perfil tiene dos nombres, se toman los dos primeros como nombre.
  const partes = u.nombre.split(" ");
  const nombres = partes.length >= 4 ? partes.slice(0, 2).join(" ") : nombre;
  const apellidos = partes.length >= 4 ? partes.slice(2).join(" ") : resto.join(" ");
  return (
    <div style={{ maxWidth: 640, margin: "0 auto" }}>
      <p>
        <Link href={`/empleos/${id}`}>← Volver a la vacante</Link>
      </p>
      <FormularioSolicitud
        vacanteId={v.id}
        titulo={v.titulo}
        empresa={v.empresa.nombre}
        maxMb={Math.round(config().CV_MAX_BYTES / (1024 * 1024))}
        inicial={{ nombre: nombres, apellido: apellidos, correo: u.correo, telefono: perfil?.telefono ?? "", ciudad: perfil?.ciudad ?? "" }}
        conApi={apiHabilitada()}
        cvPerfil={perfil?.cv ? { nombre: perfil.cv.nombreArchivo, tamano: formatoTamano(perfil.cv.tamano) } : null}
      />
    </div>
  );
}
