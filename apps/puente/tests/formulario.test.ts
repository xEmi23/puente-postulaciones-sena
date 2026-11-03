import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { createHash } from "node:crypto";
import { POST as enviarFormulario } from "@/app/api/postular/[codigo]/route";
import { asegurarFuenteSistema } from "@/entradas/generica/fuentes";
import { VERSION_AVISO } from "@/entradas/formulario/aviso";
import { CAMPO_TRAMPA, perfilValido, telefonoE164, validarFormulario } from "@/entradas/formulario/campos";
import {
  crearEnlace,
  desactivarEnlace,
  formatoCodigo,
  guardarFicha,
  marcaDeTiempo,
  reiniciarCuposFormulario,
  tiempoValido,
  vacantePublica,
} from "@/entradas/formulario/servicio";
import { referenciaCorta } from "@/lib/privacidad";
import { usarConectorDePrueba } from "@/salidas";
import { drenar, leerCv, prisma, reiniciarBd, talentia } from "./utilidades";

// V4 F6: formulario público /postular/<código> → registrarRecepcion → ConectorATS (Talentia, doble de contrato).

const ADMIN = { tipo: "usuario" as const, id: "usuario-admin-pruebas" };
const sha = (b: Uint8Array) => createHash("sha256").update(b).digest("hex");
const PROCESO = { titulo: "Desarrollador/a Backend", ciudad: "Medellín", descripcion: "Proceso de selección para el equipo de plataforma del Puente." };
let codigo = "";

type Opciones = { cv?: Uint8Array | null; ip?: string; codigo?: string; abiertoHaceMs?: number; json?: boolean };

async function enviar(cambios: Record<string, string | null> = {}, opciones: Opciones = {}) {
  const c = opciones.codigo ?? codigo;
  const campos: Record<string, string | null> = {
    nombres: "Valeria",
    apellidos: "Formulario Ficticia",
    correo: "valeria.formulario@demo.test",
    indicativo: "+57",
    telefono: "300 555 0199",
    ciudad: "Envigado",
    perfil: "https://www.linkedin.com/in/valeria-ficticia",
    autorizacion: "si",
    [CAMPO_TRAMPA]: "",
    t: marcaDeTiempo(c, Date.now() - (opciones.abiertoHaceMs ?? 5000)),
    ...cambios,
  };
  const fd = new FormData();
  for (const [k, v] of Object.entries(campos)) if (v !== null) fd.set(k, v);
  const cv = opciones.cv === undefined ? leerCv() : opciones.cv;
  if (cv) fd.set("cv", new File([cv.slice()], "cv-ficticio.pdf", { type: "application/pdf" }));
  const headers: Record<string, string> = { "x-forwarded-for": opciones.ip ?? "203.0.113.10" };
  if (opciones.json) headers.accept = "application/json";
  const r = await enviarFormulario(new Request(`http://puente.test/api/postular/${c}`, { method: "POST", headers, body: fd }), { params: Promise.resolve({ codigo: c }) });
  return { status: r.status, destino: r.headers.get("location") ?? "", cuerpo: opciones.json ? ((await r.json()) as Record<string, unknown>) : null };
}

beforeEach(async () => {
  await reiniciarBd();
  await prisma.$executeRawUnsafe(`TRUNCATE "FichaVacante", "EventoAuditoria"`);
  await asegurarFuenteSistema();
  reiniciarCuposFormulario();
  codigo = await crearEnlace(9001, PROCESO, ADMIN);
});

afterEach(() => {
  usarConectorDePrueba(null);
  vi.restoreAllMocks();
});

describe("código público y ficha de la vacante", () => {
  it("cada proceso tiene un solo código, difícil de adivinar; desactivarlo cierra el formulario", async () => {
    expect(codigo).toMatch(formatoCodigo);
    expect(await crearEnlace(9001, PROCESO, ADMIN)).toBe(codigo);
    expect(await vacantePublica(codigo)).toMatchObject({ procesoAtsId: 9001 });
    await desactivarEnlace(codigo, ADMIN);
    expect(await vacantePublica(codigo)).toBeNull();
    expect(await crearEnlace(9001, PROCESO, ADMIN)).toBe(codigo);
    expect(await vacantePublica("noexiste2345")).toBeNull();
    expect(await vacantePublica("../../etc")).toBeNull();
  });

  it("la ficha sale del proceso del ATS por defecto y se edita sin tocar el proceso; reactivar el enlace la conserva", async () => {
    expect((await vacantePublica(codigo))!.ficha).toEqual({
      titulo: "Desarrollador/a Backend",
      ciudad: "Medellín",
      modalidad: "Presencial",
      tipoEmpleo: "Tiempo completo",
      descripcion: PROCESO.descripcion,
    });
    const nueva = { titulo: "Gerente Administrativo", ciudad: "Itagüí, Antioquia", modalidad: "Presencial", tipoEmpleo: "Tiempo completo", descripcion: "Lidera el área administrativa.\n\n- Presupuesto\n- Equipo" };
    expect(await guardarFicha(codigo, nueva, ADMIN)).toEqual({ ok: true });
    expect((await vacantePublica(codigo))!).toMatchObject({ procesoAtsId: 9001, ficha: nueva });
    await desactivarEnlace(codigo, ADMIN);
    await crearEnlace(9001, PROCESO, ADMIN);
    expect((await vacantePublica(codigo))!.ficha.titulo).toBe("Gerente Administrativo");
    expect(await prisma.eventoAuditoria.count({ where: { accion: "formulario.ficha_guardada" } })).toBe(1);
  });

  it("la ficha se valida (modalidad y tipo de una lista, descripción mínima) y no se guarda para un código inexistente", async () => {
    const base = { titulo: "Gerente", ciudad: "Itagüí", modalidad: "Presencial", tipoEmpleo: "Tiempo completo", descripcion: "Descripción suficientemente larga." };
    expect(await guardarFicha(codigo, { ...base, modalidad: "En la Luna" }, ADMIN)).toMatchObject({ ok: false, mensaje: expect.stringContaining("Modalidad") });
    expect(await guardarFicha(codigo, { ...base, descripcion: "corta" }, ADMIN)).toMatchObject({ ok: false, mensaje: expect.stringContaining("Descripción") });
    expect(await guardarFicha("noexiste2345", base, ADMIN)).toEqual({ ok: false, mensaje: "El enlace no existe." });
  });
});

describe("campos y validación (compartida con la página)", () => {
  it("teléfono con indicativo a E.164; indicativo desconocido o número corto se rechazan", () => {
    expect(telefonoE164("+57", "300 555 0199")).toBe("+573005550199");
    expect(telefonoE164("+52", "55 1234 5678")).toBe("+525512345678");
    expect(telefonoE164("+99", "3005550199")).toBeNull();
    expect(telefonoE164("+57", "12")).toBeNull();
    expect(telefonoE164("+57", "300-ABC")).toBeNull();
  });

  it("perfil de LinkedIn: https, dominio linkedin.com, con ruta y ≤ 200 caracteres", () => {
    expect(perfilValido("https://www.linkedin.com/in/ana")).toBe(true);
    expect(perfilValido("https://co.linkedin.com/in/ana")).toBe(true);
    expect(perfilValido("http://www.linkedin.com/in/ana")).toBe(false);
    expect(perfilValido("https://linkedin.com.evil.test/in/ana")).toBe(false);
    expect(perfilValido("https://www.linkedin.com/")).toBe(false);
    expect(perfilValido("linkedin.com/in/ana")).toBe(false);
    expect(perfilValido(`https://www.linkedin.com/in/${"a".repeat(200)}`)).toBe(false);
  });

  it("validarFormulario devuelve un mensaje en español por campo y normaliza los válidos", () => {
    const r = validarFormulario({ nombres: " ", apellidos: "", correo: "x@", indicativo: "+57", telefono: "1", ciudad: "", perfil: "no-es-url" });
    expect(r.ok).toBe(false);
    if (!r.ok) {
      expect(Object.keys(r.errores).sort()).toEqual(["apellidos", "ciudad", "correo", "nombres", "perfil", "telefono"]);
      expect(r.errores.ciudad).toBe("Escribe tu ciudad de residencia.");
    }
    const ok = validarFormulario({ nombres: " Ana  María ", apellidos: "Ruiz", correo: "Ana@Demo.Test", indicativo: "+57", telefono: "3005550199", ciudad: " Itagüí ", perfil: "" });
    expect(ok).toEqual({ ok: true, datos: { nombres: "Ana María", apellidos: "Ruiz", correo: "ana@demo.test", telefono: "+573005550199", ciudad: "Itagüí" } });
  });
});

describe("envío correcto", () => {
  it("llega a Postulantes del ATS con el mismo SHA-256, ciudad, teléfono E.164 y el perfil como referencia externa", async () => {
    const r = await enviar();
    const rec = await prisma.recepcion.findFirstOrThrow();
    expect(r).toMatchObject({ status: 303, destino: `/postular/${codigo}/enviado?ref=${referenciaCorta(rec.jobApplicationId)}` });
    await drenar();
    const fin = await prisma.recepcion.findFirstOrThrow();
    expect(fin).toMatchObject({
      fuente: "formulario-publico",
      vacanteExterna: codigo,
      estado: "COMPLETADO",
      procesoAtsId: 9001,
      correo: "valeria.formulario@demo.test",
      telefono: "+573005550199",
      ciudad: "Envigado",
      jobApplicant: "https://www.linkedin.com/in/valeria-ficticia",
    });
    expect(talentia.postulaciones[0]).toMatchObject({ procesoId: 9001, fuente: "Formulario público" });
    expect(talentia.documentos[0].sha256).toBe(sha(leerCv()));
    // Consentimiento: fecha, versión del aviso y origen resumido (HMAC), nunca la IP en claro.
    expect(fin.consentimientoEn).toBeInstanceOf(Date);
    expect(fin.consentimientoVersion).toBe(VERSION_AVISO);
    expect(fin.consentimientoOrigen).toMatch(/^hmac:[0-9a-f]{24}$/);
    expect(JSON.stringify(fin)).not.toContain("203.0.113.10");
    // El id externo no lleva el correo (viaja al ATS como referencia de la postulación).
    expect(fin.idExterno).not.toContain("valeria");
  });

  it("sin perfil (opcional) y con otro indicativo: se acepta; la referencia externa es la del Puente", async () => {
    await enviar({ perfil: "", indicativo: "+52", telefono: "55 1234 5678" });
    await drenar();
    const rec = await prisma.recepcion.findFirstOrThrow();
    expect(rec).toMatchObject({ estado: "COMPLETADO", telefono: "+525512345678", jobApplicant: `formulario-publico:${rec.idExterno}` });
  });

  it("modo JSON (página con JavaScript): 200 con la referencia", async () => {
    const r = await enviar({}, { json: true });
    const rec = await prisma.recepcion.findFirstOrThrow();
    expect(r).toMatchObject({ status: 200, cuerpo: { ok: true, referencia: referenciaCorta(rec.jobApplicationId) } });
  });

  it("no escribe datos personales en los registros", async () => {
    const lineas: string[] = [];
    for (const m of ["log", "info", "warn", "error"] as const) vi.spyOn(console, m).mockImplementation((...a: unknown[]) => void lineas.push(a.join(" ")));
    await enviar();
    await drenar();
    expect(lineas.length).toBeGreaterThan(0);
    for (const l of lineas) expect(l).not.toMatch(/valeria|Formulario Ficticia|5550199|Envigado|203\.0\.113/i);
  });
});

describe("duplicado", () => {
  it("el mismo correo en la misma vacante: misma respuesta y referencia (no revela nada nuevo) y una sola postulación en el ATS", async () => {
    const a = await enviar();
    await drenar();
    const b = await enviar({ correo: "  Valeria.Formulario@demo.test " });
    expect(b).toEqual(a);
    await drenar();
    expect(await prisma.recepcion.count()).toBe(1);
    expect((await prisma.recepcion.findFirstOrThrow()).duplicadosEvitados).toBe(1);
    expect(talentia.conteo()).toEqual({ candidatos: 1, documentos: 1, postulaciones: 1 });
  });
});

describe("rechazos sin crear nada", () => {
  it.each([
    ["PDF falso (no empieza por %PDF)", {}, { cv: new TextEncoder().encode("<html>no soy un pdf</html>") }, "no_pdf"],
    ["sin CV", {}, { cv: null }, "sin_cv"],
    ["sin consentimiento", { autorizacion: null }, {}, "consentimiento"],
    ["correo inválido", { correo: "no-es-correo" }, {}, "datos"],
    ["teléfono inválido", { telefono: "12" }, {}, "datos"],
    ["indicativo inexistente", { indicativo: "+999" }, {}, "datos"],
    ["ciudad vacía", { ciudad: "   " }, {}, "datos"],
    ["URL de perfil inválida", { perfil: "https://perfiles.example.test/ana" }, {}, "datos"],
    ["enviado demasiado rápido", {}, { abiertoHaceMs: 200 }, "rapido"],
    ["marca de tiempo falsificada", { t: `${Date.now() - 10_000}.${"0".repeat(64)}` }, {}, "datos"],
  ] as const)("%s", async (_n, cambios, opciones, error) => {
    const r = await enviar(cambios as Record<string, string | null>, opciones as Opciones);
    expect(r).toMatchObject({ status: 303, destino: `/postular/${codigo}?error=${error}` });
    expect(await prisma.recepcion.count()).toBe(0);
  });

  it("modo JSON: 422 con el mensaje de cada campo (ciudad vacía y URL inválida)", async () => {
    const r = await enviar({ ciudad: "", perfil: "linkedin" }, { json: true });
    expect(r.status).toBe(422);
    expect(r.cuerpo).toMatchObject({
      ok: false,
      error: "datos",
      campos: { ciudad: "Escribe tu ciudad de residencia.", perfil: expect.stringContaining("https://www.linkedin.com/in/") },
    });
    expect(await prisma.recepcion.count()).toBe(0);
  });

  it("CV de más de 5 MB", async () => {
    const grande = new Uint8Array(5 * 1024 * 1024 + 10);
    grande.set(new TextEncoder().encode("%PDF-1.4"));
    expect((await enviar({}, { cv: grande })).destino).toBe(`/postular/${codigo}?error=grande`);
    expect(await prisma.recepcion.count()).toBe(0);
  });

  it("código inexistente o desactivado: vuelve al formulario, que responde 404", async () => {
    expect((await enviar({}, { codigo: "noexiste2345" })).destino).toBe("/postular/noexiste2345?error=vacante");
    await desactivarEnlace(codigo, ADMIN);
    expect((await enviar()).destino).toBe(`/postular/${codigo}?error=vacante`);
    expect(await prisma.recepcion.count()).toBe(0);
  });

  it("campo trampa (renombrado, ya no «sitio_web») lleno: parece aceptado, pero no se registra nada", async () => {
    expect(CAMPO_TRAMPA).toBe("campo_auxiliar");
    expect((await enviar({ [CAMPO_TRAMPA]: "relleno por un robot" })).destino).toMatch(new RegExp(`^/postular/${codigo}/enviado\\?ref=[A-Z0-9]{8}$`));
    expect(await prisma.recepcion.count()).toBe(0);
    // El nombre viejo ya no es la trampa: llenarlo no cambia nada.
    expect((await enviar({ sitio_web: "x" })).destino).toMatch(/\/enviado\?ref=/);
    expect(await prisma.recepcion.count()).toBe(1);
  });
});

describe("límite por IP", () => {
  it("5 envíos por IP cada 10 minutos; otra IP sigue pudiendo", async () => {
    for (let i = 0; i < 5; i++) expect((await enviar({ correo: `persona${i}@demo.test` }, { ip: "198.51.100.7" })).destino).toMatch(/\/enviado\?ref=/);
    expect((await enviar({ correo: "persona9@demo.test" }, { ip: "198.51.100.7" })).destino).toBe(`/postular/${codigo}?error=limite`);
    expect((await enviar({ correo: "otra@demo.test" }, { ip: "198.51.100.8" })).destino).toMatch(/\/enviado\?ref=/);
    expect(await prisma.recepcion.count()).toBe(6);
  });
});

describe("tiempo mínimo de llenado", () => {
  it("la marca está firmada por código y vence a las 2 horas", () => {
    const ahora = Date.now();
    expect(tiempoValido(codigo, marcaDeTiempo(codigo, ahora - 4000), ahora)).toBe("ok");
    expect(tiempoValido(codigo, marcaDeTiempo(codigo, ahora - 1000), ahora)).toBe("rapido");
    expect(tiempoValido("otrocodigo23", marcaDeTiempo(codigo, ahora - 4000), ahora)).toBe("invalido");
    expect(tiempoValido(codigo, marcaDeTiempo(codigo, ahora - 3 * 3600_000), ahora)).toBe("invalido");
  });
});
