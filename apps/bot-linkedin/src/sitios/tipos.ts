// Perfil de sitio: TODO lo que el bot sabe de un sitio concreto (URLs, selectores, extracción y cómo detectar que la
// sesión se cerró o que el sitio pide una verificación). La navegación, las guardias comunes, el mapeo a la canónica y
// el envío al Puente son iguales para todos los sitios. Pasar de Vínculo (simulado) a LinkedIn real es agregar el
// perfil «linkedin» con páginas guardadas y anonimizadas (Puerta 0), sin tocar el resto.

export type NombreSitio = "vinculo" | "linkedin";

/** Por qué el bot se detiene y pide a una persona. */
/** sesion_cerrada: pide ingresar · verificacion: captcha o advertencia · pagina_inesperada: falta la estructura conocida. */
export type Bloqueo = { tipo: "sesion_cerrada" | "verificacion" | "pagina_inesperada"; detalle: string };

export interface VacanteSitio {
  /** Identificador estable de la vacante en el sitio (lo que se vincula en Puente → Correspondencias). */
  idExterno: string;
  titulo: string;
  url: string;
}

export interface PostulanteListado {
  /** Identificador estable de la postulación en el sitio. */
  idExterno: string;
  urlDetalle: string;
}

export interface DetallePostulante {
  idExterno: string;
  vacanteExterna: string;
  nombres: string;
  apellidos: string;
  correo: string;
  telefono: string;
  ciudad: string;
  titular: string;
  perfilUrl: string;
  /** ISO 8601. */
  recibidaEn: string;
  urlCv: string;
}

export interface PerfilSitio {
  nombre: NombreSitio;
  /** false mientras falten páginas reales anonimizadas para escribir y probar sus selectores. */
  listo: boolean;
  motivoNoListo?: string;
  urlInicio(base: string): string;
  urlLogin(base: string): string;
  pausasPorDefecto: { min: number; max: number };
  /** «HH-HH» (07-19) o «00-24». */
  horarioPorDefecto: string;
  /** Todos los selectores del sitio, en un solo lugar (comentados en su archivo). */
  selectores: Record<string, string>;
  detectarBloqueo(html: string, url: string): Bloqueo | null;
  extraerVacantes(html: string, base: string): VacanteSitio[];
  extraerPostulantes(html: string, base: string): PostulanteListado[];
  extraerDetalle(html: string, base: string): DetallePostulante;
}
