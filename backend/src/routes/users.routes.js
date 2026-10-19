import express from 'express';
import bcrypt from 'bcrypt';
import { validateData, userSchemas } from '../utils/validations.js';
import { authenticateToken, requireAdmin } from '../middleware/auth.middleware.js';

const router = express.Router();

// Middleware: todas las rutas requieren autenticación
router.use(authenticateToken);

// GET /api/users - Listar usuarios (Solo Admin)
router.get('/', requireAdmin, async (req, res, next) => {
  try {
    const { page = 1, limit = 10, search = '' } = req.query;
    
    const skip = (parseInt(page) - 1) * parseInt(limit);
    
    const whereCondition = search ? {
      nombre: {
        contains: search,
        mode: 'insensitive'
      }
    } : {};
    
    const [usuarios, total] = await Promise.all([
      req.prisma.usuario.findMany({
        where: whereCondition,
        select: {
          id: true,
          nombre: true,
          rol: true,
          activo: true,
          createdAt: true,
          updatedAt: true
        },
        skip,
        take: parseInt(limit),
        orderBy: {
          createdAt: 'desc'
        }
      }),
      req.prisma.usuario.count({
        where: whereCondition
      })
    ]);
    
    res.json({
      usuarios,
      pagination: {
        page: parseInt(page),
        limit: parseInt(limit),
        total,
        pages: Math.ceil(total / parseInt(limit))
      }
    });
    
  } catch (error) {
    next(error);
  }
});

// GET /api/users/:id - Obtener usuario específico (Solo Admin)
router.get('/:id', requireAdmin, async (req, res, next) => {
  try {
    const { id } = req.params;
    
    const usuario = await req.prisma.usuario.findUnique({
      where: {
        id: parseInt(id)
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

// POST /api/users - Crear usuario (Solo Admin)
router.post('/', requireAdmin, async (req, res, next) => {
  try {
    const userData = validateData(userSchemas.create, req.body);
    
    // Hash de la contraseña
    const hashedPassword = await bcrypt.hash(userData.password, 10);
    
    const nuevoUsuario = await req.prisma.usuario.create({
      data: {
        ...userData,
        password: hashedPassword
      },
      select: {
        id: true,
        nombre: true,
        rol: true,
        activo: true,
        createdAt: true
      }
    });
    
    res.status(201).json({
      message: 'Usuario creado exitosamente',
      usuario: nuevoUsuario
    });
    
  } catch (error) {
    next(error);
  }
});

// PUT /api/users/:id - Actualizar usuario (Solo Admin)
router.put('/:id', requireAdmin, async (req, res, next) => {
  try {
    const { id } = req.params;
    const updateData = validateData(userSchemas.update, req.body);
    
    // Si se está actualizando la contraseña, hashearla
    if (updateData.password) {
      updateData.password = await bcrypt.hash(updateData.password, 10);
    }
    
    const usuarioActualizado = await req.prisma.usuario.update({
      where: {
        id: parseInt(id)
      },
      data: updateData,
      select: {
        id: true,
        nombre: true,
        rol: true,
        activo: true,
        createdAt: true,
        updatedAt: true
      }
    });
    
    res.json({
      message: 'Usuario actualizado exitosamente',
      usuario: usuarioActualizado
    });
    
  } catch (error) {
    next(error);
  }
});

// DELETE /api/users/:id - Eliminar usuario (Solo Admin)
router.delete('/:id', requireAdmin, async (req, res, next) => {
  try {
    const { id } = req.params;
    const userId = parseInt(id);
    
    // No permitir que el admin se elimine a sí mismo
    if (userId === req.user.id) {
      return res.status(400).json({
        error: 'No puedes eliminar tu propia cuenta'
      });
    }
    
    // Verificar si el usuario tiene internaciones asociadas
    const internacionesCount = await req.prisma.internacion.count({
      where: {
        usuarioId: userId
      }
    });
    
    if (internacionesCount > 0) {
      // Si tiene internaciones, solo desactivar
      const usuarioDesactivado = await req.prisma.usuario.update({
        where: {
          id: userId
        },
        data: {
          activo: false
        },
        select: {
          id: true,
          nombre: true,
          activo: true
        }
      });
      
      return res.json({
        message: 'Usuario desactivado (tiene registros asociados)',
        usuario: usuarioDesactivado
      });
    }
    
    // Si no tiene registros, eliminar completamente
    await req.prisma.usuario.delete({
      where: {
        id: userId
      }
    });
    
    res.json({
      message: 'Usuario eliminado exitosamente'
    });
    
  } catch (error) {
    next(error);
  }
});

// PUT /api/users/:id/toggle-status - Cambiar estado activo/inactivo (Solo Admin)
router.put('/:id/toggle-status', requireAdmin, async (req, res, next) => {
  try {
    const { id } = req.params;
    const userId = parseInt(id);
    
    // No permitir desactivar al admin actual
    if (userId === req.user.id) {
      return res.status(400).json({
        error: 'No puedes desactivar tu propia cuenta'
      });
    }
    
    const usuario = await req.prisma.usuario.findUnique({
      where: { id: userId },
      select: { activo: true }
    });
    
    if (!usuario) {
      return res.status(404).json({
        error: 'Usuario no encontrado'
      });
    }
    
    const usuarioActualizado = await req.prisma.usuario.update({
      where: {
        id: userId
      },
      data: {
        activo: !usuario.activo
      },
      select: {
        id: true,
        nombre: true,
        rol: true,
        activo: true
      }
    });
    
    res.json({
      message: `Usuario ${usuarioActualizado.activo ? 'activado' : 'desactivado'} exitosamente`,
      usuario: usuarioActualizado
    });
    
  } catch (error) {
    next(error);
  }
});

export default router;