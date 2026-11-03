import type { PerfilSitio } from "../tipos";

// Perfil del sitio «linkedin»: SOLO ESQUELETO, pendiente de la Puerta 0 (ESPECIFICACION_V4 §10).
// No se inventan selectores de LinkedIn: se escriben a partir de páginas reales guardadas por el equipo
// (fixtures/linkedin/originales/, fuera de git) y anonimizadas (fixtures/linkedin/anonimizadas/), con sus pruebas.
// Mientras tanto, este perfil se niega a correr.
//
// Aviso: el Acuerdo de Usuario de LinkedIn (cláusula 8.2) prohíbe bots y extracción automatizada. Si la Puerta 0 da
// «Bot = sí», el bot se usa solo con una cuenta del equipo que acepta el riesgo, CV ficticios, ventana visible, sesión
// iniciada a mano, sin evasión de ningún tipo y deteniéndose ante cualquier verificación.

export const MENSAJE_PENDIENTE = "perfil LinkedIn pendiente de la Puerta 0";

/** Selectores vacíos a propósito. Cada uno se completa con las páginas anonimizadas de la Puerta 0. */
export const SELECTORES_LINKEDIN: Record<string, string> = {
  filaVacante: "", // pendiente de la Puerta 0 (lista de vacantes del publicador)
  enlaceVacante: "", // pendiente de la Puerta 0
  filaPostulante: "", // pendiente de la Puerta 0 (P0-2: lista de postulantes)
  enlaceDetalle: "", // pendiente de la Puerta 0
  correo: "", // pendiente de la Puerta 0 (P0-5: datos de contacto visibles)
  telefono: "", // pendiente de la Puerta 0 (P0-5)
  descargarCv: "", // pendiente de la Puerta 0 (P0-3: descarga del CV uno por uno)
  idVacante: "", // pendiente de la Puerta 0 (P0-6: identificadores estables)
  idPostulacion: "", // pendiente de la Puerta 0 (P0-6)
  ingreso: "", // pendiente de la Puerta 0 (pantalla de inicio de sesión)
  verificacion: "", // pendiente de la Puerta 0 (pantallas de verificación)
};

const pendiente = (): never => {
  throw new Error(MENSAJE_PENDIENTE);
};

export const perfilLinkedin: PerfilSitio = {
  nombre: "linkedin",
  listo: false,
  motivoNoListo: `${MENSAJE_PENDIENTE}: faltan páginas reales anonimizadas en fixtures/linkedin/anonimizadas/ para escribir y probar sus selectores.`,
  urlInicio: pendiente,
  urlLogin: pendiente,
  // Valores de la especificación §8.3 para cuando exista el perfil.
  pausasPorDefecto: { min: 3000, max: 8000 },
  horarioPorDefecto: "07-19",
  selectores: SELECTORES_LINKEDIN,
  detectarBloqueo: pendiente,
  extraerVacantes: pendiente,
  extraerPostulantes: pendiente,
  extraerDetalle: pendiente,
};
