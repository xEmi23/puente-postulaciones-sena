export function conectar(o: {
  raiz: string;
  entorno: (app: string) => NodeJS.ProcessEnv;
  urls: { vinculo: string; talentia: string; puente: string };
  publicar?: number[];
  registro?: (t: string) => void;
}): { clientId: string };
