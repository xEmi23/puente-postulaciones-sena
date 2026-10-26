-- AlterTable
ALTER TABLE "ats"."Proceso" ADD COLUMN     "fechaInicio" TIMESTAMPTZ(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
ADD COLUMN     "prioridad" TEXT NOT NULL DEFAULT 'Media',
ALTER COLUMN "estado" SET DEFAULT 'INICIADO';

-- Datos existentes: el estado "ABIERTO" pasa a llamarse "INICIADO" (como en el ATS de la empresa).
UPDATE "ats"."Proceso" SET "estado" = 'INICIADO' WHERE "estado" = 'ABIERTO';
