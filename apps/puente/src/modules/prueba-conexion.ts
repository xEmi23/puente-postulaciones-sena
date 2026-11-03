import { prisma } from "@/lib/db";
import { conectorATS } from "@/salidas";
import { autorizaciones, obtenerToken } from "./vinculo-cliente";
import { marcarPrueba } from "./conexiones";

// «Probar conexión» de /conexiones. Cada prueba deja su resultado guardado y visible.

export type ResultadoPrueba = { ok: boolean; detalle: string };

/** Vínculo: obtiene un token nuevo y lista las empresas que autorizaron a la aplicación (toma la primera como empresa). */
export async function probarVinculo(fetchImpl?: typeof fetch): Promise<ResultadoPrueba> {
  try {
    await obtenerToken(fetchImpl, { forzar: true });
    const a = await autorizaciones(fetchImpl);
    const empresa = a.elements[0];
    if (!empresa) {
      const detalle = `Token obtenido para «${a.application.name}», pero ninguna empresa la ha autorizado todavía (Simulador LinkedIn → Integraciones → Conectar ATS).`;
      await marcarPrueba("VINCULO", false, detalle, { empresaId: null, empresaNombre: null });
      return { ok: false, detalle };
    }
    const detalle = `Token obtenido. Aplicación «${a.application.name}» autorizada por «${empresa.name}».`;
    await marcarPrueba("VINCULO", true, detalle, { empresaId: empresa.companyId, empresaNombre: empresa.name });
    return { ok: true, detalle };
  } catch (e) {
    const detalle = e instanceof Error ? e.message : String(e);
    await marcarPrueba("VINCULO", false, detalle);
    return { ok: false, detalle };
  }
}

/** ATS (Talentia en la demo): «verificarConexion» del ConectorATS (en Talentia, permisos de la llave y procesos visibles). */
export async function probarTalentia(fetchImpl?: typeof fetch): Promise<ResultadoPrueba> {
  try {
    const r = await conectorATS({ fetchImpl }).verificarConexion();
    await marcarPrueba("TALENTIA", r.ok, r.detalle, r.extra ?? {});
    return { ok: r.ok, detalle: r.detalle };
  } catch (e) {
    const detalle = e instanceof Error ? e.message : String(e);
    await marcarPrueba("TALENTIA", false, detalle);
    return { ok: false, detalle };
  }
}

export async function estadoConexiones() {
  const filas = await prisma.conexion.findMany();
  return { vinculo: filas.find((f) => f.tipo === "VINCULO") ?? null, talentia: filas.find((f) => f.tipo === "TALENTIA") ?? null };
}
