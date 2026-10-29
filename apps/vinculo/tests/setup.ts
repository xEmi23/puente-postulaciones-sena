import { prepararEntornoPruebas } from "./entorno-pruebas";
import { usarFetchSaliente } from "@/lib/salida";
import { fetchEnProceso } from "./utilidades";

prepararEntornoPruebas();
usarFetchSaliente(fetchEnProceso);
