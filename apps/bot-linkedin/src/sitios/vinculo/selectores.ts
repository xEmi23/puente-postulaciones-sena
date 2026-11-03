// Selectores del panel del reclutador de Vínculo (red **simulada**, apps/vinculo). Si Vínculo cambia su interfaz, solo
// cambia este archivo (y, si hace falta, ./extraccion.ts). Se prefieren atributos estables (data-*) sobre clases.

export const SELECTORES = {
  /** Panel del reclutador: una fila por vacante, con su código en data-external-job-id. */
  filaVacante: '[data-testid="fila-vacante"]',
  /** Enlace a la vacante dentro de la fila (primer <a> que apunta a /reclutador/vacantes/<id>). */
  enlaceVacante: 'a[href^="/reclutador/vacantes/"]',
  /** Página de la vacante: una fila por postulante, con el id de la postulación en data-postulacion. */
  filaPostulante: '[data-testid="fila-postulante"]',
  /** Enlace «Ver ficha» de cada postulante. */
  enlaceFicha: '[data-testid="enlace-ficha"]',
  /** Ficha del postulante: contenedor con data-postulacion y data-vacante. */
  ficha: '[data-testid="ficha-postulante"]',
  /** Campos de la ficha: [data-campo="<nombre>"] (nombres, apellidos, correo, telefono, ciudad, titular, perfil, enviada, cv). */
  campo: (nombre: string) => `[data-campo="${nombre}"]`,
  /** Menú del panel del reclutador: está en TODAS sus páginas. Si falta, la página no es la esperada (o no terminó de cargar). */
  menuPanel: 'nav[aria-label="Secciones del panel"]',
  /** Pantalla de ingreso: formulario con contraseña. */
  formularioIngreso: 'input[type="password"]',
} as const;

export const RUTAS = {
  inicio: "/reclutador",
  ingreso: "/ingresar",
} as const;
