-- AlterTable
ALTER TABLE "origen"."Outbox" ADD COLUMN     "vacanteCodigo" TEXT,
ALTER COLUMN "postulacionId" DROP NOT NULL;

-- AlterTable
ALTER TABLE "puente"."Correspondencia" ADD COLUMN     "cerradaEn" TIMESTAMPTZ(3),
ADD COLUMN     "estadoOrigenEn" TIMESTAMPTZ(3),
ADD COLUMN     "motivoCierre" TEXT;
