import Link from "next/link";
import { prisma } from "@/lib/db";
import { exigirUsuario } from "@/lib/sesion-servidor";
import { fecha } from "@/lib/fechas";
import { FormularioNuevaApp } from "./componentes";

export const dynamic = "force-dynamic";
export const metadata = { title: "Desarrolladores" };

export default async function Desarrolladores() {
  const u = await exigirUsuario("/developers");
  const apps = await prisma.aplicacionDev.findMany({ where: { propietarioId: u.id }, orderBy: { creadaEn: "desc" } });
  return (
    <>
      <div className="v-linea">
        <h1>Portal de desarrolladores</h1>
        <Link href="/developers/docs">Documentación de la API</Link>
      </div>
      <p className="v-subtitulo">
        Registra la aplicación de tu ATS para publicar vacantes y recibir las solicitudes por webhook, con el mismo formato y la misma firma que Apply
        Connect. Las empresas la autorizan desde «Integraciones».
      </p>
      <FormularioNuevaApp />
      <section className="v-tarjeta" aria-labelledby="t-mis-apps">
        <h2 id="t-mis-apps">Mis aplicaciones</h2>
        {apps.length === 0 ? (
          <p className="vacio">Aún no tienes aplicaciones.</p>
        ) : (
          <ul style={{ listStyle: "none", padding: 0, margin: 0, display: "grid", gap: "0.6rem" }}>
            {apps.map((a) => (
              <li key={a.id} className="v-linea" data-testid="mi-aplicacion">
                <span>
                  <Link href={`/developers/aplicaciones/${a.id}`}>{a.nombre}</Link>
                  <span className="v-meta" style={{ display: "block" }}>
                    <code>{a.clientId}</code> · creada el {fecha(a.creadaEn)}
                  </span>
                </span>
                <span className={a.revocadaEn ? "v-estado-mal" : a.webhookEstado === "VALIDADO" ? "v-estado-ok" : ""}>
                  {a.revocadaEn ? "Revocada" : a.webhookEstado === "VALIDADO" ? "Webhook validado" : a.webhookEstado === "FALLIDO" ? "Webhook con fallas" : "Webhook sin validar"}
                </span>
              </li>
            ))}
          </ul>
        )}
      </section>
    </>
  );
}
