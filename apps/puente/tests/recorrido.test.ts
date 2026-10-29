import { beforeEach, describe, expect, it } from "vitest";
import { sha256Hex } from "@/lib/archivos";
import { drenar, leerCv, postular, prisma, reiniciarBd, talentia, vinculo } from "./utilidades";

beforeEach(reiniciarBd);

describe("recorrido del puente: webhook → CV de Vínculo → candidato, documento y postulación en Talentia", () => {
  it("una postulación con PDF termina en Postulantes del proceso correcto con el mismo hash", async () => {
    const original = leerCv();
    const { jobApplicationId } = await postular({ codigo: "RT-2026-101" });
    await drenar();

    const rec = await prisma.recepcion.findUniqueOrThrow({ where: { jobApplicationId }, include: { eventos: true } });
    expect(rec.estado).toBe("COMPLETADO");
    expect(rec.paso).toBe("postulacion_creada");
    expect(rec.procesoAtsId).toBe(9001);
    expect(rec.cvContenido).toBeNull(); // la copia temporal se elimina al completar
    expect(rec.eventos.map((e) => e.paso).filter(Boolean)).toEqual(
      expect.arrayContaining(["cv_descargado", "postulante_listo", "documento_subido", "postulacion_creada"]),
    );
    expect(vinculo.descargas).toBe(1);

    const [post] = talentia.postulaciones;
    expect(post).toMatchObject({ procesoId: 9001, etapa: "Postulantes", referenciaExterna: jobApplicationId });
    expect(post.fuente).toBe("Portal simulado (tipo LinkedIn)"); // nunca «LinkedIn Easy Apply» en texto visible (D-19)
    const candidato = talentia.candidatos.get(post.candidatoId)!;
    expect(candidato.correo).toBe("camila.ejemplo@demo.test");
    expect(candidato.telefono).toBe("+573000000001");
    const doc = talentia.documentos.find((d) => d.id === post.documentoId)!;
    expect(doc.sha256).toBe(sha256Hex(original));
    expect(sha256Hex(doc.bytes)).toBe(sha256Hex(original));
  });
});
