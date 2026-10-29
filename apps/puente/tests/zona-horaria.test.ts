import { beforeEach, expect, it } from "vitest";
import { postular, prisma, reiniciarBd } from "./utilidades";

beforeEach(reiniciarBd);

// Regresión: el adaptador pg envía fechas sin zona; sin TimeZone=UTC en la sesión se guardaban 5 h desplazadas
// y el procesador no encontraba trabajos "listos" (proximoIntentoEn <= now()).
it("las fechas escritas por Prisma coinciden con now() de PostgreSQL", async () => {
  await postular();
  const [fila] = await prisma.$queryRaw<{ diferencia: number }[]>`
    SELECT abs(extract(epoch FROM (now() - "creadoEn")))::float AS diferencia FROM "Trabajo"`;
  expect(fila.diferencia).toBeLessThan(60);
});
