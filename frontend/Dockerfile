# Etapa 1: Construcción del bundle estático con Node.js
FROM node:20-alpine AS builder

WORKDIR /app

COPY package*.json ./
RUN npm install

COPY . .

# En producción, las peticiones van a /api que Nginx reenvía al backend
ENV VITE_API_URL=/api
RUN npm run build

# Etapa 2: Servidor web de producción con Nginx Alpine
FROM nginx:alpine

# Copiar artefactos compilados
COPY --from=builder /app/dist /usr/share/nginx/html

# Copiar configuración de Nginx
COPY nginx.conf /etc/nginx/conf.d/default.conf

EXPOSE 80

CMD ["nginx", "-g", "daemon off;"]
