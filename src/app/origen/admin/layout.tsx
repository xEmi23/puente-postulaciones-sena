import Link from "next/link";
import { exigirSesion } from "@/lib/sesion-servidor";

export default async function LayoutAdminOrigen({ children }: { children: React.ReactNode }) {
  await exigirSesion("/origen/admin");
  return (
    <>
      <div className="o-admin-aviso" role="note">
        Administración del <strong>simulador</strong> de origen: publicar vacantes y ver o reenviar las entregas al puente. En el
        mundo real esto lo hace LinkedIn.
      </div>
      <nav className="o-admin-nav" aria-label="Administración del portal">
        <Link href="/origen/admin">Vacantes y entregas</Link>
        <Link href="/origen/admin/vacantes/nueva">Publicar vacante</Link>
        <Link href="/origen/admin/consola">Consola de pruebas del webhook</Link>
      </nav>
      {children}
    </>
  );
}
