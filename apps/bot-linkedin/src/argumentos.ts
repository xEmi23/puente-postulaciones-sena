// Argumentos de la línea de comandos del bot. En PowerShell, `npm run bot -- --seco` NO entrega `--seco` al bot: el
// envoltorio npm.ps1 quita el `--` y npm se queda la opción como suya (la exporta como npm_config_seco=true, y
// `--vacante X` llega como npm_config_vacante=true más «X» suelto). Por seguridad (--seco nunca debe enviar), se leen
// las dos formas: así el mismo comando documentado funciona igual en PowerShell, cmd y bash.

export interface Argumentos {
  login: boolean;
  seco: boolean;
  vacante?: string;
}

const verdadero = (v: string | undefined) => v !== undefined && v !== "" && v !== "false";

export function leerArgumentos(argv: string[], env: NodeJS.ProcessEnv = process.env): Argumentos {
  const o: Argumentos = { login: false, seco: false };
  const sueltos: string[] = [];
  for (let i = 0; i < argv.length; i++) {
    if (argv[i] === "login") o.login = true;
    else if (argv[i] === "--seco") o.seco = true;
    else if (argv[i] === "--vacante") {
      o.vacante = argv[++i];
      if (!o.vacante || o.vacante.startsWith("--")) throw new Error("Falta el código de la vacante: npm run bot -w apps/bot-linkedin -- --vacante <código>");
    }
    else if (argv[i].startsWith("--vacante=")) o.vacante = argv[i].slice("--vacante=".length);
    else sueltos.push(argv[i]);
  }
  if (verdadero(env.npm_config_seco)) o.seco = true;
  const v = env.npm_config_vacante;
  if (!o.vacante && verdadero(v)) o.vacante = v === "true" ? sueltos.shift() : v;
  if (o.vacante === undefined && verdadero(v)) throw new Error("Falta el código de la vacante: npm run bot -w apps/bot-linkedin -- --vacante <código>");
  return o;
}
