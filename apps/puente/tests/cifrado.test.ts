import { afterEach, describe, expect, it } from "vitest";
import { cifrar, descifrar } from "@/lib/cifrado";

// La clave de cifrado puede ser 64 hexadecimales (npm run setup) o un secreto generado por Render (generateValue, base64).
const original = process.env.PUENTE_CLAVE_CIFRADO;
afterEach(() => {
  process.env.PUENTE_CLAVE_CIFRADO = original;
});

describe("cifrado de secretos en reposo", () => {
  it("con la clave hexadecimal: cifra, no deja el texto en claro y descifra", () => {
    const c = cifrar("secreto-de-prueba");
    expect(c).not.toContain("secreto-de-prueba");
    expect(descifrar(c)).toBe("secreto-de-prueba");
  });

  it("con un secreto no hexadecimal (como generateValue de Render) deriva la clave y funciona igual", () => {
    process.env.PUENTE_CLAVE_CIFRADO = "Zm9vYmFyYmF6cXV4cXV1eGNvcmdlZ3JhdWx0Z2FycGx5d2FsZG8=";
    const c = cifrar("otro-secreto");
    expect(descifrar(c)).toBe("otro-secreto");
    // Con otra clave no se puede descifrar (AES-GCM autentica).
    process.env.PUENTE_CLAVE_CIFRADO = "b".repeat(44);
    expect(() => descifrar(c)).toThrow();
  });

  it("rechaza una clave demasiado corta", () => {
    process.env.PUENTE_CLAVE_CIFRADO = "corta";
    expect(() => cifrar("x")).toThrow(/PUENTE_CLAVE_CIFRADO/);
  });
});
