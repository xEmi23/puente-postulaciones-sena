-- CreateSchema
CREATE SCHEMA IF NOT EXISTS "puente";

-- CreateEnum
CREATE TYPE "EstadoRecepcion" AS ENUM ('RECIBIDO', 'PROCESANDO', 'COMPLETADO', 'RECHAZADO', 'FALLIDO_REINTENTABLE', 'REQUIERE_VERIFICACION');

-- CreateEnum
CREATE TYPE "PasoRecepcion" AS ENUM ('cv_descargado', 'candidato_creado', 'documento_subido', 'postulacion_creada');

-- CreateEnum
CREATE TYPE "EstadoTrabajo" AS ENUM ('PENDIENTE', 'EN_CURSO', 'HECHO', 'DETENIDO');

-- CreateTable
CREATE TABLE "Recepcion" (
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
    "estado" "EstadoRecepcion" NOT NULL DEFAULT 'RECIBIDO',
    "paso" "PasoRecepcion",
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
CREATE TABLE "Trabajo" (
    "id" UUID NOT NULL,
    "recepcionId" UUID NOT NULL,
    "estado" "EstadoTrabajo" NOT NULL DEFAULT 'PENDIENTE',
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
CREATE TABLE "EventoRecepcion" (
    "id" UUID NOT NULL,
    "recepcionId" UUID NOT NULL,
    "tipo" TEXT NOT NULL,
    "paso" "PasoRecepcion",
    "detalle" TEXT NOT NULL,
    "creadoEn" TIMESTAMPTZ(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "EventoRecepcion_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "EntregaRechazada" (
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
CREATE TABLE "Correspondencia" (
    "id" UUID NOT NULL,
    "externalJobId" TEXT NOT NULL,
    "procesoAtsId" INTEGER NOT NULL,
    "descripcion" TEXT NOT NULL,
    "activa" BOOLEAN NOT NULL DEFAULT true,
    "motivoCierre" TEXT,
    "cerradaEn" TIMESTAMPTZ(3),
    "estadoOrigenEn" TIMESTAMPTZ(3),
    "creadaEn" TIMESTAMPTZ(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "actualizadaEn" TIMESTAMPTZ(3) NOT NULL,
    "demo" BOOLEAN NOT NULL DEFAULT true,

    CONSTRAINT "Correspondencia_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "FalloSimulado" (
    "ruta" TEXT NOT NULL,
    "modo" TEXT NOT NULL,
    "restantes" INTEGER NOT NULL DEFAULT 1,
    "creadoEn" TIMESTAMPTZ(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "FalloSimulado_pkey" PRIMARY KEY ("ruta")
);

-- CreateIndex
CREATE UNIQUE INDEX "Recepcion_jobApplicationId_key" ON "Recepcion"("jobApplicationId");

-- CreateIndex
CREATE INDEX "Recepcion_estado_idx" ON "Recepcion"("estado");

-- CreateIndex
CREATE INDEX "Recepcion_recibidaEn_idx" ON "Recepcion"("recibidaEn");

-- CreateIndex
CREATE UNIQUE INDEX "Trabajo_recepcionId_key" ON "Trabajo"("recepcionId");

-- CreateIndex
CREATE INDEX "Trabajo_estado_proximoIntentoEn_idx" ON "Trabajo"("estado", "proximoIntentoEn");

-- CreateIndex
CREATE INDEX "EventoRecepcion_recepcionId_creadoEn_idx" ON "EventoRecepcion"("recepcionId", "creadoEn");

-- CreateIndex
CREATE INDEX "EntregaRechazada_recibidaEn_idx" ON "EntregaRechazada"("recibidaEn");

-- CreateIndex
CREATE UNIQUE INDEX "Correspondencia_externalJobId_key" ON "Correspondencia"("externalJobId");

-- AddForeignKey
ALTER TABLE "Trabajo" ADD CONSTRAINT "Trabajo_recepcionId_fkey" FOREIGN KEY ("recepcionId") REFERENCES "Recepcion"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "EventoRecepcion" ADD CONSTRAINT "EventoRecepcion_recepcionId_fkey" FOREIGN KEY ("recepcionId") REFERENCES "Recepcion"("id") ON DELETE CASCADE ON UPDATE CASCADE;

