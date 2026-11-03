import path from "node:path";
import { config as cargarEnv } from "dotenv";
import type { PerfilSitio } from "./sitios/tipos";

// Configuración del bot desde el entorno (apps/bot-linkedin/.env, generado por `npm run demo:bot`). Sin contraseñas:
// la sesión del sitio vive en el perfil del navegador (.bot-perfil-<sitio>/), iniciada a mano.

cargarEnv({ path: path.resolve(__dirname, "../.env"), quiet: true });

export interface ConfigBot {
  sitio: string;
  urlSitio: string;
  puenteUrl: string;
  token: string;
  maxPorEjecucion: number;
  pausaMin: number;
  pausaMax: number;
  horario: { desde: number; hasta: number };
  headless: boolean;
  dirPerfil: string;
}

export function leerHorario(texto: string): { desde: number; hasta: number } {
  const m = /^(\d{1,2})-(\d{1,2})$/.exec(texto.trim());
  if (!m) throw new Error(`BOT_HORARIO inválido («${texto}»): usa HH-HH, por ejemplo 07-19.`);
  return { desde: Number(m[1]), hasta: Number(m[2]) };
}

export function dentroDelHorario(h: { desde: number; hasta: number }, ahora = new Date()): boolean {
  const hora = ahora.getHours();
  return hora >= h.desde && hora < h.hasta;
}

const num = (v: string | undefined, porDefecto: number) => (v && v.trim() !== "" ? Number(v) : porDefecto);

/** Mezcla el entorno con los valores por defecto del perfil del sitio. */
export function leerConfig(perfil: PerfilSitio, env: NodeJS.ProcessEnv = process.env): ConfigBot {
  const pausaMin = num(env.BOT_PAUSA_MIN_MS, perfil.pausasPorDefecto.min);
  const pausaMax = num(env.BOT_PAUSA_MAX_MS, perfil.pausasPorDefecto.max);
  if (!(pausaMin >= 0 && pausaMax >= pausaMin)) throw new Error("BOT_PAUSA_MIN_MS y BOT_PAUSA_MAX_MS deben ser números con mínimo ≤ máximo.");
  const max = num(env.BOT_MAX_POR_EJECUCION, 25);
  return {
    sitio: perfil.nombre,
    urlSitio: (env.BOT_URL_SITIO || "http://localhost:3001").replace(/\/$/, ""),
    puenteUrl: (env.PUENTE_URL || "http://localhost:3003").replace(/\/$/, ""),
    token: env.PUENTE_BOT_TOKEN ?? "",
    // Nunca más de 25 por corrida (§8.3), aunque se pida más.
    maxPorEjecucion: Math.max(1, Math.min(25, max)),
    pausaMin,
    pausaMax,
    horario: leerHorario(env.BOT_HORARIO || perfil.horarioPorDefecto),
    headless: env.BOT_HEADLESS === "true",
    dirPerfil: env.BOT_PERFIL_DIR || path.resolve(__dirname, `../.bot-perfil-${perfil.nombre}`),
  };
}
