import { beforeEach, describe, expect, it } from "vitest";
import { crearPostulacion } from "@/modules/postulacion";
import { cerrarVacante, editarVacante, reabrirVacante } from "@/modules/vacantes";
import { leerCv, postularEnOrigen, prisma, reiniciarBd, vacante } from "./utilidades";

beforeEach(reiniciarBd);

describe("postulación en Vínculo", () => {
  it("la postulación, el archivo y la outbox se guardan juntos (una transacción)", async () => {
    const { jobApplicationId } = await postularEnOrigen("RT-2026-101");
    const outbox = await prisma.outbox.findFirstOrThrow({ include: { postulacion: { include: { archivoCv: true } } } });
    expect(outbox.estado).toBe("PENDIENTE");
    const payload = JSON.parse(outbox.payload);
    expect(payload.jobApplicationId).toBe(jobApplicationId);
    expect(payload.questionResponses.resumeQuestionResponses.resumeQuestionAnswer.mediaUrl).toBe(
      `http://vinculo.test/api/origen/media/${outbox.postulacion!.archivoCvId}`,
    );
  });

  it("valida datos incompletos, archivo que no es PDF y vacante cerrada", async () => {
    const v = await vacante("RT-2026-101");
    const r1 = await crearPostulacion(v.id, { nombre: "", apellido: "X", correo: "malo", ciudad: "" }, null);
    expect(r1.ok).toBe(false);
    if (!r1.ok) {
      expect(r1.errores.nombre).toBeTruthy();
      expect(r1.errores.correo).toMatch(/correo válido/);
      expect(r1.errores.ciudad).toBeTruthy();
      expect(r1.errores.cv).toMatch(/PDF/);
    }
    const r2 = await crearPostulacion(
      v.id,
      { nombre: "Ana", apellido: "Prueba", correo: "ana@demo.test", ciudad: "Medellín" },
      { nombre: "no-es-pdf.pdf", bytes: leerCv("no-es-pdf.pdf") },
    );
    expect(r2.ok).toBe(false);
    if (!r2.ok) expect(r2.errores.cv).toMatch(/no es un PDF válido/);

    await prisma.vacante.update({ where: { id: v.id }, data: { estado: "CERRADA" } });
    const r3 = await crearPostulacion(v.id, { nombre: "Ana", apellido: "Prueba", correo: "ana@demo.test", ciudad: "Medellín" }, { nombre: "cv.pdf", bytes: leerCv() });
    expect(r3.ok).toBe(false);
    expect(await prisma.outbox.count()).toBe(0);
  });
});

describe("P5.1 · editar y cerrar vacantes en Vínculo", () => {
  it("editar cambia los datos pero no el código (externalJobId)", async () => {
    const r = await editarVacante("RT-2026-101", { titulo: "Desarrollador/a Backend Java Sénior", area: "Ingeniería", ciudad: "Medellín", modalidad: "Remoto", descripcion: "d".repeat(80) });
    expect(r.ok).toBe(true);
    const v = await vacante("RT-2026-101");
    expect(v.titulo).toBe("Desarrollador/a Backend Java Sénior");
    expect(v.modalidad).toBe("Remoto");
    expect((await editarVacante("RT-2026-101", { titulo: "x" })).ok).toBe(false);
  });

  it("cerrar deja un evento JOB_POSTING_STATUS en la outbox y el formulario deja de aceptar postulaciones", async () => {
    await cerrarVacante("RT-2026-101");
    const evento = await prisma.outbox.findFirstOrThrow({ where: { tipo: "JOB_POSTING_STATUS" } });
    expect(JSON.parse(evento.payload)).toMatchObject({ externalJobId: "RT-2026-101", estado: "CERRADA" });
    const v = await vacante("RT-2026-101");
    const r = await crearPostulacion(v.id, { nombre: "Ana", apellido: "Prueba", correo: "ana@demo.test", ciudad: "Medellín" }, { nombre: "cv.pdf", bytes: leerCv() });
    expect(r.ok).toBe(false);
    await reabrirVacante("RT-2026-101");
    const eventos = await prisma.outbox.findMany({ where: { tipo: "JOB_POSTING_STATUS" }, orderBy: { creadoEn: "asc" } });
    expect(eventos.map((e) => JSON.parse(e.payload).estado)).toEqual(["CERRADA", "PUBLICADA"]);
  });
});
