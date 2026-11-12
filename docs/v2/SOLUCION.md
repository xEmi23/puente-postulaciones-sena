# Solución v2: puente de postulaciones red profesional → ATS

> Actualizado por Claude Code (2026-11-12): no hubo correos, mensajes, entrevistas ni actas con la empresa. Lo relativo a la API de LinkedIn y a la llave de BUK cita la ficha del reto, numeral 2.8 (acceso a BUK controlado y guiado por un gestor acompañante; el equipo no tiene llave; no se afirma que la empresa se haya negado). Que la postulación empieza en LinkedIn lo dedujo el equipo analizando las interfaces de LinkedIn.

> Documento del equipo (28/10/2026). Fuente de verdad del **qué** y el **por qué**. El **cómo** detallado está en `docs/v2/ESPECIFICACION.md`.
> Etiquetas: **Verificado** (con fuente y fecha) · **Decisión interna** · **Supuesto pendiente**.

## 1. La solución en una página

Construimos **tres sistemas independientes** que reproducen el mundo real:

1. **Vínculo**: red profesional simulada (tipo LinkedIn), con candidatos, empresas, vacantes y postulación rápida («Solicitud sencilla»).
2. **Talentia**: ATS simulado (tipo BUK), con procesos de selección, tablero por etapas y fichas de postulantes.
3. **Puente**: **nuestro producto**. Mueve cada postulación de Vínculo a Talentia de forma automática, por API.

**El problema.** Hoy el reclutador de la empresa entra a cada vacante en LinkedIn, descarga todos los CV y los vuelve a subir a BUK, vacante por vacante. Según la ficha del reto, eso retrasa de 2 a 4 días hábiles a cada candidato.

**Por qué no lo conectamos a los sistemas reales.** LinkedIn solo abre sus APIs de reclutamiento a desarrolladores aprobados como socios de Talent Solutions (fabricantes de ATS), y BUK solo da acceso con una API Key que la empresa genera; según la ficha del reto, numeral 2.8, ese acceso es controlado y guiado por un gestor acompañante, y el equipo no tiene una llave.

**Lo que hicimos.** Simulamos los dos sistemas **con sus contratos reales**: Vínculo entrega las postulaciones con el formato, la firma y las reglas públicas de Apply Connect de LinkedIn; Talentia se accede igual que la API documentada de BUK (API Key con permisos de Selección). Cada sistema tiene su propia dirección, su propia base de datos (esquema) y su propio inicio de sesión.

**El resultado.** Un candidato pulsa «Solicitud sencilla» en Vínculo y segundos después aparece en la columna **Postulantes** de Talentia, con su CV idéntico al original, sin que nadie descargue ni suba nada. Si se repite el envío no hay duplicados; si algo se cae, el puente retoma donde iba.

**Por qué sirve en la vida real.** El puente no depende de los simuladores: les habla por API, igual que hablaría con los reales. El día que la empresa genere su API Key de BUK y BUK active Apply Connect, se reemplaza la configuración de los conectores y el resto queda igual.

## 2. Por qué no usamos LinkedIn ni BUK reales

| | LinkedIn | BUK |
|---|---|---|
| ¿Tiene API para esto? | Sí: Apply Connect entrega cada postulación al ATS en tiempo real (**Verificado**) | Sí: API del módulo de Selección (postulantes, postulaciones, procesos) (**Verificado**) |
| ¿Quién puede usarla? | Solo desarrolladores aprobados por LinkedIn como socios de Talent Solutions, tras cumplir criterios y firmar un acuerdo de API con restricciones de datos (**Verificado**) | Quien tenga una API Key creada en Administración de la cuenta de la empresa, con permisos de Lectura y Modificación de Selección (**Verificado**) |
| ¿Quién la tendría aquí? | El socio sería el fabricante del ATS (BUK), no la empresa ni un tercero. Algunas funciones exigen licencia LinkedIn Recruiter (**Verificado**) | La empresa, dueña de la cuenta |
| ¿Por qué no la usamos? | Un equipo SENA no puede ser socio de LinkedIn, y la empresa tampoco puede pedirla directamente | Según la ficha del reto, numeral 2.8, el acceso a la API REST de BUK es controlado y guiado por un gestor acompañante; el equipo no tiene una llave |
| ¿Qué hicimos? | Vínculo, que habla con el formato y las reglas públicas de Apply Connect | Talentia, que se usa igual que la API documentada de BUK |

**Lo que existe hoy entre BUK y LinkedIn (Verificado).** BUK permite publicar la vacante en LinkedIn con un enlace a su formulario: el candidato sale de LinkedIn y aplica en BUK. No trae a quienes usan la postulación rápida de LinkedIn, que es justo de donde vienen los CV que hoy se descargan a mano.

**Lo que la ficha permite.** Postulaciones simuladas (JSON/Postman/interfaz), sin conexión directa con LinkedIn, sin modificar la configuración de BUK, con datos anonimizados. La solución cumple las cuatro reglas.

## 3. Arquitectura

- Tres aplicaciones Next.js independientes en un monorepo (`apps/vinculo`, `apps/talentia`, `apps/puente`). Comparten carpeta solo para instalarse y probarse juntas; **no comparten código de dominio ni tablas**.
- Cada una con su puerto local (3001, 3002, 3003), su URL pública en Render, su esquema de base de datos y su inicio de sesión.
- Solo se comunican por HTTP, con las APIs descritas en la especificación.
- El puente es la única pieza que se entregaría a la empresa.

## 4. El túnel: por qué un servicio por eventos

| Opción | Ventaja | Por qué no es la principal |
|---|---|---|
| **Servicio por eventos (elegida)** | Tiempo real, auditable, reintentos, sin duplicados | — |
| Consulta periódica | Simple | Más lenta y gasta llamadas; queda como respaldo para reconciliar |
| n8n, Make, Zapier | Rápido de armar | No hay conectores para estos sistemas; la empresa dependería de un tercero con datos personales |
| Agente de IA que mueve datos | Flexible | No determinista, costo por postulación, riesgo con datos personales, difícil de auditar |
| Robot que hace clic en pantallas | No necesita API | Prohibido por la ficha y por los términos de LinkedIn; frágil |

Es el mismo modelo de Apply Connect: la red **empuja** cada postulación al webhook del integrador en cuanto ocurre.

**Uso de IA (opcional).** Solo como sugerencia que una persona confirma (proceso sugerido para una vacante, campos faltantes desde el CV). El transporte nunca depende de la IA.

## 5. Cómo pasaría a producción

| Qué se necesita | Quién lo da | Qué cambia en el puente |
|---|---|---|
| API Key de BUK (Lectura y Modificación de Selección) | La empresa, en Administración de BUK | Ajustar el conector del ATS a las rutas reales de su `/apidocs` |
| Apply Connect activo | BUK como socio de LinkedIn, a pedido de la empresa | Configurar credenciales reales; el formato ya es compatible |
| Si BUK no es socio | Un integrador certificado por LinkedIn | El puente actúa como su middleware |
| Datos personales | La empresa (Ley 1581) | Política de retención y borrado ya implementada; se ajusta |
| Ambiente de pruebas | La empresa | Pruebas con vacantes ficticias antes de abrir a candidatos reales |

**Alternativa sin desarrollo:** publicar en LinkedIn con enlace al formulario de BUK (ya disponible). Elimina el traslado, pero el candidato sale de LinkedIn.

## 6. Reglas de realismo, datos y marcas

- **Marcas propias**: nada de logos, nombres ni colores de LinkedIn, BUK o la empresa retadora. Se copia la experiencia, no la marca.
- **Datos ficticios realistas**: ningún perfil ni CV de personas reales (ficha y Ley 1581).
- **Etiqueta** «Entorno de simulación» en cada pantalla.
- **Llaves**: la API Key y el Client Secret se muestran una sola vez, se guardan con hash o cifrados y se pueden revocar.

## 7. Despliegue

Render, plan gratuito (decisión del equipo, 28/10/2026): 3 servicios web gratuitos y 1 base PostgreSQL gratuita (Render permite solo una base gratuita por workspace, por eso un esquema por sistema). Limitaciones aceptadas: los servicios se apagan tras 15 minutos sin tráfico y tardan cerca de un minuto en volver; la base gratuita vence a los 30 días de creada. Antes de presentar se abren los tres enlaces para «despertarlos».

## 8. Fuentes (consultadas 25–28/10/2026)

- LinkedIn — Recruiter System Connect: https://learn.microsoft.com/en-us/linkedin/talent/recruiter-system-connect
- LinkedIn — Apply Connect: https://learn.microsoft.com/en-us/linkedin/talent/apply-connect
- LinkedIn — Receive job applications: https://learn.microsoft.com/en-us/linkedin/talent/apply-connect/receive-applications
- LinkedIn — Webhooks: https://learn.microsoft.com/en-us/linkedin/shared/api-guide/webhook-validation
- LinkedIn — Requisitos de Apply Connect: https://www.linkedin.com/help/learning/answer/134620
- BUK — Integración del módulo de Selección por API: https://supportcenter.buk.co/hc/es-419/articles/49474572553755-Integraci%C3%B3n-del-m%C3%B3dulo-de-Selecci%C3%B3n-por-API
- BUK — Integración con LinkedIn: https://supportcenter.buk.cl/hc/es-419/articles/36403721109659-Integraci%C3%B3n-con-LinkedIn
- Render — Free: https://render.com/docs/free · Blueprints: https://render.com/docs/infrastructure-as-code · CLI: https://render.com/docs/cli
