import { beforeEach, expect, it } from "vitest";
import { postularEnOrigen, prisma, reiniciarBd } from "./utilidades";

beforeEach(reiniciarBd);

// Regresión: el adaptador pg envía fechas sin zona; sin TimeZone=UTC en la sesión se guardaban 5 h desplazadas
// y el despachador no encontraba filas "listas" (proximoIntentoEn <= now()).
it("las fechas escritas por Prisma coinciden con now() de PostgreSQL", async () => {
  await postularEnOrigen();
  const [fila] = await prisma.$queryRaw<{ diferencia: number }[]>`
    SELECT abs(extract(epoch FROM (now() - "creadoEn")))::float AS diferencia FROM "Outbox"`;
  expect(fila.diferencia).toBeLessThan(60);
});
