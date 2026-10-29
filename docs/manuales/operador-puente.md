# Manual · Operador/a del puente

Cuenta demo: `operador@puente.demo.test`. Puede ver todo y reintentar; no cambia conexiones ni publicaciones.

- **Operaciones** (`/operaciones`): cada postulación recibida de Vínculo con su estado. La lista se actualiza sola.
  - **Recibido / Procesando:** en curso. **Recibido no es transferido.**
  - **Completado:** la postulación ya existe en Talentia (pasos «CV descargado», «Postulante listo», «Documento subido», «Postulación creada»).
  - **Fallido (reintentable):** el puente reintenta solo (hasta 10 veces). Si quedó **detenido** (API Key revocada, sin permiso, sin conexión), corrige la causa y pulsa **«Reintentar»**: continúa desde el último paso, sin duplicar.
  - **Requiere verificación:** Talentia no respondió al crear la postulación y no se sabe si quedó. **«Reconciliar con Talentia»** la busca por su referencia y completa sin duplicar.
  - **Rechazado:** el CV no era válido o venció; el detalle dice por qué.
- **Detalle de la operación:** línea de tiempo con cada paso e intento, la explicación del error («qué pasó» y «qué hacer») y el estado del aviso «CV descargado» a Vínculo. El correo se muestra enmascarado.
- **Rechazos** (`/rechazos`): entregas que no se aceptaron en la entrada (firma inválida, datos incompletos, vacante cerrada…), con su código. No crearon nada en Talentia.
- **Métricas** (`/metricas`): recibidas, completadas, rechazadas, duplicados evitados, en reintento, tiempo de recepción a completado (mediana y p95) y totales por proceso.
