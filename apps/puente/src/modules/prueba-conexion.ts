import { prisma } from "@/lib/db";
import * as ats from "./ats-cliente";
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
      const detalle = `Token obtenido para «${a.application.name}», pero ninguna empresa la ha autorizado todavía (Vínculo → Integraciones → Conectar ATS).`;
      await marcarPrueba("VINCULO", false, detalle, { empresaId: null, empresaNombre: null });
      return { ok: false, detalle };
    }
    const detalle = `Token obtenido. Aplicación «${a.application.name}» autorizada por «${empresa.name}». Webhook en Vínculo: ${a.application.webhookStatus === "VALIDADO" ? "validado" : "sin validar"}.`;
    await marcarPrueba("VINCULO", true, detalle, { empresaId: empresa.companyId, empresaNombre: empresa.name });
    return { ok: true, detalle };
  } catch (e) {
    const detalle = e instanceof Error ? e.message : String(e);
    await marcarPrueba("VINCULO", false, detalle);
    return { ok: false, detalle };
  }
}

/** Talentia: consulta la llave (permisos) y lista los procesos. */
export async function probarTalentia(fetchImpl?: typeof fetch): Promise<ResultadoPrueba> {
  try {
    const llave = await ats.llaveActual({ fetchImpl });
    const procesos = await ats.listarProcesos({ fetchImpl });
    const { lectura, modificacion } = llave.permisos.seleccion;
    const faltan = !lectura || !modificacion;
    const detalle = `Llave «${llave.nombre}» (${llave.prefijo}…): Lectura ${lectura ? "sí" : "no"}, Modificación ${modificacion ? "sí" : "no"}. ${procesos.length} procesos visibles.${
      faltan ? " El puente necesita ambos permisos de Selección." : ""
    }`;
    await marcarPrueba("TALENTIA", !faltan, detalle, { permisoLectura: lectura, permisoEscritura: modificacion });
    return { ok: !faltan, detalle };
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
