-- CreateSchema
CREATE SCHEMA IF NOT EXISTS "talentia";

-- CreateTable
CREATE TABLE "Proceso" (
    "id" INTEGER NOT NULL,
    "nombre" TEXT NOT NULL,
    "area" TEXT NOT NULL,
    "ciudad" TEXT NOT NULL,
    "estado" TEXT NOT NULL DEFAULT 'INICIADO',
    "prioridad" TEXT NOT NULL DEFAULT 'Media',
    "fechaInicio" TIMESTAMPTZ(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "creadoEn" TIMESTAMPTZ(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "demo" BOOLEAN NOT NULL DEFAULT true,

    CONSTRAINT "Proceso_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Etapa" (
    "id" UUID NOT NULL,
    "procesoId" INTEGER NOT NULL,
    "nombre" TEXT NOT NULL,
    "orden" INTEGER NOT NULL,
    "tipo" TEXT,

    CONSTRAINT "Etapa_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Candidato" (
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
CREATE TABLE "Documento" (
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
CREATE TABLE "Postulacion" (
    "id" UUID NOT NULL,
    "procesoId" INTEGER NOT NULL,
    "candidatoId" UUID NOT NULL,
    "etapaId" UUID NOT NULL,
    "documentoId" UUID,
    "calificacion" TEXT NOT NULL DEFAULT 'SIN_CALIFICAR',
    "fuente" TEXT NOT NULL,
    "referenciaExterna" TEXT NOT NULL,
    "vista" BOOLEAN NOT NULL DEFAULT false,
    "descartadaEn" TIMESTAMPTZ(3),
    "creadaEn" TIMESTAMPTZ(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "Postulacion_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "ClaveIdempotencia" (
    "clave" TEXT NOT NULL,
    "ruta" TEXT NOT NULL,
    "hashSolicitud" CHAR(64) NOT NULL,
    "estadoHttp" INTEGER NOT NULL,
    "respuesta" TEXT NOT NULL,
    "creadaEn" TIMESTAMPTZ(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "ClaveIdempotencia_pkey" PRIMARY KEY ("clave")
);

-- CreateIndex
CREATE UNIQUE INDEX "Etapa_procesoId_orden_key" ON "Etapa"("procesoId", "orden");

-- CreateIndex
CREATE UNIQUE INDEX "Candidato_correo_key" ON "Candidato"("correo");

-- CreateIndex
CREATE INDEX "Documento_candidatoId_idx" ON "Documento"("candidatoId");

-- CreateIndex
CREATE UNIQUE INDEX "Postulacion_referenciaExterna_key" ON "Postulacion"("referenciaExterna");

-- CreateIndex
CREATE UNIQUE INDEX "Postulacion_procesoId_candidatoId_key" ON "Postulacion"("procesoId", "candidatoId");

-- AddForeignKey
ALTER TABLE "Etapa" ADD CONSTRAINT "Etapa_procesoId_fkey" FOREIGN KEY ("procesoId") REFERENCES "Proceso"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Documento" ADD CONSTRAINT "Documento_candidatoId_fkey" FOREIGN KEY ("candidatoId") REFERENCES "Candidato"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Postulacion" ADD CONSTRAINT "Postulacion_procesoId_fkey" FOREIGN KEY ("procesoId") REFERENCES "Proceso"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Postulacion" ADD CONSTRAINT "Postulacion_candidatoId_fkey" FOREIGN KEY ("candidatoId") REFERENCES "Candidato"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Postulacion" ADD CONSTRAINT "Postulacion_etapaId_fkey" FOREIGN KEY ("etapaId") REFERENCES "Etapa"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Postulacion" ADD CONSTRAINT "Postulacion_documentoId_fkey" FOREIGN KEY ("documentoId") REFERENCES "Documento"("id") ON DELETE SET NULL ON UPDATE CASCADE;

