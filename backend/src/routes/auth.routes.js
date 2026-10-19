import express from 'express';
import bcrypt from 'bcrypt';
import jwt from 'jsonwebtoken';
import { validateData, userSchemas } from '../utils/validations.js';
import { authenticateToken } from '../middleware/auth.middleware.js';

const router = express.Router();

// POST /api/auth/login - Iniciar sesión
router.post('/login', async (req, res, next) => {
  try {
    const { nombre, password } = validateData(userSchemas.login, req.body);
    
    // Buscar usuario
    const usuario = await req.prisma.usuario.findFirst({
      where: {
        nombre: nombre,
        activo: true
      }
    });
    
    if (!usuario) {
      return res.status(401).json({
        error: 'Credenciales inválidas'
      });
    }
    
    // Verificar contraseña
    const passwordValido = await bcrypt.compare(password, usuario.password);
    
    if (!passwordValido) {
      return res.status(401).json({
        error: 'Credenciales inválidas'
      });
    }
    
    // Generar JWT
    const token = jwt.sign(
      {
        id: usuario.id,
        nombre: usuario.nombre,
        rol: usuario.rol
      },
      process.env.JWT_SECRET,
      {
        expiresIn: process.env.JWT_EXPIRES_IN
      }
    );
    
    // Respuesta exitosa
    res.json({
      message: 'Inicio de sesión exitoso',
      token,
      usuario: {
        id: usuario.id,
        nombre: usuario.nombre,
        rol: usuario.rol
      }
    });
    
  } catch (error) {
    next(error);
  }
});

// POST /api/auth/logout - Cerrar sesión
router.post('/logout', authenticateToken, (req, res) => {
  // En JWT no necesitamos hacer nada en el servidor para logout
  // El cliente debe eliminar el token
  res.json({
    message: 'Sesión cerrada exitosamente'
  });
});

// GET /api/auth/verify - Verificar token
router.get('/verify', authenticateToken, async (req, res, next) => {
  try {
    // El token ya fue verificado por el middleware
    // Obtener datos actualizados del usuario
    const usuario = await req.prisma.usuario.findUnique({
      where: {
        id: req.user.id,
        activo: true
      },
      select: {
        id: true,
        nombre: true,
        rol: true,
        createdAt: true
      }
    });
    
    if (!usuario) {
      return res.status(401).json({
        error: 'Usuario no encontrado o inactivo'
      });
    }
    
    res.json({
      valid: true,
      usuario
    });
    
  } catch (error) {
    next(error);
  }
});

// GET /api/auth/me - Obtener perfil del usuario actual
router.get('/me', authenticateToken, async (req, res, next) => {
  try {
    const usuario = await req.prisma.usuario.findUnique({
      where: {
        id: req.user.id
      },
      select: {
        id: true,
        nombre: true,
        rol: true,
        activo: true,
        createdAt: true,
        updatedAt: true
      }
    });
    
    if (!usuario) {
      return res.status(404).json({
        error: 'Usuario no encontrado'
      });
    }
    
    res.json(usuario);
    
  } catch (error) {
    next(error);
  }
});

export default router;