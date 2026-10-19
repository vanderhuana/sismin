-- CreateEnum
CREATE TYPE "EstadoAnticipo" AS ENUM ('PENDIENTE', 'PARCIAL', 'COBRADO', 'ANULADO');

-- AlterTable calculos
ALTER TABLE "calculos" ADD COLUMN IF NOT EXISTS "anticipoBascula" DECIMAL(10,2) NOT NULL DEFAULT 0;
ALTER TABLE "calculos" ADD COLUMN IF NOT EXISTS "anticipoProveedor" DECIMAL(10,2) NOT NULL DEFAULT 0;

-- CreateTable anticipos
CREATE TABLE IF NOT EXISTS "anticipos" (
    "id" SERIAL NOT NULL,
    "codigoVale" VARCHAR(50),
    "monto" DECIMAL(10,2) NOT NULL,
    "saldoPendiente" DECIMAL(10,2) NOT NULL DEFAULT 0,
    "estado" "EstadoAnticipo" NOT NULL DEFAULT 'PENDIENTE',
    "fecha" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "observacion" TEXT,
    "glosa" VARCHAR(255),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,
    "internacionId" INTEGER,
    "proveedorId" INTEGER,
    "usuarioId" INTEGER,

    CONSTRAINT "anticipos_pkey" PRIMARY KEY ("id")
);

-- CreateTable anticipos_descuentos
CREATE TABLE IF NOT EXISTS "anticipos_descuentos" (
    "id" SERIAL NOT NULL,
    "anticipoId" INTEGER NOT NULL,
    "calculoId" INTEGER NOT NULL,
    "montoDescontado" DECIMAL(10,2) NOT NULL,
    "fecha" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "anticipos_descuentos_pkey" PRIMARY KEY ("id")
);

-- CreateTable ventas_lote_general
CREATE TABLE IF NOT EXISTS "ventas_lote_general" (
    "id" SERIAL NOT NULL,
    "numeroLoteGeneral" TEXT NOT NULL,
    "fecha" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "fechaInicioFiltro" TIMESTAMP(3),
    "fechaFinFiltro" TIMESTAMP(3),
    "tipoMineral" "TipoMineral" NOT NULL,
    "leyReferenciaAg" DECIMAL(10,3),
    "leyReferenciaPb" DECIMAL(10,3),
    "totalPesoNeto" DECIMAL(12,3) NOT NULL,
    "totalPromedioAg" DECIMAL(14,3),
    "totalPromedioPb" DECIMAL(14,3),
    "leyPonderadaAg" DECIMAL(10,4),
    "leyPonderadaPb" DECIMAL(10,4),
    "costoTotalCompra" DECIMAL(14,2),
    "observaciones" TEXT,
    "estado" TEXT NOT NULL DEFAULT 'CERRADO',
    "usuarioId" INTEGER,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "ventas_lote_general_pkey" PRIMARY KEY ("id")
);

-- CreateTable ventas_lote_detalles
CREATE TABLE IF NOT EXISTS "ventas_lote_detalles" (
    "id" SERIAL NOT NULL,
    "ventaId" INTEGER NOT NULL,
    "internacionId" INTEGER,
    "numeroLote" TEXT NOT NULL,
    "pesoNeto" DECIMAL(12,3) NOT NULL,
    "leyAg" DECIMAL(10,3),
    "promedioAg" DECIMAL(14,3),
    "leyPb" DECIMAL(10,3),
    "promedioPb" DECIMAL(14,3),
    "costoCompra" DECIMAL(12,2),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "ventas_lote_detalles_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX IF NOT EXISTS "anticipos_codigoVale_key" ON "anticipos"("codigoVale");
CREATE UNIQUE INDEX IF NOT EXISTS "ventas_lote_general_numeroLoteGeneral_key" ON "ventas_lote_general"("numeroLoteGeneral");

-- AddForeignKey
ALTER TABLE "anticipos" ADD CONSTRAINT "anticipos_internacionId_fkey" FOREIGN KEY ("internacionId") REFERENCES "internaciones"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "anticipos" ADD CONSTRAINT "anticipos_proveedorId_fkey" FOREIGN KEY ("proveedorId") REFERENCES "proveedores"("id") ON DELETE SET NULL ON UPDATE CASCADE;
ALTER TABLE "anticipos" ADD CONSTRAINT "anticipos_usuarioId_fkey" FOREIGN KEY ("usuarioId") REFERENCES "usuarios"("id") ON DELETE SET NULL ON UPDATE CASCADE;

ALTER TABLE "anticipos_descuentos" ADD CONSTRAINT "anticipos_descuentos_anticipoId_fkey" FOREIGN KEY ("anticipoId") REFERENCES "anticipos"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "anticipos_descuentos" ADD CONSTRAINT "anticipos_descuentos_calculoId_fkey" FOREIGN KEY ("calculoId") REFERENCES "calculos"("id") ON DELETE CASCADE ON UPDATE CASCADE;

ALTER TABLE "ventas_lote_general" ADD CONSTRAINT "ventas_lote_general_usuarioId_fkey" FOREIGN KEY ("usuarioId") REFERENCES "usuarios"("id") ON DELETE SET NULL ON UPDATE CASCADE;

ALTER TABLE "ventas_lote_detalles" ADD CONSTRAINT "ventas_lote_detalles_ventaId_fkey" FOREIGN KEY ("ventaId") REFERENCES "ventas_lote_general"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "ventas_lote_detalles" ADD CONSTRAINT "ventas_lote_detalles_internacionId_fkey" FOREIGN KEY ("internacionId") REFERENCES "internaciones"("id") ON DELETE SET NULL ON UPDATE CASCADE;
