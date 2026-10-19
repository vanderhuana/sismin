import express from 'express';
import PDFDocument from 'pdfkit';
import { validateData, anticipoSchemas } from '../utils/validations.js';
import { authenticateToken } from '../middleware/auth.middleware.js';
import { numeroALetras } from '../utils/numeroALetras.js';

const router = express.Router();

// Middleware: todas las rutas requieren autenticación
router.use(authenticateToken);

/**
 * Función auxiliar para generar correlativo de Vale de Anticipo
 * Formato: VALE-ANT-0001
 */
async function generarCodigoVale(prisma) {
  const ultimo = await prisma.anticipo.findFirst({
    where: { codigoVale: { not: null } },
    orderBy: { id: 'desc' }
  });

  let correlativo = 1;
  if (ultimo && ultimo.codigoVale) {
    const match = ultimo.codigoVale.match(/VALE-ANT-(\d+)/);
    if (match) {
      correlativo = parseInt(match[1], 10) + 1;
    } else {
      correlativo = ultimo.id + 1;
    }
  } else {
    const totalCount = await prisma.anticipo.count();
    correlativo = totalCount + 1;
  }

  return `VALE-ANT-${correlativo.toString().padStart(4, '0')}`;
}

/**
 * GET /api/anticipos - Listar todos los anticipos con filtros
 */
router.get('/', async (req, res, next) => {
  try {
    const {
      proveedorId,
      estado,
      fechaDesde,
      fechaHasta,
      search,
      page = 1,
      limit = 20
    } = req.query;

    const whereConditions = [];

    if (proveedorId) {
      whereConditions.push({ proveedorId: parseInt(proveedorId, 10) });
    }

    if (estado && estado !== 'TODOS') {
      whereConditions.push({ estado });
    }

    if (fechaDesde) {
      whereConditions.push({
        fecha: { gte: new Date(`${fechaDesde}T00:00:00.000Z`) }
      });
    }

    if (fechaHasta) {
      whereConditions.push({
        fecha: { lte: new Date(`${fechaHasta}T23:59:59.999Z`) }
      });
    }

    if (search && search.trim()) {
      const q = search.trim();
      whereConditions.push({
        OR: [
          { codigoVale: { contains: q, mode: 'insensitive' } },
          { glosa: { contains: q, mode: 'insensitive' } },
          { observacion: { contains: q, mode: 'insensitive' } },
          { proveedor: { nombreCompleto: { contains: q, mode: 'insensitive' } } },
          { proveedor: { ci: { contains: q, mode: 'insensitive' } } }
        ]
      });
    }

    const where = whereConditions.length > 0 ? { AND: whereConditions } : {};
    const skip = (parseInt(page, 10) - 1) * parseInt(limit, 10);
    const take = parseInt(limit, 10);

    const [anticipos, total] = await Promise.all([
      req.prisma.anticipo.findMany({
        where,
        skip,
        take,
        orderBy: { fecha: 'desc' },
        include: {
          proveedor: {
            select: { id: true, nombreCompleto: true, ci: true, telefono: true }
          },
          usuario: { select: { id: true, nombre: true } },
          internacion: { select: { id: true, lote: true } },
          descuentos: {
            include: {
              calculo: {
                select: {
                  id: true,
                  fechaCalculo: true,
                  internacion: { select: { id: true, lote: true } }
                }
              }
            }
          }
        }
      }),
      req.prisma.anticipo.count({ where })
    ]);

    // Resumen financiero rápido
    const totalEntregado = anticipos.reduce((s, a) => s + Math.trunc(Number(a.monto) || 0), 0);
    const totalSaldoPendiente = anticipos.reduce(
      (s, a) => s + (a.estado !== 'ANULADO' ? Math.trunc(Number(a.saldoPendiente) || 0) : 0),
      0
    );

    res.json({
      anticipos,
      total,
      pagina: parseInt(page, 10),
      totalPaginas: Math.ceil(total / take),
      resumen: {
        totalEntregado,
        totalSaldoPendiente
      }
    });
  } catch (error) {
    next(error);
  }
});

/**
 * GET /api/anticipos/resumen-proveedores - Lista consolidada de deudas de anticipos por proveedor
 */
router.get('/resumen-proveedores', async (req, res, next) => {
  try {
    const proveedoresConAnticipos = await req.prisma.proveedor.findMany({
      where: {
        anticipos: {
          some: {
            estado: { in: ['PENDIENTE', 'PARCIAL'] },
            saldoPendiente: { gt: 0 }
          }
        }
      },
      select: {
        id: true,
        nombreCompleto: true,
        ci: true,
        telefono: true,
        anticipos: {
          where: {
            estado: { in: ['PENDIENTE', 'PARCIAL'] },
            saldoPendiente: { gt: 0 }
          },
          select: {
            id: true,
            codigoVale: true,
            monto: true,
            saldoPendiente: true,
            fecha: true,
            glosa: true,
            estado: true
          }
        }
      },
      orderBy: { nombreCompleto: 'asc' }
    });

    const resultado = proveedoresConAnticipos.map((p) => {
      const saldoPendienteTotal = p.anticipos.reduce(
        (sum, a) => sum + Math.trunc(Number(a.saldoPendiente) || 0),
        0
      );
      const montoOriginalTotal = p.anticipos.reduce(
        (sum, a) => sum + Math.trunc(Number(a.monto) || 0),
        0
      );

      return {
        proveedorId: p.id,
        nombreCompleto: p.nombreCompleto,
        ci: p.ci,
        telefono: p.telefono,
        cantidadAnticiposActivos: p.anticipos.length,
        saldoPendienteTotal,
        montoOriginalTotal,
        anticipos: p.anticipos
      };
    });

    // Calcular gran total de deuda en la calle
    const granTotalSaldoPendiente = resultado.reduce((s, r) => s + r.saldoPendienteTotal, 0);

    res.json({
      proveedores: resultado,
      granTotalSaldoPendiente
    });
  } catch (error) {
    next(error);
  }
});

/**
 * GET /api/anticipos/proveedor/:proveedorId/pendientes
 * Consulta rápida de anticipos activos con saldo pendiente para un proveedor (usado en Calcular Pago)
 */
router.get('/proveedor/:proveedorId/pendientes', async (req, res, next) => {
  try {
    const proveedorId = parseInt(req.params.proveedorId, 10);
    if (isNaN(proveedorId)) {
      return res.status(400).json({ error: 'ID de proveedor inválido' });
    }

    const anticipos = await req.prisma.anticipo.findMany({
      where: {
        proveedorId,
        estado: { in: ['PENDIENTE', 'PARCIAL'] },
        saldoPendiente: { gt: 0 }
      },
      orderBy: { fecha: 'asc' },
      select: {
        id: true,
        codigoVale: true,
        monto: true,
        saldoPendiente: true,
        fecha: true,
        glosa: true,
        observacion: true,
        estado: true,
        internacionId: true
      }
    });

    const totalSaldoPendiente = anticipos.reduce(
      (sum, a) => sum + Math.trunc(Number(a.saldoPendiente) || 0),
      0
    );

    res.json({
      anticipos,
      totalSaldoPendiente,
      tieneAnticipos: anticipos.length > 0
    });
  } catch (error) {
    next(error);
  }
});

/**
 * GET /api/anticipos/internacion/:internacionId - Historial de anticipos ligados a un lote específico
 */
router.get('/internacion/:internacionId', async (req, res, next) => {
  try {
    const internacionId = parseInt(req.params.internacionId, 10);
    if (isNaN(internacionId)) {
      return res.status(400).json({ error: 'ID de internación inválido' });
    }

    const internacion = await req.prisma.internacion.findUnique({
      where: { id: internacionId },
      include: {
        proveedor: { select: { id: true, nombreCompleto: true, ci: true } },
        calculo: { select: { id: true, estadoPago: true } }
      }
    });

    if (!internacion) {
      return res.status(404).json({ error: 'Internación no encontrada' });
    }

    const anticipos = await req.prisma.anticipo.findMany({
      where: { internacionId },
      orderBy: { fecha: 'asc' },
      include: {
        usuario: { select: { id: true, nombre: true } }
      }
    });

    const totalAcumulado = anticipos.reduce(
      (sum, a) => sum + Math.trunc(Number(a.monto) || 0),
      0
    );

    res.json({
      internacion: {
        id: internacion.id,
        lote: internacion.lote,
        proveedor: internacion.proveedor,
        anticipoTotal: Math.trunc(Number(internacion.anticipo) || 0),
        estado: internacion.estado
      },
      anticipos,
      totalAcumulado
    });
  } catch (error) {
    next(error);
  }
});

/**
 * POST /api/anticipos - Registrar nuevo anticipo a proveedor (Independiente o de Báscula)
 */
router.post('/', async (req, res, next) => {
  try {
    const data = validateData(anticipoSchemas.create, req.body);
    const montoTrunc = Math.trunc(Number(data.monto) || 0);

    if (montoTrunc <= 0) {
      return res.status(400).json({ error: 'El monto del anticipo debe ser mayor a 0' });
    }

    // Validar existencia del proveedor
    const proveedor = await req.prisma.proveedor.findUnique({
      where: { id: data.proveedorId }
    });

    if (!proveedor) {
      return res.status(404).json({ error: 'Proveedor no encontrado' });
    }

    // Si viene asociado a un lote/internación, verificarlo
    let internacion = null;
    if (data.internacionId) {
      internacion = await req.prisma.internacion.findUnique({
        where: { id: data.internacionId },
        include: { calculo: true }
      });

      if (!internacion) {
        return res.status(404).json({ error: 'Lote/Internación no encontrada' });
      }

      if (internacion.calculo && internacion.calculo.estadoPago === 'PAGADO') {
        return res.status(400).json({
          error: 'No se pueden registrar anticipos en un lote que ya ha sido completamente pagado.'
        });
      }
    }

    const fechaAnticipo = data.fecha ? new Date(data.fecha) : new Date();

    const resultado = await req.prisma.$transaction(async (prisma) => {
      const codigoVale = await generarCodigoVale(prisma);

      const nuevoAnticipo = await prisma.anticipo.create({
        data: {
          codigoVale,
          proveedorId: data.proveedorId,
          internacionId: data.internacionId || null,
          monto: montoTrunc,
          saldoPendiente: montoTrunc,
          estado: 'PENDIENTE',
          fecha: fechaAnticipo,
          glosa: data.glosa?.trim() || 'Anticipo de fondos entregado en efectivo',
          observacion: data.observacion?.trim() || data.glosa?.trim() || null,
          usuarioId: req.user?.id || null
        },
        include: {
          proveedor: { select: { id: true, nombreCompleto: true, ci: true } },
          usuario: { select: { id: true, nombre: true } }
        }
      });

      // Si fue ligado a un lote físico en báscula, actualizar el acumulador del lote
      if (internacion) {
        const nuevoTotalLote = Math.trunc(Number(internacion.anticipo) || 0) + montoTrunc;
        await prisma.internacion.update({
          where: { id: internacion.id },
          data: { anticipo: nuevoTotalLote }
        });
      }

      return nuevoAnticipo;
    });

    res.status(201).json({
      message: `Anticipo ${resultado.codigoVale} de Bs ${montoTrunc.toLocaleString('es-BO')} registrado con éxito`,
      anticipo: resultado
    });
  } catch (error) {
    next(error);
  }
});

/**
 * GET /api/anticipos/:id/vale-pdf - Generar Vale de Anticipo en PDF para Empresa Minera "AyM"
 */
router.get('/:id/vale-pdf', async (req, res, next) => {
  try {
    const id = parseInt(req.params.id, 10);
    if (isNaN(id)) {
      return res.status(400).json({ error: 'ID de anticipo inválido' });
    }

    const anticipo = await req.prisma.anticipo.findUnique({
      where: { id },
      include: {
        proveedor: true,
        usuario: { select: { id: true, nombre: true } },
        internacion: { select: { lote: true } }
      }
    });

    if (!anticipo) {
      return res.status(404).json({ error: 'Anticipo no encontrado' });
    }

    const montoNum = Math.trunc(Number(anticipo.monto) || 0);
    const montoLiteral = numeroALetras(montoNum);
    const fechaStr = new Date(anticipo.fecha).toLocaleDateString('es-BO', {
      day: '2-digit',
      month: '2-digit',
      year: 'numeric'
    });
    const horaStr = new Date(anticipo.fecha).toLocaleTimeString('es-BO', {
      hour: '2-digit',
      minute: '2-digit'
    });

    const doc = new PDFDocument({
      size: 'LETTER',
      margins: { top: 40, bottom: 40, left: 50, right: 50 }
    });

    res.setHeader('Content-Type', 'application/pdf');
    res.setHeader(
      'Content-Disposition',
      `inline; filename="vale-anticipo-${anticipo.codigoVale || anticipo.id}.pdf"`
    );
    doc.pipe(res);

    // FUNCIÓN PARA DIBUJAR UN VALE (Generamos 2 copias por hoja: Original y Copia)
    const dibujarVale = (startY, tipoCopia) => {
      const ancho = 512;
      const alto = 320;

      // Marco contenedor exterior
      doc.rect(50, startY, ancho, alto).lineWidth(1).strokeColor('#cbd5e1').stroke();

      // Encabezado con franja azul pizarra
      doc.rect(50, startY, ancho, 50).fillColor('#0f172a').fill();

      // Textos encabezado
      doc.fillColor('#ffffff').fontSize(16).font('Helvetica-Bold');
      doc.text('EMPRESA MINERA "AyM"', 65, startY + 12);
      doc.fontSize(8).font('Helvetica').fillColor('#94a3b8');
      doc.text('COMERCIALIZACIÓN Y EXPLOTACIÓN DE MINERALES', 65, startY + 32);

      // Cuadro número de vale y tipo de copia
      doc.fillColor('#ffffff').fontSize(11).font('Helvetica-Bold');
      doc.text(anticipo.codigoVale || `VALE-${anticipo.id}`, ancho - 70, startY + 12, {
        align: 'right',
        width: 110
      });
      doc.fontSize(8).font('Helvetica').fillColor('#38bdf8');
      doc.text(`[ ${tipoCopia.toUpperCase()} ]`, ancho - 70, startY + 30, {
        align: 'right',
        width: 110
      });

      // Título del documento
      doc.fillColor('#0f172a').fontSize(12).font('Helvetica-Bold');
      doc.text('VALE DE ENTREGA DE ANTICIPO DE FONDOS', 50, startY + 62, {
        align: 'center',
        width: ancho
      });

      // Caja de Monto Destacado
      doc.rect(360, startY + 85, 190, 42).fillColor('#ecfdf5').strokeColor('#10b981').lineWidth(1.5).fillAndStroke();
      doc.fillColor('#065f46').fontSize(9).font('Helvetica-Bold').text('MONTO ENTREGADO:', 370, startY + 92);
      doc.fillColor('#047857').fontSize(14).font('Helvetica-Bold').text(
        `Bs. ${montoNum.toLocaleString('es-BO')}`,
        370,
        startY + 105
      );

      // Datos del Beneficiario
      doc.fillColor('#334155').fontSize(9).font('Helvetica-Bold');
      doc.text('FECHA Y HORA:', 65, startY + 90);
      doc.font('Helvetica').text(`${fechaStr} — ${horaStr}`, 160, startY + 90);

      doc.font('Helvetica-Bold').text('PROVEEDOR:', 65, startY + 106);
      doc.font('Helvetica').text(anticipo.proveedor?.nombreCompleto || 'Sin nombre', 160, startY + 106);

      doc.font('Helvetica-Bold').text('C.I. / NIT:', 65, startY + 122);
      doc.font('Helvetica').text(anticipo.proveedor?.ci || 'S/N', 160, startY + 122);

      if (anticipo.internacion?.lote) {
        doc.font('Helvetica-Bold').text('LOTE REF.:', 65, startY + 138);
        doc.font('Helvetica').text(anticipo.internacion.lote, 160, startY + 138);
      }

      // Línea divisoria suave
      doc.moveTo(65, startY + 155).lineTo(545, startY + 155).lineWidth(0.5).strokeColor('#e2e8f0').stroke();

      // Monto en Literal
      doc.fillColor('#1e293b').fontSize(8.5).font('Helvetica-Bold').text('SON:', 65, startY + 165);
      doc.font('Helvetica').text(montoLiteral, 100, startY + 165, { width: 440 });

      // Concepto / Glosa
      doc.font('Helvetica-Bold').text('POR CONCEPTO DE:', 65, startY + 185);
      doc.font('Helvetica').text(anticipo.glosa || 'Anticipo a cuenta de entrega de mineral', 170, startY + 185, {
        width: 375
      });

      if (anticipo.observacion && anticipo.observacion !== anticipo.glosa) {
        doc.font('Helvetica-Bold').text('OBSERVACIÓN:', 65, startY + 205);
        doc.font('Helvetica').text(anticipo.observacion, 170, startY + 205, { width: 375 });
      }

      // Sector de Firmas
      const firmaY = startY + 270;

      // Línea Firma Entrega
      doc.moveTo(90, firmaY).lineTo(230, firmaY).lineWidth(1).strokeColor('#475569').stroke();
      doc.fillColor('#334155').fontSize(8).font('Helvetica-Bold');
      doc.text('ENTREGUÉ CONFORME', 90, firmaY + 5, { width: 140, align: 'center' });
      doc.font('Helvetica').fontSize(7.5).text(
        `Caja — Empresa Minera AyM\nResp: ${anticipo.usuario?.nombre || 'Administración'}`,
        90,
        firmaY + 16,
        { width: 140, align: 'center' }
      );

      // Línea Firma Recepción
      doc.moveTo(370, firmaY).lineTo(510, firmaY).lineWidth(1).strokeColor('#475569').stroke();
      doc.fillColor('#334155').fontSize(8).font('Helvetica-Bold');
      doc.text('RECIBÍ CONFORME', 370, firmaY + 5, { width: 140, align: 'center' });
      doc.font('Helvetica').fontSize(7.5).text(
        `${anticipo.proveedor?.nombreCompleto || 'Proveedor'}\nC.I.: ${anticipo.proveedor?.ci || ''}`,
        370,
        firmaY + 16,
        { width: 140, align: 'center' }
      );
    };

    // Imprimir Copia 1: ORIGINAL (Parte superior)
    dibujarVale(40, 'Original — Contabilidad');

    // Línea de corte punteada en el medio
    doc.moveTo(50, 380).lineTo(560, 380).lineWidth(1).dash(4, { space: 4 }).strokeColor('#94a3b8').stroke();
    doc.fillColor('#64748b').fontSize(7).font('Helvetica');
    doc.undash();
    doc.text('✂  - - - - - - - - - - - - - - - - - - - - - - - - - -  CORTE AQUÍ  - - - - - - - - - - - - - - - - - - - - - - - - - -  ✂', 50, 375, {
      align: 'center',
      width: 512
    });

    // Imprimir Copia 2: COPIA CLIENTE (Parte inferior)
    dibujarVale(395, 'Copia — Proveedor');

    doc.end();
  } catch (error) {
    next(error);
  }
});

/**
 * DELETE /api/anticipos/:id - Anular anticipo
 */
router.delete('/:id', async (req, res, next) => {
  try {
    const id = parseInt(req.params.id, 10);
    if (isNaN(id)) {
      return res.status(400).json({ error: 'ID de anticipo inválido' });
    }

    const anticipo = await req.prisma.anticipo.findUnique({
      where: { id },
      include: {
        descuentos: true,
        internacion: { include: { calculo: true } }
      }
    });

    if (!anticipo) {
      return res.status(404).json({ error: 'Anticipo no encontrado' });
    }

    if (anticipo.descuentos && anticipo.descuentos.length > 0) {
      return res.status(400).json({
        error: `No se puede eliminar este anticipo porque ya tiene ${anticipo.descuentos.length} descuento(s) amortizado(s) en liquidaciones.`
      });
    }

    if (anticipo.internacion && anticipo.internacion.calculo && anticipo.internacion.calculo.estadoPago === 'PAGADO') {
      return res.status(400).json({
        error: 'No se puede eliminar un anticipo de un lote que ya fue liquidado y pagado.'
      });
    }

    await req.prisma.$transaction(async (prisma) => {
      // Si pertenecía a una internación en báscula, restar el acumulador
      if (anticipo.internacionId) {
        const monto = Math.trunc(Number(anticipo.monto) || 0);
        const actual = Math.trunc(Number(anticipo.internacion.anticipo) || 0);
        const nuevo = Math.max(0, actual - monto);
        await prisma.internacion.update({
          where: { id: anticipo.internacionId },
          data: { anticipo: nuevo }
        });
      }

      await prisma.anticipo.delete({ where: { id } });
    });

    res.json({
      message: 'Anticipo eliminado y revertido exitosamente',
      id
    });
  } catch (error) {
    next(error);
  }
});

export default router;
