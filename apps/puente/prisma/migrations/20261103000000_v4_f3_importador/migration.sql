-- V4 F3: importador manual (lotes de CV en espera de confirmación). Tablas nuevas; no toca datos existentes.
-- Reversión: DROP TABLE "ArchivoImportacion"; DROP TABLE "LoteImportacion";

-- CreateTable
CREATE TABLE "LoteImportacion" (
    "id" UUID NOT NULL,
    "usuarioId" TEXT NOT NULL,
    "procesoAtsId" INTEGER NOT NULL,
    "creadoEn" TIMESTAMPTZ(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "confirmadoEn" TIMESTAMPTZ(3),

    CONSTRAINT "LoteImportacion_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "ArchivoImportacion" (
    "id" UUID NOT NULL,
    "loteId" UUID NOT NULL,
    "orden" INTEGER NOT NULL,
    "nombreArchivo" TEXT NOT NULL,
    "contenido" BYTEA,
    "sha256" CHAR(64),
    "tamano" INTEGER NOT NULL,
    "textoLeido" BOOLEAN NOT NULL DEFAULT false,
    "nombres" TEXT NOT NULL DEFAULT '',
    "apellidos" TEXT NOT NULL DEFAULT '',
    "correo" TEXT NOT NULL DEFAULT '',
    "telefono" TEXT NOT NULL DEFAULT '',
    "origenNombre" TEXT NOT NULL DEFAULT 'archivo',
    "error" TEXT,
    "resultado" TEXT,
    "recepcionId" UUID,

    CONSTRAINT "ArchivoImportacion_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "LoteImportacion_creadoEn_idx" ON "LoteImportacion"("creadoEn");

-- CreateIndex
CREATE INDEX "ArchivoImportacion_loteId_orden_idx" ON "ArchivoImportacion"("loteId", "orden");

-- AddForeignKey
ALTER TABLE "ArchivoImportacion" ADD CONSTRAINT "ArchivoImportacion_loteId_fkey" FOREIGN KEY ("loteId") REFERENCES "LoteImportacion"("id") ON DELETE CASCADE ON UPDATE CASCADE;

