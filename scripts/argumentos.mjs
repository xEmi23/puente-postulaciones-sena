// Opciones de los scripts de la raíz (`npm run demo:bot -- --reiniciar`, `-- --proceso 9005`, `-- --publicar 9001,9002`).
// En PowerShell, npm.ps1 quita el `--` y npm se queda las opciones: llegan como npm_config_<nombre>=true y el valor
// suelto en argv. Se aceptan las dos formas para que el comando documentado funcione igual en PowerShell, cmd y bash.

const npm = (nombre) => process.env[`npm_config_${nombre}`];
const activa = (v) => v !== undefined && v !== "" && v !== "false";

/** ¿Se pasó --<nombre>? */
export function bandera(nombre, argv = process.argv.slice(2)) {
  return argv.includes(`--${nombre}`) || activa(npm(nombre));
}

/** Valor de --<nombre> <valor> (o undefined). */
export function valor(nombre, argv = process.argv.slice(2)) {
  const i = argv.indexOf(`--${nombre}`);
  if (i >= 0) return argv[i + 1];
  const v = npm(nombre);
  if (!activa(v)) return undefined;
  if (v !== "true") return v;
  return argv.find((a) => !a.startsWith("--"));
}
