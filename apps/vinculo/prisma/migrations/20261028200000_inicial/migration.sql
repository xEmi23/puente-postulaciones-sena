-- CreateSchema
CREATE SCHEMA IF NOT EXISTS "vinculo";

-- CreateEnum
CREATE TYPE "EstadoVacante" AS ENUM ('BORRADOR', 'PUBLICADA', 'CERRADA');

-- CreateEnum
CREATE TYPE "EstadoPostulacion" AS ENUM ('ENVIADA', 'VISTA', 'CV_DESCARGADO', 'NO_SELECCIONADO');

-- CreateEnum
CREATE TYPE "EstadoOutbox" AS ENUM ('PENDIENTE', 'ENVIADO', 'FALLIDO');

-- CreateTable
CREATE TABLE "User" (
    "id" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "email" TEXT NOT NULL,
    "emailVerified" BOOLEAN NOT NULL DEFAULT false,
    "image" TEXT,
    "rol" TEXT NOT NULL DEFAULT 'CANDIDATO',
    "empresaId" UUID,
    "createdAt" TIMESTAMPTZ(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMPTZ(3) NOT NULL,
    "demo" BOOLEAN NOT NULL DEFAULT false,

    CONSTRAINT "User_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Session" (
    "id" TEXT NOT NULL,
    "expiresAt" TIMESTAMPTZ(3) NOT NULL,
    "token" TEXT NOT NULL,
    "createdAt" TIMESTAMPTZ(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMPTZ(3) NOT NULL,
    "ipAddress" TEXT,
    "userAgent" TEXT,
    "userId" TEXT NOT NULL,

    CONSTRAINT "Session_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Account" (
    "id" TEXT NOT NULL,
    "accountId" TEXT NOT NULL,
    "providerId" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "accessToken" TEXT,
    "refreshToken" TEXT,
    "idToken" TEXT,
    "accessTokenExpiresAt" TIMESTAMPTZ(3),
    "refreshTokenExpiresAt" TIMESTAMPTZ(3),
    "scope" TEXT,
    "password" TEXT,
    "createdAt" TIMESTAMPTZ(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMPTZ(3) NOT NULL,

    CONSTRAINT "Account_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Verification" (
    "id" TEXT NOT NULL,
    "identifier" TEXT NOT NULL,
    "value" TEXT NOT NULL,
    "expiresAt" TIMESTAMPTZ(3) NOT NULL,
    "createdAt" TIMESTAMPTZ(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMPTZ(3) NOT NULL,

    CONSTRAINT "Verification_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Perfil" (
    "id" UUID NOT NULL,
    "userId" TEXT NOT NULL,
    "slug" TEXT NOT NULL,
    "titular" TEXT NOT NULL DEFAULT '',
    "ciudad" TEXT NOT NULL DEFAULT '',
    "telefono" TEXT,
    "acercaDe" TEXT NOT NULL DEFAULT '',
    "habilidades" TEXT[],
    "cvId" UUID,

    CONSTRAINT "Perfil_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Experiencia" (
    "id" UUID NOT NULL,
    "perfilId" UUID NOT NULL,
    "cargo" TEXT NOT NULL,
    "empresa" TEXT NOT NULL,
    "desde" TEXT NOT NULL,
    "hasta" TEXT,
    "descripcion" TEXT NOT NULL DEFAULT '',
    "orden" INTEGER NOT NULL DEFAULT 0,

    CONSTRAINT "Experiencia_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Educacion" (
    "id" UUID NOT NULL,
    "perfilId" UUID NOT NULL,
    "institucion" TEXT NOT NULL,
    "titulo" TEXT NOT NULL,
    "desde" TEXT NOT NULL,
    "hasta" TEXT,
    "orden" INTEGER NOT NULL DEFAULT 0,

    CONSTRAINT "Educacion_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Empresa" (
    "id" UUID NOT NULL,
    "slug" TEXT NOT NULL,
    "nombre" TEXT NOT NULL,
    "sector" TEXT NOT NULL,
    "ciudad" TEXT NOT NULL,
    "tamano" TEXT NOT NULL,
    "descripcion" TEXT NOT NULL,
    "sitioWeb" TEXT NOT NULL,
    "color" TEXT NOT NULL,
    "demo" BOOLEAN NOT NULL DEFAULT true,

    CONSTRAINT "Empresa_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Vacante" (
    "id" UUID NOT NULL,
    "empresaId" UUID NOT NULL,
    "externalJobId" TEXT NOT NULL,
    "titulo" TEXT NOT NULL,
    "descripcion" TEXT NOT NULL,
    "ciudad" TEXT NOT NULL,
    "modalidad" TEXT NOT NULL,
    "nivel" TEXT NOT NULL,
    "tipoEmpleo" TEXT NOT NULL DEFAULT 'TIEMPO_COMPLETO',
    "estado" "EstadoVacante" NOT NULL DEFAULT 'PUBLICADA',
    "solicitudSencilla" BOOLEAN NOT NULL DEFAULT false,
    "aplicacionId" UUID,
    "webhookUrl" TEXT,
    "urlEmpresa" TEXT,
    "motivoSinSolicitud" TEXT,
    "publicadaEn" TIMESTAMPTZ(3),
    "cerradaEn" TIMESTAMPTZ(3),
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
    "mediaUrn" TEXT,
    "expiraEn" TIMESTAMPTZ(3),
    "creadoEn" TIMESTAMPTZ(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "ArchivoCv_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Postulacion" (
    "id" UUID NOT NULL,
    "jobApplicationId" TEXT NOT NULL,
    "vacanteId" UUID NOT NULL,
    "candidatoId" TEXT NOT NULL,
    "nombre" TEXT NOT NULL,
    "apellido" TEXT NOT NULL,
    "correo" TEXT NOT NULL,
    "telefono" TEXT,
    "ciudad" TEXT NOT NULL,
    "archivoCvId" UUID NOT NULL,
    "estado" "EstadoPostulacion" NOT NULL DEFAULT 'ENVIADA',
    "aplicadaEn" TIMESTAMPTZ(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "vistaEn" TIMESTAMPTZ(3),
    "cvDescargadoEn" TIMESTAMPTZ(3),
    "rechazadaEn" TIMESTAMPTZ(3),
    "demo" BOOLEAN NOT NULL DEFAULT false,

    CONSTRAINT "Postulacion_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "AplicacionDev" (
    "id" UUID NOT NULL,
    "nombre" TEXT NOT NULL,
    "clientId" TEXT NOT NULL,
    "secretoCifrado" TEXT NOT NULL,
    "secretoVersion" INTEGER NOT NULL DEFAULT 1,
    "webhookUrl" TEXT,
    "webhookEstado" TEXT NOT NULL DEFAULT 'SIN_VALIDAR',
    "webhookValidadoEn" TIMESTAMPTZ(3),
    "webhookDetalle" TEXT,
    "propietarioId" TEXT NOT NULL,
    "creadaEn" TIMESTAMPTZ(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "revocadaEn" TIMESTAMPTZ(3),
    "demo" BOOLEAN NOT NULL DEFAULT false,

    CONSTRAINT "AplicacionDev_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "AutorizacionEmpresa" (
    "id" UUID NOT NULL,
    "empresaId" UUID NOT NULL,
    "aplicacionId" UUID NOT NULL,
    "autorizadaPorId" TEXT NOT NULL,
    "creadaEn" TIMESTAMPTZ(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "revocadaEn" TIMESTAMPTZ(3),

    CONSTRAINT "AutorizacionEmpresa_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Outbox" (
    "id" UUID NOT NULL,
    "aplicacionId" UUID NOT NULL,
    "postulacionId" UUID,
    "tipo" TEXT NOT NULL DEFAULT 'EXPORT_JOB_APPLICATION',
    "url" TEXT NOT NULL,
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
    "manual" BOOLEAN NOT NULL DEFAULT false,

    CONSTRAINT "IntentoEntrega_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "User_email_key" ON "User"("email");

-- CreateIndex
CREATE UNIQUE INDEX "Session_token_key" ON "Session"("token");

-- CreateIndex
CREATE INDEX "Session_userId_idx" ON "Session"("userId");

-- CreateIndex
CREATE INDEX "Account_userId_idx" ON "Account"("userId");

-- CreateIndex
CREATE INDEX "Verification_identifier_idx" ON "Verification"("identifier");

-- CreateIndex
CREATE UNIQUE INDEX "Perfil_userId_key" ON "Perfil"("userId");

-- CreateIndex
CREATE UNIQUE INDEX "Perfil_slug_key" ON "Perfil"("slug");

-- CreateIndex
CREATE UNIQUE INDEX "Perfil_cvId_key" ON "Perfil"("cvId");

-- CreateIndex
CREATE UNIQUE INDEX "Empresa_slug_key" ON "Empresa"("slug");

-- CreateIndex
CREATE INDEX "Vacante_estado_publicadaEn_idx" ON "Vacante"("estado", "publicadaEn");

-- CreateIndex
CREATE INDEX "Vacante_empresaId_idx" ON "Vacante"("empresaId");

-- CreateIndex
CREATE UNIQUE INDEX "Vacante_aplicacionId_externalJobId_key" ON "Vacante"("aplicacionId", "externalJobId");

-- CreateIndex
CREATE UNIQUE INDEX "ArchivoCv_mediaUrn_key" ON "ArchivoCv"("mediaUrn");

-- CreateIndex
CREATE UNIQUE INDEX "Postulacion_jobApplicationId_key" ON "Postulacion"("jobApplicationId");

-- CreateIndex
CREATE UNIQUE INDEX "Postulacion_archivoCvId_key" ON "Postulacion"("archivoCvId");

-- CreateIndex
CREATE INDEX "Postulacion_candidatoId_idx" ON "Postulacion"("candidatoId");

-- CreateIndex
CREATE UNIQUE INDEX "Postulacion_vacanteId_candidatoId_key" ON "Postulacion"("vacanteId", "candidatoId");

-- CreateIndex
CREATE UNIQUE INDEX "AplicacionDev_clientId_key" ON "AplicacionDev"("clientId");

-- CreateIndex
CREATE UNIQUE INDEX "AutorizacionEmpresa_empresaId_aplicacionId_key" ON "AutorizacionEmpresa"("empresaId", "aplicacionId");

-- CreateIndex
CREATE INDEX "Outbox_estado_proximoIntentoEn_idx" ON "Outbox"("estado", "proximoIntentoEn");

-- CreateIndex
CREATE INDEX "Outbox_aplicacionId_creadoEn_idx" ON "Outbox"("aplicacionId", "creadoEn");

-- CreateIndex
CREATE INDEX "IntentoEntrega_outboxId_idx" ON "IntentoEntrega"("outboxId");

-- AddForeignKey
ALTER TABLE "User" ADD CONSTRAINT "User_empresaId_fkey" FOREIGN KEY ("empresaId") REFERENCES "Empresa"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Session" ADD CONSTRAINT "Session_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Account" ADD CONSTRAINT "Account_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Perfil" ADD CONSTRAINT "Perfil_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Perfil" ADD CONSTRAINT "Perfil_cvId_fkey" FOREIGN KEY ("cvId") REFERENCES "ArchivoCv"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Experiencia" ADD CONSTRAINT "Experiencia_perfilId_fkey" FOREIGN KEY ("perfilId") REFERENCES "Perfil"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Educacion" ADD CONSTRAINT "Educacion_perfilId_fkey" FOREIGN KEY ("perfilId") REFERENCES "Perfil"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Vacante" ADD CONSTRAINT "Vacante_empresaId_fkey" FOREIGN KEY ("empresaId") REFERENCES "Empresa"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Vacante" ADD CONSTRAINT "Vacante_aplicacionId_fkey" FOREIGN KEY ("aplicacionId") REFERENCES "AplicacionDev"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Postulacion" ADD CONSTRAINT "Postulacion_vacanteId_fkey" FOREIGN KEY ("vacanteId") REFERENCES "Vacante"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Postulacion" ADD CONSTRAINT "Postulacion_candidatoId_fkey" FOREIGN KEY ("candidatoId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Postulacion" ADD CONSTRAINT "Postulacion_archivoCvId_fkey" FOREIGN KEY ("archivoCvId") REFERENCES "ArchivoCv"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "AplicacionDev" ADD CONSTRAINT "AplicacionDev_propietarioId_fkey" FOREIGN KEY ("propietarioId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "AutorizacionEmpresa" ADD CONSTRAINT "AutorizacionEmpresa_empresaId_fkey" FOREIGN KEY ("empresaId") REFERENCES "Empresa"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "AutorizacionEmpresa" ADD CONSTRAINT "AutorizacionEmpresa_aplicacionId_fkey" FOREIGN KEY ("aplicacionId") REFERENCES "AplicacionDev"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "AutorizacionEmpresa" ADD CONSTRAINT "AutorizacionEmpresa_autorizadaPorId_fkey" FOREIGN KEY ("autorizadaPorId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Outbox" ADD CONSTRAINT "Outbox_aplicacionId_fkey" FOREIGN KEY ("aplicacionId") REFERENCES "AplicacionDev"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Outbox" ADD CONSTRAINT "Outbox_postulacionId_fkey" FOREIGN KEY ("postulacionId") REFERENCES "Postulacion"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "IntentoEntrega" ADD CONSTRAINT "IntentoEntrega_outboxId_fkey" FOREIGN KEY ("outboxId") REFERENCES "Outbox"("id") ON DELETE CASCADE ON UPDATE CASCADE;

