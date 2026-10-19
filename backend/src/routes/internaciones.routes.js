import express from 'express';
import PDFDocument from 'pdfkit';
import path from 'path';
import fs from 'fs';
import { fileURLToPath } from 'url';
import { validateData, internacionSchemas } from '../utils/validations.js';
import { authenticateToken } from '../middleware/auth.middleware.js';
import { generarLote, formatearMoneda, formatearPeso } from '../utils/calculations.js';
import { numeroALetras } from '../utils/numeroALetras.js';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const localLogoPath = path.resolve(__dirname, '../assets/Emblema del minero con pico.png');
const fallbackLogoPath = path.resolve(__dirname, '../../../frontend/src/assets/Emblema del minero con pico.png');
const logoPath = fs.existsSync(localLogoPath) ? localLogoPath : fallbackLogoPath;

const router = express.Router();

// Middleware: todas las rutas requieren autenticación
router.use(authenticateToken);

// GET /api/internaciones - Listar internaciones
router.get('/', async (req, res, next) => {
  try {
    const { 
      page = 1, 
      limit = 10, 
      tipoMineral = '',
      estado = '',
      proveedorId = '',
      search = '',
      fechaDesde = '',
      fechaHasta = ''
    } = req.query;
    
    const skip = (parseInt(page) - 1) * parseInt(limit);
    
    // Construir condiciones de búsqueda
    const whereConditions = [];
    
    if (tipoMineral) {
      whereConditions.push({
        tipoMineral: tipoMineral
      });
    }
    
    if (estado === 'TODOS') {
      // Mostrar todos los estados sin filtrar
    } else if (estado) {
      // Estado específico seleccionado (e.g. 'PAGADO', 'EN_ESPERA_LEY', 'CALCULADO')
      whereConditions.push({
        estado: estado
      });
    } else {
      // Por defecto (si no se especifica estado o está en 'Pendientes / Activos'): ocultar los lotes PAGADOS
      whereConditions.push({
        estado: {
          not: 'PAGADO'
        }
      });
    }
    
    if (proveedorId) {
      whereConditions.push({
        proveedorId: parseInt(proveedorId)
      });
    }

    if (search) {
      whereConditions.push({
        OR: [
          {
            lote: {
              contains: search,
              mode: 'insensitive'
            }
          },
          {
            proveedor: {
              nombreCompleto: {
                contains: search,
                mode: 'insensitive'
              }
            }
          },
          {
            proveedor: {
              ci: {
                contains: search,
                mode: 'insensitive'
              }
            }
          }
        ]
      });
    }
    
    if (fechaDesde) {
      whereConditions.push({
        fechaInternacion: {
          gte: new Date(fechaDesde)
        }
      });
    }
    
    if (fechaHasta) {
      whereConditions.push({
        fechaInternacion: {
          lte: new Date(fechaHasta + 'T23:59:59.999Z')
        }
      });
    }
    
    const whereCondition = whereConditions.length > 0 ? {
      AND: whereConditions
    } : {};
    
    const [internaciones, total] = await Promise.all([
      req.prisma.internacion.findMany({
        where: whereCondition,
        skip,
        take: parseInt(limit),
        orderBy: {
          fechaInternacion: 'desc'
        },
        include: {
          proveedor: {
            select: {
              id: true,
              nombreCompleto: true,
              ci: true,
              tipo: true
            }
          },
          usuario: {
            select: {
              id: true,
              nombre: true
            }
          },
          calculo: true
        }
      }),
      req.prisma.internacion.count({
        where: whereCondition
      })
    ]);
    
    res.json({
      internaciones,
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

// GET /api/internaciones/pendientes - Listar internaciones pendientes de cálculo
router.get('/pendientes', async (req, res, next) => {
  try {
    const internacionesPendientes = await req.prisma.internacion.findMany({
      where: {
        estado: 'EN_ESPERA_LEY'
      },
      include: {
        proveedor: {
          select: {
            id: true,
            nombreCompleto: true,
            ci: true,
            tipo: true
          }
        },
        usuario: {
          select: {
            id: true,
            nombre: true
          }
        }
      },
      orderBy: {
        fechaInternacion: 'asc'
      }
    });
    
    res.json(internacionesPendientes);
    
  } catch (error) {
    next(error);
  }
});

// GET /api/internaciones/stats/dashboard - Estadísticas para el dashboard
router.get('/stats/dashboard', async (req, res, next) => {
  try {
    const [
      totalInternaciones,
      enEsperaLey,
      calculadas,
      pagadas,
      totalKilos,
      totalPagado
    ] = await Promise.all([
      req.prisma.internacion.count(),
      req.prisma.internacion.count({ where: { estado: 'EN_ESPERA_LEY' } }),
      req.prisma.internacion.count({ where: { estado: 'CALCULADO' } }),
      req.prisma.internacion.count({ where: { estado: 'PAGADO' } }),
      req.prisma.internacion.aggregate({ _sum: { kilosBruto: true } }),
      req.prisma.calculo.aggregate({
        where: { estadoPago: 'PAGADO' },
        _sum: { saldoFinal: true }
      })
    ]);

    res.json({
      totalInternaciones,
      estados: { enEsperaLey, calculadas, pagadas },
      totalKilosBruto: totalKilos._sum.kilosBruto || 0,
      totalPagado: totalPagado._sum.saldoFinal || 0
    });
  } catch (error) {
    next(error);
  }
});

// GET /api/internaciones/next-lote - Sugerencia de próximo lote correlativo
router.get('/next-lote', async (req, res, next) => {
  try {
    const todasLasInternaciones = await req.prisma.internacion.findMany({
      select: { lote: true }
    });
    const lotesExistentes = new Set(
      todasLasInternaciones.map((i) => (i.lote ? i.lote.toUpperCase() : ''))
    );
    
    let maxNum = 0;
    for (const item of todasLasInternaciones) {
      const match = item.lote && item.lote.match(/LOTE-(\d+)/i);
      if (match) {
        const val = parseInt(match[1], 10);
        if (!isNaN(val) && val > maxNum) maxNum = val;
      }
    }
    
    let nextNum = maxNum + 1;
    let lote = `LOTE-${nextNum.toString().padStart(3, '0')}`;
    while (lotesExistentes.has(lote.toUpperCase())) {
      nextNum++;
      lote = `LOTE-${nextNum.toString().padStart(3, '0')}`;
    }
    
    res.json({ nextLote: lote });
  } catch (error) {
    next(error);
  }
});

// GET /api/internaciones/check-lote - Verificar disponibilidad de número de lote
router.get('/check-lote', async (req, res, next) => {
  try {
    const { lote, excludeId } = req.query;
    if (!lote || !lote.trim()) {
      return res.status(400).json({ error: 'El parámetro lote es requerido' });
    }
    
    const where = {
      lote: {
        equals: lote.trim(),
        mode: 'insensitive'
      }
    };
    
    if (excludeId) {
      where.id = { not: parseInt(excludeId, 10) };
    }
    
    const existente = await req.prisma.internacion.findFirst({ where });
    
    res.json({
      lote: lote.trim(),
      available: !existente
    });
  } catch (error) {
    next(error);
  }
});

// GET /api/internaciones/:id - Obtener internación específica
router.get('/:id', async (req, res, next) => {
  try {
    const { id } = req.params;
    
    const internacion = await req.prisma.internacion.findUnique({
      where: {
        id: parseInt(id)
      },
      include: {
        proveedor: true,
        usuario: {
          select: {
            id: true,
            nombre: true
          }
        },
        calculo: true
      }
    });
    
    if (!internacion) {
      return res.status(404).json({
        error: 'Internación no encontrada'
      });
    }
    
    res.json(internacion);
    
  } catch (error) {
    next(error);
  }
});

// POST /api/internaciones - Crear nueva internación
router.post('/', async (req, res, next) => {
  try {
    const internacionData = validateData(internacionSchemas.create, req.body);
    
    // Verificar que el proveedor existe y está activo
    const proveedor = await req.prisma.proveedor.findFirst({
      where: {
        id: internacionData.proveedorId,
        activo: true
      }
    });
    
    if (!proveedor) {
      return res.status(400).json({
        error: 'El proveedor seleccionado no existe o se encuentra inactivo'
      });
    }
    
    // Asignación de lote: manual prioritario
    let lote = internacionData.lote ? internacionData.lote.trim().toUpperCase() : '';
    
    if (lote) {
      // Verificar si ya existe este lote (insensible a mayúsculas/minúsculas)
      const existeLote = await req.prisma.internacion.findFirst({
        where: {
          lote: {
            equals: lote,
            mode: 'insensitive'
          }
        }
      });
      
      if (existeLote) {
        return res.status(409).json({
          error: `El número de lote "${lote}" ya se encuentra registrado. Ingrese un lote único.`,
          field: 'lote'
        });
      }
    } else {
      // Fallback: Generar correlativo automático si no se proporcionó
      const todasLasInternaciones = await req.prisma.internacion.findMany({
        select: { lote: true }
      });
      const lotesExistentes = new Set(
        todasLasInternaciones.map((i) => (i.lote ? i.lote.toUpperCase() : ''))
      );
      
      let maxNum = 0;
      for (const item of todasLasInternaciones) {
        const match = item.lote && item.lote.match(/LOTE-(\d+)/i);
        if (match) {
          const val = parseInt(match[1], 10);
          if (!isNaN(val) && val > maxNum) maxNum = val;
        }
      }
      
      let nextNum = maxNum + 1;
      lote = `LOTE-${nextNum.toString().padStart(3, '0')}`;
      while (lotesExistentes.has(lote.toUpperCase())) {
        nextNum++;
        lote = `LOTE-${nextNum.toString().padStart(3, '0')}`;
      }
    }
    
    const nuevaInternacion = await req.prisma.internacion.create({
      data: {
        ...internacionData,
        lote,
        usuarioId: req.user.id
      },
      include: {
        proveedor: {
          select: {
            id: true,
            nombreCompleto: true,
            ci: true,
            tipo: true
          }
        },
        usuario: {
          select: {
            id: true,
            nombre: true
          }
        }
      }
    });
    
    // Si se registró un anticipo inicial en báscula, crear el registro en el historial
    const montoInicial = Math.trunc(Number(nuevaInternacion.anticipo) || 0);
    if (montoInicial > 0) {
      await req.prisma.anticipo.create({
        data: {
          internacionId: nuevaInternacion.id,
          proveedorId: nuevaInternacion.proveedorId,
          monto: montoInicial,
          glosa: 'Anticipo inicial en báscula',
          observacion: 'Anticipo inicial en báscula',
          usuarioId: req.user.id
        }
      });
    }

    res.status(201).json({
      message: 'Internación registrada exitosamente',
      internacion: nuevaInternacion
    });
    
  } catch (error) {
    next(error);
  }
});

// PUT /api/internaciones/:id - Actualizar internación
router.put('/:id', async (req, res, next) => {
  try {
    const { id } = req.params;
    const internacionId = parseInt(id, 10);
    const updateData = validateData(internacionSchemas.update, req.body);
    
    // Verificar que la internación existe
    const internacion = await req.prisma.internacion.findUnique({
      where: { id: internacionId },
      include: { calculo: true }
    });
    
    if (!internacion) {
      return res.status(404).json({
        error: 'Internación no encontrada'
      });
    }
    
    // Si ya tiene cálculo, restringir modificaciones que alterarían el cálculo
    if (internacion.calculo) {
      if (internacion.calculo.estadoPago === 'PAGADO') {
        return res.status(400).json({
          error: 'No se puede editar una internación que ya fue liquidada y pagada'
        });
      }
      
      if (updateData.kilosBruto !== undefined && Number(updateData.kilosBruto) !== Number(internacion.kilosBruto)) {
        return res.status(400).json({
          error: 'No se pueden modificar los kilos bruto porque ya tiene un cálculo registrado. Elimina el cálculo para volver a pesar.'
        });
      }
      
      if (updateData.tipoMineral && updateData.tipoMineral !== internacion.tipoMineral) {
        return res.status(400).json({
          error: 'No se puede cambiar el tipo de mineral porque ya tiene un cálculo registrado.'
        });
      }
      
      if (updateData.proveedorId && updateData.proveedorId !== internacion.proveedorId) {
        return res.status(400).json({
          error: 'No se puede cambiar el proveedor porque ya tiene un cálculo registrado.'
        });
      }
    }
    
    // Si se modifica el proveedor, verificar que exista y esté activo
    if (updateData.proveedorId && updateData.proveedorId !== internacion.proveedorId) {
      const proveedor = await req.prisma.proveedor.findFirst({
        where: { id: updateData.proveedorId, activo: true }
      });
      if (!proveedor) {
        return res.status(400).json({
          error: 'El proveedor seleccionado no existe o está inactivo'
        });
      }
    }
    
    // Si se modifica el lote, verificar que no esté duplicado con otra internación
    if (updateData.lote && updateData.lote.trim().toUpperCase() !== internacion.lote.toUpperCase()) {
      const loteAValidar = updateData.lote.trim().toUpperCase();
      const loteExistente = await req.prisma.internacion.findFirst({
        where: {
          id: { not: internacionId },
          lote: {
            equals: loteAValidar,
            mode: 'insensitive'
          }
        }
      });
      if (loteExistente) {
        return res.status(409).json({
          error: `El número de lote "${loteAValidar}" ya se encuentra registrado en otra internación`,
          field: 'lote'
        });
      }
      updateData.lote = loteAValidar;
    }
    
    const internacionActualizada = await req.prisma.internacion.update({
      where: {
        id: internacionId
      },
      data: updateData,
      include: {
        proveedor: {
          select: {
            id: true,
            nombreCompleto: true,
            ci: true,
            tipo: true
          }
        },
        usuario: {
          select: {
            id: true,
            nombre: true
          }
        },
        calculo: true
      }
    });
    
    res.json({
      message: 'Internación actualizada exitosamente',
      internacion: internacionActualizada
    });
    
  } catch (error) {
    next(error);
  }
});

// DELETE /api/internaciones/:id - Eliminar internación
router.delete('/:id', async (req, res, next) => {
  try {
    const { id } = req.params;
    const internacionId = parseInt(id);
    
    // Verificar que la internación existe
    const internacion = await req.prisma.internacion.findUnique({
      where: { id: internacionId },
      include: { calculo: true }
    });
    
    if (!internacion) {
      return res.status(404).json({
        error: 'Internación no encontrada'
      });
    }
    
    // No permitir eliminar si ya tiene cálculo
    if (internacion.calculo) {
      return res.status(400).json({
        error: 'No se puede eliminar una internación que ya tiene cálculo asociado'
      });
    }
    
    await req.prisma.internacion.delete({
      where: {
        id: internacionId
      }
    });
    
    res.json({
      message: 'Internación eliminada exitosamente'
    });
    
  } catch (error) {
    next(error);
  }
});

// GET /api/internaciones/:id/boleta - Generar boleta / comprobante de pesaje en PDF
router.get('/:id/boleta', async (req, res, next) => {
  try {
    const { id } = req.params;
    const internacionId = parseInt(id, 10);
    
    const internacion = await req.prisma.internacion.findUnique({
      where: { id: internacionId },
      include: {
        proveedor: true,
        usuario: {
          select: { id: true, nombre: true }
        },
        calculo: true
      }
    });
    
    if (!internacion) {
      return res.status(404).json({
        error: 'Internación no encontrada'
      });
    }
    
    const calculo = internacion.calculo;
    const hasCalculo = Boolean(calculo);

    // Dimensiones personalizadas: 10.9 cm x 16.8 cm (1 cm = 28.3465 pt)
    // Ancho: 10.9 * 28.3465 = 309 pt | Alto: 16.8 * 28.3465 = 476 pt
    const doc = new PDFDocument({
      size: [309, 476],
      margins: { top: 14, bottom: 14, left: 16, right: 16 },
      autoFirstPage: true
    });

    const filename = hasCalculo 
      ? `comprobante-${internacion.lote}.pdf` 
      : `boleta-recepcion-${internacion.lote}.pdf`;

    res.setHeader('Content-Type', 'application/pdf');
    res.setHeader('Content-Disposition', `inline; filename="${filename}"`);

    doc.pipe(res);

    const hasLogo = fs.existsSync(logoPath);

    // 1. Marca de agua de fondo (centrada con opacidad suave)
    if (hasLogo) {
      doc.save();
      doc.opacity(0.08);
      doc.image(logoPath, (309 - 190) / 2, (476 - 220) / 2, { width: 190 });
      doc.restore();
    }

    // 2. Encabezado institucional
    let topY = 14;
    if (hasLogo) {
      doc.image(logoPath, 16, topY + 2, { width: 34, height: 38 });
    }

    doc.font('Helvetica-Bold').fontSize(12).fillColor('#064e3b')
       .text('MINERA "A y M"', hasLogo ? 54 : 16, topY + 6);
    doc.font('Helvetica').fontSize(7.5).fillColor('#64748b')
       .text('EMPRESA MINERA', hasLogo ? 54 : 16, topY + 20);
    doc.font('Helvetica').fontSize(6.5).fillColor('#94a3b8')
       .text('COMERCIALIZACIÓN DE MINERALES', hasLogo ? 54 : 16, topY + 30);

    // Recuadro superior derecho: "DETALLE" si tiene cálculo o "RECEPCIÓN" si está en espera
    const badgeText = hasCalculo ? 'DETALLE' : 'RECEPCIÓN';
    const badgeWidth = hasCalculo ? 75 : 82;
    const badgeX = 309 - 16 - badgeWidth;
    doc.roundedRect(badgeX, topY + 6, badgeWidth, 24, 3)
       .fillColor('#f8fafc').strokeColor('#064e3b').lineWidth(1.2).fillAndStroke();
    doc.font('Helvetica-Bold').fontSize(hasCalculo ? 11 : 9).fillColor('#064e3b')
       .text(badgeText, badgeX, topY + (hasCalculo ? 13 : 14), { width: badgeWidth, align: 'center' });

    // Línea divisoria elegante
    doc.moveTo(16, topY + 48).lineTo(293, topY + 48).strokeColor('#064e3b').lineWidth(1.2).stroke();

    // 3. Preparación de datos del comprobante
    const fechaRef = (calculo && (calculo.fechaPago || calculo.fechaCalculo)) || internacion.fechaInternacion || new Date();
    const diaStr = String(new Date(fechaRef).getDate()).padStart(2, '0');
    const mesStr = String(new Date(fechaRef).getMonth() + 1).padStart(2, '0');
    const anioStr = new Date(fechaRef).getFullYear();
    const fechaFormateada = `P / ${diaStr} / ${mesStr} / ${anioStr}`;

    const nombreProveedor = (internacion.proveedor?.nombreCompleto || '—').toUpperCase();
    const numeroLote = internacion.lote || '—';
    const tipoMineral = internacion.tipoMineral || '—';

    let leyTexto = '—';
    if (hasCalculo) {
      if (calculo.tipoMineral === 'COMPLEJO') {
        leyTexto = `Ag: ${calculo.leyPlata ?? '—'} DM  |  Pb: ${calculo.leyPlomo ?? '—'} %`;
      } else if (calculo.tipoMineral === 'PLOMO') {
        leyTexto = `${calculo.ley ?? '—'} %`;
      } else {
        leyTexto = `${calculo.ley ?? '—'} DM`;
      }
    } else {
      leyTexto = 'En espera de laboratorio';
    }

    const kilosBrutoNum = Math.trunc(Number(internacion.kilosBruto) || 0);
    const kilosBrutoStr = `${kilosBrutoNum.toLocaleString('es-BO')} kg`;

    // 4. Bloque de Datos Generales (Líneas punteadas)
    let curY = 56;
    const itemHeight = 15.5;

    const renderDottedField = (label, value, isBold = false) => {
      doc.font('Helvetica-Bold').fontSize(8).fillColor('#1e293b')
         .text(label, 16, curY, { width: 70 });
      
      const valX = 86;
      const valW = 207;
      doc.font(isBold ? 'Helvetica-Bold' : 'Helvetica').fontSize(8.5).fillColor('#0f172a')
         .text(String(value), valX, curY, { width: valW, ellipsis: true });

      // Línea punteada sutil
      doc.save();
      doc.strokeColor('#cbd5e1').lineWidth(0.6).dash(1, { space: 2 })
         .moveTo(valX, curY + 11).lineTo(valX + valW, curY + 11).stroke();
      doc.restore();

      curY += itemHeight;
    };

    renderDottedField('Fecha:', fechaFormateada);
    renderDottedField('Nombre:', nombreProveedor, true);
    renderDottedField('Lote N°:', numeroLote, true);
    renderDottedField('Ley:', leyTexto);
    renderDottedField('Mineral:', tipoMineral);
    renderDottedField('Kilos Bruto:', kilosBrutoStr);

    curY += 2;

    if (hasCalculo) {
      // 5. CASO CON CÁLCULO / PAGADO: Exactamente igual al comprobante oficial
      const valorBrutoNum = Math.trunc(Number(calculo.valorBruto) || 0);
      const valorBrutoStr = `Bs. ${valorBrutoNum.toLocaleString('es-BO')}`;

      // Fila destacada de VALOR BRUTO
      doc.roundedRect(16, curY, 277, 20, 3)
         .fillColor('#f8fafc').strokeColor('#cbd5e1').lineWidth(1).fillAndStroke();
      doc.font('Helvetica-Bold').fontSize(8.5).fillColor('#0f172a')
         .text('VALOR BRUTO', 24, curY + 5.5);
      doc.font('Helvetica-Bold').fontSize(10).fillColor('#064e3b')
         .text(valorBrutoStr, 120, curY + 4.5, { width: 165, align: 'right' });

      curY += 26;

      // Tabla de Descuentos
      const tableX = 16;
      const col1W = 185;
      const col2W = 92;
      const tableW = col1W + col2W;

      // Cabecera de la tabla
      doc.rect(tableX, curY, tableW, 16)
         .fillColor('#f1f5f9').strokeColor('#94a3b8').lineWidth(1).fillAndStroke();
      doc.font('Helvetica-Bold').fontSize(8.5).fillColor('#334155')
         .text('Descuentos', tableX + 8, curY + 4);
      doc.font('Helvetica-Bold').fontSize(8.5).fillColor('#334155')
         .text('Bs. / %', tableX + col1W, curY + 4, { width: col2W - 8, align: 'right' });

      curY += 16;

      // Fila 1: Regalía Minera
      const regaliaPctStr = `${Number(calculo.regaliasPorcentaje || 10)} %`;
      doc.rect(tableX, curY, tableW, 16)
         .fillColor('#ffffff').strokeColor('#cbd5e1').lineWidth(0.8).fillAndStroke();
      doc.font('Helvetica').fontSize(8).fillColor('#1e293b')
         .text('Regalía Minera', tableX + 8, curY + 4);
      doc.font('Helvetica-Bold').fontSize(8.5).fillColor('#0f172a')
         .text(regaliaPctStr, tableX + col1W, curY + 3.5, { width: col2W - 8, align: 'right' });

      curY += 16;

      // Fila 2: Anticipos
      const totalAnticipos = Math.trunc(Number(calculo.anticipos || 0));
      const anticiposBsStr = `Bs. ${totalAnticipos.toLocaleString('es-BO')}`;
      doc.rect(tableX, curY, tableW, 16)
         .fillColor('#ffffff').strokeColor('#cbd5e1').lineWidth(0.8).fillAndStroke();
      doc.font('Helvetica').fontSize(8).fillColor('#1e293b')
         .text('Anticipos', tableX + 8, curY + 4);
      doc.font('Helvetica-Bold').fontSize(8.5).fillColor('#0f172a')
         .text(anticiposBsStr, tableX + col1W, curY + 3.5, { width: col2W - 8, align: 'right' });

      curY += 22;

      // A) TRANSPORTE
      const transpNum = Math.trunc(Number(calculo.transporte || 0));
      const transpBsStr = `Bs. ${transpNum.toLocaleString('es-BO')}`;

      doc.font('Helvetica-Bold').fontSize(8).fillColor('#475569')
         .text('TRANSPORTE', 16, curY);
      doc.font('Helvetica-Bold').fontSize(8.5).fillColor('#0f172a')
         .text(transpBsStr, 120, curY, { width: 173, align: 'right' });

      doc.save();
      doc.strokeColor('#cbd5e1').lineWidth(0.6).dash(1, { space: 2 })
         .moveTo(86, curY + 10).lineTo(293, curY + 10).stroke();
      doc.restore();

      curY += 16;

      // B) SALDO FINAL
      const saldoFinalNum = Math.trunc(Number(calculo.saldoFinal || 0));
      const saldoFinalStr = `Bs. ${saldoFinalNum.toLocaleString('es-BO')}`;
      const literalStr = numeroALetras(saldoFinalNum);

      doc.roundedRect(16, curY, 277, 34, 4)
         .fillColor('#ecfdf5').strokeColor('#059669').lineWidth(1.5).fillAndStroke();
      
      doc.font('Helvetica-Bold').fontSize(11).fillColor('#065f46')
         .text(`SALDO FINAL: ${saldoFinalStr}`, 24, curY + 6, { width: 261, align: 'left' });
      
      doc.font('Helvetica').fontSize(6.5).fillColor('#047857')
         .text(`Son: ${literalStr}`, 24, curY + 20, { width: 261, ellipsis: true });

      curY += 46;

      // Firmas
      const signW = 115;
      const signLeftX = 22;
      const signRightX = 172;

      doc.save();
      doc.strokeColor('#64748b').lineWidth(0.8).dash(2, { space: 2 })
         .moveTo(signLeftX, curY + 15).lineTo(signLeftX + signW, curY + 15).stroke();
      doc.moveTo(signRightX, curY + 15).lineTo(signRightX + signW, curY + 15).stroke();
      doc.restore();

      doc.font('Helvetica-Bold').fontSize(7.5).fillColor('#334155')
         .text('GERENTE "A y M"', signLeftX, curY + 19, { width: signW, align: 'center' });
      doc.font('Helvetica-Bold').fontSize(7.5).fillColor('#334155')
         .text('INTERESADO', signRightX, curY + 19, { width: signW, align: 'center' });

    } else {
      // 6. CASO EN ESPERA DE LEY: Membretado oficial tamaño 10.9 x 16.8 cm
      const anticipoNum = Math.trunc(Number(internacion.anticipo) || 0);
      const anticipoStr = `Bs. ${anticipoNum.toLocaleString('es-BO')}`;

      // Anticipo entregado si existió
      renderDottedField('Anticipo:', anticipoNum > 0 ? anticipoStr : 'Sin anticipo');

      curY += 10;

      // Tarjeta de aviso de espera de ley
      doc.roundedRect(16, curY, 277, 50, 4)
         .fillColor('#fffbeb').strokeColor('#f59e0b').lineWidth(1.2).fillAndStroke();
      doc.font('Helvetica-Bold').fontSize(9).fillColor('#b45309')
         .text('FASE 1: RECEPCIÓN Y BÁSCULA REGISTRADA', 24, curY + 8, { width: 261, align: 'center' });
      doc.font('Helvetica').fontSize(7.5).fillColor('#78350f')
         .text('Mineral recepcionado en báscula. La liquidación y cálculo del saldo a pagar se generarán una vez ingresada la ley de laboratorio químico en el módulo "Calcular Pago".', 24, curY + 22, { width: 261, align: 'center' });

      curY += 80;

      // Firmas de Balanza y Conductor / Proveedor
      const signW = 115;
      const signLeftX = 22;
      const signRightX = 172;

      doc.save();
      doc.strokeColor('#64748b').lineWidth(0.8).dash(2, { space: 2 })
         .moveTo(signLeftX, curY + 15).lineTo(signLeftX + signW, curY + 15).stroke();
      doc.moveTo(signRightX, curY + 15).lineTo(signRightX + signW, curY + 15).stroke();
      doc.restore();

      doc.font('Helvetica-Bold').fontSize(7.5).fillColor('#334155')
         .text('OPERADOR / BALANZA', signLeftX, curY + 19, { width: signW, align: 'center' });
      doc.font('Helvetica-Bold').fontSize(7.5).fillColor('#334155')
         .text('PROVEEDOR / INTERESADO', signRightX, curY + 19, { width: signW, align: 'center' });
    }

    doc.end();
    
  } catch (error) {
    next(error);
  }
});

export default router;