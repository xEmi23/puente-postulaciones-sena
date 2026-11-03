"use client";

import { useState } from "react";

/** Enlace público de una vacante con su botón «Copiar» (para pegarlo como enlace externo en la oferta). */
export function EnlaceCopiable({ url, etiqueta }: { url: string; etiqueta: string }) {
  const [copiado, setCopiado] = useState(false);
  async function copiar() {
    try {
      await navigator.clipboard.writeText(url);
      setCopiado(true);
      setTimeout(() => setCopiado(false), 2500);
    } catch {
      setCopiado(false);
    }
  }
  return (
    <div className="p-enlace-publico">
      <input readOnly value={url} aria-label={etiqueta} data-testid="enlace-publico" onFocus={(e) => e.currentTarget.select()} />
      <button type="button" className="p-boton p-boton-secundario" onClick={copiar}>
        Copiar
      </button>
      <span role="status" aria-live="polite" className="p-nota">
        {copiado ? "Enlace copiado" : ""}
      </span>
    </div>
  );
}
