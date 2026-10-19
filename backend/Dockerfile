FROM node:20-alpine

WORKDIR /app

# Instalar dependencias del sistema para compilación de bcrypt y motor de Prisma
RUN apk add --no-cache openssl python3 make g++

# Copiar definiciones de paquetes e instalar dependencias de producción
COPY package*.json ./
RUN npm install --omit=dev

# Copiar Prisma y generar el cliente
COPY prisma ./prisma/
RUN npx prisma generate

# Copiar el código fuente completo del backend
COPY . .

# Exponer puerto 3000
EXPOSE 3000

ENV NODE_ENV=production

# Al arrancar: sincroniza el esquema completo con la base de datos, ejecuta seed inicial y arranca servidor
CMD ["sh", "-c", "npx prisma db push && node src/utils/seed.js && node src/server.js"]
