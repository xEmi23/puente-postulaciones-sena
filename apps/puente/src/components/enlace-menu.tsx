"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";

/** Enlace del menú que marca la sección actual con aria-current. */
export function EnlaceMenu({ href, children }: { href: string; children: React.ReactNode }) {
  const ruta = usePathname();
  const actual = ruta === href || ruta.startsWith(`${href}/`);
  return (
    <Link href={href} aria-current={actual ? "page" : undefined}>
      {children}
    </Link>
  );
}
