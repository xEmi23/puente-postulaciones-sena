/** Indicador de carga accesible, común a los tres módulos. */
export function Cargando({ texto = "Cargando…" }: { texto?: string }) {
  return (
    <div role="status" aria-live="polite" className="cargando">
      <span className="cargando-punto" aria-hidden="true" />
      {texto}
    </div>
  );
}
