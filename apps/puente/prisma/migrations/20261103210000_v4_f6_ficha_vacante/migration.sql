-- V4 F6: datos públicos de la vacante que ve el candidato en el formulario (título, ciudad, modalidad, tipo de empleo y
-- descripción). Son del Puente: el proceso del ATS no cambia. Tabla nueva; no toca datos existentes.
-- Reversión: DROP TABLE "FichaVacante";

-- CreateTable
CREATE TABLE "FichaVacante" (
    "codigo" TEXT NOT NULL,
    "titulo" TEXT NOT NULL,
    "ciudad" TEXT NOT NULL,
    "modalidad" TEXT NOT NULL,
    "tipoEmpleo" TEXT NOT NULL,
    "descripcion" TEXT NOT NULL,
    "actualizadaEn" TIMESTAMPTZ(3) NOT NULL,

    CONSTRAINT "FichaVacante_pkey" PRIMARY KEY ("codigo")
);
