import { betterAuth } from "better-auth";
import { prismaAdapter } from "better-auth/adapters/prisma";
import { nextCookies } from "better-auth/next-js";
import { prisma } from "./db";
import { urlPublica } from "./config";
import { slugUnico } from "@/modules/slugs";

// Autenticación de Vínculo con Better Auth (D-27): correo y contraseña con hash scrypt, sesiones en la base,
// cookie propia `vin_sesion`. Cualquiera puede registrarse como candidato; los reclutadores pertenecen a una empresa
// (se crean con la siembra). Al crear un usuario se le crea su perfil público (/in/[slug]).

export const COOKIE_SESION = "vin_sesion";

export const auth = betterAuth({
  appName: "Vínculo",
  baseURL: urlPublica(),
  secret: process.env.BETTER_AUTH_SECRET,
  database: prismaAdapter(prisma, { provider: "postgresql" }),
  emailAndPassword: { enabled: true, minPasswordLength: 8, autoSignIn: true },
  user: {
    additionalFields: {
      rol: { type: "string", required: false, defaultValue: "CANDIDATO", input: false },
      empresaId: { type: "string", required: false, input: false },
    },
  },
  databaseHooks: {
    user: {
      create: {
        after: async (u) => {
          const existe = await prisma.perfil.findUnique({ where: { userId: u.id } });
          if (!existe) await prisma.perfil.create({ data: { userId: u.id, slug: await slugUnico(u.name), habilidades: [] } });
        },
      },
    },
  },
  session: { expiresIn: 7 * 24 * 3600, updateAge: 24 * 3600 },
  advanced: {
    cookies: {
      session_token: { name: COOKIE_SESION },
      session_data: { name: "vin_sesion_datos" },
      dont_remember: { name: "vin_no_recordar" },
    },
  },
  telemetry: { enabled: false },
  plugins: [nextCookies()],
});
