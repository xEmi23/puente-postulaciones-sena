import Link from "next/link";
import { etiquetaModalidad, etiquetaNivel } from "@/modules/vacantes";

/** Avatar de iniciales (sin fotos de personas reales). */
export function Avatar({ nombre, color = "#0f766e", persona = false, grande = false }: { nombre: string; color?: string; persona?: boolean; grande?: boolean }) {
  const iniciales = nombre
    .replace(/S\.A\.S\.?/g, "")
    .split(/\s+/)
    .filter(Boolean)
    .slice(0, 2)
    .map((p) => p[0]!.toUpperCase())
    .join("");
  return (
    <span className={`v-avatar${persona ? " v-avatar-persona" : ""}${grande ? " v-avatar-grande" : ""}`} style={{ background: color }} aria-hidden="true">
      {iniciales}
    </span>
  );
}

const haceCuanto = (d: Date | null) => {
  if (!d) return "";
  const dias = Math.floor((Date.now() - d.getTime()) / 86_400_000);
  return dias <= 0 ? "Publicada hoy" : dias === 1 ? "Hace 1 día" : `Hace ${dias} días`;
};

export interface DatosTarjeta {
  id: string;
  titulo: string;
  ciudad: string;
  modalidad: string;
  nivel: string;
  solicitudSencilla: boolean;
  publicadaEn: Date | null;
  empresa: { nombre: string; slug: string; color: string };
}

export function TarjetaVacante({ v }: { v: DatosTarjeta }) {
  return (
    <li className="v-vacante" data-testid="tarjeta-vacante">
      <Avatar nombre={v.empresa.nombre} color={v.empresa.color} />
      <div>
        <h3>
          <Link href={`/empleos/${v.id}`}>{v.titulo}</Link>
        </h3>
        <p className="v-meta">
          <Link href={`/empresas/${v.empresa.slug}`}>{v.empresa.nombre}</Link> · {v.ciudad} ({etiquetaModalidad(v.modalidad)})
        </p>
        <div className="v-chips">
          <span className="v-chip">{etiquetaNivel(v.nivel)}</span>
          {v.solicitudSencilla && <span className="v-chip v-chip-solicitud">Solicitud sencilla</span>}
          <span className="v-chip">{haceCuanto(v.publicadaEn)}</span>
        </div>
      </div>
    </li>
  );
}
