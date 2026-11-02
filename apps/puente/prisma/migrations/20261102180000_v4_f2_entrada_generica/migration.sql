-- V4 F2: entrada genérica, fuentes con token, revisión humana, auditoría y retención.
-- Datos existentes: las correspondencias pasan a la fuente 'apply-connect' con vacanteExterna = externalJobId; se siembra
-- la fuente del sistema 'apply-connect' (sin token: usa la firma HMAC del webhook). Ninguna fila se borra.
--
-- Reversión (manual): DROP TABLE "EventoAuditoria"; DROP TABLE "Fuente";
--   DROP INDEX "Correspondencia_fuente_vacanteExterna_key"; ALTER TABLE "Correspondencia" DROP COLUMN "fuente", DROP COLUMN "vacanteExterna";
--   DROP INDEX "Recepcion_fuente_estado_idx"; DROP INDEX "Recepcion_procesoAtsId_correo_idx";
--   ALTER TABLE "Recepcion" DROP COLUMN "cvBorradoEn", DROP COLUMN "datosBorradosEn", DROP COLUMN "motivoRevision";
--   (correo, mediaUrl y mediaUrn vuelven a NOT NULL solo si ninguna fila quedó en NULL; el valor REQUIERE_REVISION del
--   enum no se puede quitar en PostgreSQL sin recrear el tipo: se deja.)

ALTER TYPE "EstadoRecepcion" ADD VALUE IF NOT EXISTS 'REQUIERE_REVISION';

ALTER TABLE "Correspondencia" ADD COLUMN "fuente" TEXT NOT NULL DEFAULT 'apply-connect';
ALTER TABLE "Correspondencia" ADD COLUMN "vacanteExterna" TEXT;
UPDATE "Correspondencia" SET "vacanteExterna" = "externalJobId";
CREATE UNIQUE INDEX "Correspondencia_fuente_vacanteExterna_key" ON "Correspondencia"("fuente", "vacanteExterna");

ALTER TABLE "Recepcion" ADD COLUMN "cvBorradoEn" TIMESTAMPTZ(3),
ADD COLUMN "datosBorradosEn" TIMESTAMPTZ(3),
ADD COLUMN "motivoRevision" TEXT,
ALTER COLUMN "correo" DROP NOT NULL,
ALTER COLUMN "mediaUrl" DROP NOT NULL,
ALTER COLUMN "mediaUrn" DROP NOT NULL;
CREATE INDEX "Recepcion_fuente_estado_idx" ON "Recepcion"("fuente", "estado");
CREATE INDEX "Recepcion_procesoAtsId_correo_idx" ON "Recepcion"("procesoAtsId", "correo");

CREATE TABLE "Fuente" (
    "id" UUID NOT NULL,
    "nombre" TEXT NOT NULL,
    "descripcion" TEXT NOT NULL DEFAULT '',
    "sistema" BOOLEAN NOT NULL DEFAULT false,
    "tokenHash" CHAR(64),
    "tokenPrefijo" TEXT,
    "activa" BOOLEAN NOT NULL DEFAULT true,
    "ultimoUsoEn" TIMESTAMPTZ(3),
    "revocadaEn" TIMESTAMPTZ(3),
    "creadaEn" TIMESTAMPTZ(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "actualizadaEn" TIMESTAMPTZ(3) NOT NULL,
    CONSTRAINT "Fuente_pkey" PRIMARY KEY ("id")
);
CREATE UNIQUE INDEX "Fuente_nombre_key" ON "Fuente"("nombre");
CREATE INDEX "Fuente_tokenPrefijo_idx" ON "Fuente"("tokenPrefijo");

CREATE TABLE "EventoAuditoria" (
    "id" UUID NOT NULL,
    "actorTipo" TEXT NOT NULL,
    "actorId" TEXT NOT NULL,
    "accion" TEXT NOT NULL,
    "recepcionId" UUID,
    "detalle" TEXT,
    "creadoEn" TIMESTAMPTZ(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "EventoAuditoria_pkey" PRIMARY KEY ("id")
);
CREATE INDEX "EventoAuditoria_recepcionId_creadoEn_idx" ON "EventoAuditoria"("recepcionId", "creadoEn");
CREATE INDEX "EventoAuditoria_creadoEn_idx" ON "EventoAuditoria"("creadoEn");

-- Fuente del sistema para el adaptador de Apply Connect (Vínculo, simulado).
INSERT INTO "Fuente" ("id", "nombre", "descripcion", "sistema", "activa", "actualizadaEn")
VALUES (gen_random_uuid(), 'apply-connect', 'Apply Connect (Vínculo, simulado): webhook firmado con HMAC', true, true, CURRENT_TIMESTAMP)
ON CONFLICT ("nombre") DO NOTHING;
