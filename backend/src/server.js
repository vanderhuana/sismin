import express from 'express';
import cors from 'cors';
import dotenv from 'dotenv';
import { PrismaClient } from '@prisma/client';

// Importar rutas
import authRoutes from './routes/auth.routes.js';
import userRoutes from './routes/users.routes.js';
import providerRoutes from './routes/providers.routes.js';
import internacionRoutes from './routes/internaciones.routes.js';
import calculoRoutes from './routes/calculos.routes.js';
import anticiposRoutes from './routes/anticipos.routes.js';
import ventasRoutes from './routes/ventas.routes.js';

// Configurar variables de entorno
dotenv.config();

// Inicializar Express
const app = express();
const PORT = process.env.PORT || 3000;

// Inicializar Prisma
const prisma = new PrismaClient();

// Middleware CORS - permite localhost en cualquier puerto (dev)
const corsOptions = {
  origin: (origin, callback) => {
    // Permitir solicitudes sin origin (como Postman, mobile o proxy interno)
    if (!origin) return callback(null, true);

    const allowedOrigin = process.env.CORS_ORIGIN;
    if (!allowedOrigin || allowedOrigin === '*' || /^http:\/\/localhost:\d+$/.test(origin)) {
      return callback(null, true);
    }

    const originsList = allowedOrigin.split(',').map(o => o.trim());
    if (originsList.includes(origin)) {
      return callback(null, true);
    }

    // Permitir por defecto si viene del mismo host en producción
    callback(null, true);
  },
  credentials: true
};

app.use(cors(corsOptions));

app.use(express.json());
app.use(express.urlencoded({ extended: true }));

// Middleware para Prisma - disponible en todas las rutas
app.use((req, res, next) => {
  req.prisma = prisma;
  next();
});

// Rutas de la API
app.use('/api/auth', authRoutes);
app.use('/api/users', userRoutes);
app.use('/api/providers', providerRoutes);
app.use('/api/internaciones', internacionRoutes);
app.use('/api/calculos', calculoRoutes);
app.use('/api/anticipos', anticiposRoutes);
app.use('/api/ventas', ventasRoutes);

// Ruta de salud
app.get('/api/health', (req, res) => {
  res.json({ 
    message: 'Sistema de Gestión Minera API - Funcionando',
    timestamp: new Date().toISOString(),
    version: '1.0.0'
  });
});

// Middleware de manejo de errores
app.use((err, req, res, next) => {
  console.error('Error:', err);
  
  // Error de validación de Joi
  if (err.isJoi) {
    return res.status(400).json({
      error: 'Datos de entrada inválidos',
      details: err.details.map(detail => ({
        field: detail.path.join('.'),
        message: detail.message
      }))
    });
  }
  
  // Error de Prisma
  if (err.code === 'P2002') {
    const targetField = err.meta?.target?.[0] || 'unknown';
    let msg = 'Ya existe un registro con estos datos duplicados';
    if (targetField === 'ci') {
      msg = 'Ya existe un proveedor registrado con esta Cédula de Identidad (CI / NIT)';
    } else if (targetField === 'nombre') {
      msg = 'Ya existe un usuario con este nombre de usuario';
    } else if (targetField === 'lote') {
      msg = 'El número de lote ya se encuentra registrado';
    }
    return res.status(409).json({
      error: msg,
      field: targetField
    });
  }
  
  if (err.code === 'P2025') {
    return res.status(404).json({
      error: 'Registro no encontrado'
    });
  }
  
  // Error genérico
  res.status(500).json({
    error: 'Error interno del servidor',
    message: process.env.NODE_ENV === 'development' ? err.message : 'Algo salió mal'
  });
});

// Ruta 404
app.use('*', (req, res) => {
  res.status(404).json({
    error: 'Ruta no encontrada',
    path: req.originalUrl
  });
});

// Iniciar servidor
app.listen(PORT, () => {
  console.log(`🚀 Servidor ejecutándose en http://localhost:${PORT}`);
  console.log(`📊 Base de datos: ${process.env.NODE_ENV === 'development' ? 'Desarrollo' : 'Producción'}`);
});

// Manejo de cierre graceful
process.on('SIGINT', async () => {
  console.log('\n🛑 Cerrando servidor...');
  await prisma.$disconnect();
  process.exit(0);
});

process.on('SIGTERM', async () => {
  console.log('\n🛑 Cerrando servidor...');
  await prisma.$disconnect();
  process.exit(0);
});

export default app;