# 🏗️ Sistema de Gestión Minera

Sistema web completo para gestión de compra de minerales (plata, plomo, complejo) con cálculos automáticos de pago, desarrollado con tecnologías modernas.

## 🚀 Stack Tecnológico

- **Frontend:** React 18 + Vite + Tailwind CSS + Zustand
- **Backend:** Node.js + Express + JWT + Prisma ORM
- **Base de Datos:** PostgreSQL
- **UI/UX:** Tailwind CSS + Lucide Icons

## 📁 Estructura del Proyecto

```
sistemamin/
├── frontend/                 # Aplicación React
│   ├── src/
│   │   ├── components/       # Componentes reutilizables
│   │   │   ├── ui/          # Componentes de UI
│   │   │   └── layout/      # Layout y navegación
│   │   ├── pages/           # Páginas de la aplicación
│   │   ├── services/        # Servicios API
│   │   ├── hooks/           # Hooks personalizados
│   │   └── utils/           # Utilidades
│   ├── package.json
│   └── vite.config.js
├── backend/                  # API Express
│   ├── src/
│   │   ├── routes/          # Rutas de la API
│   │   ├── controllers/     # Lógica de negocio
│   │   ├── middleware/      # Middleware de autenticación
│   │   ├── utils/           # Utilidades y validaciones
│   │   └── prisma/          # Schema de base de datos
│   ├── package.json
│   └── .env
└── README.md
```

## 📋 Requisitos del Sistema

- **Node.js:** 18 o superior
- **PostgreSQL:** 15 o superior  
- **npm:** Versión más reciente

## ⚡ Instalación Rápida

### 1. Configurar Base de Datos
```bash
# Instalar PostgreSQL (si no está instalado)
# Crear base de datos
createdb sistemamin
```

### 2. Configurar Backend
```bash
cd backend

# Instalar dependencias
npm install

# Configurar variables de entorno
cp .env.example .env
# Editar .env con tu configuración de PostgreSQL

# Ejecutar migraciones y crear tablas
npx prisma migrate dev --name init

# Generar cliente de Prisma  
npx prisma generate

# Sembrar datos iniciales (usuarios de prueba)
npm run db:seed

# Iniciar servidor de desarrollo
npm run dev
```

### 3. Configurar Frontend
```bash
# En otra terminal
cd frontend

# Instalar dependencias
npm install

# Iniciar aplicación
npm run dev
```

## 🔐 Credenciales de Prueba

Una vez ejecutado el seed, puedes usar:

- **Administrador:** 
  - Usuario: `admin`
  - Contraseña: `admin123`

- **Operador:** 
  - Usuario: `operador`  
  - Contraseña: `moderado123`

## 🎯 Funcionalidades Implementadas

### ✅ Completadas
- [x] **Autenticación completa** con JWT
- [x] **Sistema de roles** (Admin/Moderado)
- [x] **Dashboard** con estadísticas
- [x] **Layout responsivo** con sidebar
- [x] **API REST completa** para todos los módulos
- [x] **Validaciones** backend y frontend
- [x] **Base de datos** con relaciones complejas

### 🚧 En Desarrollo (Próximas funcionalidades)
- [ ] **Gestión de Usuarios** - CRUD completo
- [ ] **Gestión de Proveedores** - CRUD completo  
- [ ] **Internar Mineral** - Registro de entrada (pesado)
- [ ] **Calcular Pago** - Procesamiento de cálculos
- [ ] **Comprobantes PDF** - Generación y descarga
- [ ] **Reportes** - Estadísticas detalladas

## 🧮 Fórmulas de Cálculo

### Para PLATA y PLOMO (Mineral Simple)
```
1. Kilos Neto = trunc(Kilos Bruto - (Kilos Bruto × Humedad% / 100)) (sin redondeo, ej: 150 kg al 3% = 145 kg)
2. Valor Bruto = Kilos Neto × Valor Escala  
3. Regalías = trunc(Valor Bruto × (Regalías % / 100))
4. Saldo Final = Valor Bruto - Regalías - Anticipos + Transporte
```

### Para COMPLEJO (Plata + Plomo)
```
1. Kilos Neto = trunc(Kilos Bruto - (Kilos Bruto × Humedad% / 100)) (sin redondeo, ej: 150 kg al 3% = 145 kg)
2. Valor Escala Total = Valor Escala Plata + Valor Escala Plomo
3. Valor Bruto = Kilos Neto × Valor Escala Total
4. Regalías = trunc(Valor Bruto × (Regalías % / 100))  
5. Saldo Final = Valor Bruto - Regalías - Anticipos + Transporte
```

## 🔧 Scripts Disponibles

### Backend
```bash
npm run dev        # Servidor de desarrollo
npm run start      # Servidor de producción
npm run db:migrate # Ejecutar migraciones
npm run db:seed    # Sembrar datos iniciales
npm run db:generate # Generar cliente Prisma
```

### Frontend  
```bash
npm run dev        # Servidor de desarrollo
npm run build      # Build de producción
npm run preview    # Vista previa del build
```

## 🌐 URLs del Sistema

- **Frontend:** http://localhost:5173
- **Backend API:** http://localhost:3000
- **API Health:** http://localhost:3000/api/health

## 🗃️ Base de Datos

### Tablas Principales
- `usuarios` - Gestión de usuarios y roles
- `proveedores` - Información de proveedores
- `internaciones` - Registro de entrada de mineral
- `calculos` - Cálculos de pago con fórmulas

### Relaciones
- Usuario → Internaciones (quien registró)
- Proveedor → Internaciones (de quién es el mineral)
- Internación → Cálculo (1:1, opcional)

## 🔒 Seguridad

- **Autenticación:** JWT con expiración de 8 horas
- **Autorización:** Middleware de roles y permisos
- **Validación:** Joi en backend, React Hook Form en frontend
- **Passwords:** Hasheados con bcrypt (10 rounds)
- **CORS:** Configurado para desarrollo y producción

## 🚀 Próximas Mejoras

1. **Módulos faltantes** - Completar todas las funcionalidades
2. **Tests automatizados** - Jest + React Testing Library
3. **Docker** - Containerización completa
4. **CI/CD** - Pipeline de despliegue
5. **Logs de auditoría** - Seguimiento de acciones
6. **Backup automático** - Respaldo de datos
7. **Reportes avanzados** - Gráficos y estadísticas

## 📞 Soporte

Para soporte técnico o preguntas sobre el sistema, contactar al equipo de desarrollo.

---

**Sistema de Gestión Minera v1.0** - Todos los derechos reservados.
