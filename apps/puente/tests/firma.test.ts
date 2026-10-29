import { createHmac } from "node:crypto";
import { describe, expect, it } from "vitest";
import { firmarCuerpo, firmaValida, respuestaDesafio } from "@/lib/firma";

// Referencia independiente escrita a partir de la fórmula documentada (docs/contratos.md §Firma),
// para no validar la implementación contra sí misma.
const referencia = (cuerpo: string, secreto: string) => createHmac("sha256", secreto).update("hmacsha256=" + cuerpo).digest("hex");

describe("firma X-LI-Signature", () => {
  const secreto = "secreto-de-prueba-0123456789";
  const cuerpo = '{"type":"EXPORT_JOB_APPLICATION","jobApplicationId":"urn:li:jobApplication:1"}';

  it("coincide con la fórmula documentada: hex(HMAC-SHA256('hmacsha256=' + cuerpo crudo))", () => {
    expect(firmarCuerpo(cuerpo, secreto)).toBe(referencia(cuerpo, secreto));
    expect(firmarCuerpo(cuerpo, secreto)).toMatch(/^[0-9a-f]{64}$/);
  });

  it("acepta una firma válida (también en mayúsculas)", () => {
    const f = referencia(cuerpo, secreto);
    expect(firmaValida(cuerpo, f, secreto)).toBe(true);
    expect(firmaValida(cuerpo, f.toUpperCase(), secreto)).toBe(true);
  });

  it("rechaza firma ausente, mal formada, con prefijo o de otro secreto", () => {
    const f = referencia(cuerpo, secreto);
    expect(firmaValida(cuerpo, null, secreto)).toBe(false);
    expect(firmaValida(cuerpo, "", secreto)).toBe(false);
    expect(firmaValida(cuerpo, "abc", secreto)).toBe(false);
    expect(firmaValida(cuerpo, `hmacsha256=${f}`, secreto)).toBe(false);
    expect(firmaValida(cuerpo, referencia(cuerpo, "otro-secreto-0123456789"), secreto)).toBe(false);
  });

  it("rechaza si el cuerpo cambia aunque sea por re-serializar el JSON", () => {
    const f = referencia(cuerpo, secreto);
    const reserializado = JSON.stringify(JSON.parse(cuerpo), null, 2);
    expect(firmaValida(reserializado, f, secreto)).toBe(false);
    expect(firmaValida(cuerpo + " ", f, secreto)).toBe(false);
  });

  it("firma la cadena exacta con caracteres no ASCII (UTF-8)", () => {
    const conTildes = '{"nombre":"Andrés Peña"}';
    expect(firmaValida(conTildes, referencia(conTildes, secreto), secreto)).toBe(true);
  });
});

describe("challengeResponse", () => {
  it("es hex(HMAC-SHA256(challengeCode, clientSecret))", () => {
    const code = "890e4665-4dfe-4ab1-b689-ed553bceeed0";
    const esperado = createHmac("sha256", "mi-secreto").update(code).digest("hex");
    expect(respuestaDesafio(code, "mi-secreto")).toBe(esperado);
  });
});
