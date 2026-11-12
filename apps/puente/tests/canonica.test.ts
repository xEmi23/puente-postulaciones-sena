import { describe, expect, it } from "vitest";
import { estadoV4 } from "@/nucleo/estados";
import { normalizarCorreo, normalizarTelefono, normalizarTexto, validarCanonica, validarEntrada } from "@/nucleo/contrato/canonica";

// F1-2: contrato canónico v1 (ESPECIFICACION_V4 §6): casos válidos, inválidos y normalización.

const base = () => ({
  version: "1",
  fuente: "importador",
  idExterno: "9001:abc",
  vacanteExterna: "9001",
  candidato: { nombres: "Camila", apellidos: "Ejemplo Ficticia", correo: "camila.ejemplo@demo.test" },
});

describe("PostulacionCanonica v1 · casos válidos", () => {
  it("acepta la canónica mínima (solo obligatorios) y pone origenDatos = fuente por defecto", () => {
    const r = validarCanonica({ version: "1", fuente: "importador", idExterno: "x", vacanteExterna: "9001", candidato: { nombres: "Ana" } });
    expect(r.ok).toBe(true);
    if (r.ok) {
      expect(r.datos.origenDatos).toBe("fuente");
      expect(r.datos.candidato.correo).toBeUndefined();
    }
  });

  it("acepta la canónica completa con CV, respuestas y fecha con zona horaria", () => {
    const r = validarCanonica({
      ...base(),
      recibidaEn: "2026-11-05T14:03:00-05:00",
      candidato: { ...base().candidato, telefono: "3001234567", ciudad: "Medellín", titular: "Analista", perfilUrl: "https://perfil.demo.test/camila" },
      cv: { nombreArchivo: "cv.pdf", tipo: "application/pdf", sha256: "a".repeat(64), bytes: 1234 },
      respuestas: [{ pregunta: "¿Disponibilidad?", respuesta: "Inmediata" }],
      origenDatos: "confirmado-por-persona",
    });
    expect(r.ok).toBe(true);
  });
});

describe("PostulacionCanonica v1 · casos inválidos", () => {
  const invalido = (cambio: Record<string, unknown>, campo: string) => {
    const r = validarCanonica({ ...base(), ...cambio });
    expect(r.ok).toBe(false);
    if (!r.ok) expect(r.errores.map((e) => e.campo)).toContain(campo);
  };

  it("exige version 1", () => invalido({ version: "2" }, "version"));
  it("exige idExterno", () => invalido({ idExterno: "  " }, "idExterno"));
  it("exige vacanteExterna", () => invalido({ vacanteExterna: "" }, "vacanteExterna"));
  it("exige candidato.nombres", () => invalido({ candidato: { nombres: "   " } }, "candidato.nombres"));
  it("rechaza un correo mal formado", () => invalido({ candidato: { nombres: "Ana", correo: "no-es-correo" } }, "candidato.correo"));
  it("rechaza un teléfono que no se puede llevar a E.164", () => invalido({ candidato: { nombres: "Ana", telefono: "12" } }, "candidato.telefono"));
  it("rechaza un CV que no es PDF o con SHA-256 inválido", () => {
    invalido({ cv: { nombreArchivo: "cv.docx", tipo: "application/msword", sha256: "a".repeat(64), bytes: 1 } }, "cv.tipo");
    invalido({ cv: { nombreArchivo: "cv.pdf", tipo: "application/pdf", sha256: "XYZ", bytes: 1 } }, "cv.sha256");
  });
  it("rechaza un nombre de fuente inválido", () => invalido({ fuente: "Con Espacios" }, "fuente"));

  it("en la entrada genérica la fuente la fija el token: si viene en el cuerpo, se rechaza", () => {
    const r = validarEntrada({ ...base() }, "linkedin-bot");
    expect(r.ok).toBe(false);
    if (!r.ok) expect(r.errores[0].campo).toBe("fuente");
  });

  it("la entrada genérica rechaza campos desconocidos y, sin ellos, toma la fuente del token", () => {
    const { fuente: _sinFuente, ...cuerpo } = base();
    void _sinFuente;
    expect(validarEntrada({ ...cuerpo, extra: 1 }, "linkedin-bot").ok).toBe(false);
    const r = validarEntrada(cuerpo, "linkedin-bot");
    expect(r.ok && r.datos.fuente).toBe("linkedin-bot");
  });
});

// Entrega (2026-11-11): un obligatorio AUSENTE o un campo desconocido devolvían el mensaje genérico de Zod en inglés
// («Invalid input: expected string, received undefined», «Unrecognized key: …») a quien llama la entrada genérica.
describe("mensajes de validación en español", () => {
  const sinFuente = () => {
    const { fuente: _f, ...resto } = base();
    void _f;
    return resto;
  };
  const errores = (r: ReturnType<typeof validarEntrada>) => (r.ok ? [] : r.errores);
  const enIngles = /invalid input|expected|received|unrecognized|too (big|small)/i;

  it("un obligatorio ausente (candidato.nombres, idExterno, vacanteExterna, version) se explica en español", () => {
    const c = sinFuente();
    for (const [cuerpo, campo] of [
      [{ ...c, candidato: { apellidos: "Sin Nombres" } }, "candidato.nombres"],
      [{ ...c, idExterno: undefined }, "idExterno"],
      [{ ...c, vacanteExterna: undefined }, "vacanteExterna"],
      [{ ...c, version: undefined }, "version"],
      [{ ...c, candidato: undefined }, "candidato"],
    ] as const) {
      const e = errores(validarEntrada(JSON.parse(JSON.stringify(cuerpo)), "linkedin-bot"));
      const del = e.find((x) => x.campo === campo);
      expect(del, campo).toBeDefined();
      expect(del!.mensaje, campo).not.toMatch(enIngles);
    }
    const nombres = errores(validarEntrada({ ...c, candidato: { apellidos: "Sin Nombres" } }, "linkedin-bot")).find((x) => x.campo === "candidato.nombres");
    expect(nombres!.mensaje).toBe("Campo obligatorio.");
  });

  it("un campo desconocido o un tipo equivocado se explican en español y nombran el campo", () => {
    const e = errores(validarEntrada({ ...sinFuente(), salario: 5000000 }, "linkedin-bot"));
    expect(e[0].mensaje).toBe("Campo no permitido por el contrato: salario.");
    const t = errores(validarEntrada({ ...sinFuente(), candidato: { nombres: 123 } }, "linkedin-bot"));
    expect(t[0].campo).toBe("candidato.nombres");
    expect(t[0].mensaje).not.toMatch(enIngles);
  });

  it("los mensajes propios de cada campo siguen teniendo prioridad", () => {
    const e = errores(validarEntrada({ ...sinFuente(), version: "2" }, "linkedin-bot"));
    expect(e[0].mensaje).toBe("Versión del contrato no soportada (se espera «1»).");
    const n = errores(validarEntrada({ ...sinFuente(), candidato: { nombres: "   " } }, "linkedin-bot"));
    expect(n[0].mensaje).toBe("Los nombres son obligatorios.");
  });
});

describe("normalización", () => {
  it("correo en minúsculas y sin espacios", () => {
    expect(normalizarCorreo("  Camila.Ejemplo @Demo.TEST ")).toBe("camila.ejemplo@demo.test");
  });

  it("teléfono a E.164 con +57 por defecto si no trae indicativo", () => {
    expect(normalizarTelefono("300 123 4567")).toBe("+573001234567");
    expect(normalizarTelefono("(300) 123-4567")).toBe("+573001234567");
    expect(normalizarTelefono("+57 300 123 4567")).toBe("+573001234567");
    expect(normalizarTelefono("+1 (415) 555-0101")).toBe("+14155550101");
    expect(normalizarTelefono("0044 20 7946 0958")).toBe("+442079460958");
    expect(normalizarTelefono("12")).toBeNull();
    expect(normalizarTelefono("   ")).toBeNull();
  });

  it("nombres con espacios limpios", () => {
    expect(normalizarTexto("  María   José  ")).toBe("María José");
  });

  it("la validación aplica la normalización a la canónica", () => {
    const r = validarCanonica({ ...base(), candidato: { nombres: "  María   José ", correo: " MJ@Demo.Test ", telefono: "300-123-4567" } });
    expect(r.ok).toBe(true);
    if (r.ok) expect(r.datos.candidato).toMatchObject({ nombres: "María José", correo: "mj@demo.test", telefono: "+573001234567" });
  });
});

describe("estado V4 derivado (D-52)", () => {
  it("traduce los estados guardados a los de la especificación", () => {
    expect(estadoV4("RECIBIDO")).toBe("RECIBIDA");
    expect(estadoV4("PROCESANDO")).toBe("EN_PROCESO");
    expect(estadoV4("COMPLETADO")).toBe("COMPLETADA");
    expect(estadoV4("RECHAZADO")).toBe("FALLIDA_DEFINITIVA");
    expect(estadoV4("FALLIDO_REINTENTABLE", "PENDIENTE")).toBe("FALLIDA_REINTENTABLE");
    expect(estadoV4("FALLIDO_REINTENTABLE", "DETENIDO")).toBe("FALLIDA_DEFINITIVA");
    expect(estadoV4("REQUIERE_VERIFICACION")).toBe("REQUIERE_VERIFICACION");
  });
});
