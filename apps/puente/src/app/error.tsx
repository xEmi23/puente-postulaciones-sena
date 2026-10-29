"use client";

import { useEffect } from "react";

export default function ErrorGeneral({ error, reset }: { error: Error & { digest?: string }; reset: () => void }) {
  useEffect(() => {
    console.error(error);
  }, [error]);
  return (
    <main id="contenido" className="indice" role="alert">
      <h1>Algo salió mal</h1>
      <p>Ocurrió un error inesperado al cargar esta pantalla. Ningún dato se perdió: las operaciones pendientes siguen guardadas.</p>
      {error.digest && (
        <p style={{ fontSize: "0.85rem", color: "#4b5563" }}>
          Código de seguimiento: <code>{error.digest}</code>
        </p>
      )}
      <button type="button" onClick={reset} style={{ font: "inherit", padding: "0.5rem 1rem", cursor: "pointer" }}>
        Intentar de nuevo
      </button>
    </main>
  );
}
