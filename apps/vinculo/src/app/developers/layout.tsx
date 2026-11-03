import { notFound } from "next/navigation";
import { apiHabilitada } from "@/lib/config";

export const dynamic = "force-dynamic";

/** El portal de desarrolladores solo existe con VINCULO_API_HABILITADA=true (D-68): por defecto Vínculo no tiene API. */
export default function LayoutDesarrolladores({ children }: { children: React.ReactNode }) {
  if (!apiHabilitada()) notFound();
  return children;
}
