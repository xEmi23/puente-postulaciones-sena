import Link from "next/link";
import { prisma } from "@/lib/db";
import { exigirUsuario } from "@/lib/sesion-servidor";

export default async function LayoutReclutador({ children }: { children: React.ReactNode }) {
  const u = await exigirUsuario("/reclutador", "RECLUTADOR");
  const empresa = u.empresaId ? await prisma.empresa.findUnique({ where: { id: u.empresaId } }) : null;
  return (
    <>
      <div className="v-linea" style={{ marginBottom: "0.75rem" }}>
        <p className="v-meta" style={{ margin: 0 }}>
          Panel de reclutador · <strong>{empresa?.nombre ?? "Sin empresa"}</strong>
        </p>
        <nav aria-label="Secciones del panel">
          <ul className="v-nav" style={{ margin: 0 }}>
            <li>
              <Link href="/reclutador">Vacantes</Link>
            </li>
            <li>
              <Link href="/reclutador/vacantes/nueva">Publicar vacante</Link>
            </li>
            <li>
              <Link href="/reclutador/integraciones">Integraciones</Link>
            </li>
          </ul>
        </nav>
      </div>
      {children}
    </>
  );
}
