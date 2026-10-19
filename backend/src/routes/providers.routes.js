import express from 'express';
import { validateData, providerSchemas } from '../utils/validations.js';
import { authenticateToken } from '../middleware/auth.middleware.js';

const router = express.Router();

// Middleware: todas las rutas requieren autenticación
router.use(authenticateToken);

// GET /api/providers - Listar proveedores
router.get('/', async (req, res, next) => {
  try {
    const { 
      page = 1, 
      limit = 10, 
      search = '', 
      tipo = '',
      activo = ''
    } = req.query;
    
    const skip = (parseInt(page) - 1) * parseInt(limit);
    
    // Construir condiciones de búsqueda
    const whereConditions = [];
    
    if (search) {
      whereConditions.push({
        OR: [
          {
            nombreCompleto: {
              contains: search,
              mode: 'insensitive'
            }
          },
          {
            ci: {
              contains: search,
              mode: 'insensitive'
            }
          }
        ]
      });
    }
    
    if (tipo) {
      whereConditions.push({
        tipo: tipo
      });
    }
    
    if (activo !== '') {
      whereConditions.push({
        activo: activo === 'true'
      });
    }
    
    const whereCondition = whereConditions.length > 0 ? {
      AND: whereConditions
    } : {};
    
    const [proveedores, total] = await Promise.all([
      req.prisma.proveedor.findMany({
        where: whereCondition,
        skip,
        take: parseInt(limit),
        orderBy: {
          nombreCompleto: 'asc'
        },
        include: {
          _count: {
            select: {
              internaciones: true
            }
          }
        }
      }),
      req.prisma.proveedor.count({
        where: whereCondition
      })
    ]);
    
    res.json({
      proveedores,
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

// GET /api/providers/active - Listar solo proveedores activos (para selects)
router.get('/active', async (req, res, next) => {
  try {
    const proveedores = await req.prisma.proveedor.findMany({
      where: {
        activo: true
      },
      select: {
        id: true,
        nombreCompleto: true,
        ci: true,
        tipo: true
      },
      orderBy: {
        nombreCompleto: 'asc'
      }
    });
    
    res.json(proveedores);
    
  } catch (error) {
    next(error);
  }
});

// GET /api/providers/:id - Obtener proveedor específico
router.get('/:id', async (req, res, next) => {
  try {
    const { id } = req.params;
    
    const proveedor = await req.prisma.proveedor.findUnique({
      where: {
        id: parseInt(id)
      },
      include: {
        internaciones: {
          include: {
            calculo: true
          },
          orderBy: {
            fechaInternacion: 'desc'
          },
          take: 10 // Últimas 10 internaciones
        },
        _count: {
          select: {
            internaciones: true
          }
        }
      }
    });
    
    if (!proveedor) {
      return res.status(404).json({
        error: 'Proveedor no encontrado'
      });
    }
    
    res.json(proveedor);
    
  } catch (error) {
    next(error);
  }
});

// POST /api/providers - Crear proveedor
router.post('/', async (req, res, next) => {
  try {
    const providerData = validateData(providerSchemas.create, req.body);

    const data = {
      nombreCompleto: providerData.nombreCompleto.trim(),
      ci: providerData.ci.trim(),
      telefono: providerData.telefono?.trim() || null,
      direccion: providerData.direccion?.trim() || null,
      tipo: providerData.tipo
    };

    // Verificar si el CI ya existe
    const existing = await req.prisma.proveedor.findUnique({
      where: { ci: data.ci }
    });

    if (existing) {
      return res.status(409).json({
        error: `Ya existe un proveedor registrado con el CI / NIT: ${data.ci}`,
        field: 'ci'
      });
    }
    
    const nuevoProveedor = await req.prisma.proveedor.create({
      data
    });
    
    res.status(201).json({
      message: 'Proveedor creado exitosamente',
      proveedor: nuevoProveedor
    });
    
  } catch (error) {
    next(error);
  }
});

// PUT /api/providers/:id - Actualizar proveedor
router.put('/:id', async (req, res, next) => {
  try {
    const { id } = req.params;
    const providerId = parseInt(id);

    const currentProvider = await req.prisma.proveedor.findUnique({
      where: { id: providerId }
    });

    if (!currentProvider) {
      return res.status(404).json({
        error: 'Proveedor no encontrado'
      });
    }

    const updateData = validateData(providerSchemas.update, req.body);

    const data = { ...updateData };
    if ('nombreCompleto' in data && data.nombreCompleto) {
      data.nombreCompleto = data.nombreCompleto.trim();
    }
    if ('ci' in data && data.ci) {
      data.ci = data.ci.trim();
      // Verificar si otro proveedor tiene este CI
      const existing = await req.prisma.proveedor.findFirst({
        where: {
          ci: data.ci,
          id: { not: providerId }
        }
      });
      if (existing) {
        return res.status(409).json({
          error: `Ya existe otro proveedor registrado con el CI / NIT: ${data.ci}`,
          field: 'ci'
        });
      }
    }
    if ('telefono' in data) data.telefono = data.telefono?.trim() || null;
    if ('direccion' in data) data.direccion = data.direccion?.trim() || null;
    
    const proveedorActualizado = await req.prisma.proveedor.update({
      where: {
        id: providerId
      },
      data
    });
    
    res.json({
      message: 'Proveedor actualizado exitosamente',
      proveedor: proveedorActualizado
    });
    
  } catch (error) {
    next(error);
  }
});

// DELETE /api/providers/:id - Eliminar proveedor
router.delete('/:id', async (req, res, next) => {
  try {
    const { id } = req.params;
    const providerId = parseInt(id);
    
    // Verificar si el proveedor tiene internaciones asociadas
    const internacionesCount = await req.prisma.internacion.count({
      where: {
        proveedorId: providerId
      }
    });
    
    if (internacionesCount > 0) {
      // Si tiene internaciones, solo desactivar
      const proveedorDesactivado = await req.prisma.proveedor.update({
        where: {
          id: providerId
        },
        data: {
          activo: false
        }
      });
      
      return res.json({
        message: 'Proveedor desactivado (tiene registros asociados)',
        proveedor: proveedorDesactivado
      });
    }
    
    // Si no tiene registros, eliminar completamente
    await req.prisma.proveedor.delete({
      where: {
        id: providerId
      }
    });
    
    res.json({
      message: 'Proveedor eliminado exitosamente'
    });
    
  } catch (error) {
    next(error);
  }
});

// PUT /api/providers/:id/toggle-status - Cambiar estado activo/inactivo
router.put('/:id/toggle-status', async (req, res, next) => {
  try {
    const { id } = req.params;
    
    const proveedor = await req.prisma.proveedor.findUnique({
      where: { id: parseInt(id) },
      select: { activo: true }
    });
    
    if (!proveedor) {
      return res.status(404).json({
        error: 'Proveedor no encontrado'
      });
    }
    
    const proveedorActualizado = await req.prisma.proveedor.update({
      where: {
        id: parseInt(id)
      },
      data: {
        activo: !proveedor.activo
      }
    });
    
    res.json({
      message: `Proveedor ${proveedorActualizado.activo ? 'activado' : 'desactivado'} exitosamente`,
      proveedor: proveedorActualizado
    });
    
  } catch (error) {
    next(error);
  }
});

// GET /api/providers/:id/stats - Estadísticas del proveedor
router.get('/:id/stats', async (req, res, next) => {
  try {
    const { id } = req.params;
    const providerId = parseInt(id);
    
    const [totalInternaciones, totalPagado, ultimaInternacion] = await Promise.all([
      // Total de internaciones
      req.prisma.internacion.count({
        where: { proveedorId: providerId }
      }),
      
      // Total pagado (suma de saldos finales de cálculos pagados)
      req.prisma.calculo.aggregate({
        where: {
          internacion: {
            proveedorId: providerId
          },
          estadoPago: 'PAGADO'
        },
        _sum: {
          saldoFinal: true
        }
      }),
      
      // Última internación
      req.prisma.internacion.findFirst({
        where: { proveedorId: providerId },
        orderBy: { fechaInternacion: 'desc' },
        include: {
          calculo: true
        }
      })
    ]);
    
    res.json({
      totalInternaciones,
      totalPagado: totalPagado._sum.saldoFinal || 0,
      ultimaInternacion
    });
    
  } catch (error) {
    next(error);
  }
});

export default router;