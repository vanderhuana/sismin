import express from 'express';
import ExcelJS from 'exceljs';
import PDFDocument from 'pdfkit';
import path from 'path';
import fs from 'fs';
import { fileURLToPath } from 'url';
import { authenticateToken } from '../middleware/auth.middleware.js';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const localLogoPath = path.resolve(__dirname, '../assets/Emblema del minero con pico.png');
const fallbackLogoPath = path.resolve(__dirname, '../../../frontend/src/assets/Emblema del minero con pico.png');
const logoPath = fs.existsSync(localLogoPath) ? localLogoPath : fallbackLogoPath;

const router = express.Router();

// Middleware: todas las rutas requieren autenticación
router.use(authenticateToken);

/**
 * GET /api/ventas/disponibles
 * Busca lotes en estado PAGADO dentro de un rango de fechas y mineral
 * que aún NO hayan sido incluidos en ningún lote general.
 */
router.get('/disponibles', async (req, res, next) => {
  try {
    const { fechaDesde, fechaHasta, tipoMineral, leyMin, leyMax, estadoVenta } = req.query;

    const whereConditions = [
      {
        OR: [
          { estado: 'PAGADO' },
          { calculo: { estadoPago: 'PAGADO' } }
        ]
      }
    ];

    // Filtro por mineral (si es específico)
    if (tipoMineral && tipoMineral !== 'TODOS') {
      whereConditions.push({ tipoMineral });
    }

    // Filtro por estado de venta: DISPONIBLES (por defecto), VENDIDOS o TODOS
    if (estadoVenta === 'VENDIDOS') {
      whereConditions.push({ ventaDetalles: { some: {} } });
    } else if (estadoVenta === 'TODOS') {
      // No filtrar por ventaDetalles (incluye tanto disponibles como ya vendidos)
    } else {
      // Por defecto: DISPONIBLES (que no pertenezca a ningún lote general ya cerrado)
      whereConditions.push({ ventaDetalles: { none: {} } });
    }

    if (fechaDesde) {
      whereConditions.push({
        fechaInternacion: {
          gte: new Date(`${fechaDesde}T00:00:00.000Z`)
        }
      });
    }

    if (fechaHasta) {
      whereConditions.push({
        fechaInternacion: {
          lte: new Date(`${fechaHasta}T23:59:59.999Z`)
        }
      });
    }

    const internaciones = await req.prisma.internacion.findMany({
      where: { AND: whereConditions },
      orderBy: { fechaInternacion: 'desc' },
      include: {
        proveedor: { select: { id: true, nombreCompleto: true, ci: true } },
        calculo: true,
        ventaDetalles: {
          include: {
            venta: {
              select: { id: true, numeroLoteGeneral: true, fecha: true }
            }
          }
        }
      }
    });

    // Mapear cada internación a la estructura de la matriz
    let registros = internaciones.map((it) => {
      const calc = it.calculo;
      const peso = Math.trunc(Number(it.kilosBruto) || 0);

      let ley_ag = null;
      let promedio_ag = null;
      let ley_pb = null;
      let promedio_pb = null;

      if (it.tipoMineral === 'PLATA') {
        ley_ag = Math.trunc(Number(calc?.ley || 0));
        promedio_ag = Math.trunc(peso * ley_ag);
      } else if (it.tipoMineral === 'PLOMO') {
        ley_pb = Math.trunc(Number(calc?.ley || 0));
        promedio_pb = Math.trunc(peso * ley_pb);
      } else if (it.tipoMineral === 'COMPLEJO') {
        ley_ag = Math.trunc(Number(calc?.leyPlata || 0));
        promedio_ag = Math.trunc(peso * ley_ag);
        ley_pb = Math.trunc(Number(calc?.leyPlomo || 0));
        promedio_pb = Math.trunc(peso * ley_pb);
      }

      const costo = Math.trunc(Number(calc?.valorBruto || 0));
      const yaVendido = it.ventaDetalles && it.ventaDetalles.length > 0;
      const loteGeneralVendido = yaVendido ? it.ventaDetalles[0].venta?.numeroLoteGeneral : null;

      return {
        internacionId: it.id,
        lote: it.lote,
        fecha: it.fechaInternacion,
        tipoMineral: it.tipoMineral,
        proveedor: it.proveedor?.nombreCompleto || 'Desconocido',
        peso,
        ley_ag,
        promedio_ag,
        ley_pb,
        promedio_pb,
        costo,
        yaVendido,
        loteGeneralVendido
      };
    });

    // Filtro dinámico por rango de Ley (ej. 1 a 96, 25 a 200, etc.)
    if (leyMin !== undefined && leyMin !== '' && !isNaN(Number(leyMin))) {
      const min = Number(leyMin);
      registros = registros.filter((r) => {
        const val = r.tipoMineral === 'PLOMO' ? r.ley_pb : r.ley_ag;
        return val !== null && val >= min;
      });
    }

    if (leyMax !== undefined && leyMax !== '' && !isNaN(Number(leyMax))) {
      const max = Number(leyMax);
      registros = registros.filter((r) => {
        const val = r.tipoMineral === 'PLOMO' ? r.ley_pb : r.ley_ag;
        return val !== null && val <= max;
      });
    }

    // Totales preliminares de todos los registros disponibles
    const totalPeso = registros.reduce((sum, r) => sum + r.peso, 0);
    const totalPromAg = registros.reduce((sum, r) => sum + (r.promedio_ag || 0), 0);
    const totalPromPb = registros.reduce((sum, r) => sum + (r.promedio_pb || 0), 0);
    const totalCosto = registros.reduce((sum, r) => sum + r.costo, 0);

    const leyAgPond = totalPeso > 0 ? totalPromAg / totalPeso : 0;
    const leyPbPond = totalPeso > 0 ? totalPromPb / totalPeso : 0;

    res.json({
      material: tipoMineral || 'TODOS',
      estadoVenta: estadoVenta || 'DISPONIBLES',
      totalRegistros: registros.length,
      registros,
      totales: {
        peso: totalPeso,
        promedio_ag: totalPromAg,
        promedio_pb: totalPromPb,
        ley_ag_ponderada_calculada: Number(leyAgPond.toFixed(4)),
        ley_ag_ponderada_escrita: Number(leyAgPond.toFixed(2)),
        ley_pb_ponderada_calculada: Number(leyPbPond.toFixed(4)),
        ley_pb_ponderada_escrita: Number(leyPbPond.toFixed(2)),
        costoTotal: totalCosto
      }
    });
  } catch (error) {
    next(error);
  }
});

/**
 * POST /api/ventas
 * Cierra y guarda un lote general en la base de datos con su detalle de lotes
 */
router.post('/', async (req, res, next) => {
  try {
    const {
      numeroLoteGeneral,
      tipoMineral,
      fechaInicioFiltro,
      fechaFinFiltro,
      leyReferenciaAg,
      leyReferenciaPb,
      observaciones,
      loteIds
    } = req.body;

    if (!numeroLoteGeneral?.trim()) {
      return res.status(400).json({ error: 'El número de lote general es obligatorio' });
    }

    if (!tipoMineral) {
      return res.status(400).json({ error: 'El tipo de mineral es obligatorio' });
    }

    if (!Array.isArray(loteIds) || loteIds.length === 0) {
      return res.status(400).json({ error: 'Debes seleccionar al menos un lote para conformar el lote general' });
    }

    const nroLoteTrim = numeroLoteGeneral.trim().toUpperCase();

    // Validar unicidad del número de lote general
    const existe = await req.prisma.ventaLoteGeneral.findUnique({
      where: { numeroLoteGeneral: nroLoteTrim }
    });

    if (existe) {
      return res.status(409).json({
        error: `Ya existe una venta registrada con el número de lote general "${nroLoteTrim}"`
      });
    }

    // Buscar las internaciones seleccionadas
    const internaciones = await req.prisma.internacion.findMany({
      where: {
        id: { in: loteIds.map((id) => parseInt(id, 10)) },
        ventaDetalles: { none: {} }
      },
      include: {
        calculo: true,
        proveedor: true
      }
    });

    if (internaciones.length === 0) {
      return res.status(400).json({
        error: 'Los lotes seleccionados ya han sido cerrados en otro lote general o no están disponibles'
      });
    }

    // Resolver tipo de mineral válido para Prisma (enum: PLATA | PLOMO | COMPLEJO)
    let mineralFinal = tipoMineral;
    const tiposEnLotes = [...new Set(internaciones.map((it) => it.tipoMineral))];

    if (!mineralFinal || mineralFinal === 'TODOS' || !['PLATA', 'PLOMO', 'COMPLEJO'].includes(mineralFinal)) {
      if (tiposEnLotes.length === 1) {
        mineralFinal = tiposEnLotes[0];
      } else if (tiposEnLotes.includes('COMPLEJO') || (tiposEnLotes.includes('PLATA') && tiposEnLotes.includes('PLOMO'))) {
        mineralFinal = 'COMPLEJO';
      } else {
        mineralFinal = tiposEnLotes[0] || 'PLATA';
      }
    }

    // Calcular detalles y métricas
    let sumPeso = 0;
    let sumPromAg = 0;
    let sumPromPb = 0;
    let sumCosto = 0;

    const detallesData = internaciones.map((it) => {
      const calc = it.calculo;
      const peso = Math.trunc(Number(it.kilosBruto) || 0);

      let leyAg = null;
      let promAg = null;
      let leyPb = null;
      let promPb = null;

      // Calcular según el tipo de mineral real de cada internación
      const minLote = it.tipoMineral;
      if (minLote === 'PLATA') {
        leyAg = Math.trunc(Number(calc?.ley || 0));
        promAg = Math.trunc(peso * leyAg);
      } else if (minLote === 'PLOMO') {
        leyPb = Math.trunc(Number(calc?.ley || 0));
        promPb = Math.trunc(peso * leyPb);
      } else if (minLote === 'COMPLEJO') {
        leyAg = Math.trunc(Number(calc?.leyPlata || 0));
        promAg = Math.trunc(peso * leyAg);
        leyPb = Math.trunc(Number(calc?.leyPlomo || 0));
        promPb = Math.trunc(peso * leyPb);
      }

      const costo = Math.trunc(Number(calc?.valorBruto || 0));

      sumPeso += peso;
      if (promAg) sumPromAg += promAg;
      if (promPb) sumPromPb += promPb;
      sumCosto += costo;

      return {
        internacionId: it.id,
        numeroLote: it.lote,
        pesoNeto: peso,
        leyAg: leyAg !== null ? leyAg : null,
        promedioAg: promAg !== null ? promAg : null,
        leyPb: leyPb !== null ? leyPb : null,
        promedioPb: promPb !== null ? promPb : null,
        costoCompra: costo
      };
    });

    const leyAgPonderada = sumPeso > 0 && sumPromAg > 0 ? Number((sumPromAg / sumPeso).toFixed(4)) : null;
    const leyPbPonderada = sumPeso > 0 && sumPromPb > 0 ? Number((sumPromPb / sumPeso).toFixed(4)) : null;

    // Guardar transacción
    const nuevaVenta = await req.prisma.ventaLoteGeneral.create({
      data: {
        numeroLoteGeneral: nroLoteTrim,
        fecha: new Date(),
        fechaInicioFiltro: fechaInicioFiltro ? new Date(fechaInicioFiltro) : null,
        fechaFinFiltro: fechaFinFiltro ? new Date(fechaFinFiltro) : null,
        tipoMineral: mineralFinal,
        leyReferenciaAg: (leyReferenciaAg !== undefined && leyReferenciaAg !== null && !isNaN(parseFloat(leyReferenciaAg))) ? parseFloat(leyReferenciaAg) : null,
        leyReferenciaPb: (leyReferenciaPb !== undefined && leyReferenciaPb !== null && !isNaN(parseFloat(leyReferenciaPb))) ? parseFloat(leyReferenciaPb) : null,
        totalPesoNeto: sumPeso,
        totalPromedioAg: sumPromAg || null,
        totalPromedioPb: sumPromPb || null,
        leyPonderadaAg: leyAgPonderada,
        leyPonderadaPb: leyPbPonderada,
        costoTotalCompra: sumCosto,
        observaciones: observaciones?.trim() || null,
        estado: 'CERRADO',
        usuarioId: req.user?.id || null,
        detalles: {
          create: detallesData
        }
      },
      include: {
        detalles: true,
        usuario: { select: { id: true, nombre: true } }
      }
    });

    res.status(201).json({
      message: `Lote General "${nroLoteTrim}" cerrado y guardado exitosamente`,
      venta: nuevaVenta
    });
  } catch (error) {
    next(error);
  }
});

/**
 * GET /api/ventas
 * Lista el historial de todos los lotes generales cerrados
 */
router.get('/', async (req, res, next) => {
  try {
    const { tipoMineral, search } = req.query;

    const whereConditions = [];

    if (tipoMineral) {
      whereConditions.push({ tipoMineral });
    }

    if (search?.trim()) {
      whereConditions.push({
        numeroLoteGeneral: {
          contains: search.trim(),
          mode: 'insensitive'
        }
      });
    }

    const where = whereConditions.length > 0 ? { AND: whereConditions } : {};

    const ventas = await req.prisma.ventaLoteGeneral.findMany({
      where,
      orderBy: { fecha: 'desc' },
      include: {
        usuario: { select: { id: true, nombre: true } },
        _count: { select: { detalles: true } }
      }
    });

    res.json({ ventas });
  } catch (error) {
    next(error);
  }
});

/**
 * GET /api/ventas/:id
 * Detalle completo de un lote general con todos sus registros
 */
router.get('/:id', async (req, res, next) => {
  try {
    const id = parseInt(req.params.id, 10);
    if (isNaN(id)) return res.status(400).json({ error: 'ID inválido' });

    const venta = await req.prisma.ventaLoteGeneral.findUnique({
      where: { id },
      include: {
        usuario: { select: { id: true, nombre: true } },
        detalles: {
          orderBy: { id: 'asc' },
          include: {
            internacion: {
              include: {
                proveedor: { select: { id: true, nombreCompleto: true } }
              }
            }
          }
        }
      }
    });

    if (!venta) {
      return res.status(404).json({ error: 'Lote general no encontrado' });
    }

    res.json({ venta });
  } catch (error) {
    next(error);
  }
});

/**
 * GET /api/ventas/:id/excel
 * Genera y descarga el archivo Excel (.xlsx) formateado con la matriz exacta
 */
router.get('/:id/excel', async (req, res, next) => {
  try {
    const id = parseInt(req.params.id, 10);
    const venta = await req.prisma.ventaLoteGeneral.findUnique({
      where: { id },
      include: {
        detalles: {
          orderBy: { id: 'asc' },
          include: {
            internacion: {
              include: { proveedor: { select: { nombreCompleto: true } } }
            }
          }
        },
        usuario: { select: { nombre: true } }
      }
    });

    if (!venta) return res.status(404).json({ error: 'Lote general no encontrado' });

    const workbook = new ExcelJS.Workbook();
    workbook.creator = 'Sistema de Gestión Minera';
    workbook.created = new Date();

    const sheet = workbook.addWorksheet(`Lote ${venta.numeroLoteGeneral}`);

    // Título principal
    sheet.mergeCells('A1:G1');
    const titleCell = sheet.getCell('A1');
    titleCell.value = `LIQUIDACIÓN DE VENTA — LOTE GENERAL ${venta.numeroLoteGeneral}`;
    titleCell.font = { name: 'Arial', size: 14, bold: true, color: { argb: 'FFFFFFFF' } };
    titleCell.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: 'FF1E293B' } };
    titleCell.alignment = { horizontal: 'center', vertical: 'middle' };
    sheet.getRow(1).height = 30;

    // Metadatos
    sheet.addRow(['Mineral:', venta.tipoMineral, 'Fecha de Cierre:', new Date(venta.fecha).toLocaleDateString('es-BO')]);
    if (venta.leyReferenciaAg) {
      sheet.addRow(['Ley Ref. Ag:', Number(venta.leyReferenciaAg), 'Operador:', venta.usuario?.nombre || 'Admin']);
    } else {
      sheet.addRow(['Operador:', venta.usuario?.nombre || 'Admin']);
    }
    sheet.addRow([]);

    // Cabecera de la tabla
    const headerRow = sheet.addRow([
      'Lote',
      'Proveedor',
      'Peso Bruto (kg)',
      'Ley Ag (DM)',
      'Promedio Ag',
      'Ley Pb (%)',
      'Promedio Pb',
      'Valor Bruto (Bs)'
    ]);

    headerRow.font = { name: 'Arial', size: 10, bold: true, color: { argb: 'FFFFFFFF' } };
    headerRow.alignment = { horizontal: 'center', vertical: 'middle' };
    headerRow.eachCell((cell) => {
      cell.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: 'FF0F766E' } };
      cell.border = {
        top: { style: 'thin' },
        left: { style: 'thin' },
        bottom: { style: 'thin' },
        right: { style: 'thin' }
      };
    });

    // Filas de datos
    venta.detalles.forEach((det) => {
      const row = sheet.addRow([
        det.numeroLote,
        det.internacion?.proveedor?.nombreCompleto || '—',
        Number(det.pesoNeto),
        det.leyAg !== null ? Number(det.leyAg) : '—',
        det.promedioAg !== null ? Number(det.promedioAg) : '—',
        det.leyPb !== null ? Number(det.leyPb) : '—',
        det.promedioPb !== null ? Number(det.promedioPb) : '—',
        Number(det.costoCompra || 0)
      ]);

      row.font = { name: 'Arial', size: 9 };
      row.getCell(1).alignment = { horizontal: 'center' };
      row.getCell(3).numFmt = '#,##0';
      row.getCell(5).numFmt = '#,##0';
      row.getCell(7).numFmt = '#,##0';
      row.getCell(8).numFmt = 'Bs #,##0';

      row.eachCell((cell) => {
        cell.border = {
          top: { style: 'thin', color: { argb: 'FFE2E8F0' } },
          bottom: { style: 'thin', color: { argb: 'FFE2E8F0' } },
          left: { style: 'thin', color: { argb: 'FFE2E8F0' } },
          right: { style: 'thin', color: { argb: 'FFE2E8F0' } }
        };
      });
    });

    // Fila de TOTALES
    const totalRow = sheet.addRow([
      'TOTALES',
      '',
      Number(venta.totalPesoNeto),
      '',
      venta.totalPromedioAg ? Number(venta.totalPromedioAg) : '',
      '',
      venta.totalPromedioPb ? Number(venta.totalPromedioPb) : '',
      Number(venta.costoTotalCompra || 0)
    ]);

    totalRow.font = { name: 'Arial', size: 10, bold: true };
    totalRow.eachCell((cell) => {
      cell.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: 'FFF1F5F9' } };
      cell.border = { top: { style: 'medium' }, bottom: { style: 'double' } };
    });

    // Fila de LEY PONDERADA
    sheet.addRow([]);
    const pondRow1 = sheet.addRow(['LEY PONDERADA AG:', Number(venta.leyPonderadaAg || 0).toFixed(2)]);
    pondRow1.font = { name: 'Arial', size: 11, bold: true, color: { argb: 'FF047857' } };

    if (venta.leyPonderadaPb) {
      const pondRow2 = sheet.addRow(['LEY PONDERADA PB:', Number(venta.leyPonderadaPb).toFixed(2)]);
      pondRow2.font = { name: 'Arial', size: 11, bold: true, color: { argb: 'FF047857' } };
    }

    if (venta.observaciones) {
      sheet.addRow([]);
      sheet.addRow(['Observaciones:', venta.observaciones]);
    }

    // Auto-ajustar anchos de columna
    sheet.columns.forEach((col) => {
      col.width = 16;
    });
    sheet.getColumn(2).width = 24; // Proveedor

    res.setHeader(
      'Content-Type',
      'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet'
    );
    res.setHeader(
      'Content-Disposition',
      `attachment; filename="venta-${venta.numeroLoteGeneral}.xlsx"`
    );

    await workbook.xlsx.write(res);
    res.end();
  } catch (error) {
    next(error);
  }
});

/**
 * GET /api/ventas/:id/pdf
 * Genera y descarga el comprobante oficial en PDF
 */
router.get('/:id/pdf', async (req, res, next) => {
  try {
    const id = parseInt(req.params.id, 10);
    const venta = await req.prisma.ventaLoteGeneral.findUnique({
      where: { id },
      include: {
        detalles: {
          orderBy: { id: 'asc' },
          include: { internacion: { include: { proveedor: true } } }
        },
        usuario: true
      }
    });

    if (!venta) return res.status(404).json({ error: 'Lote general no encontrado' });

    const doc = new PDFDocument({
      size: 'LETTER',
      margins: { top: 30, bottom: 30, left: 36, right: 36 },
      autoFirstPage: true
    });

    res.setHeader('Content-Type', 'application/pdf');
    res.setHeader(
      'Content-Disposition',
      `attachment; filename="venta-${venta.numeroLoteGeneral}.pdf"`
    );

    doc.pipe(res);

    const hasLogo = fs.existsSync(logoPath);
    const mineralUpper = (venta.tipoMineral || '').toUpperCase();
    const isComplejo = mineralUpper.includes('COMPLEJO');
    const isPlomo = mineralUpper.includes('PLOMO');

    // 1. Marca de agua
    const renderWatermark = () => {
      if (hasLogo) {
        doc.save();
        doc.opacity(0.045);
        doc.image(logoPath, (612 - 320) / 2, (792 - 320) / 2, { width: 320, height: 320 });
        doc.restore();
      }
    };

    // Pie de página
    const renderFooter = (pageNumber) => {
      doc.save();
      doc.strokeColor('#cbd5e1').lineWidth(0.6).dash(2, { space: 2 })
         .moveTo(36, 756).lineTo(576, 756).stroke();
      doc.font('Helvetica').fontSize(7).fillColor('#94a3b8')
         .text('Empresa Minera "A y M" — Sistema de Gestión y Liquidación de Minerales', 36, 761, { width: 340 });
      const fechaImpresion = new Date().toLocaleString('es-BO', { dateStyle: 'short', timeStyle: 'short' });
      doc.text(`Impreso: ${fechaImpresion}  |  Pág. ${pageNumber}`, 376, 761, { width: 200, align: 'right' });
      doc.restore();
    };

    renderWatermark();

    // 2. Encabezado institucional con Logo
    if (hasLogo) {
      doc.image(logoPath, 36, 28, { width: 48, height: 48 });
    }

    const headerTextX = hasLogo ? 92 : 36;
    doc.font('Helvetica-Bold').fontSize(16).fillColor('#064e3b')
       .text('EMPRESA MINERA "A y M"', headerTextX, 28);
    doc.font('Helvetica-Bold').fontSize(8.5).fillColor('#047857')
       .text('COMERCIALIZACIÓN Y EXPLOTACIÓN DE MINERALES', headerTextX, 47);
    doc.font('Helvetica').fontSize(7.5).fillColor('#64748b')
       .text('SISTEMA DE GESTIÓN Y CONTROL DE LOTES GENERALES', headerTextX, 59);
    doc.font('Helvetica').fontSize(7).fillColor('#94a3b8')
       .text('Potosí — Bolivia', headerTextX, 70);

    // Recuadro derecho: Identificación del Lote General
    doc.roundedRect(386, 26, 190, 52, 4)
       .fillColor('#f0fdf4').strokeColor('#059669').lineWidth(1).fillAndStroke();
    doc.font('Helvetica-Bold').fontSize(8.5).fillColor('#064e3b')
       .text('LIQUIDACIÓN LOTE GENERAL', 386, 32, { width: 190, align: 'center' });
    doc.font('Helvetica-Bold').fontSize(13).fillColor('#047857')
       .text(String(venta.numeroLoteGeneral), 386, 45, { width: 190, align: 'center' });
    const fechaStr = new Date(venta.fecha).toLocaleDateString('es-BO', { day: '2-digit', month: '2-digit', year: 'numeric' });
    doc.font('Helvetica').fontSize(7.5).fillColor('#475569')
       .text(`Fecha de Cierre: ${fechaStr}`, 386, 63, { width: 190, align: 'center' });

    // Líneas divisorias decorativas
    doc.rect(36, 86, 540, 2.5).fill('#064e3b');
    doc.rect(36, 89.5, 540, 0.8).fill('#10b981');

    // 3. Ficha de Datos Generales
    doc.roundedRect(36, 96, 540, 36, 3)
       .fillColor('#f8fafc').strokeColor('#cbd5e1').lineWidth(0.8).fillAndStroke();

    // Columna 1
    doc.font('Helvetica-Bold').fontSize(7.5).fillColor('#64748b').text('MINERAL:', 46, 102);
    doc.font('Helvetica-Bold').fontSize(8.5).fillColor('#0f172a').text(String(venta.tipoMineral || '—'), 95, 102);
    doc.font('Helvetica-Bold').fontSize(7.5).fillColor('#64748b').text('TOTAL LOTES:', 46, 116);
    doc.font('Helvetica').fontSize(8.5).fillColor('#0f172a').text(`${venta.detalles.length} lotes acopiados`, 115, 116);

    // Columna 2
    doc.font('Helvetica-Bold').fontSize(7.5).fillColor('#64748b').text('OPERADOR:', 230, 102);
    doc.font('Helvetica').fontSize(8.5).fillColor('#0f172a').text(String(venta.usuario?.nombre || 'Administrador'), 288, 102, { width: 100, ellipsis: true });
    doc.font('Helvetica-Bold').fontSize(7.5).fillColor('#64748b').text('ESTADO:', 230, 116);
    doc.font('Helvetica-Bold').fontSize(8.5).fillColor('#047857').text(String(venta.estado || 'CERRADO'), 278, 116);

    // Columna 3
    doc.font('Helvetica-Bold').fontSize(7.5).fillColor('#64748b').text('LEY REF. AG:', 410, 102);
    doc.font('Helvetica').fontSize(8.5).fillColor('#0f172a').text(venta.leyReferenciaAg != null ? `${venta.leyReferenciaAg} DM` : '—', 475, 102);
    doc.font('Helvetica-Bold').fontSize(7.5).fillColor('#64748b').text('LEY REF. PB:', 410, 116);
    doc.font('Helvetica').fontSize(8.5).fillColor('#0f172a').text(venta.leyReferenciaPb != null ? `${venta.leyReferenciaPb} %` : '—', 475, 116);

    // 4. Tabla de Detalle de Lotes Acopiados
    const renderTableHeader = (y) => {
      doc.rect(36, y, 540, 18).fill('#064e3b');
      doc.font('Helvetica-Bold').fontSize(8).fillColor('#ffffff');

      if (isComplejo) {
        doc.text('Lote', 40, y + 5, { width: 46 });
        doc.text('Proveedor', 88, y + 5, { width: 130 });
        doc.text('Peso (kg)', 220, y + 5, { width: 62, align: 'right' });
        doc.text('Ley Ag', 284, y + 5, { width: 44, align: 'right' });
        doc.text('Prom. Ag', 330, y + 5, { width: 50, align: 'right' });
        doc.text('Ley Pb', 382, y + 5, { width: 44, align: 'right' });
        doc.text('Prom. Pb', 428, y + 5, { width: 50, align: 'right' });
        doc.text('Costo (Bs)', 480, y + 5, { width: 92, align: 'right' });
      } else if (isPlomo) {
        doc.text('Lote', 40, y + 5, { width: 55 });
        doc.text('Proveedor', 98, y + 5, { width: 172 });
        doc.text('Peso Bruto (kg)', 272, y + 5, { width: 75, align: 'right' });
        doc.text('Ley Pb (%)', 350, y + 5, { width: 65, align: 'right' });
        doc.text('Promedio Pb', 418, y + 5, { width: 70, align: 'right' });
        doc.text('Costo Compra (Bs)', 490, y + 5, { width: 82, align: 'right' });
      } else {
        doc.text('Lote', 40, y + 5, { width: 55 });
        doc.text('Proveedor', 98, y + 5, { width: 172 });
        doc.text('Peso Bruto (kg)', 272, y + 5, { width: 75, align: 'right' });
        doc.text('Ley Ag (DM)', 350, y + 5, { width: 65, align: 'right' });
        doc.text('Promedio Ag', 418, y + 5, { width: 70, align: 'right' });
        doc.text('Costo Compra (Bs)', 490, y + 5, { width: 82, align: 'right' });
      }
    };

    let currentY = 140;
    renderTableHeader(currentY);
    currentY += 18;

    const rowHeight = 16;
    let pageIndex = 1;

    venta.detalles.forEach((det, idx) => {
      // Salto de página si excede el límite
      if (currentY + rowHeight > 700) {
        renderFooter(pageIndex);
        doc.addPage();
        pageIndex++;
        renderWatermark();

        // Encabezado simple para páginas subsiguientes
        doc.font('Helvetica-Bold').fontSize(10).fillColor('#064e3b')
           .text(`EMPRESA MINERA "A y M" — LIQUIDACIÓN ${venta.numeroLoteGeneral} (Continuación)`, 36, 30);
        doc.rect(36, 44, 540, 1.5).fill('#064e3b');

        currentY = 52;
        renderTableHeader(currentY);
        currentY += 18;
      }

      // Filas alternadas
      if (idx % 2 === 0) {
        doc.rect(36, currentY, 540, rowHeight).fill('#f8fafc');
      }

      // Línea divisoria muy suave
      doc.save();
      doc.strokeColor('#f1f5f9').lineWidth(0.5)
         .moveTo(36, currentY + rowHeight).lineTo(576, currentY + rowHeight).stroke();
      doc.restore();

      doc.font('Helvetica').fontSize(8).fillColor('#1e293b');
      const textY = currentY + 3.5;

      const provNombre = det.internacion?.proveedor?.nombreCompleto || '—';
      const pesoFormatted = Number(det.pesoNeto || 0).toLocaleString('es-BO');
      const costoFormatted = Number(det.costoCompra || 0).toLocaleString('es-BO');

      if (isComplejo) {
        doc.text(det.numeroLote, 40, textY, { width: 46, ellipsis: true });
        doc.text(provNombre, 88, textY, { width: 130, ellipsis: true });
        doc.text(pesoFormatted, 220, textY, { width: 62, align: 'right' });
        doc.text(det.leyAg != null ? String(det.leyAg) : '—', 284, textY, { width: 44, align: 'right' });
        doc.text(det.promedioAg != null ? Number(det.promedioAg).toLocaleString('es-BO') : '—', 330, textY, { width: 50, align: 'right' });
        doc.text(det.leyPb != null ? String(det.leyPb) : '—', 382, textY, { width: 44, align: 'right' });
        doc.text(det.promedioPb != null ? Number(det.promedioPb).toLocaleString('es-BO') : '—', 428, textY, { width: 50, align: 'right' });
        doc.text(costoFormatted, 480, textY, { width: 92, align: 'right' });
      } else if (isPlomo) {
        doc.text(det.numeroLote, 40, textY, { width: 55, ellipsis: true });
        doc.text(provNombre, 98, textY, { width: 172, ellipsis: true });
        doc.text(pesoFormatted, 272, textY, { width: 75, align: 'right' });
        doc.text(det.leyPb != null ? String(det.leyPb) : '—', 350, textY, { width: 65, align: 'right' });
        doc.text(det.promedioPb != null ? Number(det.promedioPb).toLocaleString('es-BO') : '—', 418, textY, { width: 70, align: 'right' });
        doc.text(costoFormatted, 490, textY, { width: 82, align: 'right' });
      } else {
        doc.text(det.numeroLote, 40, textY, { width: 55, ellipsis: true });
        doc.text(provNombre, 98, textY, { width: 172, ellipsis: true });
        doc.text(pesoFormatted, 272, textY, { width: 75, align: 'right' });
        doc.text(det.leyAg != null ? String(det.leyAg) : '—', 350, textY, { width: 65, align: 'right' });
        doc.text(det.promedioAg != null ? Number(det.promedioAg).toLocaleString('es-BO') : '—', 418, textY, { width: 70, align: 'right' });
        doc.text(costoFormatted, 490, textY, { width: 82, align: 'right' });
      }

      currentY += rowHeight;
    });

    // Línea de cierre de la tabla
    doc.rect(36, currentY, 540, 1.5).fill('#064e3b');
    currentY += 8;

    // Verificar espacio para Totales y Firmas
    if (currentY + 140 > 730) {
      renderFooter(pageIndex);
      doc.addPage();
      pageIndex++;
      renderWatermark();
      currentY = 40;
    }

    // 5. Cuadro de Totales y Leyes Ponderadas
    const boxY = currentY;
    const boxH = 62;
    doc.roundedRect(36, boxY, 540, boxH, 4)
       .fillColor('#f0fdf4').strokeColor('#059669').lineWidth(1.2).fillAndStroke();

    // Franja de título
    doc.roundedRect(36, boxY, 540, 18, 3).fill('#064e3b');
    doc.font('Helvetica-Bold').fontSize(8.5).fillColor('#ffffff')
       .text('RESUMEN DE LIQUIDACIÓN Y LEYES PONDERADAS', 36, boxY + 4.5, { width: 540, align: 'center' });

    // Fila 1 de totales
    const totalPesoStr = `${Number(venta.totalPesoNeto || 0).toLocaleString('es-BO')} kg`;
    const totalCostoStr = `Bs. ${Number(venta.costoTotalCompra || 0).toLocaleString('es-BO')}`;

    doc.font('Helvetica-Bold').fontSize(8.5).fillColor('#064e3b').text('TOTAL PESO:', 48, boxY + 24);
    doc.font('Helvetica-Bold').fontSize(10).fillColor('#0f172a').text(totalPesoStr, 114, boxY + 23);

    doc.font('Helvetica-Bold').fontSize(8.5).fillColor('#064e3b').text('VALOR BRUTO:', 210, boxY + 24);
    doc.font('Helvetica-Bold').fontSize(10).fillColor('#0f172a').text(totalCostoStr, 282, boxY + 23);

    if (venta.totalPromedioAg) {
      doc.font('Helvetica-Bold').fontSize(8.5).fillColor('#064e3b').text('PROM. AG:', 395, boxY + 24);
      doc.font('Helvetica').fontSize(9.5).fillColor('#0f172a').text(Number(venta.totalPromedioAg).toLocaleString('es-BO'), 448, boxY + 23);
    }

    // Fila 2: Insignias de Ley Ponderada
    if (venta.leyPonderadaAg != null) {
      doc.roundedRect(48, boxY + 40, 205, 16, 3).fill('#dcfce7');
      doc.font('Helvetica-Bold').fontSize(8.5).fillColor('#065f46')
         .text('LEY PONDERADA AG:', 54, boxY + 43.5);
      doc.font('Helvetica-Bold').fontSize(10).fillColor('#047857')
         .text(`${Number(venta.leyPonderadaAg).toFixed(2)} DM`, 165, boxY + 42.5);
    }

    if (venta.leyPonderadaPb != null) {
      const pbX = venta.leyPonderadaAg != null ? 265 : 48;
      doc.roundedRect(pbX, boxY + 40, 205, 16, 3).fill('#dcfce7');
      doc.font('Helvetica-Bold').fontSize(8.5).fillColor('#065f46')
         .text('LEY PONDERADA PB:', pbX + 6, boxY + 43.5);
      doc.font('Helvetica-Bold').fontSize(10).fillColor('#047857')
         .text(`${Number(venta.leyPonderadaPb).toFixed(2)} %`, pbX + 115, boxY + 42.5);
    }

    currentY = boxY + boxH + 8;

    // 6. Observaciones
    if (venta.observaciones && venta.observaciones.trim()) {
      doc.roundedRect(36, currentY, 540, 18, 3).fillColor('#f8fafc').strokeColor('#e2e8f0').lineWidth(0.6).fillAndStroke();
      doc.font('Helvetica-Bold').fontSize(7.5).fillColor('#64748b').text('OBSERVACIONES:', 42, currentY + 4.5);
      doc.font('Helvetica-Oblique').fontSize(7.5).fillColor('#334155').text(venta.observaciones, 116, currentY + 4.5, { width: 450, ellipsis: true });
      currentY += 24;
    } else {
      currentY += 12;
    }

    // 7. Firmas de conformidad
    if (currentY + 65 > 740) {
      renderFooter(pageIndex);
      doc.addPage();
      pageIndex++;
      renderWatermark();
      currentY = 60;
    }

    currentY = Math.max(currentY + 15, 660);

    // Firma 1
    doc.save();
    doc.strokeColor('#94a3b8').lineWidth(1).moveTo(65, currentY).lineTo(235, currentY).stroke();
    doc.restore();
    doc.font('Helvetica-Bold').fontSize(8.5).fillColor('#1e293b').text('RESPONSABLE DE VENTA', 65, currentY + 5, { width: 170, align: 'center' });
    doc.font('Helvetica').fontSize(7.5).fillColor('#64748b').text('Empresa Minera "A y M"', 65, currentY + 16, { width: 170, align: 'center' });

    // Firma 2
    doc.save();
    doc.strokeColor('#94a3b8').lineWidth(1).moveTo(375, currentY).lineTo(545, currentY).stroke();
    doc.restore();
    doc.font('Helvetica-Bold').fontSize(8.5).fillColor('#1e293b').text('CONTROL METALÚRGICO / BALANZA', 375, currentY + 5, { width: 170, align: 'center' });
    doc.font('Helvetica').fontSize(7.5).fillColor('#64748b').text('Firma y Sello Autorizado', 375, currentY + 16, { width: 170, align: 'center' });

    // Pie de página de la última hoja
    renderFooter(pageIndex);

    doc.end();
  } catch (error) {
    next(error);
  }
});

export default router;
