import { randomBytes } from "node:crypto";
import { prisma } from "@/lib/db";

/** «Valentina Ríos Gaviria» → «valentina-rios-gaviria». */
export function aSlug(texto: string): string {
  return (
    texto
      .normalize("NFD")
      .replace(/[̀-ͯ]/g, "")
      .toLowerCase()
      .replace(/[^a-z0-9]+/g, "-")
      .replace(/^-+|-+$/g, "")
      .slice(0, 60) || "persona"
  );
}

/** Slug de perfil libre: si ya existe, agrega un sufijo corto aleatorio. */
export async function slugUnico(nombre: string): Promise<string> {
  const base = aSlug(nombre);
  if (!(await prisma.perfil.findUnique({ where: { slug: base } }))) return base;
  for (;;) {
    const otro = `${base}-${randomBytes(3).toString("hex")}`;
    if (!(await prisma.perfil.findUnique({ where: { slug: otro } }))) return otro;
  }
}
