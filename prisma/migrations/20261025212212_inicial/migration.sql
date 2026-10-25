-- CreateSchema
CREATE SCHEMA IF NOT EXISTS "ats";

-- CreateSchema
CREATE SCHEMA IF NOT EXISTS "origen";

-- CreateSchema
CREATE SCHEMA IF NOT EXISTS "puente";

-- CreateEnum
CREATE TYPE "origen"."EstadoVacante" AS ENUM ('BORRADOR', 'PUBLICADA', 'CERRADA');

-- CreateEnum
CREATE TYPE "origen"."EstadoOutbox" AS ENUM ('PENDIENTE', 'ENVIADO', 'FALLIDO');

-- CreateEnum
CREATE TYPE "puente"."EstadoRecepcion" AS ENUM ('RECIBIDO', 'PROCESANDO', 'COMPLETADO', 'RECHAZADO', 'FALLIDO_REINTENTABLE', 'REQUIERE_VERIFICACION');

-- CreateEnum
CREATE TYPE "puente"."PasoRecepcion" AS ENUM ('cv_descargado', 'candidato_creado', 'documento_subido', 'postulacion_creada');

-- CreateEnum
CREATE TYPE "puente"."EstadoTrabajo" AS ENUM ('PENDIENTE', 'EN_CURSO', 'HECHO', 'DETENIDO');

-- CreateTable
CREATE TABLE "origen"."Vacante" (
    "id" UUID NOT NULL,
    "codigo" TEXT NOT NULL,
    "titulo" TEXT NOT NULL,
    "area" TEXT NOT NULL,
    "ciudad" TEXT NOT NULL,
    "modalidad" TEXT NOT NULL,
    "descripcion" TEXT NOT NULL,
    "estado" "origen"."EstadoVacante" NOT NULL DEFAULT 'PUBLICADA',
    "publicadaEn" TIMESTAMPTZ(3),
    "creadaEn" TIMESTAMPTZ(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "actualizadaEn" TIMESTAMPTZ(3) NOT NULL,
    "demo" BOOLEAN NOT NULL DEFAULT true,

    CONSTRAINT "Vacante_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "origen"."ArchivoCv" (
    "id" UUID NOT NULL,
    "nombreArchivo" TEXT NOT NULL,
    "mime" TEXT NOT NULL,
    "tamano" INTEGER NOT NULL,
    "sha256" CHAR(64) NOT NULL,
    "contenido" BYTEA NOT NULL,
    "mediaUrn" TEXT NOT NULL,
    "expiraEn" TIMESTAMPTZ(3) NOT NULL,
    "creadoEn" TIMESTAMPTZ(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "ArchivoCv_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "origen"."Postulacion" (
    "id" UUID NOT NULL,
    "jobApplicationId" TEXT NOT NULL,
    "jobApplicant" TEXT NOT NULL,
    "vacanteId" UUID NOT NULL,
    "nombre" TEXT NOT NULL,
    "apellido" TEXT NOT NULL,
    "correo" TEXT NOT NULL,
    "telefono" TEXT,
    "ciudad" TEXT NOT NULL,
    "archivoCvId" UUID NOT NULL,
    "aplicadaEn" TIMESTAMPTZ(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "demo" BOOLEAN NOT NULL DEFAULT true,

    CONSTRAINT "Postulacion_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "origen"."Outbox" (
    "id" UUID NOT NULL,
    "postulacionId" UUID NOT NULL,
    "tipo" TEXT NOT NULL DEFAULT 'EXPORT_JOB_APPLICATION',
    "payload" TEXT NOT NULL,
    "estado" "origen"."EstadoOutbox" NOT NULL DEFAULT 'PENDIENTE',
    "intentos" INTEGER NOT NULL DEFAULT 0,
    "proximoIntentoEn" TIMESTAMPTZ(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "bloqueadoHasta" TIMESTAMPTZ(3),
    "ultimoError" TEXT,
    "creadoEn" TIMESTAMPTZ(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "enviadoEn" TIMESTAMPTZ(3),

    CONSTRAINT "Outbox_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "origen"."IntentoEntrega" (
    "id" UUID NOT NULL,
    "outboxId" UUID NOT NULL,
    "numero" INTEGER NOT NULL,
    "enviadoEn" TIMESTAMPTZ(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "httpStatus" INTEGER,
    "codigoError" TEXT,
    "respuesta" TEXT,
    "duracionMs" INTEGER NOT NULL,
    "error" TEXT,

    CONSTRAINT "IntentoEntrega_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "puente"."Recepcion" (
    "id" UUID NOT NULL,
    "jobApplicationId" TEXT NOT NULL,
    "jobApplicant" TEXT NOT NULL,
    "externalJobId" TEXT NOT NULL,
    "appliedAt" TIMESTAMPTZ(3) NOT NULL,
    "payloadSha256" CHAR(64) NOT NULL,
    "nombre" TEXT NOT NULL,
    "apellido" TEXT NOT NULL,
    "correo" TEXT NOT NULL,
    "telefono" TEXT,
    "ciudad" TEXT,
    "mediaUrl" TEXT NOT NULL,
    "mediaUrn" TEXT NOT NULL,
    "estado" "puente"."EstadoRecepcion" NOT NULL DEFAULT 'RECIBIDO',
    "paso" "puente"."PasoRecepcion",
    "procesoAtsId" INTEGER,
    "cvSha256" CHAR(64),
    "cvTamano" INTEGER,
    "cvNombreArchivo" TEXT,
    "cvContenido" BYTEA,
    "atsCandidatoId" TEXT,
    "atsDocumentoId" TEXT,
    "atsPostulacionId" TEXT,
    "errorCodigo" TEXT,
    "errorDetalle" TEXT,
    "duplicadosEvitados" INTEGER NOT NULL DEFAULT 0,
    "recibidaEn" TIMESTAMPTZ(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "completadaEn" TIMESTAMPTZ(3),
    "actualizadaEn" TIMESTAMPTZ(3) NOT NULL,
    "demo" BOOLEAN NOT NULL DEFAULT true,

    CONSTRAINT "Recepcion_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "puente"."Trabajo" (
    "id" UUID NOT NULL,
    "recepcionId" UUID NOT NULL,
    "estado" "puente"."EstadoTrabajo" NOT NULL DEFAULT 'PENDIENTE',
    "intentos" INTEGER NOT NULL DEFAULT 0,
    "proximoIntentoEn" TIMESTAMPTZ(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "leaseHasta" TIMESTAMPTZ(3),
    "leaseDueno" TEXT,
    "ultimoError" TEXT,
    "creadoEn" TIMESTAMPTZ(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "actualizadoEn" TIMESTAMPTZ(3) NOT NULL,

    CONSTRAINT "Trabajo_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "puente"."EventoRecepcion" (
    "id" UUID NOT NULL,
    "recepcionId" UUID NOT NULL,
    "tipo" TEXT NOT NULL,
    "paso" "puente"."PasoRecepcion",
    "detalle" TEXT NOT NULL,
    "creadoEn" TIMESTAMPTZ(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "EventoRecepcion_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "puente"."EntregaRechazada" (
    "id" UUID NOT NULL,
    "codigo" TEXT NOT NULL,
    "motivo" TEXT NOT NULL,
    "jobApplicationId" TEXT,
    "externalJobId" TEXT,
    "recibidaEn" TIMESTAMPTZ(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "demo" BOOLEAN NOT NULL DEFAULT true,

    CONSTRAINT "EntregaRechazada_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "puente"."Correspondencia" (
    "id" UUID NOT NULL,
    "externalJobId" TEXT NOT NULL,
    "procesoAtsId" INTEGER NOT NULL,
    "descripcion" TEXT NOT NULL,
    "activa" BOOLEAN NOT NULL DEFAULT true,
    "creadaEn" TIMESTAMPTZ(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "actualizadaEn" TIMESTAMPTZ(3) NOT NULL,
    "demo" BOOLEAN NOT NULL DEFAULT true,

    CONSTRAINT "Correspondencia_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "ats"."Proceso" (
    "id" INTEGER NOT NULL,
    "nombre" TEXT NOT NULL,
    "area" TEXT NOT NULL,
    "ciudad" TEXT NOT NULL,
    "estado" TEXT NOT NULL DEFAULT 'ABIERTO',
    "creadoEn" TIMESTAMPTZ(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "demo" BOOLEAN NOT NULL DEFAULT true,

    CONSTRAINT "Proceso_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "ats"."Etapa" (
    "id" UUID NOT NULL,
    "procesoId" INTEGER NOT NULL,
    "nombre" TEXT NOT NULL,
    "orden" INTEGER NOT NULL,

    CONSTRAINT "Etapa_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "ats"."Candidato" (
    "id" UUID NOT NULL,
    "nombre" TEXT NOT NULL,
    "apellido" TEXT NOT NULL,
    "correo" TEXT NOT NULL,
    "telefono" TEXT,
    "ciudad" TEXT,
    "referenciaExterna" TEXT,
    "creadoEn" TIMESTAMPTZ(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "demo" BOOLEAN NOT NULL DEFAULT true,

    CONSTRAINT "Candidato_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "ats"."Documento" (
    "id" UUID NOT NULL,
    "candidatoId" UUID NOT NULL,
    "tipo" TEXT NOT NULL DEFAULT 'CV',
    "nombreArchivo" TEXT NOT NULL,
    "mime" TEXT NOT NULL,
    "tamano" INTEGER NOT NULL,
    "sha256" CHAR(64) NOT NULL,
    "contenido" BYTEA NOT NULL,
    "creadoEn" TIMESTAMPTZ(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "Documento_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "ats"."Postulacion" (
    "id" UUID NOT NULL,
    "procesoId" INTEGER NOT NULL,
    "candidatoId" UUID NOT NULL,
    "etapaId" UUID NOT NULL,
    "documentoId" UUID,
    "calificacion" TEXT NOT NULL DEFAULT 'SIN_CALIFICAR',
    "fuente" TEXT NOT NULL,
    "referenciaExterna" TEXT NOT NULL,
    "vista" BOOLEAN NOT NULL DEFAULT false,
    "creadaEn" TIMESTAMPTZ(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "Postulacion_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "ats"."ClaveIdempotencia" (
    "clave" TEXT NOT NULL,
    "ruta" TEXT NOT NULL,
    "hashSolicitud" CHAR(64) NOT NULL,
    "estadoHttp" INTEGER NOT NULL,
    "respuesta" TEXT NOT NULL,
    "creadaEn" TIMESTAMPTZ(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "ClaveIdempotencia_pkey" PRIMARY KEY ("clave")
);

-- CreateTable
CREATE TABLE "ats"."FalloSimulado" (
    "ruta" TEXT NOT NULL,
    "modo" TEXT NOT NULL,
    "restantes" INTEGER NOT NULL DEFAULT 1,
    "creadoEn" TIMESTAMPTZ(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "FalloSimulado_pkey" PRIMARY KEY ("ruta")
);

-- CreateIndex
CREATE UNIQUE INDEX "Vacante_codigo_key" ON "origen"."Vacante"("codigo");

-- CreateIndex
CREATE UNIQUE INDEX "ArchivoCv_mediaUrn_key" ON "origen"."ArchivoCv"("mediaUrn");

-- CreateIndex
CREATE UNIQUE INDEX "Postulacion_jobApplicationId_key" ON "origen"."Postulacion"("jobApplicationId");

-- CreateIndex
CREATE UNIQUE INDEX "Postulacion_archivoCvId_key" ON "origen"."Postulacion"("archivoCvId");

-- CreateIndex
CREATE INDEX "Postulacion_vacanteId_idx" ON "origen"."Postulacion"("vacanteId");

-- CreateIndex
CREATE INDEX "Outbox_estado_proximoIntentoEn_idx" ON "origen"."Outbox"("estado", "proximoIntentoEn");

-- CreateIndex
CREATE INDEX "IntentoEntrega_outboxId_idx" ON "origen"."IntentoEntrega"("outboxId");

-- CreateIndex
CREATE UNIQUE INDEX "Recepcion_jobApplicationId_key" ON "puente"."Recepcion"("jobApplicationId");

-- CreateIndex
CREATE INDEX "Recepcion_estado_idx" ON "puente"."Recepcion"("estado");

-- CreateIndex
CREATE INDEX "Recepcion_recibidaEn_idx" ON "puente"."Recepcion"("recibidaEn");

-- CreateIndex
CREATE UNIQUE INDEX "Trabajo_recepcionId_key" ON "puente"."Trabajo"("recepcionId");

-- CreateIndex
CREATE INDEX "Trabajo_estado_proximoIntentoEn_idx" ON "puente"."Trabajo"("estado", "proximoIntentoEn");

-- CreateIndex
CREATE INDEX "EventoRecepcion_recepcionId_creadoEn_idx" ON "puente"."EventoRecepcion"("recepcionId", "creadoEn");

-- CreateIndex
CREATE INDEX "EntregaRechazada_recibidaEn_idx" ON "puente"."EntregaRechazada"("recibidaEn");

-- CreateIndex
CREATE UNIQUE INDEX "Correspondencia_externalJobId_key" ON "puente"."Correspondencia"("externalJobId");

-- CreateIndex
CREATE UNIQUE INDEX "Etapa_procesoId_orden_key" ON "ats"."Etapa"("procesoId", "orden");

-- CreateIndex
CREATE UNIQUE INDEX "Candidato_correo_key" ON "ats"."Candidato"("correo");

-- CreateIndex
CREATE INDEX "Documento_candidatoId_idx" ON "ats"."Documento"("candidatoId");

-- CreateIndex
CREATE UNIQUE INDEX "Postulacion_referenciaExterna_key" ON "ats"."Postulacion"("referenciaExterna");

-- CreateIndex
CREATE UNIQUE INDEX "Postulacion_procesoId_candidatoId_key" ON "ats"."Postulacion"("procesoId", "candidatoId");

-- AddForeignKey
ALTER TABLE "origen"."Postulacion" ADD CONSTRAINT "Postulacion_vacanteId_fkey" FOREIGN KEY ("vacanteId") REFERENCES "origen"."Vacante"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "origen"."Postulacion" ADD CONSTRAINT "Postulacion_archivoCvId_fkey" FOREIGN KEY ("archivoCvId") REFERENCES "origen"."ArchivoCv"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "origen"."Outbox" ADD CONSTRAINT "Outbox_postulacionId_fkey" FOREIGN KEY ("postulacionId") REFERENCES "origen"."Postulacion"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "origen"."IntentoEntrega" ADD CONSTRAINT "IntentoEntrega_outboxId_fkey" FOREIGN KEY ("outboxId") REFERENCES "origen"."Outbox"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "puente"."Trabajo" ADD CONSTRAINT "Trabajo_recepcionId_fkey" FOREIGN KEY ("recepcionId") REFERENCES "puente"."Recepcion"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "puente"."EventoRecepcion" ADD CONSTRAINT "EventoRecepcion_recepcionId_fkey" FOREIGN KEY ("recepcionId") REFERENCES "puente"."Recepcion"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ats"."Etapa" ADD CONSTRAINT "Etapa_procesoId_fkey" FOREIGN KEY ("procesoId") REFERENCES "ats"."Proceso"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ats"."Documento" ADD CONSTRAINT "Documento_candidatoId_fkey" FOREIGN KEY ("candidatoId") REFERENCES "ats"."Candidato"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ats"."Postulacion" ADD CONSTRAINT "Postulacion_procesoId_fkey" FOREIGN KEY ("procesoId") REFERENCES "ats"."Proceso"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ats"."Postulacion" ADD CONSTRAINT "Postulacion_candidatoId_fkey" FOREIGN KEY ("candidatoId") REFERENCES "ats"."Candidato"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ats"."Postulacion" ADD CONSTRAINT "Postulacion_etapaId_fkey" FOREIGN KEY ("etapaId") REFERENCES "ats"."Etapa"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ats"."Postulacion" ADD CONSTRAINT "Postulacion_documentoId_fkey" FOREIGN KEY ("documentoId") REFERENCES "ats"."Documento"("id") ON DELETE SET NULL ON UPDATE CASCADE;
