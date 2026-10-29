import { lookup } from "node:dns/promises";
import { isIP } from "node:net";
import { esEntornoLocal } from "./config";

// Protección contra SSRF para las URL de webhook que registran los desarrolladores: Vínculo hace solicitudes a ellas.
// Localmente (demo) se permiten http y localhost. En un despliegue público se exige https y se rechazan destinos
// privados, de enlace local o de loopback (incluido el servicio de metadatos 169.254.169.254).

const PRIVADAS_V4 = [
  [0x0a000000, 8], // 10.0.0.0/8
  [0x7f000000, 8], // 127.0.0.0/8
  [0xa9fe0000, 16], // 169.254.0.0/16
  [0xac100000, 12], // 172.16.0.0/12
  [0xc0a80000, 16], // 192.168.0.0/16
  [0x64400000, 10], // 100.64.0.0/10
  [0x00000000, 8], // 0.0.0.0/8
] as const;

function ipv4Privada(ip: string): boolean {
  const n = ip.split(".").reduce((a, o) => (a << 8) + Number(o), 0) >>> 0;
  return PRIVADAS_V4.some(([red, bits]) => (n & (~0 << (32 - bits))) >>> 0 === red);
}

export function ipPrivada(ip: string): boolean {
  if (isIP(ip) === 4) return ipv4Privada(ip);
  const v = ip.toLowerCase();
  if (v.startsWith("::ffff:")) return ipv4Privada(v.slice(7));
  return v === "::1" || v === "::" || v.startsWith("fc") || v.startsWith("fd") || v.startsWith("fe80");
}

/** Devuelve null si la URL es aceptable como webhook, o el motivo del rechazo. */
export async function motivoUrlNoPermitida(texto: string, local = esEntornoLocal()): Promise<string | null> {
  let url: URL;
  try {
    url = new URL(texto);
  } catch {
    return "No es una URL válida.";
  }
  if (url.username || url.password) return "La URL no puede llevar usuario ni contraseña.";
  if (local) return ["http:", "https:"].includes(url.protocol) ? null : "La URL debe empezar por http:// o https://.";
  if (url.protocol !== "https:") return "La URL del webhook debe usar https.";
  const host = url.hostname.replace(/^\[|\]$/g, "");
  if (host === "localhost" || host.endsWith(".localhost") || host.endsWith(".internal")) return "La URL apunta a una red interna.";
  try {
    const direcciones = isIP(host) ? [{ address: host }] : await lookup(host, { all: true });
    if (direcciones.some((d) => ipPrivada(d.address))) return "La URL apunta a una red privada.";
  } catch {
    return "No se pudo resolver el dominio de la URL.";
  }
  return null;
}
