-- CreateSchema
CREATE SCHEMA IF NOT EXISTS "vinculo";

-- CreateEnum
CREATE TYPE "EstadoVacante" AS ENUM ('BORRADOR', 'PUBLICADA', 'CERRADA');

-- CreateEnum
CREATE TYPE "EstadoOutbox" AS ENUM ('PENDIENTE', 'ENVIADO', 'FALLIDO');

-- CreateTable
CREATE TABLE "Vacante" (
    "id" UUID NOT NULL,
    "codigo" TEXT NOT NULL,
    "titulo" TEXT NOT NULL,
    "area" TEXT NOT NULL,
    "ciudad" TEXT NOT NULL,
    "modalidad" TEXT NOT NULL,
    "descripcion" TEXT NOT NULL,
    "estado" "EstadoVacante" NOT NULL DEFAULT 'PUBLICADA',
    "publicadaEn" TIMESTAMPTZ(3),
    "creadaEn" TIMESTAMPTZ(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "actualizadaEn" TIMESTAMPTZ(3) NOT NULL,
    "demo" BOOLEAN NOT NULL DEFAULT true,

    CONSTRAINT "Vacante_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "ArchivoCv" (
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
CREATE TABLE "Postulacion" (
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
CREATE TABLE "Outbox" (
    "id" UUID NOT NULL,
    "postulacionId" UUID,
    "tipo" TEXT NOT NULL DEFAULT 'EXPORT_JOB_APPLICATION',
    "vacanteCodigo" TEXT,
    "payload" TEXT NOT NULL,
    "estado" "EstadoOutbox" NOT NULL DEFAULT 'PENDIENTE',
    "intentos" INTEGER NOT NULL DEFAULT 0,
    "proximoIntentoEn" TIMESTAMPTZ(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "bloqueadoHasta" TIMESTAMPTZ(3),
    "ultimoError" TEXT,
    "creadoEn" TIMESTAMPTZ(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "enviadoEn" TIMESTAMPTZ(3),

    CONSTRAINT "Outbox_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "IntentoEntrega" (
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

-- CreateIndex
CREATE UNIQUE INDEX "Vacante_codigo_key" ON "Vacante"("codigo");

-- CreateIndex
CREATE UNIQUE INDEX "ArchivoCv_mediaUrn_key" ON "ArchivoCv"("mediaUrn");

-- CreateIndex
CREATE UNIQUE INDEX "Postulacion_jobApplicationId_key" ON "Postulacion"("jobApplicationId");

-- CreateIndex
CREATE UNIQUE INDEX "Postulacion_archivoCvId_key" ON "Postulacion"("archivoCvId");

-- CreateIndex
CREATE INDEX "Postulacion_vacanteId_idx" ON "Postulacion"("vacanteId");

-- CreateIndex
CREATE INDEX "Outbox_estado_proximoIntentoEn_idx" ON "Outbox"("estado", "proximoIntentoEn");

-- CreateIndex
CREATE INDEX "IntentoEntrega_outboxId_idx" ON "IntentoEntrega"("outboxId");

-- AddForeignKey
ALTER TABLE "Postulacion" ADD CONSTRAINT "Postulacion_vacanteId_fkey" FOREIGN KEY ("vacanteId") REFERENCES "Vacante"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Postulacion" ADD CONSTRAINT "Postulacion_archivoCvId_fkey" FOREIGN KEY ("archivoCvId") REFERENCES "ArchivoCv"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Outbox" ADD CONSTRAINT "Outbox_postulacionId_fkey" FOREIGN KEY ("postulacionId") REFERENCES "Postulacion"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "IntentoEntrega" ADD CONSTRAINT "IntentoEntrega_outboxId_fkey" FOREIGN KEY ("outboxId") REFERENCES "Outbox"("id") ON DELETE CASCADE ON UPDATE CASCADE;

