import { existsSync, readdirSync } from "node:fs";
import path from "node:path";
import type { NombreSitio, PerfilSitio } from "./tipos";
import { perfilVinculo } from "./vinculo";
import { MENSAJE_PENDIENTE, perfilLinkedin } from "./linkedin";

export type { PerfilSitio, NombreSitio } from "./tipos";

/** ¿Hay páginas de LinkedIn anonimizadas para trabajar? (condición necesaria, no suficiente, para completar el perfil). */
export function hayPaginasLinkedinAnonimizadas(raiz = path.resolve(__dirname, "../../fixtures/linkedin/anonimizadas")): boolean {
  return existsSync(raiz) && readdirSync(raiz).some((f) => f.endsWith(".html"));
}

/**
 * Perfil del sitio pedido. «linkedin» se niega a correr mientras su perfil no esté listo (Puerta 0): nunca se abre
 * LinkedIn real con selectores inventados.
 */
export function cargarPerfil(nombre: string): PerfilSitio {
  if (nombre === "vinculo") return perfilVinculo;
  if (nombre === "linkedin") {
    if (!perfilLinkedin.listo || !hayPaginasLinkedinAnonimizadas()) throw new Error(perfilLinkedin.motivoNoListo ?? MENSAJE_PENDIENTE);
    return perfilLinkedin;
  }
  throw new Error(`Sitio desconocido «${nombre}». Usa BOT_SITIO=vinculo (o linkedin cuando su perfil exista).`);
}

export const SITIOS: NombreSitio[] = ["vinculo", "linkedin"];
