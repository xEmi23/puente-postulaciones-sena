import { betterAuth } from "better-auth";
import { prismaAdapter } from "better-auth/adapters/prisma";
import { nextCookies } from "better-auth/next-js";
import { prisma } from "./db";
import { urlPublica } from "./config";

// Autenticación de Talentia con Better Auth (librería mantenida; D-27): correo y contraseña con hash scrypt,
// sesiones en la base y cookie propia `tal_sesion` (en localhost las cookies no se separan por puerto).
// No hay registro público: las cuentas las crea el administrador (aquí, la siembra de demostración).

export const ROLES = ["ADMIN", "RECLUTADOR"] as const;
export type Rol = (typeof ROLES)[number];
export const COOKIE_SESION = "tal_sesion";

export const auth = betterAuth({
  appName: "Talentia",
  baseURL: urlPublica(),
  secret: process.env.BETTER_AUTH_SECRET,
  database: prismaAdapter(prisma, { provider: "postgresql" }),
  emailAndPassword: { enabled: true, disableSignUp: true, minPasswordLength: 8 },
  user: { additionalFields: { rol: { type: "string", required: false, defaultValue: "RECLUTADOR", input: false } } },
  session: { expiresIn: 8 * 3600, updateAge: 3600 },
  advanced: {
    cookies: {
      session_token: { name: COOKIE_SESION },
      session_data: { name: "tal_sesion_datos" },
      dont_remember: { name: "tal_no_recordar" },
    },
  },
  telemetry: { enabled: false },
  plugins: [nextCookies()],
});
