import { useState, useEffect, useMemo, useRef } from 'react';
import { useLocation } from 'react-router-dom';
import { useForm } from 'react-hook-form';
import {
  internacionService,
  calculoService,
  anticipoService,
  handleApiError
} from '../services/api';
import { calcularPagoPreview, formatBs, formatKg } from '../utils/calculations';
import Modal from '../components/ui/Modal';
import {
  Calculator,
  Loader2,
  AlertCircle,
  Clock,
  CheckCircle,
  Check,
  FileDown,
  Banknote,
  ChevronDown,
  ChevronUp,
  Coins,
  AlertTriangle,
  Receipt,
  Printer,
  Search,
  X,
  ChevronLeft,
  ChevronRight
} from 'lucide-react';

const mineralBadge = {
  PLATA: { label: 'Plata (Ag)', badge: 'bg-blue-100 text-blue-800 border-blue-300' },
  PLATA_OXIDO: { label: 'Plata Óxido', badge: 'bg-orange-100 text-orange-800 border-orange-300' },
  PLATA_PIRITA: { label: 'Plata Pirita', badge: 'bg-yellow-100 text-yellow-800 border-yellow-300' },
  PLOMO: { label: 'Plomo (Pb)', badge: 'bg-violet-100 text-violet-800 border-violet-300' },
  PLOMO_OXIDO: { label: 'Plomo Óxido', badge: 'bg-orange-100 text-orange-900 border-orange-400' },
  PLOMO_PIRITA: { label: 'Plomo Pirita', badge: 'bg-amber-100 text-amber-900 border-amber-400' },
  ESTANO: { label: 'Estaño (Sn)', badge: 'bg-teal-100 text-teal-800 border-teal-300' },
  ESTANO_OXIDO: { label: 'Estaño Óxido', badge: 'bg-emerald-100 text-emerald-900 border-emerald-400' },
  ESTANO_PIRITA: { label: 'Estaño Pirita', badge: 'bg-lime-100 text-lime-900 border-lime-400' },
  COMPLEJO: { label: 'Complejo (Ag+Pb)', badge: 'bg-indigo-100 text-indigo-800 border-indigo-300' },
  PIRITA: { label: 'Pirita (Py)', badge: 'bg-yellow-100 text-yellow-800 border-yellow-300' },
  OXIDO: { label: 'Óxido (Ox)', badge: 'bg-orange-100 text-orange-800 border-orange-300' }
};

const getMineralLabel = (tipo) => mineralBadge[tipo]?.label || tipo;

const CalculatePay = () => {
  const location = useLocation();
  const preselectHandled = useRef(false);
  const [pendientes, setPendientes] = useState([]);
  const [calculos, setCalculos] = useState([]);
  const [selected, setSelected] = useState(null);
  const [loadingPendientes, setLoadingPendientes] = useState(true);
  const [loadingCalculos, setLoadingCalculos] = useState(true);
  const [error, setError] = useState(null);
  const [success, setSuccess] = useState(null);
  const [submitting, setSubmitting] = useState(false);
  const [showRegaliasDetalle, setShowRegaliasDetalle] = useState(false);

  // Búsqueda y paginación de pendientes de ley
  const [busquedaPendiente, setBusquedaPendiente] = useState('');
  const [filtroMineralPendiente, setFiltroMineralPendiente] = useState('');
  const [paginaPendientes, setPaginaPendientes] = useState(1);
  const ITEMS_PER_PAGE_PENDIENTES = 6;
  const formCalcRef = useRef(null);

  // Historial de anticipos en báscula del lote
  const [anticiposHistorial, setAnticiposHistorial] = useState([]);
  const [loadingAnticiposHistorial, setLoadingAnticiposHistorial] = useState(false);
  const [showAnticiposDesglose, setShowAnticiposDesglose] = useState(false);

  // Anticipos de cuenta general del proveedor (independientes)
  const [anticiposCuentaProveedor, setAnticiposCuentaProveedor] = useState([]);
  const [loadingAnticiposCuenta, setLoadingAnticiposCuenta] = useState(false);
  const [descuentosPactados, setDescuentosPactados] = useState({});
  const [modalAnticiposProveedorOpen, setModalAnticiposProveedorOpen] = useState(false);

  // Estado para confirmación de pago y descarga/impresión
  const [modalConfirmarPago, setModalConfirmarPago] = useState(null);
  const [pagandoLote, setPagandoLote] = useState(false);
  const [descargandoId, setDescargandoId] = useState(null);

  // Estado para modal de estimación de Valor de Escala (Fórmula de Escala)
  const [modalEscalaOpen, setModalEscalaOpen] = useState(false);
  const [modalEscalaData, setModalEscalaData] = useState({
    fieldName: 'valorEscala',
    ley: '',
    porcentaje: 75,
    cotizacion: 48,
    tipoCambio: 11
  });

  const { register, handleSubmit, reset, watch, setValue, formState: { errors } } = useForm({
    defaultValues: {
      humedadPorcentaje: 3,
      regaliasPorcentaje: 10,
      transporte: '',
      anticipos: '',
      ley: '',
      valorEscala: '',
      leyPlata: '',
      valorEscalaPlata: '',
      leyPlomo: '',
      valorEscalaPlomo: ''
    }
  });

  const formValues = watch();

  // Cálculo en tiempo real de la fórmula de valor de escala: (Ley * 3.215 * % * cot * tc) / 1000
  const resultadoEscalaCalculado = useMemo(() => {
    const leyNum = parseFloat(modalEscalaData.ley) || 0;
    const factorEstatico = 3.215;
    const pct = (parseFloat(modalEscalaData.porcentaje) || 0) / 100;
    const cot = parseFloat(modalEscalaData.cotizacion) || 0;
    const tc = parseFloat(modalEscalaData.tipoCambio) || 0;

    const val = (leyNum * factorEstatico * pct * cot * tc) / 1000;
    return Math.round(val);
  }, [modalEscalaData]);

  const handleOpenModalEscala = (fieldName = 'valorEscala', leyField = 'ley') => {
    const currentLey = formValues[leyField] || '';
    setModalEscalaData({
      fieldName,
      ley: currentLey,
      porcentaje: 75,
      cotizacion: 48,
      tipoCambio: 11
    });
    setModalEscalaOpen(true);
  };

  const handleAplicarEscala = (resultado) => {
    setValue(modalEscalaData.fieldName, resultado, { shouldDirty: true, shouldValidate: true });
    setModalEscalaOpen(false);
  };

  // Total descontado de cuenta del proveedor según lo tranzado
  const totalDescuentoProveedor = useMemo(() => {
    return Object.values(descuentosPactados).reduce(
      (sum, val) => sum + (Math.trunc(Number(val) || 0)),
      0
    );
  }, [descuentosPactados]);

  // Total deuda activa en cuenta del proveedor
  const totalDeudaProveedor = useMemo(() => {
    return anticiposCuentaProveedor.reduce(
      (sum, a) => sum + (Math.trunc(Number(a.saldoPendiente) || 0)),
      0
    );
  }, [anticiposCuentaProveedor]);

  // Total de anticipo a descontar (Báscula + Proveedor)
  const montoAnticipoBascula = useMemo(() => {
    if (formValues.anticipos !== undefined && formValues.anticipos !== '') {
      return Math.trunc(Number(formValues.anticipos) || 0);
    }
    return Math.trunc(Number(selected?.anticipo) || 0);
  }, [formValues.anticipos, selected]);

  const totalAnticiposAplicados = montoAnticipoBascula + totalDescuentoProveedor;

  const preview = useMemo(() => {
    if (!selected) return null;
    try {
      return calcularPagoPreview({
        kilosBruto: selected.kilosBruto,
        humedadPorcentaje: formValues.humedadPorcentaje,
        tipoMineral: selected.tipoMineral,
        ley: formValues.ley,
        valorEscala: formValues.valorEscala,
        leyPlata: formValues.leyPlata,
        valorEscalaPlata: formValues.valorEscalaPlata,
        leyPlomo: formValues.leyPlomo,
        valorEscalaPlomo: formValues.valorEscalaPlomo,
        regaliasPorcentaje: formValues.regaliasPorcentaje,
        anticipos: totalAnticiposAplicados,
        transporte: formValues.transporte
      });
    } catch {
      return null;
    }
  }, [selected, formValues, totalAnticiposAplicados]);

  // Filtro y búsqueda de pendientes de ley
  const filteredPendientes = useMemo(() => {
    let result = pendientes;

    if (filtroMineralPendiente) {
      result = result.filter((p) => {
        if (filtroMineralPendiente === 'PLATA') return p.tipoMineral?.startsWith('PLATA');
        if (filtroMineralPendiente === 'PLOMO') return p.tipoMineral?.startsWith('PLOMO');
        if (filtroMineralPendiente === 'ESTANO') return p.tipoMineral?.startsWith('ESTANO');
        if (filtroMineralPendiente === 'COMPLEJO') return p.tipoMineral === 'COMPLEJO';
        return p.tipoMineral === filtroMineralPendiente;
      });
    }

    if (busquedaPendiente.trim()) {
      const q = busquedaPendiente.trim().toLowerCase();
      result = result.filter((p) => {
        const lote = (p.lote || '').toLowerCase();
        const prov = (p.proveedor?.nombreCompleto || '').toLowerCase();
        const ci = (p.proveedor?.ci || '').toLowerCase();
        return lote.includes(q) || prov.includes(q) || ci.includes(q);
      });
    }

    return result;
  }, [pendientes, busquedaPendiente, filtroMineralPendiente]);

  const totalPaginasPendientes = Math.max(1, Math.ceil(filteredPendientes.length / ITEMS_PER_PAGE_PENDIENTES));

  const paginatedPendientes = useMemo(() => {
    const start = (paginaPendientes - 1) * ITEMS_PER_PAGE_PENDIENTES;
    return filteredPendientes.slice(start, start + ITEMS_PER_PAGE_PENDIENTES);
  }, [filteredPendientes, paginaPendientes]);

  // Si cambia el filtro o búsqueda, restablecer a la página 1
  useEffect(() => {
    setPaginaPendientes(1);
  }, [busquedaPendiente, filtroMineralPendiente]);

  const loadData = async () => {
    try {
      setLoadingPendientes(true);
      setLoadingCalculos(true);
      const [pend, calc] = await Promise.all([
        internacionService.getPendingInternaciones(),
        calculoService.getCalculos({ estadoPago: 'PENDIENTE', limit: 20 })
      ]);
      setPendientes(pend);
      setCalculos(calc.calculos);
    } catch (err) {
      setError(handleApiError(err));
    } finally {
      setLoadingPendientes(false);
      setLoadingCalculos(false);
    }
  };

  useEffect(() => {
    loadData();
  }, []);

  const selectInternacion = async (item) => {
    setSelected(item);

    // En pantallas pequeñas o medianas, auto-scroll al formulario para evitar subir/bajar tedioso
    if (formCalcRef.current && window.innerWidth < 1024) {
      setTimeout(() => {
        formCalcRef.current?.scrollIntoView({ behavior: 'smooth', block: 'start' });
      }, 50);
    }

    const totalAnticipo = Math.trunc(Number(item.anticipo) || 0);
    reset({
      humedadPorcentaje: 3,
      regaliasPorcentaje: 10,
      transporte: '',
      anticipos: totalAnticipo,
      ley: '',
      valorEscala: '',
      leyPlata: '',
      valorEscalaPlata: '',
      leyPlomo: '',
      valorEscalaPlomo: ''
    });
    setShowRegaliasDetalle(false);
    setShowAnticiposDesglose(false);
    setError(null);

    // 1. Cargar historial de anticipos en báscula del lote
    try {
      setLoadingAnticiposHistorial(true);
      const res = await anticipoService.getAnticiposByInternacion(item.id);
      setAnticiposHistorial(res.anticipos || []);
    } catch {
      setAnticiposHistorial([]);
    } finally {
      setLoadingAnticiposHistorial(false);
    }

    // 2. Consultar si el proveedor tiene anticipos pendientes en cuenta
    try {
      setLoadingAnticiposCuenta(true);
      const resProv = await anticipoService.getPendientesByProveedor(item.proveedorId);
      const lista = resProv.anticipos || [];
      setAnticiposCuentaProveedor(lista);

      const pactadosInicial = {};
      lista.forEach((a) => {
        pactadosInicial[a.id] = Math.trunc(Number(a.saldoPendiente) || 0);
      });
      setDescuentosPactados(pactadosInicial);

      // Si el proveedor tiene anticipos en cuenta, abrir la ventana de aviso
      if (lista.length > 0) {
        setModalAnticiposProveedorOpen(true);
      }
    } catch {
      setAnticiposCuentaProveedor([]);
      setDescuentosPactados({});
    } finally {
      setLoadingAnticiposCuenta(false);
    }
  };

  // Preseleccionar internación si viene desde el módulo Internar Mineral o Internaciones Realizadas
  useEffect(() => {
    const internacionId = location.state?.internacionId;
    if (!internacionId || preselectHandled.current || pendientes.length === 0) return;

    const item = pendientes.find((p) => p.id === internacionId);
    if (item) {
      // Ajustar página en la que se encuentra el lote preseleccionado
      const index = filteredPendientes.findIndex((p) => p.id === internacionId);
      if (index !== -1) {
        const targetPage = Math.floor(index / ITEMS_PER_PAGE_PENDIENTES) + 1;
        setPaginaPendientes(targetPage);
      }
      selectInternacion(item);
      preselectHandled.current = true;
      if (formCalcRef.current && window.innerWidth < 1024) {
        formCalcRef.current.scrollIntoView({ behavior: 'smooth', block: 'start' });
      }
    }
  }, [pendientes, location.state, reset, filteredPendientes]);

  const showSuccess = (msg) => {
    setSuccess(msg);
    setTimeout(() => setSuccess(null), 4000);
  };

  // Cambiar el descuento pactado de un anticipo en cuenta
  const handleCambiarDescuentoPactado = (anticipoId, monto) => {
    const item = anticiposCuentaProveedor.find((a) => a.id === anticipoId);
    const saldoMax = Math.trunc(Number(item?.saldoPendiente) || 0);
    const num = Math.min(Math.max(0, Math.trunc(Number(monto) || 0)), saldoMax);

    setDescuentosPactados((prev) => ({
      ...prev,
      [anticipoId]: num
    }));
  };

  const onSubmit = async (data) => {
    if (!selected) return;

    try {
      setSubmitting(true);
      setError(null);

      const anticiposDescontar = Object.entries(descuentosPactados)
        .map(([id, monto]) => ({
          anticipoId: parseInt(id, 10),
          montoADescontar: Math.trunc(Number(monto) || 0)
        }))
        .filter((x) => x.montoADescontar > 0);

      const payload = {
        internacionId: selected.id,
        tipoMineral: selected.tipoMineral,
        humedadPorcentaje: Math.trunc(parseFloat(data.humedadPorcentaje)),
        regaliasPorcentaje: Math.trunc(parseFloat(data.regaliasPorcentaje)),
        transporte: Math.trunc(parseFloat(data.transporte || 0)),
        anticipoBascula: montoAnticipoBascula,
        anticipoProveedor: totalDescuentoProveedor,
        anticipos: totalAnticiposAplicados,
        anticiposDescontar
      };

      if (selected.tipoMineral === 'COMPLEJO') {
        payload.leyPlata = Math.trunc(parseFloat(data.leyPlata));
        payload.valorEscalaPlata = Math.trunc(parseFloat(data.valorEscalaPlata));
        payload.leyPlomo = Math.trunc(parseFloat(data.leyPlomo));
        payload.valorEscalaPlomo = Math.trunc(parseFloat(data.valorEscalaPlomo));
      } else {
        payload.ley = Math.trunc(parseFloat(data.ley));
        payload.valorEscala = Math.trunc(parseFloat(data.valorEscala));
      }

      const result = await calculoService.createCalculo(payload);
      showSuccess(`✅ Cálculo guardado para el lote ${selected.lote} — Saldo: ${formatBs(result.calculo.saldoFinal)}`);
      setSelected(null);
      reset();
      setAnticiposCuentaProveedor([]);
      setDescuentosPactados({});
      loadData();

      // Redireccionar directamente abriendo el modal de Confirmar Pago / Imprimir
      if (result.calculo) {
        setModalConfirmarPago(result.calculo);
      }
    } catch (err) {
      setError(handleApiError(err));
    } finally {
      setSubmitting(false);
    }
  };

  // Abrir modal elegante de confirmación de pago
  const handleOpenConfirmarPago = (calculo) => {
    setModalConfirmarPago(calculo);
  };

  // Confirmar el pago (con opción de descargar/imprimir comprobante al mismo tiempo)
  const handleConfirmarPago = async (calculo, descargarComprobante = false) => {
    if (!calculo) return;
    try {
      setPagandoLote(true);
      setError(null);
      await calculoService.markAsPaid(calculo.id);
      showSuccess(`✅ Pago registrado para el lote ${calculo.internacion.lote} — ${formatBs(calculo.saldoFinal)}`);
      setModalConfirmarPago(null);
      if (descargarComprobante) {
        await handlePrintOrDownloadReceipt(calculo);
      }
      loadData();
    } catch (err) {
      setError(handleApiError(err));
    } finally {
      setPagandoLote(false);
    }
  };

  // Imprimir o descargar comprobante (abre vista previa en nueva pestaña lista para imprimir con Ctrl+P o descarga directa)
  const handlePrintOrDownloadReceipt = async (calculo) => {
    try {
      setDescargandoId(calculo.id);
      const response = await calculoService.generateReceipt(calculo.id);
      const blob = new Blob([response.data], { type: 'application/pdf' });
      const url = window.URL.createObjectURL(blob);
      const printWindow = window.open(url, '_blank');
      if (!printWindow) {
        const link = document.createElement('a');
        link.href = url;
        link.download = `comprobante-${calculo.internacion.lote}.pdf`;
        link.click();
      }
      setTimeout(() => window.URL.revokeObjectURL(url), 60000);
    } catch (err) {
      setError(handleApiError(err));
    } finally {
      setDescargandoId(null);
    }
  };

  const handleMarkPaid = handleOpenConfirmarPago;
  const handleDownloadReceipt = handlePrintOrDownloadReceipt;

  const isComplejo = selected?.tipoMineral === 'COMPLEJO';

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-3xl font-bold text-gray-900">Calcular Pago</h1>
        <p className="mt-1 text-gray-600">
          Ingresa la ley del laboratorio y calcula el pago al proveedor
        </p>
      </div>

      {error && (
        <div className="flex items-start gap-3 rounded-lg border border-red-200 bg-red-50 p-4">
          <AlertCircle className="h-5 w-5 shrink-0 text-red-500" />
          <p className="text-sm text-red-700">{error}</p>
        </div>
      )}

      {success && (
        <div className="flex items-center gap-2 rounded-lg border border-green-200 bg-green-50 p-4 text-sm text-green-800">
          <CheckCircle className="h-5 w-5 text-green-600" />
          <span>{success}</span>
        </div>
      )}

      <div className="grid grid-cols-1 gap-6 lg:grid-cols-3">
        {/* Lotes pendientes */}
        <div className="card flex flex-col h-fit">
          <div className="card-header pb-3 border-b border-gray-100">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-2">
                <div className="p-1.5 rounded-lg bg-amber-50 text-amber-600 border border-amber-200">
                  <Clock className="h-4 w-4" />
                </div>
                <div>
                  <h2 className="card-title text-base font-bold text-gray-900">Pendientes de Ley</h2>
                  <p className="text-xs text-gray-500">Lotes en espera de liquidación</p>
                </div>
              </div>
              <span className="inline-flex items-center px-2 py-0.5 rounded-full text-xs font-semibold bg-primary-50 text-primary-700 border border-primary-200">
                {filteredPendientes.length} {filteredPendientes.length === 1 ? 'lote' : 'lotes'}
              </span>
            </div>

            {/* Barra de Búsqueda y Filtro de Mineral */}
            <div className="mt-3 space-y-2">
              <div className="relative">
                <Search className="absolute left-2.5 top-1/2 -translate-y-1/2 h-3.5 w-3.5 text-gray-400" />
                <input
                  type="text"
                  value={busquedaPendiente}
                  onChange={(e) => setBusquedaPendiente(e.target.value)}
                  placeholder="Buscar por lote, proveedor, CI..."
                  className="w-full pl-8 pr-7 py-1.5 text-xs rounded-lg border border-gray-200 bg-gray-50/70 focus:bg-white focus:border-primary-500 focus:ring-1 focus:ring-primary-500 outline-none transition-all"
                />
                {busquedaPendiente && (
                  <button
                    type="button"
                    onClick={() => setBusquedaPendiente('')}
                    className="absolute right-2 top-1/2 -translate-y-1/2 text-gray-400 hover:text-gray-600 p-0.5"
                    title="Limpiar búsqueda"
                  >
                    <X className="h-3 w-3" />
                  </button>
                )}
              </div>

              {/* Filtro rápido por mineral */}
              <div className="flex items-center gap-1 overflow-x-auto pb-1 text-xs scrollbar-thin">
                <button
                  type="button"
                  onClick={() => setFiltroMineralPendiente('')}
                  className={`px-2 py-0.5 rounded-md text-[11px] font-medium transition-colors shrink-0 ${
                    !filtroMineralPendiente
                      ? 'bg-primary-600 text-white font-semibold shadow-xs'
                      : 'bg-gray-100 text-gray-600 hover:bg-gray-200'
                  }`}
                >
                  Todos
                </button>
                <button
                  type="button"
                  onClick={() => setFiltroMineralPendiente('PLATA')}
                  className={`px-2 py-0.5 rounded-md text-[11px] font-medium transition-colors shrink-0 ${
                    filtroMineralPendiente === 'PLATA'
                      ? 'bg-blue-600 text-white font-semibold shadow-xs'
                      : 'bg-blue-50 text-blue-700 hover:bg-blue-100'
                  }`}
                >
                  Plata
                </button>
                <button
                  type="button"
                  onClick={() => setFiltroMineralPendiente('PLOMO')}
                  className={`px-2 py-0.5 rounded-md text-[11px] font-medium transition-colors shrink-0 ${
                    filtroMineralPendiente === 'PLOMO'
                      ? 'bg-violet-600 text-white font-semibold shadow-xs'
                      : 'bg-violet-50 text-violet-700 hover:bg-violet-100'
                  }`}
                >
                  Plomo
                </button>
                <button
                  type="button"
                  onClick={() => setFiltroMineralPendiente('ESTANO')}
                  className={`px-2 py-0.5 rounded-md text-[11px] font-medium transition-colors shrink-0 ${
                    filtroMineralPendiente === 'ESTANO'
                      ? 'bg-teal-600 text-white font-semibold shadow-xs'
                      : 'bg-teal-50 text-teal-700 hover:bg-teal-100'
                  }`}
                >
                  Estaño
                </button>
                <button
                  type="button"
                  onClick={() => setFiltroMineralPendiente('COMPLEJO')}
                  className={`px-2 py-0.5 rounded-md text-[11px] font-medium transition-colors shrink-0 ${
                    filtroMineralPendiente === 'COMPLEJO'
                      ? 'bg-indigo-600 text-white font-semibold shadow-xs'
                      : 'bg-indigo-50 text-indigo-700 hover:bg-indigo-100'
                  }`}
                >
                  Complejo
                </button>
              </div>
            </div>
          </div>

          {/* Contenido de la lista */}
          <div className="flex-1">
            {loadingPendientes ? (
              <div className="flex flex-col items-center justify-center py-10 text-gray-400">
                <Loader2 className="h-6 w-6 animate-spin text-primary-600 mb-2" />
                <span className="text-xs">Cargando pendientes...</span>
              </div>
            ) : filteredPendientes.length === 0 ? (
              <div className="py-8 px-4 text-center">
                <p className="text-sm font-medium text-gray-500">No se encontraron lotes</p>
                <p className="text-xs text-gray-400 mt-1">
                  {busquedaPendiente || filtroMineralPendiente
                    ? 'Prueba modificando los filtros de búsqueda'
                    : 'No hay internaciones pendientes de ley'}
                </p>
                {(busquedaPendiente || filtroMineralPendiente) && (
                  <button
                    type="button"
                    onClick={() => {
                      setBusquedaPendiente('');
                      setFiltroMineralPendiente('');
                    }}
                    className="mt-3 text-xs text-primary-600 hover:text-primary-800 font-semibold underline"
                  >
                    Restablecer filtros
                  </button>
                )}
              </div>
            ) : (
              <ul className="divide-y divide-gray-100">
                {paginatedPendientes.map((item) => {
                  const isItemActive = selected?.id === item.id;
                  return (
                    <li
                      key={item.id}
                      onClick={() => selectInternacion(item)}
                      className={`cursor-pointer p-3 transition-all duration-150 ${
                        isItemActive
                          ? 'bg-primary-50/90 border-l-4 border-primary-600 shadow-2xs'
                          : 'hover:bg-slate-50/80 border-l-4 border-transparent'
                      }`}
                    >
                      <div className="flex justify-between items-start gap-2">
                        <div className="flex items-center gap-1.5 min-w-0">
                          <span className={`font-mono text-sm font-bold ${isItemActive ? 'text-primary-800' : 'text-gray-900'}`}>
                            {item.lote}
                          </span>
                          {isItemActive && (
                            <span className="text-[10px] bg-primary-600 text-white px-1.5 py-0.2 rounded font-semibold">
                              Activo
                            </span>
                          )}
                        </div>
                        <span className={`badge text-[10px] py-0.5 px-2 font-mono font-bold shrink-0 ${mineralBadge[item.tipoMineral]?.badge || 'badge-warning'}`}>
                          {getMineralLabel(item.tipoMineral)}
                        </span>
                      </div>

                      <p className="text-xs text-gray-600 font-medium truncate mt-1">
                        {item.proveedor?.nombreCompleto}
                      </p>

                      <div className="mt-1.5 flex justify-between items-center text-[11px] text-gray-500 border-t border-gray-100/60 pt-1">
                        <span className="font-semibold text-gray-700">{formatKg(item.kilosBruto)}</span>
                        {Number(item.anticipo) > 0 ? (
                          <span className="text-amber-700 font-semibold bg-amber-50 px-1.5 py-0.2 rounded border border-amber-200">
                            Anticipo: {formatBs(item.anticipo)}
                          </span>
                        ) : (
                          <span className="text-gray-400">Sin anticipo</span>
                        )}
                      </div>
                    </li>
                  );
                })}
              </ul>
            )}
          </div>

          {/* Paginación */}
          {filteredPendientes.length > ITEMS_PER_PAGE_PENDIENTES && (
            <div className="p-2.5 bg-gray-50/80 border-t border-gray-200 flex items-center justify-between text-xs text-gray-600">
              <span className="text-[11px] text-gray-500 font-medium">
                Pág. <strong className="text-gray-800">{paginaPendientes}</strong> de {totalPaginasPendientes} ({filteredPendientes.length} lotes)
              </span>
              <div className="flex items-center gap-1">
                <button
                  type="button"
                  onClick={() => setPaginaPendientes((p) => Math.max(1, p - 1))}
                  disabled={paginaPendientes <= 1}
                  className="p-1 rounded hover:bg-white border border-gray-200 disabled:opacity-30 disabled:pointer-events-none transition-colors"
                  title="Página anterior"
                >
                  <ChevronLeft className="h-3.5 w-3.5" />
                </button>
                <button
                  type="button"
                  onClick={() => setPaginaPendientes((p) => Math.min(totalPaginasPendientes, p + 1))}
                  disabled={paginaPendientes >= totalPaginasPendientes}
                  className="p-1 rounded hover:bg-white border border-gray-200 disabled:opacity-30 disabled:pointer-events-none transition-colors"
                  title="Página siguiente"
                >
                  <ChevronRight className="h-3.5 w-3.5" />
                </button>
              </div>
            </div>
          )}
        </div>

        {/* Formulario de cálculo */}
        <div ref={formCalcRef} className="card lg:col-span-2">
          {!selected ? (
            <div className="flex flex-col items-center justify-center py-16 text-gray-400">
              <Calculator className="h-16 w-16 mb-4 text-gray-300" />
              <p className="text-base font-medium text-gray-600">Selecciona un lote para calcular el pago</p>
              <p className="text-sm text-gray-400">Los datos se cargarán automáticamente</p>
            </div>
          ) : (
            <>
              <div className="card-header">
                <div className="flex justify-between items-start">
                  <div>
                    <h2 className="card-title text-lg">
                      Calcular lote: <span className="font-mono text-primary-600">{selected.lote}</span>
                    </h2>
                    <p className="text-sm text-gray-500">
                      Proveedor: <strong className="text-gray-800">{selected.proveedor?.nombreCompleto}</strong> (CI: {selected.proveedor?.ci})
                    </p>
                  </div>
                  <span className={`badge font-mono font-bold ${mineralBadge[selected.tipoMineral]?.badge || 'badge-info'}`}>
                    {getMineralLabel(selected.tipoMineral)} - {formatKg(selected.kilosBruto)}
                  </span>
                </div>
              </div>

              <form onSubmit={handleSubmit(onSubmit)} className="card-content space-y-4">
                {selected.tipoMineral !== 'COMPLEJO' ? (
                  <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
                    <div>
                      <label className="mb-1 block text-sm font-medium text-gray-700">
                        Ley ({selected.tipoMineral.startsWith('PLOMO') || selected.tipoMineral.startsWith('ESTANO') ? '%' : 'DM'}) *
                      </label>
                      <input
                        type="number"
                        step="1"
                        {...register('ley', { required: 'Requerido', min: 1 })}
                        onFocus={(e) => e.target.select()}
                        className={`input ${errors.ley ? 'input-error' : ''}`}
                        placeholder="Ej: 95"
                      />
                      {errors.ley && (
                        <p className="mt-1 text-sm text-red-600">{errors.ley.message}</p>
                      )}
                    </div>
                    <div>
                      <div className="flex items-center justify-between mb-1">
                        <label className="text-sm font-medium text-gray-700">
                          Valor escala *
                        </label>
                        <button
                          type="button"
                          onClick={() => handleOpenModalEscala('valorEscala', 'ley')}
                          className="text-xs font-semibold text-primary-600 hover:text-primary-800 flex items-center gap-1 hover:underline transition-colors"
                          title="Calcular estimación con fórmula (Ley × 3.215 × % × cot × tc ÷ 1000)"
                        >
                          <Calculator className="h-3.5 w-3.5" />
                          <span>Estimar escala</span>
                        </button>
                      </div>
                      <input
                        type="number"
                        step="1"
                        {...register('valorEscala', { required: 'Requerido', min: 1 })}
                        onFocus={(e) => e.target.select()}
                        className={`input ${errors.valorEscala ? 'input-error' : ''}`}
                        placeholder="Ej: 140"
                      />
                      {errors.valorEscala && (
                        <p className="mt-1 text-sm text-red-600">{errors.valorEscala.message}</p>
                      )}
                    </div>
                  </div>
                ) : (
                  <div className="space-y-4">
                    <p className="text-sm font-medium text-gray-700">Plata</p>
                    <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
                      <div>
                        <label className="mb-1 block text-sm text-gray-600">Ley plata (DM) *</label>
                        <input
                          type="number"
                          step="1"
                          {...register('leyPlata', { required: 'Requerido', min: 1 })}
                          onFocus={(e) => e.target.select()}
                          className={`input ${errors.leyPlata ? 'input-error' : ''}`}
                          placeholder="Ej: 95"
                        />
                      </div>
                      <div>
                        <div className="flex items-center justify-between mb-1">
                          <label className="text-sm text-gray-600">Valor escala plata *</label>
                          <button
                            type="button"
                            onClick={() => handleOpenModalEscala('valorEscalaPlata', 'leyPlata')}
                            className="text-xs font-semibold text-primary-600 hover:text-primary-800 flex items-center gap-1 hover:underline"
                            title="Calcular estimación para plata"
                          >
                            <Calculator className="h-3 w-3" />
                            <span>Estimar</span>
                          </button>
                        </div>
                        <input
                          type="number"
                          step="1"
                          {...register('valorEscalaPlata', { required: 'Requerido', min: 1 })}
                          onFocus={(e) => e.target.select()}
                          className={`input ${errors.valorEscalaPlata ? 'input-error' : ''}`}
                          placeholder="Ej: 140"
                        />
                      </div>
                    </div>
                    <p className="text-sm font-medium text-gray-700">Plomo</p>
                    <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
                      <div>
                        <label className="mb-1 block text-sm text-gray-600">Ley plomo (DM) *</label>
                        <input
                          type="number"
                          step="1"
                          {...register('leyPlomo', { required: 'Requerido', min: 1 })}
                          onFocus={(e) => e.target.select()}
                          className={`input ${errors.leyPlomo ? 'input-error' : ''}`}
                          placeholder="Ej: 20"
                        />
                      </div>
                      <div>
                        <div className="flex items-center justify-between mb-1">
                          <label className="text-sm text-gray-600">Valor escala plomo *</label>
                          <button
                            type="button"
                            onClick={() => handleOpenModalEscala('valorEscalaPlomo', 'leyPlomo')}
                            className="text-xs font-semibold text-primary-600 hover:text-primary-800 flex items-center gap-1 hover:underline"
                            title="Calcular estimación para plomo"
                          >
                            <Calculator className="h-3 w-3" />
                            <span>Estimar</span>
                          </button>
                        </div>
                        <input
                          type="number"
                          step="1"
                          {...register('valorEscalaPlomo', { required: 'Requerido', min: 1 })}
                          onFocus={(e) => e.target.select()}
                          className={`input ${errors.valorEscalaPlomo ? 'input-error' : ''}`}
                          placeholder="Ej: 2"
                        />
                      </div>
                    </div>
                  </div>
                )}

                <div className="grid grid-cols-1 gap-4 sm:grid-cols-3">
                  <div>
                    <label className="mb-1 block text-sm font-medium text-gray-700">Humedad % *</label>
                    <input
                      type="number"
                      step="1"
                      min="0"
                      max="100"
                      {...register('humedadPorcentaje', { required: true, min: 0, max: 100 })}
                      onFocus={(e) => e.target.select()}
                      className="input"
                    />
                  </div>
                  <div>
                    <label className="mb-1 block text-sm font-medium text-gray-700">Regalías %</label>
                    <input
                      type="number"
                      step="1"
                      min="0"
                      {...register('regaliasPorcentaje')}
                      onFocus={(e) => e.target.select()}
                      className="input"
                    />
                  </div>
                  <div>
                    <label className="mb-1 block text-sm font-medium text-gray-700">Transporte (Bs)</label>
                    <input
                      type="number"
                      step="1"
                      min="0"
                      {...register('transporte')}
                      onFocus={(e) => e.target.select()}
                      className="input"
                      placeholder="0"
                    />
                  </div>
                </div>

                {/* Control de Anticipos a Descontar (Diseño Compacto con Distintivo Verde-Ámbar) */}
                <div className="rounded-xl border border-emerald-300/80 bg-gradient-to-br from-emerald-50/70 via-teal-50/30 to-amber-50/60 p-3.5 space-y-3 shadow-2xs">
                  {/* Fila principal: Título, monto en báscula y botones de acción rápida */}
                  <div className="flex flex-wrap items-center justify-between gap-2">
                    <div className="flex items-center gap-2">
                      <div className="p-1.5 rounded-lg bg-emerald-100/80 text-emerald-800 border border-emerald-300">
                        <Coins className="h-4 w-4" />
                      </div>
                      <div>
                        <h4 className="text-sm font-semibold text-gray-900">
                          Anticipos a Descontar
                        </h4>
                        <p className="text-xs text-gray-600">
                          En báscula:{' '}
                          <strong className="text-emerald-800 font-mono font-bold">
                            {formatBs(selected.anticipo)}
                          </strong>
                        </p>
                      </div>
                    </div>

                    {/* Botones de acción rápida y botón de historial */}
                    <div className="flex items-center gap-1.5">
                      <button
                        type="button"
                        onClick={() => setValue('anticipos', Math.trunc(Number(selected.anticipo) || 0), { shouldDirty: true })}
                        className="px-2.5 py-1 text-xs font-semibold rounded border border-emerald-400 bg-emerald-100/90 text-emerald-900 hover:bg-emerald-200 transition-colors shadow-2xs"
                        title="Descontar el total de anticipos entregados"
                      >
                        Todo ({formatBs(selected.anticipo)})
                      </button>
                      <button
                        type="button"
                        onClick={() => setValue('anticipos', 0, { shouldDirty: true })}
                        className="px-2.5 py-1 text-xs font-medium rounded border border-gray-300 bg-white/90 text-gray-700 hover:bg-gray-100 transition-colors shadow-2xs"
                        title="No descontar anticipo en este cálculo"
                      >
                        Bs 0
                      </button>
                      {anticiposHistorial.length > 0 && (
                        <button
                          type="button"
                          onClick={() => setShowAnticiposDesglose(!showAnticiposDesglose)}
                          className="ml-1 px-2 py-1 text-xs font-medium text-emerald-900 hover:text-emerald-950 border border-emerald-300/80 rounded bg-white/90 hover:bg-emerald-50 flex items-center gap-1 transition-colors shadow-2xs"
                          title="Ver o esconder historial de entregas"
                        >
                          <span>Historial ({anticiposHistorial.length})</span>
                          {showAnticiposDesglose ? <ChevronUp className="h-3 w-3" /> : <ChevronDown className="h-3 w-3" />}
                        </button>
                      )}
                    </div>
                  </div>

                  {/* Fila de Input y estado en línea */}
                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 items-center pt-1 border-t border-emerald-200/50">
                    <div>
                      <label className="block text-xs font-medium text-gray-700 mb-1">
                        Monto a descontar hoy (Bs) *
                      </label>
                      <input
                        type="number"
                        min="0"
                        step="1"
                        {...register('anticipos', { min: 0 })}
                        className="input bg-white text-sm font-semibold text-gray-900 border-emerald-300 focus:bg-white focus:border-emerald-600 focus:ring-1 focus:ring-emerald-600"
                        placeholder="0"
                      />
                    </div>

                    {/* Estado contextual compacto */}
                    <div className="text-xs pt-1 sm:pt-4">
                      {Number(selected.anticipo) === 0 && Number(formValues.anticipos || 0) === 0 ? (
                        <span className="inline-flex items-center gap-1 text-gray-500">
                          ℹ️ Lote sin anticipos entregados en báscula.
                        </span>
                      ) : Number(formValues.anticipos || 0) < Number(selected.anticipo) ? (
                        <div className="rounded border border-amber-200 bg-amber-50/80 px-2.5 py-1.5 text-[11px] text-amber-800 flex items-center justify-between">
                          <span>⚠️ <strong>Saldo pendiente:</strong></span>
                          <span className="font-mono font-bold text-amber-900">
                            {formatBs(Number(selected.anticipo) - Number(formValues.anticipos || 0))}
                          </span>
                        </div>
                      ) : Number(formValues.anticipos || 0) === Number(selected.anticipo) ? (
                        <div className="rounded border border-emerald-200 bg-emerald-50/70 px-2.5 py-1.5 text-[11px] text-emerald-800 flex items-center gap-1.5">
                          <Check className="h-3.5 w-3.5 text-emerald-600 shrink-0" />
                          <span>Se descuenta el 100% del anticipo de báscula.</span>
                        </div>
                      ) : (
                        <div className="rounded border border-blue-200 bg-blue-50/70 px-2.5 py-1.5 text-[11px] text-blue-800">
                          ℹ️ Monto mayor al anticipo inicial registrado.
                        </div>
                      )}
                    </div>
                  </div>

                  {/* AVISO / BOTÓN DE ANTICIPOS EN CUENTA DEL PROVEEDOR */}
                  {anticiposCuentaProveedor.length > 0 && (
                    <div className="rounded-md border border-amber-200 bg-amber-50/70 p-2.5 flex flex-wrap items-center justify-between gap-2">
                      <div className="flex items-center gap-2">
                        <AlertTriangle className="h-4 w-4 text-amber-600 shrink-0" />
                        <div className="text-xs text-amber-900">
                          <span>Proveedor con anticipos en cuenta general.</span>
                          <span className="ml-1 text-[11px] text-amber-700">
                            (Deuda: <strong>{formatBs(totalDeudaProveedor)}</strong> • Descontar: <strong className="text-emerald-700">{formatBs(totalDescuentoProveedor)}</strong>)
                          </span>
                        </div>
                      </div>

                      <button
                        type="button"
                        onClick={() => setModalAnticiposProveedorOpen(true)}
                        className="btn btn-secondary btn-sm border-amber-300 text-amber-900 hover:bg-amber-100 text-xs font-semibold px-2.5 py-1 inline-flex items-center gap-1"
                      >
                        <Receipt className="h-3 w-3" />
                        <span>Tranzar Cuenta ({anticiposCuentaProveedor.length})</span>
                      </button>
                    </div>
                  )}

                  {/* Historial colapsable de entregas en báscula */}
                  {anticiposHistorial.length > 0 && showAnticiposDesglose && (
                    <div className="border-t border-slate-100 pt-2.5">
                      <div className="flex items-center justify-between mb-1.5">
                        <span className="text-xs font-semibold text-gray-700">
                          Historial de entregas en báscula ({anticiposHistorial.length}):
                        </span>
                      </div>
                      <div className="overflow-x-auto rounded border border-gray-200 bg-white">
                        <table className="table text-xs">
                          <thead className="table-header">
                            <tr className="table-header-row bg-gray-50 text-gray-600">
                              <th className="table-header-cell py-1.5">Fecha</th>
                              <th className="table-header-cell py-1.5">Motivo</th>
                              <th className="table-header-cell py-1.5">Operador</th>
                              <th className="table-header-cell py-1.5 text-right">Monto</th>
                            </tr>
                          </thead>
                          <tbody className="table-body">
                            {anticiposHistorial.map((a) => (
                              <tr key={a.id} className="table-row">
                                <td className="table-cell py-1.5 font-mono text-gray-600">
                                  {new Date(a.fecha).toLocaleDateString('es-BO')}
                                </td>
                                <td className="table-cell py-1.5">{a.glosa || a.observacion || 'Adelanto en efectivo'}</td>
                                <td className="table-cell py-1.5 text-gray-500">{a.usuario?.nombre || 'Balanza'}</td>
                                <td className="table-cell py-1.5 text-right font-mono font-bold text-emerald-700">
                                  {formatBs(a.monto)}
                                </td>
                              </tr>
                            ))}
                          </tbody>
                        </table>
                      </div>
                    </div>
                  )}
                </div>

                {/* VISTA PREVIA DEL CÁLCULO — CON BLOQUE COLAPSABLE EXACTO DE REGALÍAS */}
                {preview && (
                  <div className="rounded-lg border border-gray-200 bg-gray-50 p-4">
                    <h3 className="mb-3 text-sm font-semibold text-gray-800">Vista previa del cálculo</h3>
                    <dl className="space-y-2 text-sm">
                      <div className="flex justify-between">
                        <dt className="text-gray-600">Kilos neto</dt>
                        <dd className="font-medium">{formatKg(preview.kilosNeto)}</dd>
                      </div>
                      <div className="flex justify-between">
                        <dt className="text-gray-600">Valor escala {isComplejo ? 'total' : ''}</dt>
                        <dd className="font-medium">{preview.valorEscalaTotal}</dd>
                      </div>
                      <div className="flex justify-between border-t border-gray-200 pt-2">
                        <dt className="text-gray-600">Valor bruto</dt>
                        <dd className="font-semibold">{formatBs(preview.valorBruto)}</dd>
                      </div>

                      {/* Pestaña colapsable de Regalías */}
                      <div className="rounded-md border border-gray-200 bg-white overflow-hidden my-1">
                        <button
                          type="button"
                          onClick={() => setShowRegaliasDetalle((prev) => !prev)}
                          className="w-full flex items-center justify-between px-3 py-1.5 text-xs font-medium text-gray-700 hover:bg-gray-100 transition-colors"
                        >
                          <span className="flex items-center gap-1.5">
                            <span className="font-semibold text-gray-800">🏷️ Detalle de Regalías ({formValues.regaliasPorcentaje || 0}%)</span>
                            <span className="text-[11px] text-gray-500">
                              {showRegaliasDetalle ? '· Clic para ocultar' : '· Clic para ver resultado'}
                            </span>
                          </span>
                          {showRegaliasDetalle ? (
                            <ChevronUp className="h-4 w-4 text-gray-500" />
                          ) : (
                            <ChevronDown className="h-4 w-4 text-gray-500" />
                          )}
                        </button>
                        {showRegaliasDetalle && (
                          <div className="flex justify-between border-t border-gray-100 px-3 py-2 text-xs bg-red-50/50 text-red-700">
                            <dt className="font-medium">(-) Regalías calculadas ({formValues.regaliasPorcentaje}%)</dt>
                            <dd className="font-semibold">- {formatBs(preview.regaliasMonto)}</dd>
                          </div>
                        )}
                      </div>

                      {/* Descuento por Anticipo de Báscula */}
                      <div className={`flex justify-between ${montoAnticipoBascula > 0 ? 'text-red-700' : 'text-gray-600'}`}>
                        <dt>(-) Anticipo Báscula descontado</dt>
                        <dd className="font-medium">
                          {montoAnticipoBascula > 0 ? `- ${formatBs(montoAnticipoBascula)}` : formatBs(0)}
                        </dd>
                      </div>

                      {/* Descuento por Anticipos en Cuenta si existen */}
                      {totalDescuentoProveedor > 0 && (
                        <div className="flex justify-between text-red-700">
                          <dt>(-) Anticipos Cuenta Proveedor descontados</dt>
                          <dd className="font-medium">- {formatBs(totalDescuentoProveedor)}</dd>
                        </div>
                      )}

                      {Number(formValues.transporte) > 0 && (
                        <div className="flex justify-between text-green-700">
                          <dt>(+) Transporte</dt>
                          <dd>+ {formatBs(formValues.transporte)}</dd>
                        </div>
                      )}

                      {/* Saldo Final con Diferenciación Visual Inteligente (Positivo / Negativo) */}
                      <div className={`mt-3 rounded-xl p-3 border-2 transition-all ${
                        preview.saldoFinal < 0
                          ? 'bg-red-50/90 border-red-300 text-red-950 shadow-xs'
                          : preview.saldoFinal > 0
                          ? 'bg-emerald-50/90 border-emerald-300 text-emerald-950 shadow-xs'
                          : 'bg-gray-100 border-gray-300 text-gray-800'
                      }`}>
                        <div className="flex flex-wrap items-center justify-between gap-2">
                          <div>
                            <dt className="text-xs uppercase font-extrabold tracking-wider flex items-center gap-1.5">
                              {preview.saldoFinal < 0 ? (
                                <>
                                  <AlertTriangle className="h-4 w-4 text-red-600 shrink-0" />
                                  <span className="text-red-800 font-bold">Saldo Negativo (Déficit / En contra)</span>
                                </>
                              ) : preview.saldoFinal > 0 ? (
                                <>
                                  <CheckCircle className="h-4 w-4 text-emerald-600 shrink-0" />
                                  <span className="text-emerald-800 font-bold">Saldo Positivo (A pagar)</span>
                                </>
                              ) : (
                                <span>Saldo Liquidado (Bs 0)</span>
                              )}
                            </dt>
                          </div>
                          <dd className={`text-xl font-black font-mono tracking-tight px-3 py-1 rounded-lg ${
                            preview.saldoFinal < 0
                              ? 'text-red-700 bg-white border border-red-300 shadow-2xs'
                              : preview.saldoFinal > 0
                              ? 'text-emerald-700 bg-white border border-emerald-300 shadow-2xs'
                              : 'text-gray-800 bg-white border border-gray-300'
                          }`}>
                            {formatBs(preview.saldoFinal)}
                          </dd>
                        </div>
                      </div>
                    </dl>
                  </div>
                )}

                <div className="flex justify-end gap-2">
                  <button
                    type="button"
                    onClick={() => {
                      setSelected(null);
                      setAnticiposCuentaProveedor([]);
                      setDescuentosPactados({});
                    }}
                    className="btn btn-secondary btn-md"
                  >
                    Cancelar
                  </button>
                  <button type="submit" disabled={submitting} className="btn btn-primary btn-md">
                    {submitting ? (
                      <>
                        <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                        Guardando...
                      </>
                    ) : (
                      <>
                        <Calculator className="mr-2 h-4 w-4" />
                        Guardar cálculo
                      </>
                    )}
                  </button>
                </div>
              </form>
            </>
          )}
        </div>
      </div>

      {/* VENTANA EMERGENTE DE TRANZA DE ANTICIPOS DE CUENTA */}
      {modalAnticiposProveedorOpen && selected && (
        <Modal
          open={modalAnticiposProveedorOpen}
          onClose={() => setModalAnticiposProveedorOpen(false)}
          title={`Anticipos en Cuenta — ${selected.proveedor?.nombreCompleto}`}
        >
          <div className="space-y-4">
            <div className="bg-amber-50 border border-amber-200 rounded-lg p-3 text-xs text-amber-900">
              <p className="font-bold flex items-center gap-1.5 mb-1">
                <AlertTriangle className="h-4 w-4 text-amber-600" />
                <span>Anticipos Pendientes de Oficina / Caja</span>
              </p>
              <p>
                Este proveedor tiene <strong>{anticiposCuentaProveedor.length} anticipo(s)</strong> en cuenta con un saldo pendiente de{' '}
                <strong className="text-amber-950 font-mono text-sm">{formatBs(totalDeudaProveedor)}</strong>.
                Indica cuánto deseas descontar en esta liquidación. El saldo no descontado se mantendrá guardado para sus siguientes lotes.
              </p>
            </div>

            <div className="space-y-2.5 max-h-[350px] overflow-y-auto">
              {anticiposCuentaProveedor.map((ant) => {
                const saldo = Math.trunc(Number(ant.saldoPendiente) || 0);
                const pactado = descuentosPactados[ant.id] !== undefined ? descuentosPactados[ant.id] : saldo;
                const quedara = Math.max(0, saldo - pactado);

                return (
                  <div key={ant.id} className="p-3 bg-white border border-gray-200 rounded-lg space-y-2">
                    <div className="flex items-center justify-between text-xs">
                      <div>
                        <span className="font-mono font-bold text-gray-900 mr-2">{ant.codigoVale}</span>
                        <span className="text-gray-500 font-mono">
                          {new Date(ant.fecha).toLocaleDateString('es-BO')}
                        </span>
                      </div>
                      <span className="badge bg-amber-100 text-amber-900 font-mono font-bold text-xs">
                        Saldo: {formatBs(saldo)}
                      </span>
                    </div>

                    <p className="text-xs text-gray-700 bg-gray-50 p-2 rounded">
                      {ant.glosa}
                    </p>

                    <div className="grid grid-cols-2 gap-3 items-center pt-1 border-t border-gray-100 text-xs">
                      <div>
                        <label className="block text-[11px] font-bold text-gray-700 mb-1">
                          Descontar en este lote (Bs):
                        </label>
                        <input
                          type="number"
                          min="0"
                          max={saldo}
                          value={pactado}
                          onChange={(e) => handleCambiarDescuentoPactado(ant.id, e.target.value)}
                          className="input input-sm text-xs font-mono font-bold w-full bg-white border-amber-300"
                        />
                      </div>
                      <div className="flex items-center gap-1.5 pt-4">
                        <button
                          type="button"
                          onClick={() => handleCambiarDescuentoPactado(ant.id, saldo)}
                          className="btn btn-secondary btn-sm text-[11px] px-2 py-1"
                        >
                          Todo ({formatBs(saldo)})
                        </button>
                        <button
                          type="button"
                          onClick={() => handleCambiarDescuentoPactado(ant.id, 0)}
                          className="btn btn-secondary btn-sm text-[11px] px-2 py-1"
                        >
                          Bs 0
                        </button>
                      </div>
                    </div>

                    <div className="flex items-center justify-between text-xs bg-slate-50 p-2 rounded text-slate-700 font-mono">
                      <span>Saldo que quedará para el futuro:</span>
                      <strong className={quedara > 0 ? 'text-amber-800' : 'text-emerald-700'}>
                        {formatBs(quedara)} {quedara === 0 && '✅ (Cobrado al 100%)'}
                      </strong>
                    </div>
                  </div>
                );
              })}
            </div>

            {/* Resumen Total */}
            <div className="rounded-lg bg-gray-900 text-white p-3 flex items-center justify-between text-xs font-mono">
              <div>
                <span className="text-gray-400 block text-[10px]">TOTAL A DESCONTAR HOY:</span>
                <span className="text-emerald-400 font-bold text-sm">{formatBs(totalDescuentoProveedor)}</span>
              </div>
              <div className="text-right">
                <span className="text-gray-400 block text-[10px]">SALDO PENDIENTE RESTANTE:</span>
                <span className="text-amber-400 font-bold text-sm">
                  {formatBs(Math.max(0, totalDeudaProveedor - totalDescuentoProveedor))}
                </span>
              </div>
            </div>

            <div className="flex justify-end pt-2 border-t border-gray-100">
              <button
                type="button"
                onClick={() => setModalAnticiposProveedorOpen(false)}
                className="btn btn-primary btn-sm text-xs px-4"
              >
                Aceptar y Aplicar al Cálculo
              </button>
            </div>
          </div>
        </Modal>
      )}

      {/* MODAL SIMPLE PARA ESTIMAR VALOR DE ESCALA */}
      {modalEscalaOpen && (
        <Modal
          open={modalEscalaOpen}
          onClose={() => setModalEscalaOpen(false)}
          title="Calculadora Rápida de Valor de Escala"
          size="md"
        >
          <div className="space-y-4">
            <div className="rounded-lg bg-blue-50 border border-blue-200 p-3 text-xs text-blue-900">
              <p className="font-bold flex items-center gap-1.5 mb-0.5">
                <Calculator className="h-4 w-4 text-blue-600" />
                <span>Fórmula de Estimación:</span>
              </p>
              <p className="font-mono text-[11px] text-blue-800">
                (Ley × 3.215 × % Recuperación × Cotización × Tipo de Cambio) ÷ 1000
              </p>
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 text-xs">
              {/* Ley */}
              <div>
                <label className="block font-semibold text-gray-700 mb-1">
                  Ley (DM / %):
                </label>
                <input
                  type="number"
                  step="any"
                  value={modalEscalaData.ley}
                  onChange={(e) => setModalEscalaData((prev) => ({ ...prev, ley: e.target.value }))}
                  onFocus={(e) => e.target.select()}
                  className="input input-sm text-xs font-mono font-bold w-full"
                  placeholder="Ej: 30"
                />
              </div>

              {/* Factor Estático */}
              <div>
                <label className="block font-semibold text-gray-700 mb-1">
                  Factor Fijo:
                </label>
                <input
                  type="text"
                  readOnly
                  value="3.215 (estático)"
                  className="input input-sm text-xs font-mono bg-gray-100 text-gray-600 cursor-not-allowed w-full border-gray-200"
                />
              </div>

              {/* % Recuperación */}
              <div>
                <label className="block font-semibold text-gray-700 mb-1">
                  % Recuperación / Pago:
                </label>
                <div className="relative">
                  <input
                    type="number"
                    step="any"
                    value={modalEscalaData.porcentaje}
                    onChange={(e) => setModalEscalaData((prev) => ({ ...prev, porcentaje: e.target.value }))}
                    onFocus={(e) => e.target.select()}
                    className="input input-sm text-xs font-mono font-bold w-full pr-7"
                    placeholder="75"
                  />
                  <span className="absolute right-2.5 top-1/2 -translate-y-1/2 text-gray-500 font-bold">%</span>
                </div>
              </div>

              {/* Cotización */}
              <div>
                <label className="block font-semibold text-gray-700 mb-1">
                  Cotización Internacional (USD):
                </label>
                <input
                  type="number"
                  step="any"
                  value={modalEscalaData.cotizacion}
                  onChange={(e) => setModalEscalaData((prev) => ({ ...prev, cotizacion: e.target.value }))}
                  onFocus={(e) => e.target.select()}
                  className="input input-sm text-xs font-mono font-bold w-full"
                  placeholder="Ej: 48"
                />
              </div>

              {/* Tipo de Cambio */}
              <div>
                <label className="block font-semibold text-gray-700 mb-1">
                  Tipo de Cambio (T.C.):
                </label>
                <input
                  type="number"
                  step="any"
                  value={modalEscalaData.tipoCambio}
                  onChange={(e) => setModalEscalaData((prev) => ({ ...prev, tipoCambio: e.target.value }))}
                  onFocus={(e) => e.target.select()}
                  className="input input-sm text-xs font-mono font-bold w-full"
                  placeholder="Ej: 11"
                />
              </div>

              {/* Tarjeta de Resultado Calculado */}
              <div className="flex flex-col justify-end">
                <div className="rounded-lg bg-emerald-50 border-2 border-emerald-300 p-2.5 flex items-center justify-between">
                  <div>
                    <span className="text-[10px] text-emerald-800 font-bold block uppercase">Valor Escala Estimado:</span>
                    <span className="text-[11px] text-gray-600 font-mono">Bs el Kilo</span>
                  </div>
                  <span className="text-2xl font-black font-mono text-emerald-700">
                    {resultadoEscalaCalculado}
                  </span>
                </div>
              </div>
            </div>

            {/* Desglose de operaciones */}
            <div className="rounded bg-slate-50 border border-slate-200 p-2.5 text-[11px] text-slate-700 font-mono">
              Operación: ({Number(modalEscalaData.ley) || 0} × 3.215 × {(Number(modalEscalaData.porcentaje) || 0) / 100} × {Number(modalEscalaData.cotizacion) || 0} × {Number(modalEscalaData.tipoCambio) || 0}) ÷ 1000 = <strong className="text-emerald-700 font-bold text-xs">{resultadoEscalaCalculado} Bs/kg</strong>
            </div>

            <div className="flex items-center justify-end gap-2 pt-3 border-t border-gray-100">
              <button
                type="button"
                onClick={() => setModalEscalaOpen(false)}
                className="btn btn-secondary btn-sm text-xs"
              >
                Cancelar
              </button>
              <button
                type="button"
                onClick={() => handleAplicarEscala(resultadoEscalaCalculado)}
                className="btn btn-primary btn-sm text-xs font-bold inline-flex items-center gap-1.5 shadow-sm"
              >
                <Check className="h-3.5 w-3.5" />
                <span>Aplicar al Valor de Escala ({resultadoEscalaCalculado})</span>
              </button>
            </div>
          </div>
        </Modal>
      )}

      {/* Cálculos pendientes de pago */}
      <div className="card shadow-sm border border-gray-200 overflow-hidden">
        <div className="card-header bg-gradient-to-r from-gray-50 to-white border-b border-gray-200 py-4 px-6 flex flex-wrap items-center justify-between gap-3">
          <div className="flex items-center gap-3">
            <div className="p-2 rounded-lg bg-emerald-100 text-emerald-700">
              <Banknote className="h-5 w-5" />
            </div>
            <div>
              <h2 className="text-lg font-bold text-gray-900">Cálculos pendientes de pago</h2>
              <p className="text-xs text-gray-500">Lotes liquidados listos para desembolso o emisión de comprobante</p>
            </div>
          </div>
          {calculos.length > 0 && (
            <span className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full text-xs font-semibold bg-amber-50 text-amber-800 border border-amber-200">
              <Clock className="h-3.5 w-3.5 text-amber-600" />
              <span>{calculos.length} {calculos.length === 1 ? 'lote pendiente' : 'lotes pendientes'}</span>
            </span>
          )}
        </div>

        {loadingCalculos ? (
          <div className="flex flex-col items-center justify-center py-12">
            <Loader2 className="h-8 w-8 animate-spin text-primary-600 mb-2" />
            <p className="text-sm text-gray-500">Cargando cálculos pendientes...</p>
          </div>
        ) : calculos.length === 0 ? (
          <div className="py-12 text-center">
            <CheckCircle className="h-10 w-10 text-emerald-500 mx-auto mb-2 opacity-80" />
            <p className="text-sm font-semibold text-gray-700">No hay cálculos pendientes de pago</p>
            <p className="text-xs text-gray-500 mt-1">Todos los lotes calculados están al día</p>
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full border-collapse text-left">
              <thead>
                <tr className="bg-slate-50/80 border-b border-gray-200 text-xs font-bold text-gray-600 uppercase tracking-wider">
                  <th className="py-3.5 px-5">Lote</th>
                  <th className="py-3.5 px-5">Proveedor</th>
                  <th className="py-3.5 px-4 text-center">Mineral</th>
                  <th className="py-3.5 px-5 text-right">Valor Bruto</th>
                  <th className="py-3.5 px-5 text-right">Saldo Final</th>
                  <th className="py-3.5 px-5 text-center w-60">Acciones</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-100 bg-white">
                {calculos.map((calculo) => {
                  const mBadge = mineralBadge[calculo.tipoMineral] || {
                    label: calculo.tipoMineral,
                    badge: 'bg-gray-100 text-gray-800 border-gray-300'
                  };
                  return (
                    <tr key={calculo.id} className="hover:bg-slate-50/70 transition-colors">
                      {/* Lote */}
                      <td className="py-4 px-5 whitespace-nowrap">
                        <span className="font-mono font-bold text-xs bg-slate-100 text-slate-800 border border-slate-300 px-2.5 py-1 rounded-md">
                          {calculo.internacion.lote}
                        </span>
                      </td>

                      {/* Proveedor */}
                      <td className="py-4 px-5">
                        <div className="font-semibold text-sm text-gray-900">
                          {calculo.internacion.proveedor?.nombreCompleto || '—'}
                        </div>
                        {calculo.internacion.proveedor?.ci && (
                          <div className="text-xs text-gray-500 font-mono mt-0.5">
                            CI: {calculo.internacion.proveedor.ci}
                          </div>
                        )}
                      </td>

                      {/* Mineral con Badge de Color */}
                      <td className="py-4 px-4 text-center whitespace-nowrap">
                        <span className={`inline-flex px-2.5 py-0.5 rounded text-xs font-bold border ${mBadge.badge}`}>
                          {mBadge.label}
                        </span>
                      </td>

                      {/* Valor Bruto */}
                      <td className="py-4 px-5 text-right whitespace-nowrap font-mono text-sm text-gray-700">
                        {formatBs(calculo.valorBruto)}
                      </td>

                      {/* Saldo Final Destacado con Color según Positivo/Negativo */}
                      <td className="py-4 px-5 text-right whitespace-nowrap">
                        <span className={`inline-flex items-center gap-1 font-mono font-bold text-sm px-3 py-1 rounded-lg border ${
                          Number(calculo.saldoFinal) < 0
                            ? 'text-red-800 bg-red-50 border-red-300'
                            : Number(calculo.saldoFinal) > 0
                            ? 'text-emerald-800 bg-emerald-50 border-emerald-200'
                            : 'text-gray-800 bg-gray-100 border-gray-300'
                        }`}>
                          {Number(calculo.saldoFinal) < 0 && (
                            <span className="text-[10px] uppercase font-bold text-red-600 bg-red-100 px-1 rounded mr-0.5">
                              En contra
                            </span>
                          )}
                          {formatBs(calculo.saldoFinal)}
                        </span>
                      </td>

                      {/* Acciones Espaciadas con Texto e Iconos */}
                      <td className="py-4 px-5 text-center whitespace-nowrap">
                        <div className="flex items-center justify-center gap-2">
                          <button
                            type="button"
                            onClick={() => handleOpenConfirmarPago(calculo)}
                            className="btn btn-sm bg-emerald-600 hover:bg-emerald-700 text-white font-medium text-xs px-3 py-1.5 rounded-lg shadow-sm inline-flex items-center gap-1.5 transition-all"
                            title="Confirmar el pago y asentar en el sistema"
                          >
                            <Banknote className="h-3.5 w-3.5" />
                            <span>Confirmar Pago</span>
                          </button>

                          <button
                            type="button"
                            onClick={() => handlePrintOrDownloadReceipt(calculo)}
                            disabled={descargandoId === calculo.id}
                            className="btn btn-secondary btn-sm text-xs px-2.5 py-1.5 rounded-lg border border-slate-300 bg-white hover:bg-slate-50 text-slate-700 shadow-sm inline-flex items-center gap-1.5 transition-all"
                            title="Imprimir o descargar comprobante oficial"
                          >
                            {descargandoId === calculo.id ? (
                              <Loader2 className="h-3.5 w-3.5 animate-spin text-slate-600" />
                            ) : (
                              <Printer className="h-3.5 w-3.5 text-slate-600" />
                            )}
                            <span>Imprimir</span>
                          </button>
                        </div>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        )}
      </div>

      {/* MODAL PARA CONFIRMAR PAGO */}
      {modalConfirmarPago && (
        <Modal
          open={Boolean(modalConfirmarPago)}
          onClose={() => setModalConfirmarPago(null)}
          title={`Confirmar Pago — ${modalConfirmarPago.internacion.lote}`}
          size="md"
        >
          <div className="space-y-4">
            <div className="rounded-xl bg-emerald-50/80 border border-emerald-200 p-4 space-y-2">
              <div className="flex items-center justify-between text-xs text-emerald-800 font-semibold uppercase tracking-wider">
                <span>Detalle de Liquidación</span>
                <span className="font-mono text-xs">{modalConfirmarPago.internacion.lote}</span>
              </div>
              <div className="pt-1">
                <p className="text-sm text-gray-700">
                  Proveedor: <strong className="text-gray-900">{modalConfirmarPago.internacion.proveedor?.nombreCompleto}</strong>
                </p>
                <p className="text-xs text-gray-600">
                  Mineral: <span className="font-semibold text-gray-800">{getMineralLabel(modalConfirmarPago.tipoMineral)}</span> · Kilos Bruto: {formatKg(modalConfirmarPago.internacion?.kilosBruto)}
                </p>
              </div>
              <div className={`pt-2 border-t flex items-center justify-between ${
                Number(modalConfirmarPago.saldoFinal) < 0 ? 'border-red-200' : 'border-emerald-200/80'
              }`}>
                <span className="text-xs font-semibold text-gray-600">
                  {Number(modalConfirmarPago.saldoFinal) < 0
                    ? 'Saldo en contra (Déficit a cobrar al proveedor):'
                    : 'Monto total a cancelar:'}
                </span>
                <span className={`text-xl font-black font-mono ${
                  Number(modalConfirmarPago.saldoFinal) < 0 ? 'text-red-700' : 'text-emerald-700'
                }`}>
                  {formatBs(modalConfirmarPago.saldoFinal)}
                </span>
              </div>
            </div>

            <p className="text-xs text-gray-600">
              ¿Deseas confirmar este pago? Puedes asentar el pago y descargar/imprimir el comprobante oficial en el mismo instante.
            </p>

            <div className="flex flex-col sm:flex-row items-center justify-end gap-2 pt-3 border-t border-gray-100">
              <button
                type="button"
                onClick={() => setModalConfirmarPago(null)}
                disabled={pagandoLote}
                className="btn btn-secondary btn-sm w-full sm:w-auto text-xs px-3"
              >
                Pagar Después / Cerrar
              </button>
              <button
                type="button"
                onClick={() => handlePrintOrDownloadReceipt(modalConfirmarPago)}
                disabled={pagandoLote || descargandoId === modalConfirmarPago.id}
                className="btn btn-secondary btn-sm w-full sm:w-auto text-xs px-3 text-slate-700 border-slate-300 hover:bg-slate-50 inline-flex items-center justify-center gap-1.5"
                title="Descargar o imprimir comprobante oficial sin asentar pago todavía"
              >
                {descargandoId === modalConfirmarPago.id ? (
                  <Loader2 className="h-3.5 w-3.5 animate-spin" />
                ) : (
                  <FileDown className="h-3.5 w-3.5 text-slate-600" />
                )}
                <span>Solo Imprimir</span>
              </button>
              <button
                type="button"
                onClick={() => handleConfirmarPago(modalConfirmarPago, false)}
                disabled={pagandoLote}
                className="btn btn-secondary btn-sm w-full sm:w-auto text-xs px-3 text-emerald-800 border-emerald-300 hover:bg-emerald-50 inline-flex items-center justify-center gap-1.5"
              >
                {pagandoLote ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <Check className="h-3.5 w-3.5 text-emerald-600" />}
                <span>Solo Confirmar Pago</span>
              </button>
              <button
                type="button"
                onClick={() => handleConfirmarPago(modalConfirmarPago, true)}
                disabled={pagandoLote}
                className="btn btn-primary btn-sm w-full sm:w-auto text-xs px-4 bg-emerald-600 hover:bg-emerald-700 text-white font-bold inline-flex items-center justify-center gap-1.5 shadow-sm"
              >
                {pagandoLote ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <Printer className="h-3.5 w-3.5" />}
                <span>Confirmar e Imprimir</span>
              </button>
            </div>
          </div>
        </Modal>
      )}
    </div>
  );
};

export default CalculatePay;
