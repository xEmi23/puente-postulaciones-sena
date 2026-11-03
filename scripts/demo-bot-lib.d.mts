export function prepararDemoBot(o: {
  raiz: string;
  entorno: (app: string) => NodeJS.ProcessEnv;
  proceso?: number;
  reiniciar?: boolean;
  urlTalentia?: string;
}): { token: string; vacante: string; titulo: string; proceso: number };
export function fijarApiVinculo(raiz: string, habilitada: boolean): boolean;
