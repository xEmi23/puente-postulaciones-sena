import type { PerfilSitio } from "../sitios/tipos";
import { exigirSinBloqueo } from "../guardias";
import { aCanonica, esPdf } from "../mapeo";
import type { EstadoEnvio, ResultadoEnvio } from "../envio";
import type { CanonicaSinFuente } from "../mapeo";

// Recorrido común a todos los sitios: panel → vacantes permitidas por el Puente → postulantes → ficha → CV → envío.
// Las guardias se revisan en CADA página; ante una verificación o sesión cerrada, el bot se detiene.

export interface Navegador {
  ir(url: string): Promise<{ html: string; url: string }>;
  descargar(url: string): Promise<{ status: number; bytes: Uint8Array; nombreArchivo: string }>;
}

export interface Dependencias {
  vacantesPermitidas(): Promise<string[]>;
  enviar(datos: CanonicaSinFuente, cv: { bytes: Uint8Array; nombreArchivo: string } | null): Promise<ResultadoEnvio>;
  pausa(): Promise<unknown>;
  log(mensaje: string): void;
}

export interface OpcionesRecorrido {
  urlSitio: string;
  maxPorEjecucion: number;
  /** Solo esta vacante (su id externo en el sitio). */
  vacante?: string;
  /** No envía nada: muestra lo que enviaría. */
  seco?: boolean;
}

export interface Resumen {
  sitio: string;
  vacantes: number;
  vistas: number;
  enviadas: number;
  recibidas: number;
  revision: number;
  duplicadas: number;
  rechazadas: number;
  errores: number;
  seco: boolean;
  limiteAlcanzado: boolean;
}

const MAX_CV = 5 * 1024 * 1024;

export async function recorrer(perfil: PerfilSitio, nav: Navegador, deps: Dependencias, o: OpcionesRecorrido): Promise<Resumen> {
  const r: Resumen = { sitio: perfil.nombre, vacantes: 0, vistas: 0, enviadas: 0, recibidas: 0, revision: 0, duplicadas: 0, rechazadas: 0, errores: 0, seco: !!o.seco, limiteAlcanzado: false };
  const permitidas = new Set(await deps.vacantesPermitidas());
  if (permitidas.size === 0) {
    deps.log("El Puente no tiene vacantes vinculadas a esta fuente (Puente → Correspondencias). No hay nada que recorrer.");
    return r;
  }

  const inicio = await nav.ir(perfil.urlInicio(o.urlSitio));
  exigirSinBloqueo(perfil, inicio.html, inicio.url);
  // Solo vacantes propias que el Puente tiene vinculadas a la fuente (y, si se pidió, solo una).
  const vacantes = perfil.extraerVacantes(inicio.html, o.urlSitio).filter((v) => permitidas.has(v.idExterno) && (!o.vacante || v.idExterno === o.vacante));
  if (o.vacante && vacantes.length === 0) deps.log(`La vacante «${o.vacante}» no está en el panel o no está vinculada a esta fuente en el Puente.`);
  else if (vacantes.length === 0) {
    deps.log(`Ninguna de las vacantes vinculadas en el Puente (${[...permitidas].join(", ")}) aparece en el panel del sitio. ¿Es la cuenta correcta? ¿Se ejecutó npm run demo:bot?`);
  }

  for (const v of vacantes) {
    r.vacantes++;
    deps.log(`Vacante ${v.idExterno} · ${v.titulo}`);
    await deps.pausa();
    const pagina = await nav.ir(v.url);
    exigirSinBloqueo(perfil, pagina.html, pagina.url);
    const postulantes = perfil.extraerPostulantes(pagina.html, o.urlSitio);
    deps.log(`  ${postulantes.length} postulante(s) encontrados.`);

    for (const p of postulantes) {
      if (r.vistas >= o.maxPorEjecucion) {
        r.limiteAlcanzado = true;
        deps.log(`  Límite de ${o.maxPorEjecucion} por corrida alcanzado: el resto queda para la próxima.`);
        return r;
      }
      await deps.pausa();
      const ficha = await nav.ir(p.urlDetalle);
      exigirSinBloqueo(perfil, ficha.html, ficha.url);
      const d = perfil.extraerDetalle(ficha.html, o.urlSitio);
      if (!d.vacanteExterna) d.vacanteExterna = v.idExterno;
      r.vistas++;

      let cv: { bytes: Uint8Array; nombreArchivo: string } | null = null;
      if (d.urlCv) {
        const descarga = await nav.descargar(d.urlCv);
        if (descarga.status === 200 && esPdf(descarga.bytes) && descarga.bytes.length <= MAX_CV) cv = { bytes: descarga.bytes, nombreArchivo: descarga.nombreArchivo };
        else deps.log(`  ${d.idExterno}: el CV no se pudo descargar como PDF (${descarga.status}); se envía sin CV y quedará en revisión.`);
      }
      const datos = aCanonica(d, cv);

      if (o.seco) {
        deps.log(`  [seco] ${d.idExterno}: se enviaría (${cv ? `CV ${cv.bytes.length} bytes` : "sin CV"}). No se envía nada.`);
        continue;
      }
      const res = await deps.enviar(datos, cv);
      r.enviadas++;
      contar(r, res.estado);
      deps.log(`  ${d.idExterno}: ${res.estado} (${res.detalle})`);
    }
  }
  return r;
}

function contar(r: Resumen, e: EstadoEnvio) {
  if (e === "RECIBIDA") r.recibidas++;
  else if (e === "REQUIERE_REVISION") r.revision++;
  else if (e === "DUPLICADA") r.duplicadas++;
  else if (e === "RECHAZADA") r.rechazadas++;
  else r.errores++;
}
