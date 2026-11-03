import "dotenv/config";
import { prisma } from "../src/lib/db";
import { guardarTalentia, guardarVinculo } from "../src/modules/conexiones";
import { probarTalentia, probarVinculo } from "../src/modules/prueba-conexion";
import { publicarProceso } from "../src/modules/publicacion";

// Parte del puente de `npm run demo:conectar`: guarda las conexiones recibidas por variables de entorno
// (CONECTAR_VINCULO_URL, CONECTAR_CLIENT_ID, CONECTAR_CLIENT_SECRET, CONECTAR_TALENTIA_URL, CONECTAR_API_KEY), las prueba
// y publica en Vínculo los procesos de CONECTAR_PUBLICAR (por ejemplo «9001,9002»). Requiere que las tres apps estén
// corriendo: Vínculo valida el webhook del puente por HTTP antes de publicar.
// Sin CONECTAR_VINCULO_URL solo guarda y prueba Talentia (la usa `npm run demo:bot`: con la API de Vínculo apagada, D-68).

async function main() {
  const e = process.env;
  if (!e.CONECTAR_VINCULO_URL) {
    const t = await guardarTalentia({ urlBase: e.CONECTAR_TALENTIA_URL, apiKey: e.CONECTAR_API_KEY });
    if (!t.ok) throw new Error(`Simulador BUK: ${t.error}`);
    const pt = await probarTalentia();
    console.log(`Simulador BUK: ${pt.ok ? "✔" : "✖"} ${pt.detalle}`);
    if (!pt.ok) process.exit(3);
    return;
  }
  const v = await guardarVinculo({ urlBase: e.CONECTAR_VINCULO_URL, clientId: e.CONECTAR_CLIENT_ID, clientSecret: e.CONECTAR_CLIENT_SECRET });
  if (!v.ok) throw new Error(`Simulador LinkedIn: ${v.error}`);
  const t = await guardarTalentia({ urlBase: e.CONECTAR_TALENTIA_URL, apiKey: e.CONECTAR_API_KEY });
  if (!t.ok) throw new Error(`Simulador BUK: ${t.error}`);
  const pv = await probarVinculo();
  const pt = await probarTalentia();
  console.log(`Simulador LinkedIn: ${pv.ok ? "✔" : "✖"} ${pv.detalle}`);
  console.log(`Simulador BUK: ${pt.ok ? "✔" : "✖"} ${pt.detalle}`);
  if (!pv.ok || !pt.ok) process.exit(3);
  for (const id of (e.CONECTAR_PUBLICAR ?? "").split(",").map(Number).filter(Boolean)) {
    const r = await publicarProceso(id);
    console.log(`Proceso ${id}: ${r.ok ? "✔" : "✖"} ${r.mensaje}`);
    if (!r.ok) process.exit(4);
  }
}

main()
  .catch((err) => {
    console.error(`✖ ${err instanceof Error ? err.message : err}`);
    process.exit(1);
  })
  .finally(() => prisma.$disconnect());
