-- CreateEnum
CREATE TYPE "RolUsuario" AS ENUM ('ADMIN', 'MODERADO');

-- CreateEnum
CREATE TYPE "TipoProveedor" AS ENUM ('EMPRESA', 'PERSONA_NATURAL');

-- CreateEnum
CREATE TYPE "TipoMineral" AS ENUM ('PLATA', 'PLOMO', 'COMPLEJO');

-- CreateEnum
CREATE TYPE "EstadoInternacion" AS ENUM ('EN_ESPERA_LEY', 'CALCULADO', 'PAGADO');

-- CreateEnum
CREATE TYPE "EstadoPago" AS ENUM ('PENDIENTE', 'PAGADO');

-- CreateTable
CREATE TABLE "usuarios" (
    "id" SERIAL NOT NULL,
    "nombre" VARCHAR(100) NOT NULL,
    "password" VARCHAR(255) NOT NULL,
    "rol" "RolUsuario" NOT NULL DEFAULT 'MODERADO',
    "activo" BOOLEAN NOT NULL DEFAULT true,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "usuarios_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "proveedores" (
    "id" SERIAL NOT NULL,
    "nombreCompleto" VARCHAR(200) NOT NULL,
    "ci" VARCHAR(20) NOT NULL,
    "telefono" VARCHAR(20),
    "direccion" TEXT,
    "tipo" "TipoProveedor" NOT NULL DEFAULT 'PERSONA_NATURAL',
    "activo" BOOLEAN NOT NULL DEFAULT true,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "proveedores_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "internaciones" (
    "id" SERIAL NOT NULL,
    "lote" TEXT NOT NULL,
    "fechaInternacion" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "tipoMineral" "TipoMineral" NOT NULL,
    "kilosBruto" DECIMAL(10,3) NOT NULL,
    "estado" "EstadoInternacion" NOT NULL DEFAULT 'EN_ESPERA_LEY',
    "anticipo" DECIMAL(10,2) NOT NULL DEFAULT 0,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,
    "proveedorId" INTEGER NOT NULL,
    "usuarioId" INTEGER NOT NULL,

    CONSTRAINT "internaciones_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "calculos" (
    "id" SERIAL NOT NULL,
    "fechaCalculo" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "tipoMineral" "TipoMineral" NOT NULL,
    "ley" DECIMAL(10,3),
    "valorEscala" DECIMAL(10,2),
    "leyPlata" DECIMAL(10,3),
    "valorEscalaPlata" DECIMAL(10,2),
    "leyPlomo" DECIMAL(10,3),
    "valorEscalaPlomo" DECIMAL(10,2),
    "valorEscalaTotal" DECIMAL(10,2),
    "humedadPorcentaje" DECIMAL(5,2) NOT NULL,
    "kilosNeto" DECIMAL(10,3) NOT NULL,
    "valorBruto" DECIMAL(12,2) NOT NULL,
    "regaliasPorcentaje" DECIMAL(5,2) NOT NULL DEFAULT 10,
    "regaliasMonto" DECIMAL(12,2) NOT NULL,
    "anticipos" DECIMAL(10,2) NOT NULL DEFAULT 0,
    "transporte" DECIMAL(10,2) NOT NULL DEFAULT 0,
    "saldoFinal" DECIMAL(12,2) NOT NULL,
    "estadoPago" "EstadoPago" NOT NULL DEFAULT 'PENDIENTE',
    "fechaPago" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,
    "internacionId" INTEGER NOT NULL,

    CONSTRAINT "calculos_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "proveedores_ci_key" ON "proveedores"("ci");

-- CreateIndex
CREATE UNIQUE INDEX "internaciones_lote_key" ON "internaciones"("lote");

-- CreateIndex
CREATE UNIQUE INDEX "calculos_internacionId_key" ON "calculos"("internacionId");

-- AddForeignKey
ALTER TABLE "internaciones" ADD CONSTRAINT "internaciones_proveedorId_fkey" FOREIGN KEY ("proveedorId") REFERENCES "proveedores"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "internaciones" ADD CONSTRAINT "internaciones_usuarioId_fkey" FOREIGN KEY ("usuarioId") REFERENCES "usuarios"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "calculos" ADD CONSTRAINT "calculos_internacionId_fkey" FOREIGN KEY ("internacionId") REFERENCES "internaciones"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
