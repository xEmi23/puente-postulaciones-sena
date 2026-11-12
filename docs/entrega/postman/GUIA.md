# Guía de una página: enviar postulaciones simuladas por JSON

> Para quien evalúa o integra una fuente nueva. Contrato completo: [docs/contratos.md §8](../../contratos.md). Todo es simulado y con datos ficticios.

## 1. Preparar (una vez, 2 minutos)

1. Arranca el proyecto (`npm run dev`) y conecta el Puente con el Simulador BUK (`npm run demo:bot`, o Puente → **Conexiones**).
2. Entra al Puente (http://localhost:3003) como `admin@puente.demo.test` / `Demo2026!`.
3. **Fuentes** → «Crear fuente» (por ejemplo `postman`) → **Generar token**. Cópialo: se muestra **una sola vez**.
4. **Correspondencias** → fuente `postman`, vacante externa `VAC-DEMO-1`, proceso del Simulador BUK (por ejemplo 9002) → Guardar.

## 2. Importar en Postman

1. *Import* → [puente-entrada-generica.postman_collection.json](puente-entrada-generica.postman_collection.json).
2. En la colección → *Variables*: pega el token en `token` (valor actual, no el inicial; **nunca** lo guardes en el repositorio). `baseUrl` = `http://localhost:3003`.
3. *Settings* → *Working directory* = la raíz del repositorio (para que encuentre `fixtures/cv/*.pdf`).

## 3. La petición

```
POST {{baseUrl}}/api/entradas/v1/postulaciones
Authorization: Bearer <token de la fuente>
Content-Type: multipart/form-data
  datos = { JSON de la PostulacionCanonica v1, sin "fuente" }
  cv    = archivo PDF (≤ 5 MB, opcional: sin CV queda en revisión)
```

El JSON va en la parte `datos` del formulario multipart (así viaja junto al PDF). Un cuerpo `application/json` sin multipart responde 400 con el mensaje «Se espera multipart/form-data…».

Obligatorios: `version` («1»), `idExterno`, `vacanteExterna`, `candidato.nombres`. Ejemplo mínimo: [ejemplos/01-valido.json](ejemplos/01-valido.json).

Con `curl` (Git Bash o Linux/macOS):

```bash
curl -s -X POST http://localhost:3003/api/entradas/v1/postulaciones \
  -H "Authorization: Bearer $TOKEN" \
  -F 'datos={"version":"1","idExterno":"curl-001","vacanteExterna":"VAC-DEMO-1","candidato":{"nombres":"Ana","apellidos":"Ejemplo","correo":"ana.curl@demo.test","telefono":"300 555 0101","ciudad":"Medellín"}}' \
  -F "cv=@fixtures/cv/cv-camila-ejemplo.pdf;type=application/pdf"
```

## 4. Qué responde

| Código | Estado | Cuándo | Ejemplo |
|---|---|---|---|
| 202 | `RECIBIDA` | Válida; va al ATS | 01 |
| 202 | `REQUIERE_REVISION` | Sin correo, sin CV, datos sin confirmar o posible duplicado | 02, «01 sin CV» |
| 200 | `DUPLICADA` | Mismo `idExterno` de la misma fuente | «01 bis» |
| 400 | `INVALIDA` | No cumple el contrato (errores por campo) | 03–07, 09 |
| 401 | `NO_AUTORIZADO` | Token ausente, inválido o revocado | 11, 12 |
| 413 | `DEMASIADO_GRANDE` | CV de más de 5 MB | archivo grande (abajo) |
| 415 | `NO_ES_PDF` | El archivo no empieza por `%PDF` | 10 |
| 422 | `VACANTE_SIN_CORRESPONDENCIA` | La vacante no está vinculada | 08 |
| 429 | `DEMASIADAS_PETICIONES` | Más de 60 por minuto por token (`Retry-After`) | Runner, 61 iteraciones |

**Ojo:** 202 es un acuse, no una transferencia. Se cuenta como registrada cuando aparece en **Postulantes** del Simulador BUK (y en Puente → **Operaciones** como «Completado»).

Para el 413, crea un PDF de más de 5 MB: `node -e "require('fs').writeFileSync('grande.pdf', Buffer.concat([Buffer.from('%PDF-1.4\n'), Buffer.alloc(5*1024*1024, 32)]))"`.

## 5. Comprobación automática

`node scripts/probar-ejemplos.mjs` envía todos los ejemplos (y provoca 413 y 429) contra el Puente local y escribe [resultados-ejemplos.md](resultados-ejemplos.md).
