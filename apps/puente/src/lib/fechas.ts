const formato = new Intl.DateTimeFormat("es-CO", {
  dateStyle: "medium",
  timeStyle: "short",
  timeZone: "America/Bogota",
});
const soloFecha = new Intl.DateTimeFormat("es-CO", { dateStyle: "medium", timeZone: "America/Bogota" });

export const fechaHora = (d: Date) => formato.format(d);
export const fecha = (d: Date) => soloFecha.format(d);
