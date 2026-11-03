import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { createHash } from "node:crypto";
import { POST as enviarFormulario } from "@/app/api/postular/[codigo]/route";
import { asegurarFuenteSistema } from "@/entradas/generica/fuentes";
import { VERSION_AVISO } from "@/entradas/formulario/aviso";
import { crearEnlace, desactivarEnlace, formatoCodigo, marcaDeTiempo, reiniciarCuposFormulario, tiempoValido, vacantePublica } from "@/entradas/formulario/servicio";
import { usarConectorDePrueba } from "@/salidas";
import { drenar, leerCv, prisma, reiniciarBd, talentia } from "./utilidades";

// V4 F6: formulario público /postular/<código> → registrarRecepcion → ConectorATS (Talentia, doble de contrato).

const ADMIN = { tipo: "usuario" as const, id: "usuario-admin-pruebas" };
const sha = (b: Uint8Array) => createHash("sha256").update(b).digest("hex");
let codigo = "";

async function enviar(cambios: Record<string, string | null> = {}, opciones: { cv?: Uint8Array | null; ip?: string; codigo?: string; abiertoHaceMs?: number } = {}) {
  const c = opciones.codigo ?? codigo;
  const campos: Record<string, string | null> = {
    nombres: "Valeria",
    apellidos: "Formulario Ficticia",
    correo: "valeria.formulario@demo.test",
    telefono: "300 555 0199",
    autorizacion: "si",
    sitio_web: "",
    t: marcaDeTiempo(c, Date.now() - (opciones.abiertoHaceMs ?? 5000)),
    ...cambios,
  };
  const fd = new FormData();
  for (const [k, v] of Object.entries(campos)) if (v !== null) fd.set(k, v);
  const cv = opciones.cv === undefined ? leerCv() : opciones.cv;
  if (cv) fd.set("cv", new File([cv.slice()], "cv-ficticio.pdf", { type: "application/pdf" }));
  const r = await enviarFormulario(new Request(`http://puente.test/api/postular/${c}`, { method: "POST", headers: { "x-forwarded-for": opciones.ip ?? "203.0.113.10" }, body: fd }), {
    params: Promise.resolve({ codigo: c }),
  });
  return { status: r.status, destino: r.headers.get("location") ?? "" };
}

beforeEach(async () => {
  await reiniciarBd();
  await asegurarFuenteSistema();
  reiniciarCuposFormulario();
  codigo = await crearEnlace(9001, "Desarrollador/a Backend", ADMIN);
});

afterEach(() => {
  usarConectorDePrueba(null);
  vi.restoreAllMocks();
});

describe("código público de la vacante", () => {
  it("cada proceso tiene un solo código, difícil de adivinar; desactivarlo cierra el formulario", async () => {
    expect(codigo).toMatch(formatoCodigo);
    expect(await crearEnlace(9001, "Desarrollador/a Backend", ADMIN)).toBe(codigo);
    expect(await vacantePublica(codigo)).toMatchObject({ procesoAtsId: 9001, titulo: "Desarrollador/a Backend" });
    await desactivarEnlace(codigo, ADMIN);
    expect(await vacantePublica(codigo)).toBeNull();
    expect(await crearEnlace(9001, "Desarrollador/a Backend", ADMIN)).toBe(codigo);
    expect(await vacantePublica("noexiste2345")).toBeNull();
    expect(await vacantePublica("../../etc")).toBeNull();
  });
});

describe("envío correcto", () => {
  it("llega a Postulantes del ATS con el mismo SHA-256, fuente «Formulario público» y la prueba del consentimiento", async () => {
    const r = await enviar();
    expect(r).toEqual({ status: 303, destino: `/postular/${codigo}/enviado` });
    await drenar();
    const rec = await prisma.recepcion.findFirstOrThrow();
    expect(rec).toMatchObject({ fuente: "formulario-publico", vacanteExterna: codigo, estado: "COMPLETADO", procesoAtsId: 9001, correo: "valeria.formulario@demo.test", telefono: "+573005550199" });
    expect(talentia.postulaciones[0]).toMatchObject({ procesoId: 9001, fuente: "Formulario público" });
    expect(talentia.documentos[0].sha256).toBe(sha(leerCv()));
    // Consentimiento: fecha, versión del aviso y origen resumido (HMAC), nunca la IP en claro.
    expect(rec.consentimientoEn).toBeInstanceOf(Date);
    expect(rec.consentimientoVersion).toBe(VERSION_AVISO);
    expect(rec.consentimientoOrigen).toMatch(/^hmac:[0-9a-f]{24}$/);
    expect(JSON.stringify(rec)).not.toContain("203.0.113.10");
    // El id externo no lleva el correo (viaja al ATS como referencia).
    expect(rec.idExterno).not.toContain("valeria");
  });

  it("no escribe datos personales en los registros", async () => {
    const lineas: string[] = [];
    for (const m of ["log", "info", "warn", "error"] as const) vi.spyOn(console, m).mockImplementation((...a: unknown[]) => void lineas.push(a.join(" ")));
    await enviar();
    await drenar();
    expect(lineas.length).toBeGreaterThan(0);
    for (const l of lineas) expect(l).not.toMatch(/valeria|Formulario Ficticia|5550199|203\.0\.113/i);
  });
});

describe("duplicado", () => {
  it("el mismo correo en la misma vacante: misma respuesta (no revela que existía) y una sola postulación en el ATS", async () => {
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
    ["enviado demasiado rápido", {}, { abiertoHaceMs: 200 }, "rapido"],
    ["marca de tiempo falsificada", { t: `${Date.now() - 10_000}.${"0".repeat(64)}` }, {}, "datos"],
  ] as const)("%s", async (_n, cambios, opciones, error) => {
    const r = await enviar(cambios as Record<string, string | null>, opciones as Parameters<typeof enviar>[1]);
    expect(r).toEqual({ status: 303, destino: `/postular/${codigo}?error=${error}` });
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

  it("campo trampa lleno: parece aceptado, pero no se registra nada", async () => {
    expect((await enviar({ sitio_web: "http://spam.example" })).destino).toBe(`/postular/${codigo}/enviado`);
    expect(await prisma.recepcion.count()).toBe(0);
  });
});

describe("límite por IP", () => {
  it("5 envíos por IP cada 10 minutos; otra IP sigue pudiendo", async () => {
    for (let i = 0; i < 5; i++) expect((await enviar({ correo: `persona${i}@demo.test` }, { ip: "198.51.100.7" })).destino).toMatch(/\/enviado$/);
    expect((await enviar({ correo: "persona9@demo.test" }, { ip: "198.51.100.7" })).destino).toBe(`/postular/${codigo}?error=limite`);
    expect((await enviar({ correo: "otra@demo.test" }, { ip: "198.51.100.8" })).destino).toMatch(/\/enviado$/);
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
