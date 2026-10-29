import { ETAPAS_REFERENCIA, etiquetaTipo } from "@/modules/etapas";

export const metadata = { title: "Configuraciones" };

export default function Configuraciones() {
  return (
    <>
      <p className="a-migas">Desarrollo organizacional / Selección / Configuraciones</p>
      <div className="a-encabezado">
        <div>
          <h1>Configuraciones de Selección</h1>
          <p className="a-sub">Plantilla de etapas con que se crea cada proceso (solo lectura en el simulador).</p>
        </div>
      </div>
      <div className="a-tabla-contenedor">
        <table className="a-tabla">
          <caption className="visualmente-oculto">Plantilla de etapas</caption>
          <thead>
            <tr>
              <th scope="col">Orden</th>
              <th scope="col">Etapa</th>
              <th scope="col">Tipo</th>
            </tr>
          </thead>
          <tbody>
            {ETAPAS_REFERENCIA.map((e, i) => (
              <tr key={e.nombre}>
                <td>{i + 1}</td>
                <td>{e.nombre}</td>
                <td>{etiquetaTipo(e.tipo, i + 1)}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </>
  );
}
