import { beforeEach, describe, expect, it } from "vitest";
import { sha256Hex } from "@/lib/archivos";
import { drenar, leerCv, postularEnOrigen, prisma, reiniciarBd, vacante } from "./utilidades";
import { crearPostulacion } from "@/modules/origen/postulacion";

beforeEach(reiniciarBd);

describe("recorrido vertical origen → puente → ATS (PostgreSQL real, route handlers reales)", () => {
  it("una postulación con PDF termina en la columna Postulantes del proceso correcto con el mismo hash", async () => {
    const original = leerCv();
    const { jobApplicationId } = await postularEnOrigen("RT-2026-101");

    // La postulación y la outbox se guardaron juntas.
    const outbox = await prisma.outboxOrigen.findFirstOrThrow({ include: { postulacion: true } });
    expect(outbox.estado).toBe("PENDIENTE");
    expect(JSON.parse(outbox.payload).jobApplicationId).toBe(jobApplicationId);

    await drenar();

    const entregado = await prisma.outboxOrigen.findUniqueOrThrow({ where: { id: outbox.id }, include: { intentosEntrega: true } });
    expect(entregado.estado).toBe("ENVIADO");
    expect(entregado.intentosEntrega).toHaveLength(1);
    expect(entregado.intentosEntrega[0].httpStatus).toBe(200);

    const rec = await prisma.recepcion.findUniqueOrThrow({ where: { jobApplicationId }, include: { eventos: true } });
    expect(rec.estado).toBe("COMPLETADO");
    expect(rec.paso).toBe("postulacion_creada");
    expect(rec.procesoAtsId).toBe(9001);
    expect(rec.cvContenido).toBeNull(); // la copia temporal se elimina al completar
    expect(rec.eventos.map((e) => e.paso).filter(Boolean)).toEqual(
      expect.arrayContaining(["cv_descargado", "candidato_creado", "documento_subido", "postulacion_creada"]),
    );

    const post = await prisma.postulacionAts.findUniqueOrThrow({
      where: { referenciaExterna: jobApplicationId },
      include: { etapa: true, candidato: true, documento: true },
    });
    expect(post.procesoId).toBe(9001);
    expect(post.etapa.nombre).toBe("Postulantes");
    expect(post.etapa.orden).toBe(1);
    expect(post.calificacion).toBe("SIN_CALIFICAR");
    expect(post.fuente).toContain("LinkedIn");
    expect(post.vista).toBe(false);
    expect(post.candidato.correo).toBe("camila.ejemplo@demo.test");
    expect(post.candidato.telefono).toBe("+573000000001");

    // Hash del CV en el ATS = hash del archivo original, y los bytes son idénticos.
    expect(post.documento!.sha256).toBe(sha256Hex(original));
    expect(sha256Hex(post.documento!.contenido)).toBe(sha256Hex(original));
  });

  it("valida en el origen: datos incompletos, archivo que no es PDF y vacante cerrada", async () => {
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
    expect(await prisma.outboxOrigen.count()).toBe(0);
  });
});
