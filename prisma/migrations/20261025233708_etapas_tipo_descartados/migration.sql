-- AlterTable
ALTER TABLE "ats"."Etapa" ADD COLUMN     "tipo" TEXT;

-- AlterTable
ALTER TABLE "ats"."Postulacion" ADD COLUMN     "descartadaEn" TIMESTAMPTZ(3);
