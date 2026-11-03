// Aviso de privacidad del formulario público (V4 F6). BORRADOR pendiente de validación legal (Ley 1581 de 2012):
// no afirma cumplimiento. La versión se guarda con cada postulación como prueba del consentimiento; si el texto cambia,
// sube la versión.

export const VERSION_AVISO = "2026-11-03.1";
export const ROTULO_BORRADOR = "Borrador pendiente de validación legal (Ley 1581 de 2012)";

/** Canal de contacto para ejercer los derechos. Sin la variable no se inventa uno. */
export function correoPrivacidad(): string | null {
  const v = (process.env.PRIVACIDAD_CORREO ?? "").trim();
  return /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(v) ? v : null;
}

export const diasRetencion = () => Number(process.env.RETENCION_CV_DIAS ?? 30);
