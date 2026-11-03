import "dotenv/config";
import { prisma } from "../src/lib/db";
import { asegurarFuenteSistema, crearFuente, generarToken } from "../src/entradas/generica/fuentes";
import { referenciaCorrespondencia } from "../src/modules/destino";
import { auditar } from "../src/nucleo/auditoria";

// Parte del Puente de `npm run demo:bot`: la fuente «vinculo-bot» con un token NUEVO (rota el anterior) y la
// correspondencia (vinculo-bot, vacante de Vínculo) → proceso de Talentia. Equivale a hacerlo en Fuentes y
// Correspondencias. Entrada: CONECTAR_VACANTE, CONECTAR_PROCESO. Imprime JSON: { token, fuente, vacante, proceso }.

const FUENTE = "vinculo-bot";
const DESCRIPCION = "Bot asistido del Puente sobre el Simulador LinkedIn (red simulada)";
const actor = { tipo: "sistema" as const, id: "demo:bot" };

async function main() {
  const vacante = String(process.env.CONECTAR_VACANTE ?? "");
  const proceso = Number(process.env.CONECTAR_PROCESO ?? 0);
  if (!vacante || !proceso) throw new Error("Faltan CONECTAR_VACANTE y CONECTAR_PROCESO.");
  await asegurarFuenteSistema();
  if (!(await prisma.fuente.findUnique({ where: { nombre: FUENTE } }))) {
    const r = await crearFuente(FUENTE, DESCRIPCION, actor);
    if (!r.ok) throw new Error(r.mensaje);
  } else {
    // Una fuente creada antes de D-74 conserva la descripción con el nombre visible anterior: se reescribe.
    await prisma.fuente.update({ where: { nombre: FUENTE }, data: { descripcion: DESCRIPCION } });
  }
  const t = await generarToken(FUENTE, actor);
  if (!t.ok || !t.token) throw new Error(t.mensaje);
  const externalJobId = referenciaCorrespondencia(FUENTE, vacante);
  await prisma.correspondencia.upsert({
    where: { externalJobId },
    create: { fuente: FUENTE, vacanteExterna: vacante, externalJobId, procesoAtsId: proceso, descripcion: `${vacante} → proceso ${proceso} (demo del bot)` },
    update: { procesoAtsId: proceso, activa: true, cerradaEn: null },
  });
  await auditar(actor, "correspondencia.guardada", null, `${FUENTE}:${vacante}→${proceso}`);
  process.stdout.write(JSON.stringify({ token: t.token, fuente: FUENTE, vacante, proceso }));
}

main()
  .catch((e) => {
    console.error(e instanceof Error ? e.message : e);
    process.exit(1);
  })
  .finally(() => prisma.$disconnect());
