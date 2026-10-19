import express from 'express';
import PDFDocument from 'pdfkit';
import path from 'path';
import fs from 'fs';
import { fileURLToPath } from 'url';
import { validateData, calculoSchemas } from '../utils/validations.js';
import { authenticateToken } from '../middleware/auth.middleware.js';
import { calcularPago, formatearMoneda, formatearPeso, formatearPorcentaje } from '../utils/calculations.js';
import { numeroALetras } from '../utils/numeroALetras.js';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const localLogoPath = path.resolve(__dirname, '../assets/Emblema del minero con pico.png');
const fallbackLogoPath = path.resolve(__dirname, '../../../frontend/src/assets/Emblema del minero con pico.png');
const logoPath = fs.existsSync(localLogoPath) ? localLogoPath : fallbackLogoPath;

const router = express.Router();

// Middleware: todas las rutas requieren autenticación
router.use(authenticateToken);

// GET /api/calculos - Listar cálculos
router.get('/', async (req, res, next) => {
  try {
    const { 
      page = 1, 
      limit = 10, 
      estadoPago = '',
      tipoMineral = '',
      proveedorId = ''
    } = req.query;
    
    const skip = (parseInt(page) - 1) * parseInt(limit);
    
    const whereConditions = [];
    
    if (estadoPago) {
      whereConditions.push({
        estadoPago: estadoPago
      });
    }
    
    if (tipoMineral) {
      whereConditions.push({
        tipoMineral: tipoMineral
      });
    }
    
    if (proveedorId) {
      whereConditions.push({
        internacion: {
          proveedorId: parseInt(proveedorId)
        }
      });
    }
    
    const whereCondition = whereConditions.length > 0 ? {
      AND: whereConditions
    } : {};
    
    const [calculos, total] = await Promise.all([
      req.prisma.calculo.findMany({
        where: whereCondition,
        skip,
        take: parseInt(limit),
        orderBy: {
          fechaCalculo: 'desc'
        },
        include: {
          internacion: {
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
          }
        }
      }),
      req.prisma.calculo.count({
        where: whereCondition
      })
    ]);
    
    res.json({
      calculos,
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

// GET /api/calculos/:id - Obtener cálculo específico
router.get('/:id', async (req, res, next) => {
  try {
    const { id } = req.params;
    
    const calculo = await req.prisma.calculo.findUnique({
      where: {
        id: parseInt(id)
      },
      include: {
        internacion: {
          include: {
            proveedor: true,
            usuario: {
              select: {
                id: true,
                nombre: true
              }
            }
          }
        }
      }
    });
    
    if (!calculo) {
      return res.status(404).json({
        error: 'Cálculo no encontrado'
      });
    }
    
    res.json(calculo);
    
  } catch (error) {
    next(error);
  }
});

// POST /api/calculos - Crear nuevo cálculo
router.post('/', async (req, res, next) => {
  try {
    const internacion = await req.prisma.internacion.findUnique({
      where: { id: parseInt(req.body.internacionId, 10) },
      include: { calculo: true }
    });

    if (!internacion) {
      return res.status(404).json({ error: 'Internación no encontrada' });
    }

    if (internacion.calculo) {
      return res.status(400).json({ error: 'Esta internación ya tiene un cálculo asociado' });
    }

    if (internacion.estado !== 'EN_ESPERA_LEY') {
      return res.status(400).json({
        error: 'Solo se pueden calcular internaciones en estado "EN_ESPERA_LEY"'
      });
    }

    const calculoData = validateData(calculoSchemas.create, {
      ...req.body,
      tipoMineral: internacion.tipoMineral
    });
    
    // Separar y calcular anticipos: Báscula vs Cuenta Proveedor
    const anticipoBascula = calculoData.anticipoBascula !== undefined
      ? Math.trunc(Number(calculoData.anticipoBascula) || 0)
      : (calculoData.anticipos !== undefined ? Math.trunc(Number(calculoData.anticipos) || 0) : Math.trunc(Number(internacion.anticipo) || 0));

    const anticiposDescontar = Array.isArray(calculoData.anticiposDescontar) ? calculoData.anticiposDescontar : [];
    let anticipoProveedor = 0;

    if (anticiposDescontar.length > 0) {
      anticipoProveedor = anticiposDescontar.reduce((sum, item) => sum + Math.trunc(Number(item.montoADescontar) || 0), 0);
    } else if (calculoData.anticipoProveedor !== undefined) {
      anticipoProveedor = Math.trunc(Number(calculoData.anticipoProveedor) || 0);
    }

    const montoAnticipoTotal = anticipoBascula + anticipoProveedor;

    // Realizar cálculos
    const resultadoCalculo = calcularPago({
      kilosBruto: internacion.kilosBruto,
      humedadPorcentaje: calculoData.humedadPorcentaje,
      tipoMineral: internacion.tipoMineral,
      // Para mineral simple
      ley: calculoData.ley,
      valorEscala: calculoData.valorEscala,
      // Para complejo
      leyPlata: calculoData.leyPlata,
      valorEscalaPlata: calculoData.valorEscalaPlata,
      leyPlomo: calculoData.leyPlomo,
      valorEscalaPlomo: calculoData.valorEscalaPlomo,
      // Descuentos y ajustes
      regaliasPorcentaje: calculoData.regaliasPorcentaje,
      anticipos: montoAnticipoTotal,
      transporte: calculoData.transporte
    });

    // Preparar datos para la base de datos
    const dataToSave = {
      internacionId: calculoData.internacionId,
      tipoMineral: internacion.tipoMineral,
      humedadPorcentaje: calculoData.humedadPorcentaje,
      kilosNeto: resultadoCalculo.kilosNeto,
      valorBruto: resultadoCalculo.valorBruto,
      regaliasPorcentaje: calculoData.regaliasPorcentaje,
      regaliasMonto: resultadoCalculo.regaliasMonto,
      anticipos: montoAnticipoTotal,
      anticipoBascula,
      anticipoProveedor,
      transporte: calculoData.transporte,
      saldoFinal: resultadoCalculo.saldoFinal
    };
    
    // Agregar campos específicos según tipo de mineral
    if (internacion.tipoMineral === 'COMPLEJO') {
      dataToSave.leyPlata = calculoData.leyPlata;
      dataToSave.valorEscalaPlata = calculoData.valorEscalaPlata;
      dataToSave.leyPlomo = calculoData.leyPlomo;
      dataToSave.valorEscalaPlomo = calculoData.valorEscalaPlomo;
      dataToSave.valorEscalaTotal = resultadoCalculo.valorEscalaTotal;
    } else {
      dataToSave.ley = calculoData.ley;
      dataToSave.valorEscala = calculoData.valorEscala;
    }
    
    // Usar transacción para crear cálculo, amortizar anticipos y actualizar estado de internación
    const nuevoCalculo = await req.prisma.$transaction(async (prisma) => {
      // Crear cálculo
      const calculo = await prisma.calculo.create({
        data: dataToSave,
        include: {
          internacion: {
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
          }
        }
      });
      
      // Amortizar cada anticipo de cuenta de proveedor seleccionado (tranza / descuento parcial o total)
      for (const item of anticiposDescontar) {
        const montoDesc = Math.trunc(Number(item.montoADescontar) || 0);
        if (montoDesc > 0 && item.anticipoId) {
          const ant = await prisma.anticipo.findUnique({
            where: { id: parseInt(item.anticipoId, 10) }
          });

          if (ant) {
            const saldoActual = Math.trunc(Number(ant.saldoPendiente) || 0);
            const montoEfectivo = Math.min(montoDesc, saldoActual);
            const nuevoSaldo = Math.max(0, saldoActual - montoEfectivo);
            const nuevoEstado = nuevoSaldo === 0 ? 'COBRADO' : 'PARCIAL';

            // Guardar registro de la amortización
            await prisma.anticipoDescuento.create({
              data: {
                anticipoId: ant.id,
                calculoId: calculo.id,
                montoDescontado: montoEfectivo
              }
            });

            // Actualizar saldo pendiente y estado del anticipo
            await prisma.anticipo.update({
              where: { id: ant.id },
              data: {
                saldoPendiente: nuevoSaldo,
                estado: nuevoEstado
              }
            });
          }
        }
      }

      // Actualizar estado de internación
      await prisma.internacion.update({
        where: {
          id: calculoData.internacionId
        },
        data: {
          estado: 'CALCULADO'
        }
      });
      
      return calculo;
    });
    
    res.status(201).json({
      message: 'Cálculo creado exitosamente',
      calculo: nuevoCalculo
    });
    
  } catch (error) {
    next(error);
  }
});

// PUT /api/calculos/:id/pagar - Marcar cálculo como pagado
router.put('/:id/pagar', async (req, res, next) => {
  try {
    const { id } = req.params;
    
    const calculo = await req.prisma.calculo.findUnique({
      where: {
        id: parseInt(id)
      },
      include: {
        internacion: true
      }
    });
    
    if (!calculo) {
      return res.status(404).json({
        error: 'Cálculo no encontrado'
      });
    }
    
    if (calculo.estadoPago === 'PAGADO') {
      return res.status(400).json({
        error: 'Este cálculo ya está marcado como pagado'
      });
    }
    
    // Usar transacción para marcar como pagado
    const calculoActualizado = await req.prisma.$transaction(async (prisma) => {
      // Actualizar cálculo
      const calculo = await prisma.calculo.update({
        where: {
          id: parseInt(id)
        },
        data: {
          estadoPago: 'PAGADO',
          fechaPago: new Date()
        },
        include: {
          internacion: {
            include: {
              proveedor: true
            }
          }
        }
      });
      
      // Actualizar estado de internación
      await prisma.internacion.update({
        where: {
          id: calculo.internacionId
        },
        data: {
          estado: 'PAGADO'
        }
      });
      
      return calculo;
    });
    
    res.json({
      message: 'Pago registrado exitosamente',
      calculo: calculoActualizado
    });
    
  } catch (error) {
    next(error);
  }
});

// GET /api/calculos/:id/comprobante - Generar comprobante PDF
router.get('/:id/comprobante', async (req, res, next) => {
  try {
    const { id } = req.params;
    
    const calculo = await req.prisma.calculo.findUnique({
      where: {
        id: parseInt(id)
      },
      include: {
        internacion: {
          include: {
            proveedor: true,
            usuario: {
              select: {
                nombre: true
              }
            }
          }
        }
      }
    });
    
    if (!calculo) {
      return res.status(404).json({
        error: 'Cálculo no encontrado'
      });
    }
    
    // Dimensiones personalizadas: 10.9 cm x 16.8 cm (1 cm = 28.3465 pt)
    // Ancho: 10.9 * 28.3465 = 309 pt | Alto: 16.8 * 28.3465 = 476 pt
    const doc = new PDFDocument({
      size: [309, 476],
      margins: { top: 14, bottom: 14, left: 16, right: 16 },
      autoFirstPage: true
    });
    
    // Configurar headers para PDF
    res.setHeader('Content-Type', 'application/pdf');
    res.setHeader('Content-Disposition', `inline; filename="comprobante-${calculo.internacion.lote}.pdf"`);
    
    // Pipe del documento al response
    doc.pipe(res);

    const hasLogo = fs.existsSync(logoPath);

    // 1. Marca de agua de fondo (centrada con opacidad suave)
    if (hasLogo) {
      doc.save();
      doc.opacity(0.08);
      // Ancho página: 309, Alto: 476. Logo ancho: 190, centrado horizontal y verticalmente
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

    // Recuadro "DETALLE" a la derecha
    doc.roundedRect(218, topY + 6, 75, 24, 3)
       .fillColor('#f8fafc').strokeColor('#064e3b').lineWidth(1.2).fillAndStroke();
    doc.font('Helvetica-Bold').fontSize(11).fillColor('#064e3b')
       .text('DETALLE', 218, topY + 13, { width: 75, align: 'center' });

    // Línea divisoria elegante
    doc.moveTo(16, topY + 48).lineTo(293, topY + 48).strokeColor('#064e3b').lineWidth(1.2).stroke();

    // 3. Preparación de datos del comprobante
    const fechaPago = calculo.fechaPago || calculo.fechaCalculo || new Date();
    const diaStr = String(fechaPago.getDate()).padStart(2, '0');
    const mesStr = String(fechaPago.getMonth() + 1).padStart(2, '0');
    const anioStr = fechaPago.getFullYear();
    const fechaFormateada = `P / ${diaStr} / ${mesStr} / ${anioStr}`;

    const nombreProveedor = (calculo.internacion.proveedor?.nombreCompleto || '—').toUpperCase();
    const numeroLote = calculo.internacion.lote || '—';
    const tipoMineral = calculo.tipoMineral || '—';

    let leyTexto = '—';
    if (calculo.tipoMineral === 'COMPLEJO') {
      leyTexto = `Ag: ${calculo.leyPlata ?? '—'} DM  |  Pb: ${calculo.leyPlomo ?? '—'} %`;
    } else if (calculo.tipoMineral === 'PLOMO') {
      leyTexto = `${calculo.ley ?? '—'} %`;
    } else {
      leyTexto = `${calculo.ley ?? '—'} DM`;
    }

    const kilosBrutoNum = Math.trunc(Number(calculo.internacion.kilosBruto) || 0);
    const kilosBrutoStr = `${kilosBrutoNum.toLocaleString('es-BO')} kg`;

    const valorBrutoNum = Math.trunc(Number(calculo.valorBruto) || 0);
    const valorBrutoStr = `Bs. ${valorBrutoNum.toLocaleString('es-BO')}`;

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

    // Fila destacada de VALOR BRUTO
    doc.roundedRect(16, curY, 277, 20, 3)
       .fillColor('#f8fafc').strokeColor('#cbd5e1').lineWidth(1).fillAndStroke();
    doc.font('Helvetica-Bold').fontSize(8.5).fillColor('#0f172a')
       .text('VALOR BRUTO', 24, curY + 5.5);
    doc.font('Helvetica-Bold').fontSize(10).fillColor('#064e3b')
       .text(valorBrutoStr, 120, curY + 4.5, { width: 165, align: 'right' });

    curY += 26;

    // 5. Tabla de Descuentos
    // Ancho tabla: 277 pt. Columna 1 (185 pt) | Columna 2 (92 pt)
    const tableX = 16;
    const col1W = 185;
    const col2W = 92;
    const tableW = col1W + col2W;

    // Cabecera de la tabla
    doc.rect(tableX, curY, tableW, 16)
       .fillColor('#f1f5f9').strokeColor('#94a3b8').lineWidth(1).fillAndStroke();
    doc.font('Helvetica-Bold').fontSize(8).fillColor('#334155')
       .text('Descuentos', tableX + 8, curY + 4);
    doc.font('Helvetica-Bold').fontSize(8).fillColor('#334155')
       .text('Bs. / %', tableX + col1W, curY + 4, { width: col2W - 8, align: 'right' });

    curY += 16;

    // Fila 1: Regalía Minera (solo porcentaje como solicitó el usuario)
    const regaliaPctStr = `${Number(calculo.regaliasPorcentaje || 10)} %`;
    doc.rect(tableX, curY, tableW, 16)
       .fillColor('#ffffff').strokeColor('#cbd5e1').lineWidth(0.8).fillAndStroke();
    doc.font('Helvetica').fontSize(8).fillColor('#1e293b')
       .text('Regalía Minera', tableX + 8, curY + 4);
    doc.font('Helvetica-Bold').fontSize(8.5).fillColor('#0f172a')
       .text(regaliaPctStr, tableX + col1W, curY + 3.5, { width: col2W - 8, align: 'right' });

    curY += 16;

    // Fila 2: Anticipos (solo el monto en Bs como solicitó el usuario)
    const totalAnticipos = Math.trunc(Number(calculo.anticipos || 0));
    const anticiposBsStr = `Bs. ${totalAnticipos.toLocaleString('es-BO')}`;
    doc.rect(tableX, curY, tableW, 16)
       .fillColor('#ffffff').strokeColor('#cbd5e1').lineWidth(0.8).fillAndStroke();
    doc.font('Helvetica').fontSize(8).fillColor('#1e293b')
       .text('Anticipos', tableX + 8, curY + 4);
    doc.font('Helvetica-Bold').fontSize(8.5).fillColor('#0f172a')
       .text(anticiposBsStr, tableX + col1W, curY + 3.5, { width: col2W - 8, align: 'right' });

    curY += 22;

    // 6. Resultados Finales
    // A) TRANSPORTE (arriba de Saldo Final)
    const transpNum = Math.trunc(Number(calculo.transporte || 0));
    const transpBsStr = `Bs. ${transpNum.toLocaleString('es-BO')}`;

    doc.font('Helvetica-Bold').fontSize(8).fillColor('#475569')
       .text('TRANSPORTE', 16, curY);
    doc.font('Helvetica-Bold').fontSize(8.5).fillColor('#0f172a')
       .text(transpBsStr, 120, curY, { width: 173, align: 'right' });

    // Dotted line para transporte
    doc.save();
    doc.strokeColor('#cbd5e1').lineWidth(0.6).dash(1, { space: 2 })
       .moveTo(86, curY + 10).lineTo(293, curY + 10).stroke();
    doc.restore();

    curY += 16;

    // B) SALDO FINAL (destacado en negrita con monto literal en palabras)
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

    // 7. Firmas de Gerente "A y M" e Interesado
    const signW = 115;
    const signLeftX = 22;
    const signRightX = 172;

    // Líneas punteadas para firmas
    doc.save();
    doc.strokeColor('#64748b').lineWidth(0.8).dash(2, { space: 2 })
       .moveTo(signLeftX, curY + 15).lineTo(signLeftX + signW, curY + 15).stroke();
    doc.moveTo(signRightX, curY + 15).lineTo(signRightX + signW, curY + 15).stroke();
    doc.restore();

    doc.font('Helvetica-Bold').fontSize(7.5).fillColor('#334155')
       .text('GERENTE "A y M"', signLeftX, curY + 19, { width: signW, align: 'center' });
    doc.font('Helvetica-Bold').fontSize(7.5).fillColor('#334155')
       .text('INTERESADO', signRightX, curY + 19, { width: signW, align: 'center' });

    // Finalizar el documento
    doc.end();
    
  } catch (error) {
    next(error);
  }
});

export default router;