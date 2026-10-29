import { conApi, respuesta } from "@/modules/api/http";

export const dynamic = "force-dynamic";

/** Datos de la llave con la que se llama (contrato del simulador): sirve para «Probar conexión» y ver los permisos. */
export function GET(req: Request) {
  return conApi(req, "/api/v1/api-key", "lectura", async ({ llave }) =>
    respuesta(200, {
      data: {
        nombre: llave.nombre,
        prefijo: llave.prefijo,
        permisos: { seleccion: { lectura: llave.permisoLectura, modificacion: llave.permisoModificacion } },
        creada_en: llave.creadaEn.toISOString(),
      },
    }),
  );
}
