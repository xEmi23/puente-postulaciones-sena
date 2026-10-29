import Link from "next/link";

export default function NoEncontrado() {
  return (
    <main id="contenido" className="indice">
      <h1>No encontramos esta página</h1>
      <p>Es posible que el enlace esté mal escrito o que el elemento ya no exista.</p>
      <p>
        <Link href="/">Volver al inicio</Link>
      </p>
    </main>
  );
}
