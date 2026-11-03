"use client";

import { usePathname } from "next/navigation";

// Franja de entorno (CLAUDE.md). En las páginas públicas del candidato (formulario y aviso de privacidad) es más
// discreta y dice que es un ejercicio académico; conserva «Entorno de simulación» y «No es LinkedIn ni BUK».
export function FranjaSimulacion() {
  const publica = /^\/(postular|privacidad)(\/|$)/.test(usePathname() ?? "");
  if (publica) {
    return (
      <div className="aviso-simulacion aviso-discreto" role="note" aria-label="Aviso de entorno">
        Ejercicio académico (proyecto SENA) · Entorno de simulación · No es LinkedIn ni BUK: simulación académica.
      </div>
    );
  }
  return (
    <div className="aviso-simulacion" role="note" aria-label="Aviso de entorno">
      <strong>Entorno de simulación</strong> · No es LinkedIn ni BUK: simulación académica. Datos ficticios.
    </div>
  );
}
