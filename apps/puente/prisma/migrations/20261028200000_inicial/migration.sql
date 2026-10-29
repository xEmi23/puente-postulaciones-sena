-- CreateSchema
CREATE SCHEMA IF NOT EXISTS "puente";

-- CreateEnum
CREATE TYPE "EstadoRecepcion" AS ENUM ('RECIBIDO', 'PROCESANDO', 'COMPLETADO', 'RECHAZADO', 'FALLIDO_REINTENTABLE', 'REQUIERE_VERIFICACION');

-- CreateEnum
CREATE TYPE "PasoRecepcion" AS ENUM ('cv_descargado', 'postulante_listo', 'documento_subido', 'postulacion_creada');

-- CreateEnum
CREATE TYPE "EstadoTrabajo" AS ENUM ('PENDIENTE', 'EN_CURSO', 'HECHO', 'DETENIDO');

-- CreateTable
CREATE TABLE "User" (
    "id" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "email" TEXT NOT NULL,
    "emailVerified" BOOLEAN NOT NULL DEFAULT false,
    "image" TEXT,
    "rol" TEXT NOT NULL DEFAULT 'OPERADOR',
    "createdAt" TIMESTAMPTZ(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMPTZ(3) NOT NULL,
    "demo" BOOLEAN NOT NULL DEFAULT true,

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
CREATE TABLE "Conexion" (
    "tipo" TEXT NOT NULL,
    "urlBase" TEXT NOT NULL,
    "clientId" TEXT,
    "secretoCifrado" TEXT NOT NULL,
    "secretoFinal" TEXT NOT NULL,
    "empresaId" TEXT,
    "empresaNombre" TEXT,
    "estadoPrueba" TEXT NOT NULL DEFAULT 'SIN_PROBAR',
    "detallePrueba" TEXT,
    "probadaEn" TIMESTAMPTZ(3),
    "permisoLectura" BOOLEAN,
    "permisoEscritura" BOOLEAN,
    "webhookValidadoEn" TIMESTAMPTZ(3),
    "ultimoContactoEn" TIMESTAMPTZ(3),
    "actualizadaEn" TIMESTAMPTZ(3) NOT NULL,

    CONSTRAINT "Conexion_pkey" PRIMARY KEY ("tipo")
);

-- CreateTable
CREATE TABLE "Publicacion" (
    "procesoId" INTEGER NOT NULL,
    "externalJobId" TEXT NOT NULL,
    "titulo" TEXT NOT NULL,
    "vacanteId" TEXT,
    "url" TEXT,
    "estado" TEXT NOT NULL DEFAULT 'PUBLICADA',
    "solicitudSencilla" BOOLEAN NOT NULL DEFAULT false,
    "motivo" TEXT,
    "automatica" BOOLEAN NOT NULL DEFAULT false,
    "publicadaEn" TIMESTAMPTZ(3),
    "cerradaEn" TIMESTAMPTZ(3),
    "actualizadaEn" TIMESTAMPTZ(3) NOT NULL,
    "demo" BOOLEAN NOT NULL DEFAULT true,

    CONSTRAINT "Publicacion_pkey" PRIMARY KEY ("procesoId")
);

-- CreateTable
CREATE TABLE "Configuracion" (
    "id" INTEGER NOT NULL DEFAULT 1,
    "publicacionAutomatica" BOOLEAN NOT NULL DEFAULT false,
    "ultimoSondeoEn" TIMESTAMPTZ(3),
    "resultadoSondeo" TEXT,

    CONSTRAINT "Configuracion_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Correspondencia" (
    "id" UUID NOT NULL,
    "externalJobId" TEXT NOT NULL,
    "procesoAtsId" INTEGER NOT NULL,
    "descripcion" TEXT NOT NULL,
    "activa" BOOLEAN NOT NULL DEFAULT true,
    "cerradaEn" TIMESTAMPTZ(3),
    "creadaEn" TIMESTAMPTZ(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "actualizadaEn" TIMESTAMPTZ(3) NOT NULL,
    "demo" BOOLEAN NOT NULL DEFAULT true,

    CONSTRAINT "Correspondencia_pkey" PRIMARY KEY ("id")
);

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
    "atsPostulanteId" TEXT,
    "atsDocumentoId" TEXT,
    "atsPostulacionId" TEXT,
    "errorCodigo" TEXT,
    "errorDetalle" TEXT,
    "duplicadosEvitados" INTEGER NOT NULL DEFAULT 0,
    "recibidaEn" TIMESTAMPTZ(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "completadaEn" TIMESTAMPTZ(3),
    "avisoEstado" TEXT NOT NULL DEFAULT 'NO_APLICA',
    "avisoIntentos" INTEGER NOT NULL DEFAULT 0,
    "avisoProximoEn" TIMESTAMPTZ(3),
    "avisoError" TEXT,
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
CREATE TABLE "FalloSimulado" (
    "ruta" TEXT NOT NULL,
    "modo" TEXT NOT NULL,
    "restantes" INTEGER NOT NULL DEFAULT 1,
    "creadoEn" TIMESTAMPTZ(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "FalloSimulado_pkey" PRIMARY KEY ("ruta")
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
CREATE UNIQUE INDEX "Publicacion_externalJobId_key" ON "Publicacion"("externalJobId");

-- CreateIndex
CREATE UNIQUE INDEX "Correspondencia_externalJobId_key" ON "Correspondencia"("externalJobId");

-- CreateIndex
CREATE UNIQUE INDEX "Recepcion_jobApplicationId_key" ON "Recepcion"("jobApplicationId");

-- CreateIndex
CREATE INDEX "Recepcion_estado_idx" ON "Recepcion"("estado");

-- CreateIndex
CREATE INDEX "Recepcion_recibidaEn_idx" ON "Recepcion"("recibidaEn");

-- CreateIndex
CREATE INDEX "Recepcion_avisoEstado_avisoProximoEn_idx" ON "Recepcion"("avisoEstado", "avisoProximoEn");

-- CreateIndex
CREATE UNIQUE INDEX "Trabajo_recepcionId_key" ON "Trabajo"("recepcionId");

-- CreateIndex
CREATE INDEX "Trabajo_estado_proximoIntentoEn_idx" ON "Trabajo"("estado", "proximoIntentoEn");

-- CreateIndex
CREATE INDEX "EventoRecepcion_recepcionId_creadoEn_idx" ON "EventoRecepcion"("recepcionId", "creadoEn");

-- CreateIndex
CREATE INDEX "EntregaRechazada_recibidaEn_idx" ON "EntregaRechazada"("recibidaEn");

-- AddForeignKey
ALTER TABLE "Session" ADD CONSTRAINT "Session_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Account" ADD CONSTRAINT "Account_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Trabajo" ADD CONSTRAINT "Trabajo_recepcionId_fkey" FOREIGN KEY ("recepcionId") REFERENCES "Recepcion"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "EventoRecepcion" ADD CONSTRAINT "EventoRecepcion_recepcionId_fkey" FOREIGN KEY ("recepcionId") REFERENCES "Recepcion"("id") ON DELETE CASCADE ON UPDATE CASCADE;

