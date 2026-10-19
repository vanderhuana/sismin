/*
  Warnings:

  - A unique constraint covering the columns `[nombre]` on the table `usuarios` will be added. If there are existing duplicate values, this will fail.

*/
-- AlterTable
ALTER TABLE "proveedores" ALTER COLUMN "ci" DROP NOT NULL;

-- CreateIndex
CREATE UNIQUE INDEX "usuarios_nombre_key" ON "usuarios"("nombre");
