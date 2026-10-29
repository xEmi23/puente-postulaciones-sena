import { betterAuth } from "better-auth";
import { prismaAdapter } from "better-auth/adapters/prisma";
import { nextCookies } from "better-auth/next-js";
import { prisma } from "./db";
import { urlPublica } from "./config";

// Autenticación del puente con Better Auth (D-27): correo y contraseña con hash, sesiones en la base,
// cookie propia `pue_sesion`. Sin registro público. Roles: ADMIN (configura conexiones y publicación) y OPERADOR (supervisa).

export const ROLES = ["ADMIN", "OPERADOR"] as const;
export type Rol = (typeof ROLES)[number];
export const COOKIE_SESION = "pue_sesion";

export const auth = betterAuth({
  appName: "Puente",
  baseURL: urlPublica(),
  secret: process.env.BETTER_AUTH_SECRET,
  database: prismaAdapter(prisma, { provider: "postgresql" }),
  emailAndPassword: { enabled: true, disableSignUp: true, minPasswordLength: 8 },
  user: { additionalFields: { rol: { type: "string", required: false, defaultValue: "OPERADOR", input: false } } },
  session: { expiresIn: 8 * 3600, updateAge: 3600 },
  advanced: {
    cookies: {
      session_token: { name: COOKIE_SESION },
      session_data: { name: "pue_sesion_datos" },
      dont_remember: { name: "pue_no_recordar" },
    },
  },
  telemetry: { enabled: false },
  plugins: [nextCookies()],
});
