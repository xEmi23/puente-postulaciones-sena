# Manual · Reclutador/a de Vínculo

Entra con una cuenta de reclutador de una empresa (demo: `reclutadora@andina.demo.test`, Andina Software S.A.S., ficticia).

- **Panel del reclutador** (`/reclutador`): tus vacantes con su estado y número de solicitudes.
- **Publicar vacante:** título, descripción, ciudad, modalidad, nivel y tipo de empleo. Elige cómo recibir:
  - **En Vínculo, con «Solicitud sencilla».** Si eliges un **ATS conectado** (una aplicación autorizada en «Integraciones»), cada solicitud se entrega sola a ese ATS; Vínculo valida su webhook antes de publicar. Si no eliges ATS, las solicitudes quedan en Vínculo.
  - **En el sitio de la empresa** (enlace externo).
- **Ver solicitudes** (detalle de la vacante): datos de cada persona; «Descargar CV» la marca como «CV descargado» para el candidato; también «Marcar como vista» y «No seleccionar». Es el trabajo manual que el puente elimina.
- **Editar, cerrar y reabrir** una vacante. Cerrada, deja de recibir solicitudes.
- **Integraciones** (`/reclutador/integraciones`): autoriza (o revoca) la aplicación de un ATS con su Client ID. Sin autorización, la aplicación no puede publicar en nombre de la empresa.
