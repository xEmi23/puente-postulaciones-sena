import "dotenv/config";
import { prisma } from "../src/lib/db";
import { autorizarAplicacion, crearAplicacion, registrarWebhook } from "../src/modules/aplicaciones";
import { CUENTAS_DEMO } from "../src/modules/demo";

// Parte de Vínculo de `npm run demo:conectar`.
//   crear     → la reclutadora demo registra la aplicación del puente y Andina la autoriza; imprime clientId y clientSecret (JSON).
//   webhook   → registra y valida por desafío el webhook de la aplicación (CONECTAR_APP_ID, CONECTAR_WEBHOOK_URL).

async function main() {
  const accion = process.argv[2];
  if (accion === "crear") {
    const reclutadora = await prisma.user.findUniqueOrThrow({ where: { email: CUENTAS_DEMO[2].correo } });
    const r = await crearAplicacion(reclutadora.id, { nombre: "Puente de postulaciones" }, { demo: true });
    if (!r.ok) throw new Error(r.error);
    const a = await autorizarAplicacion(reclutadora.empresaId!, r.app.clientId, reclutadora.id);
    if (!a.ok) throw new Error(a.error);
    process.stdout.write(JSON.stringify({ appId: r.app.id, clientId: r.app.clientId, clientSecret: r.clientSecret }));
  } else if (accion === "webhook") {
    const v = await registrarWebhook(String(process.env.CONECTAR_APP_ID), String(process.env.CONECTAR_WEBHOOK_URL));
    console.log(`Webhook: ${v.ok ? "✔" : "✖"} ${v.detalle}`);
    if (!v.ok) process.exit(3);
  } else {
    throw new Error("Uso: tsx scripts/crear-aplicacion.ts crear|webhook");
  }
}

main()
  .catch((e) => {
    console.error(e instanceof Error ? e.message : e);
    process.exit(1);
  })
  .finally(() => prisma.$disconnect());
