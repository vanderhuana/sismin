import { useState, useEffect, useMemo } from 'react';
import { ventaService, handleApiError } from '../services/api';
import Modal from '../components/ui/Modal';
import {
  TrendingUp,
  Calendar,
  Filter,
  FileSpreadsheet,
  FileDown,
  CheckSquare,
  Square,
  Eye,
  Loader2,
  AlertCircle,
  CheckCircle2,
  Tag,
  Scale,
  Layers,
  History,
  Lock,
  Search,
  RefreshCw,
  ArrowUpDown,
  ArrowUp,
  ArrowDown,
  Sparkles,
  CheckCheck,
  SlidersHorizontal,
  Zap
} from 'lucide-react';

const TIPOS_MINERAL = [
  { value: 'TODOS', label: 'Todos los Minerales', badgeClass: 'bg-indigo-100 text-indigo-800 border-indigo-300' },
  { value: 'PLATA', label: 'Plata (Ag)', badgeClass: 'bg-slate-100 text-slate-800 border-slate-300' },
  { value: 'PLOMO', label: 'Plomo (Pb)', badgeClass: 'bg-zinc-100 text-zinc-800 border-zinc-300' },
  { value: 'COMPLEJO', label: 'Complejo (Ag + Pb)', badgeClass: 'bg-amber-100 text-amber-800 border-amber-300' }
];

const formatKg = (n) => `${Number(Math.trunc(n) || 0).toLocaleString('es-BO')} kg`;
const formatBs = (n) =>
  Number(Math.trunc(n) || 0).toLocaleString('es-BO', {
    style: 'currency',
    currency: 'BOB',
    minimumFractionDigits: 0,
    maximumFractionDigits: 0
  });

const MineralSales = () => {
  const [activeTab, setActiveTab] = useState('NUEVO'); // 'NUEVO' | 'HISTORIAL'

  // Filtros de búsqueda para nuevo lote
  const [filtroEstadoVenta, setFiltroEstadoVenta] = useState('DISPONIBLES'); // 'DISPONIBLES' | 'VENDIDOS' | 'TODOS'
  const [filtroTipoMineral, setFiltroTipoMineral] = useState('TODOS');
  const [filtroAtajoFecha, setFiltroAtajoFecha] = useState('TODO'); // 'TODO' | 'HOY' | 'AYER' | '3DIAS' | 'SEMANA' | 'MES' | 'CUSTOM'
  const [filtroFechaDesde, setFiltroFechaDesde] = useState('');
  const [filtroFechaHasta, setFiltroFechaHasta] = useState('');
  const [filtroLeyMin, setFiltroLeyMin] = useState('');
  const [filtroLeyMax, setFiltroLeyMax] = useState('');

  // Estados de datos de matriz (arranca con PANTALLA LIMPIA)
  const [buscandoDisponibles, setBuscandoDisponibles] = useState(false);
  const [lotesDisponibles, setLotesDisponibles] = useState([]);
  const [selectedLoteIds, setSelectedLoteIds] = useState(new Set());
  const [busquedaRealizada, setBusquedaRealizada] = useState(false); // false = pantalla limpia inicial

  // Ordenamiento y búsqueda en matriz
  const [ordenColumna, setOrdenColumna] = useState('ley'); // 'ley' | 'lote' | 'peso' | 'proveedor'
  const [ordenDireccion, setOrdenDireccion] = useState('desc'); // 'desc' | 'asc'
  const [busquedaTextoTabla, setBusquedaTextoTabla] = useState('');

  // Estados de formulario de cierre
  const [numeroLoteGeneral, setNumeroLoteGeneral] = useState('');
  const [leyReferenciaAg, setLeyReferenciaAg] = useState('100');
  const [leyReferenciaPb, setLeyReferenciaPb] = useState('');
  const [observaciones, setObservaciones] = useState('');
  const [guardandoCierre, setGuardandoCierre] = useState(false);

  // Estados de Historial
  const [ventasHistorial, setVentasHistorial] = useState([]);
  const [loadingHistorial, setLoadingHistorial] = useState(false);
  const [filtroHistorialMineral, setFiltroHistorialMineral] = useState('');
  const [busquedaHistorial, setBusquedaHistorial] = useState('');

  // Modal de Detalle
  const [detalleModalOpen, setDetalleModalOpen] = useState(false);
  const [ventaDetalleItem, setVentaDetalleItem] = useState(null);
  const [loadingDetalle, setLoadingDetalle] = useState(false);

  // Modal de éxito de cierre con botones de descarga directa
  const [cierreExitosoModalOpen, setCierreExitosoModalOpen] = useState(false);
  const [ventaRecienCreada, setVentaRecienCreada] = useState(null);

  // Alertas
  const [error, setError] = useState(null);
  const [success, setSuccess] = useState(null);

  const showSuccessMsg = (msg) => {
    setSuccess(msg);
    setTimeout(() => setSuccess(null), 4000);
  };

  // Función para aplicar atajos rápidos de fecha
  const aplicarAtajoFecha = (atajo) => {
    setFiltroAtajoFecha(atajo);
    const ahora = new Date();
    const formatoISO = (d) => {
      const año = d.getFullYear();
      const mes = String(d.getMonth() + 1).padStart(2, '0');
      const dia = String(d.getDate()).padStart(2, '0');
      return `${año}-${mes}-${dia}`;
    };

    if (atajo === 'TODO') {
      setFiltroFechaDesde('');
      setFiltroFechaHasta('');
    } else if (atajo === 'HOY') {
      const hoyStr = formatoISO(ahora);
      setFiltroFechaDesde(hoyStr);
      setFiltroFechaHasta(hoyStr);
    } else if (atajo === 'AYER') {
      const ayer = new Date(ahora);
      ayer.setDate(ayer.getDate() - 1);
      const ayerStr = formatoISO(ayer);
      setFiltroFechaDesde(ayerStr);
      setFiltroFechaHasta(ayerStr);
    } else if (atajo === '3DIAS') {
      const d = new Date(ahora);
      d.setDate(d.getDate() - 3);
      setFiltroFechaDesde(formatoISO(d));
      setFiltroFechaHasta(formatoISO(ahora));
    } else if (atajo === 'SEMANA') {
      const d = new Date(ahora);
      d.setDate(d.getDate() - 7);
      setFiltroFechaDesde(formatoISO(d));
      setFiltroFechaHasta(formatoISO(ahora));
    } else if (atajo === 'MES') {
      const d = new Date(ahora);
      d.setDate(d.getDate() - 30);
      setFiltroFechaDesde(formatoISO(d));
      setFiltroFechaHasta(formatoISO(ahora));
    }
  };

  // Función para limpiar la pantalla (modo pantalla limpia)
  const limpiarPantalla = () => {
    setLotesDisponibles([]);
    setSelectedLoteIds(new Set());
    setBusquedaRealizada(false);
    setError(null);
  };

  // Buscar lotes según filtros configurados
  const handleBuscarLotes = async (e, overrides = {}) => {
    if (e && e.preventDefault) e.preventDefault();
    try {
      setBuscandoDisponibles(true);
      setError(null);

      const mineral = overrides.tipoMineral !== undefined ? overrides.tipoMineral : filtroTipoMineral;
      const estado = overrides.estadoVenta !== undefined ? overrides.estadoVenta : filtroEstadoVenta;
      const fDesde = overrides.fechaDesde !== undefined ? overrides.fechaDesde : filtroFechaDesde;
      const fHasta = overrides.fechaHasta !== undefined ? overrides.fechaHasta : filtroFechaHasta;
      const lMin = overrides.leyMin !== undefined ? overrides.leyMin : filtroLeyMin;
      const lMax = overrides.leyMax !== undefined ? overrides.leyMax : filtroLeyMax;

      const res = await ventaService.getLotesDisponibles({
        fechaDesde: fDesde || undefined,
        fechaHasta: fHasta || undefined,
        tipoMineral: mineral !== 'TODOS' ? mineral : undefined,
        estadoVenta: estado,
        leyMin: lMin !== '' ? lMin : undefined,
        leyMax: lMax !== '' ? lMax : undefined
      });

      setLotesDisponibles(res.registros || []);

      // Por defecto seleccionar solo los que no están ya vendidos
      const disponiblesIds = new Set(
        (res.registros || []).filter((r) => !r.yaVendido).map((r) => r.internacionId)
      );
      setSelectedLoteIds(disponiblesIds);
      setBusquedaRealizada(true);

      // Sugerir número correlativo de lote general
      const hoy = new Date();
      const año = hoy.getFullYear();
      const mes = String(hoy.getMonth() + 1).padStart(2, '0');
      const prefijo = mineral === 'TODOS' ? 'GRAL' : mineral;
      setNumeroLoteGeneral(`VENTA-${prefijo}-${año}${mes}-${disponiblesIds.size > 0 ? disponiblesIds.size : '01'}`);
    } catch (err) {
      setError(handleApiError(err));
    } finally {
      setBuscandoDisponibles(false);
    }
  };

  // Lotes mostrados aplicando buscador de texto y ordenamiento
  const lotesMostrados = useMemo(() => {
    let list = [...lotesDisponibles];

    if (busquedaTextoTabla.trim()) {
      const q = busquedaTextoTabla.toLowerCase();
      list = list.filter(
        (r) =>
          String(r.lote).toLowerCase().includes(q) ||
          String(r.proveedor || '').toLowerCase().includes(q)
      );
    }

    list.sort((a, b) => {
      if (ordenColumna === 'ley') {
        const leyA = a.ley_ag ?? a.ley_pb ?? 0;
        const leyB = b.ley_ag ?? b.ley_pb ?? 0;
        return ordenDireccion === 'desc' ? leyB - leyA : leyA - leyB;
      }
      if (ordenColumna === 'peso') {
        return ordenDireccion === 'desc' ? b.peso - a.peso : a.peso - b.peso;
      }
      if (ordenColumna === 'lote') {
        return ordenDireccion === 'desc' ? b.lote - a.lote : a.lote - b.lote;
      }
      if (ordenColumna === 'proveedor') {
        return ordenDireccion === 'desc'
          ? (b.proveedor || '').localeCompare(a.proveedor || '')
          : (a.proveedor || '').localeCompare(b.proveedor || '');
      }
      return 0;
    });

    return list;
  }, [lotesDisponibles, busquedaTextoTabla, ordenColumna, ordenDireccion]);

  // Selección individual de lotes (impide seleccionar lotes ya vendidos para una nueva venta)
  const toggleSelectLote = (id) => {
    const item = lotesDisponibles.find((x) => x.internacionId === id);
    if (item && item.yaVendido) {
      setError(`El lote ${item.lote} ya fue comercializado en el Lote General ${item.loteGeneralVendido || ''}.`);
      return;
    }

    setSelectedLoteIds((prev) => {
      const next = new Set(prev);
      if (next.has(id)) {
        next.delete(id);
      } else {
        next.add(id);
      }
      return next;
    });
  };

  // Seleccionar / Deseleccionar todos los disponibles no vendidos
  const toggleSelectAll = () => {
    const soloNoVendidos = lotesDisponibles.filter((r) => !r.yaVendido).map((r) => r.internacionId);
    if (selectedLoteIds.size === soloNoVendidos.length) {
      setSelectedLoteIds(new Set());
    } else {
      setSelectedLoteIds(new Set(soloNoVendidos));
    }
  };

  const seleccionarTodos = () => {
    const soloNoVendidos = lotesDisponibles.filter((r) => !r.yaVendido).map((r) => r.internacionId);
    setSelectedLoteIds(new Set(soloNoVendidos));
  };

  const deseleccionarTodos = () => {
    setSelectedLoteIds(new Set());
  };

  const invertirSeleccion = () => {
    setSelectedLoteIds((prev) => {
      const next = new Set();
      lotesDisponibles.forEach((r) => {
        if (!r.yaVendido && !prev.has(r.internacionId)) {
          next.add(r.internacionId);
        }
      });
      return next;
    });
  };

  // Selección inteligente por Ley Alta (ej. >= 100) en lotes no vendidos
  const seleccionarLeyesAltas = () => {
    const ids = new Set();
    lotesDisponibles.forEach((r) => {
      if (!r.yaVendido) {
        const ley = r.ley_ag ?? r.ley_pb ?? 0;
        if (ley >= 100) {
          ids.add(r.internacionId);
        }
      }
    });
    setSelectedLoteIds(ids);
  };

  // Cambiar ordenamiento de columna
  const toggleOrden = (col) => {
    if (ordenColumna === col) {
      setOrdenDireccion((prev) => (prev === 'desc' ? 'asc' : 'desc'));
    } else {
      setOrdenColumna(col);
      setOrdenDireccion('desc');
    }
  };

  // Cálculos en vivo según lotes seleccionados
  const metricasEnVivo = useMemo(() => {
    const seleccionados = lotesDisponibles.filter((r) => selectedLoteIds.has(r.internacionId));
    const totalPeso = seleccionados.reduce((sum, r) => sum + r.peso, 0);
    const totalPromAg = seleccionados.reduce((sum, r) => sum + (r.promedio_ag || 0), 0);
    const totalPromPb = seleccionados.reduce((sum, r) => sum + (r.promedio_pb || 0), 0);
    const totalCosto = seleccionados.reduce((sum, r) => sum + (r.costo || 0), 0);

    const leyAgPonderada = totalPeso > 0 && totalPromAg > 0 ? totalPromAg / totalPeso : 0;
    const leyPbPonderada = totalPeso > 0 && totalPromPb > 0 ? totalPromPb / totalPeso : 0;

    return {
      cantidad: seleccionados.length,
      totalPeso,
      totalPromAg,
      totalPromPb,
      leyAgPonderada,
      leyPbPonderada,
      totalCosto
    };
  }, [lotesDisponibles, selectedLoteIds]);

  // Cierre y Guardado del Lote General
  const handleCerrarLoteGeneral = async (e) => {
    e.preventDefault();
    if (!numeroLoteGeneral.trim()) {
      setError('Debes ingresar un número para el lote general');
      return;
    }
    if (selectedLoteIds.size === 0) {
      setError('Debes seleccionar al menos un lote para conformar la venta');
      return;
    }

    try {
      setGuardandoCierre(true);
      setError(null);

      // Deducir mineral válido para la base de datos si el filtro estaba en 'TODOS'
      let mineralPayload = filtroTipoMineral;
      if (mineralPayload === 'TODOS') {
        const seleccionados = lotesDisponibles.filter((r) => selectedLoteIds.has(r.internacionId));
        const tipos = [...new Set(seleccionados.map((r) => r.tipoMineral))];
        if (tipos.length === 1) {
          mineralPayload = tipos[0];
        } else if (tipos.includes('COMPLEJO') || (tipos.includes('PLATA') && tipos.includes('PLOMO'))) {
          mineralPayload = 'COMPLEJO';
        } else {
          mineralPayload = tipos[0] || 'PLATA';
        }
      }

      const payload = {
        numeroLoteGeneral: numeroLoteGeneral.trim().toUpperCase(),
        tipoMineral: mineralPayload,
        fechaInicioFiltro: filtroFechaDesde || undefined,
        fechaFinFiltro: filtroFechaHasta || undefined,
        leyReferenciaAg: leyReferenciaAg ? parseFloat(leyReferenciaAg) : undefined,
        leyReferenciaPb: leyReferenciaPb ? parseFloat(leyReferenciaPb) : undefined,
        observaciones: observaciones.trim() || undefined,
        loteIds: Array.from(selectedLoteIds)
      };

      const res = await ventaService.createVentaLoteGeneral(payload);
      setVentaRecienCreada(res.venta);
      setCierreExitosoModalOpen(true);

      // Limpiar estados de búsqueda
      setLotesDisponibles([]);
      setSelectedLoteIds(new Set());
      setBusquedaRealizada(false);
      setObservaciones('');

      // Recargar historial en segundo plano
      loadHistorial();
    } catch (err) {
      setError(handleApiError(err));
    } finally {
      setGuardandoCierre(false);
    }
  };

  // Cargar Historial de Ventas
  const loadHistorial = async () => {
    try {
      setLoadingHistorial(true);
      const params = {};
      if (filtroHistorialMineral) params.tipoMineral = filtroHistorialMineral;
      if (busquedaHistorial.trim()) params.search = busquedaHistorial.trim();
      const res = await ventaService.getVentas(params);
      setVentasHistorial(res.ventas || []);
    } catch (err) {
      setError(handleApiError(err));
    } finally {
      setLoadingHistorial(false);
    }
  };

  useEffect(() => {
    if (activeTab === 'HISTORIAL') {
      loadHistorial();
    }
  }, [activeTab, filtroHistorialMineral]);

  // Abrir detalle de un lote general cerrado
  const handleVerDetalle = async (id) => {
    try {
      setLoadingDetalle(true);
      setDetalleModalOpen(true);
      const res = await ventaService.getVenta(id);
      setVentaDetalleItem(res.venta);
    } catch (err) {
      setError(handleApiError(err));
    } finally {
      setLoadingDetalle(false);
    }
  };

  return (
    <div className="space-y-6">
      {/* Encabezado */}
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
        <div>
          <h1 className="text-3xl font-bold text-gray-900 flex items-center gap-2">
            <TrendingUp className="h-8 w-8 text-emerald-600" />
            <span>Venta de Mineral (Lotes Generales)</span>
          </h1>
          <p className="mt-1 text-sm text-gray-600">
            Consolidación y liquidación de lotes pagados con cálculo automático de Ley Ponderada
          </p>
        </div>

        {/* Pestañas de Navegación */}
        <div className="flex rounded-lg bg-gray-100 p-1 border border-gray-200">
          <button
            type="button"
            onClick={() => setActiveTab('NUEVO')}
            className={`flex items-center gap-2 px-4 py-2 text-sm font-semibold rounded-md transition-all ${
              activeTab === 'NUEVO'
                ? 'bg-white text-emerald-800 shadow-sm'
                : 'text-gray-600 hover:text-gray-900'
            }`}
          >
            <Layers className="h-4 w-4" />
            <span>Nuevo Lote General</span>
          </button>
          <button
            type="button"
            onClick={() => setActiveTab('HISTORIAL')}
            className={`flex items-center gap-2 px-4 py-2 text-sm font-semibold rounded-md transition-all ${
              activeTab === 'HISTORIAL'
                ? 'bg-white text-emerald-800 shadow-sm'
                : 'text-gray-600 hover:text-gray-900'
            }`}
          >
            <History className="h-4 w-4" />
            <span>Historial de Ventas</span>
          </button>
        </div>
      </div>

      {/* Alertas */}
      {error && (
        <div className="flex items-start gap-3 rounded-xl border border-red-200 bg-red-50 p-4 shadow-sm">
          <AlertCircle className="h-5 w-5 shrink-0 text-red-500 mt-0.5" />
          <div className="flex-1">
            <h4 className="text-sm font-semibold text-red-800">Ocurrió un error</h4>
            <p className="text-xs text-red-700 mt-0.5">{error}</p>
          </div>
        </div>
      )}

      {success && (
        <div className="flex items-center gap-2 rounded-xl border border-emerald-200 bg-emerald-50 p-4 text-sm font-medium text-emerald-800 shadow-sm">
          <CheckCircle2 className="h-5 w-5 text-emerald-600" />
          <span>{success}</span>
        </div>
      )}

      {/* ===================== PESTAÑA 1: NUEVO LOTE GENERAL ===================== */}
      {activeTab === 'NUEVO' && (
        <div className="space-y-6">
          {/* Tarjeta de Filtros de Búsqueda y Navegación Dinámica */}
          <div className="card border border-gray-200 shadow-sm space-y-4 p-5 bg-white">
            <div className="flex flex-wrap items-center justify-between gap-3 border-b border-gray-100 pb-3">
              <div>
                <h2 className="text-base font-bold text-gray-900 flex items-center gap-2">
                  <Filter className="h-4 w-4 text-emerald-600" />
                  <span>Criterios de Búsqueda y Filtros en Vivo</span>
                </h2>
                <p className="text-xs text-gray-500">
                  Selecciona el estado, mineral o período. Usa "Limpiar Pantalla" cuando desees liberar la memoria.
                </p>
              </div>

              {/* Botón para Limpiar Pantalla */}
              {busquedaRealizada && (
                <button
                  type="button"
                  onClick={limpiarPantalla}
                  className="btn btn-secondary btn-sm inline-flex items-center gap-1.5 text-gray-600 hover:text-red-700 hover:bg-red-50 border border-gray-200 shadow-xs"
                  title="Ocultar datos y vaciar la tabla para no sobrecargar la pantalla"
                >
                  <Square className="h-3.5 w-3.5" />
                  <span>⏹️ Limpiar Pantalla (Ocultar)</span>
                </button>
              )}
            </div>

            {/* SELECCIÓN 1: ESTADO DEL MINERAL (POR VENDER / VENDIDOS / TODOS) */}
            <div>
              <label className="block text-xs font-bold text-gray-700 uppercase tracking-wider mb-1.5 flex items-center gap-1.5">
                <Tag className="h-3.5 w-3.5 text-emerald-600" />
                <span>1. Estado del Mineral</span>
              </label>
              <div className="flex flex-wrap items-center gap-2">
                <button
                  type="button"
                  onClick={() => setFiltroEstadoVenta('DISPONIBLES')}
                  className={`px-3.5 py-1.5 rounded-lg text-xs font-semibold border transition-all ${
                    filtroEstadoVenta === 'DISPONIBLES'
                      ? 'bg-emerald-600 text-white border-emerald-600 shadow-sm'
                      : 'bg-white text-gray-700 border-gray-300 hover:bg-gray-50'
                  }`}
                >
                  🟢 Por Vender (Disponibles en Almacén)
                </button>
                <button
                  type="button"
                  onClick={() => setFiltroEstadoVenta('VENDIDOS')}
                  className={`px-3.5 py-1.5 rounded-lg text-xs font-semibold border transition-all ${
                    filtroEstadoVenta === 'VENDIDOS'
                      ? 'bg-blue-600 text-white border-blue-600 shadow-sm'
                      : 'bg-white text-gray-700 border-gray-300 hover:bg-gray-50'
                  }`}
                >
                  🔵 Ya Vendidos (Cerrados en Lotes Generales)
                </button>
                <button
                  type="button"
                  onClick={() => setFiltroEstadoVenta('TODOS')}
                  className={`px-3.5 py-1.5 rounded-lg text-xs font-semibold border transition-all ${
                    filtroEstadoVenta === 'TODOS'
                      ? 'bg-slate-800 text-white border-slate-800 shadow-sm'
                      : 'bg-white text-gray-700 border-gray-300 hover:bg-gray-50'
                  }`}
                >
                  ⚪ Todos los Lotes (Ambos)
                </button>
              </div>
            </div>

            {/* SELECCIÓN 2: TIPO DE MINERAL */}
            <div>
              <label className="block text-xs font-bold text-gray-700 uppercase tracking-wider mb-1.5 flex items-center gap-1.5">
                <Layers className="h-3.5 w-3.5 text-emerald-600" />
                <span>2. Tipo de Mineral</span>
              </label>
              <div className="flex flex-wrap items-center gap-2">
                {TIPOS_MINERAL.map((m) => {
                  const isActive = filtroTipoMineral === m.value;
                  return (
                    <button
                      key={m.value}
                      type="button"
                      onClick={() => setFiltroTipoMineral(m.value)}
                      className={`px-3.5 py-1.5 rounded-lg text-xs font-semibold border transition-all ${
                        isActive
                          ? 'bg-emerald-700 text-white border-emerald-700 shadow-sm'
                          : 'bg-white text-gray-700 border-gray-300 hover:bg-gray-50'
                      }`}
                    >
                      {m.label}
                    </button>
                  );
                })}
              </div>
            </div>

            {/* SELECCIÓN 3: ATAJOS DE FECHA RÁPIDOS */}
            <div>
              <label className="block text-xs font-bold text-gray-700 uppercase tracking-wider mb-1.5 flex items-center gap-1.5">
                <Calendar className="h-3.5 w-3.5 text-emerald-600" />
                <span>3. Período de Fecha (Atajos de 1 Clic)</span>
              </label>
              <div className="flex flex-wrap items-center gap-2">
                {[
                  { id: 'TODO', label: 'Todo el Stock' },
                  { id: 'HOY', label: 'Hoy' },
                  { id: 'AYER', label: 'Ayer' },
                  { id: '3DIAS', label: 'Últimos 3 Días' },
                  { id: 'SEMANA', label: 'Esta Semana (7 días)' },
                  { id: 'MES', label: 'Este Mes (30 días)' },
                  { id: 'CUSTOM', label: '📅 Personalizado' }
                ].map((item) => (
                  <button
                    key={item.id}
                    type="button"
                    onClick={() => aplicarAtajoFecha(item.id)}
                    className={`px-3 py-1 rounded-md text-xs font-medium border transition-all ${
                      filtroAtajoFecha === item.id
                        ? 'bg-emerald-100 text-emerald-900 border-emerald-400 font-bold'
                        : 'bg-gray-50 text-gray-700 border-gray-200 hover:bg-gray-100'
                    }`}
                  >
                    {item.label}
                  </button>
                ))}
              </div>

              {/* Selectores de fecha manuales si selecciona personalizado */}
              {filtroAtajoFecha === 'CUSTOM' && (
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 mt-3 p-3 bg-gray-50 rounded-xl border border-gray-200">
                  <div>
                    <label className="block text-xs font-medium text-gray-600 mb-1">Fecha Desde</label>
                    <input
                      type="date"
                      value={filtroFechaDesde}
                      onChange={(e) => setFiltroFechaDesde(e.target.value)}
                      className="input text-xs"
                    />
                  </div>
                  <div>
                    <label className="block text-xs font-medium text-gray-600 mb-1">Fecha Hasta</label>
                    <input
                      type="date"
                      value={filtroFechaHasta}
                      onChange={(e) => setFiltroFechaHasta(e.target.value)}
                      className="input text-xs"
                    />
                  </div>
                </div>
              )}
            </div>

            {/* SELECCIÓN 4: RANGO DE LEY DINÁMICO Y BOTÓN DE BÚSQUEDA */}
            <div className="pt-3 border-t border-gray-100 flex flex-wrap items-end justify-between gap-4">
              <div>
                <label className="block text-xs font-bold text-gray-700 uppercase tracking-wider mb-1 flex items-center gap-1.5">
                  <SlidersHorizontal className="h-3.5 w-3.5 text-emerald-600" />
                  <span>4. Rango de Ley (Dinámico)</span>
                </label>
                <div className="flex items-center gap-2">
                  <input
                    type="number"
                    step="any"
                    placeholder="Mín (ej: 1, 25)"
                    value={filtroLeyMin}
                    onChange={(e) => setFiltroLeyMin(e.target.value)}
                    className="input h-9 text-xs font-mono w-28"
                  />
                  <span className="text-gray-400 text-xs font-bold">a</span>
                  <input
                    type="number"
                    step="any"
                    placeholder="Máx (ej: 96, 200)"
                    value={filtroLeyMax}
                    onChange={(e) => setFiltroLeyMax(e.target.value)}
                    className="input h-9 text-xs font-mono w-28"
                  />
                  <button
                    type="button"
                    onClick={() => {
                      setFiltroLeyMin('100');
                      setFiltroLeyMax('');
                    }}
                    className={`px-2.5 py-1.5 rounded-md border text-xs font-medium ${
                      filtroLeyMin === '100' && !filtroLeyMax
                        ? 'bg-amber-100 text-amber-900 border-amber-300 font-bold'
                        : 'bg-gray-50 text-gray-700 border-gray-200 hover:bg-gray-100'
                    }`}
                  >
                    ★ Leyes ≥ 100
                  </button>
                  <button
                    type="button"
                    onClick={() => {
                      setFiltroLeyMin('0');
                      setFiltroLeyMax('100');
                    }}
                    className="px-2.5 py-1.5 rounded-md border text-xs font-medium bg-gray-50 text-gray-700 border-gray-200 hover:bg-gray-100"
                  >
                    0 a 100
                  </button>
                  <button
                    type="button"
                    onClick={() => {
                      setFiltroLeyMin('25');
                      setFiltroLeyMax('200');
                    }}
                    className="px-2.5 py-1.5 rounded-md border text-xs font-medium bg-gray-50 text-gray-700 border-gray-200 hover:bg-gray-100"
                  >
                    25 a 200
                  </button>
                  {(filtroLeyMin !== '' || filtroLeyMax !== '') && (
                    <button
                      type="button"
                      onClick={() => {
                        setFiltroLeyMin('');
                        setFiltroLeyMax('');
                      }}
                      className="px-2 py-1 text-xs text-red-600 hover:bg-red-50 font-medium"
                    >
                      Limpiar
                    </button>
                  )}
                </div>
              </div>

              {/* Botón de Consulta / Actualización */}
              <button
                type="button"
                onClick={(e) => handleBuscarLotes(e)}
                disabled={buscandoDisponibles}
                className="btn btn-primary btn-md inline-flex items-center gap-2 bg-emerald-600 hover:bg-emerald-700 text-white shadow-md text-sm font-bold px-6 py-2.5"
              >
                {buscandoDisponibles ? (
                  <>
                    <Loader2 className="h-4 w-4 animate-spin" />
                    <span>Consultando lotes...</span>
                  </>
                ) : (
                  <>
                    <Search className="h-4 w-4" />
                    <span>Consultar Lotes con Filtros</span>
                  </>
                )}
              </button>
            </div>
          </div>

          {/* ===================== CONTENIDO SEGÚN ESTADO ===================== */}
          {!busquedaRealizada ? (
            /* PANTALLA LIMPIA INICIAL: Para no sobrecargar la memoria */
            <div className="card p-10 text-center border-2 border-dashed border-gray-200 bg-white shadow-sm rounded-2xl">
              <div className="mx-auto w-16 h-16 rounded-2xl bg-emerald-50 border border-emerald-200 flex items-center justify-center mb-4">
                <Layers className="h-8 w-8 text-emerald-600" />
              </div>
              <h3 className="text-lg font-bold text-gray-900">Pantalla Limpia — Sin sobrecarga de datos</h3>
              <p className="text-sm text-gray-500 max-w-md mx-auto mt-1 mb-6">
                Para mantener tu pantalla rápida y fluida, los datos no se cargan automáticamente.
                Haz clic en una opción rápida o presiona <strong>Consultar Lotes</strong> para ver la matriz.
              </p>
              <div className="flex flex-wrap items-center justify-center gap-3">
                <button
                  type="button"
                  onClick={() => {
                    setFiltroEstadoVenta('DISPONIBLES');
                    setFiltroTipoMineral('TODOS');
                    handleBuscarLotes(null, { estadoVenta: 'DISPONIBLES', tipoMineral: 'TODOS' });
                  }}
                  className="btn btn-primary bg-emerald-600 hover:bg-emerald-700 text-white font-bold px-5 py-2.5 text-sm shadow-md inline-flex items-center gap-2"
                >
                  <CheckCircle2 className="h-4 w-4" />
                  <span>🟢 Cargar Todo el Stock Por Vender</span>
                </button>
                <button
                  type="button"
                  onClick={() => {
                    setFiltroEstadoVenta('DISPONIBLES');
                    setFiltroTipoMineral('PLATA');
                    handleBuscarLotes(null, { estadoVenta: 'DISPONIBLES', tipoMineral: 'PLATA' });
                  }}
                  className="btn btn-secondary text-gray-700 font-semibold px-4 py-2.5 text-sm hover:bg-gray-200"
                >
                  <span>Solo Plata (Ag)</span>
                </button>
                <button
                  type="button"
                  onClick={() => {
                    setFiltroEstadoVenta('DISPONIBLES');
                    setFiltroTipoMineral('PLOMO');
                    handleBuscarLotes(null, { estadoVenta: 'DISPONIBLES', tipoMineral: 'PLOMO' });
                  }}
                  className="btn btn-secondary text-gray-700 font-semibold px-4 py-2.5 text-sm hover:bg-gray-200"
                >
                  <span>Solo Plomo (Pb)</span>
                </button>
                <button
                  type="button"
                  onClick={() => {
                    setFiltroEstadoVenta('VENDIDOS');
                    setFiltroTipoMineral('TODOS');
                    handleBuscarLotes(null, { estadoVenta: 'VENDIDOS', tipoMineral: 'TODOS' });
                  }}
                  className="btn btn-secondary text-blue-700 bg-blue-50 border border-blue-200 font-semibold px-4 py-2.5 text-sm hover:bg-blue-100"
                >
                  <span>🔵 Ver Ya Vendidos</span>
                </button>
              </div>
            </div>
          ) : (
            /* MATRIZ DE LOTES DISPONIBLES / CONSULTADOS */
            <div className="space-y-6">
              {lotesDisponibles.length === 0 ? (
                <div className="card p-12 text-center text-gray-500">
                  <Scale className="h-12 w-12 mx-auto text-gray-300 mb-3" />
                  <h3 className="text-base font-semibold text-gray-700">No se encontraron lotes con estos filtros</h3>
                  <p className="text-xs text-gray-500 mt-1">
                    No existen lotes en estado {filtroEstadoVenta} con los criterios seleccionados. Prueba cambiando el mineral o las fechas.
                  </p>
                </div>
              ) : (
                <>
                  {/* Tarjetas de Resumen en Vivo */}
                  <div className="grid grid-cols-2 lg:grid-cols-4 gap-3">
                    <div className="rounded-xl border border-gray-200 bg-white p-3.5 shadow-sm">
                      <p className="text-xs font-medium text-gray-500">Lotes Seleccionados</p>
                      <p className="mt-1 text-2xl font-bold text-gray-900">
                        {metricasEnVivo.cantidad}{' '}
                        <span className="text-xs font-normal text-gray-500">de {lotesDisponibles.length}</span>
                      </p>
                    </div>

                    <div className="rounded-xl border border-gray-200 bg-white p-3.5 shadow-sm">
                      <p className="text-xs font-medium text-gray-500">Peso Bruto Total</p>
                      <p className="mt-1 text-2xl font-bold font-mono text-gray-900">
                        {formatKg(metricasEnVivo.totalPeso)}
                      </p>
                    </div>

                    <div className="rounded-xl border border-emerald-300 bg-emerald-50/70 p-3.5 shadow-sm">
                      <p className="text-xs font-semibold text-emerald-800 uppercase tracking-wider">
                        Ley Ponderada Ag
                      </p>
                      <p className="mt-1 text-2xl font-bold font-mono text-emerald-900">
                        {metricasEnVivo.leyAgPonderada.toFixed(2)}
                      </p>
                      <p className="text-[10px] text-emerald-700">
                        Exacta: {metricasEnVivo.leyAgPonderada.toFixed(4)}
                      </p>
                    </div>

                    <div className="rounded-xl border border-zinc-300 bg-zinc-50/70 p-3.5 shadow-sm">
                      <p className="text-xs font-semibold text-zinc-800 uppercase tracking-wider">
                        Ley Ponderada Pb
                      </p>
                      <p className="mt-1 text-2xl font-bold font-mono text-zinc-900">
                        {metricasEnVivo.leyPbPonderada.toFixed(2)}
                      </p>
                      <p className="text-[10px] text-zinc-700">
                        Exacta: {metricasEnVivo.leyPbPonderada.toFixed(4)}
                      </p>
                    </div>
                  </div>

                  {/* Tabla de Matriz Rediseñada y Ampliada */}
                  <div className="card shadow-md border border-gray-200 overflow-hidden">
                    {/* Barra de Herramientas y Opciones Rápidas de Check */}
                    <div className="p-4 bg-gray-50/80 border-b border-gray-200 flex flex-wrap items-center justify-between gap-3">
                      {/* Botones de Control de Check */}
                      <div className="flex flex-wrap items-center gap-2">
                        <button
                          type="button"
                          onClick={seleccionarTodos}
                          className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-semibold bg-emerald-600 text-white hover:bg-emerald-700 shadow-sm transition-all"
                          title="Marcar todos los lotes disponibles"
                        >
                          <CheckCheck className="h-4 w-4" />
                          <span>Marcar Disponibles</span>
                        </button>
                        <button
                          type="button"
                          onClick={deseleccionarTodos}
                          className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-semibold bg-white border border-gray-300 text-gray-700 hover:bg-gray-100 shadow-sm transition-all"
                          title="Desmarcar todos"
                        >
                          <Square className="h-4 w-4 text-gray-400" />
                          <span>Desmarcar Todos</span>
                        </button>
                        <button
                          type="button"
                          onClick={seleccionarLeyesAltas}
                          className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-semibold bg-amber-50 border border-amber-300 text-amber-900 hover:bg-amber-100 shadow-sm transition-all"
                          title="Marcar solo lotes con Ley ≥ 100"
                        >
                          <Sparkles className="h-3.5 w-3.5 text-amber-600" />
                          <span>Marcar Ley ≥ 100</span>
                        </button>
                        <button
                          type="button"
                          onClick={invertirSeleccion}
                          className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-semibold bg-white border border-gray-200 text-gray-600 hover:bg-gray-100 shadow-sm transition-all"
                          title="Invertir los seleccionados actuales"
                        >
                          <RefreshCw className="h-3.5 w-3.5 text-gray-500" />
                          <span>Invertir</span>
                        </button>
                      </div>

                      {/* Buscador interno y estado */}
                      <div className="flex items-center gap-2">
                        <div className="relative">
                          <Search className="h-4 w-4 text-gray-400 absolute left-3 top-2.5 pointer-events-none" />
                          <input
                            type="text"
                            placeholder="Buscar lote o proveedor..."
                            value={busquedaTextoTabla}
                            onChange={(e) => setBusquedaTextoTabla(e.target.value)}
                            className="input h-9 text-xs pl-9 pr-3 w-48 sm:w-60 bg-white"
                          />
                        </div>
                        <span className="text-xs font-semibold text-emerald-800 bg-emerald-100/70 border border-emerald-200 px-3 py-1.5 rounded-lg">
                          {selectedLoteIds.size} seleccionados
                        </span>
                      </div>
                    </div>

                    <div className="overflow-x-auto">
                      <table className="w-full border-collapse">
                        <thead>
                          <tr className="bg-slate-100/90 text-slate-700 text-xs font-bold uppercase tracking-wider border-b border-gray-200 select-none">
                            <th className="py-3.5 px-4 text-center w-14">
                              <input
                                type="checkbox"
                                checked={selectedLoteIds.size > 0 && selectedLoteIds.size === lotesDisponibles.filter(r => !r.yaVendido).length}
                                onChange={toggleSelectAll}
                                className="w-5 h-5 text-emerald-600 rounded cursor-pointer accent-emerald-600 align-middle"
                                title="Seleccionar/Deseleccionar todos los disponibles"
                              />
                            </th>
                            <th
                              onClick={() => toggleOrden('lote')}
                              className="py-3.5 px-4 text-left cursor-pointer hover:bg-slate-200/80 transition-colors"
                            >
                              <div className="flex items-center gap-1.5">
                                <span>Lote</span>
                                {ordenColumna === 'lote' ? (
                                  ordenDireccion === 'desc' ? <ArrowDown className="h-3.5 w-3.5 text-emerald-700" /> : <ArrowUp className="h-3.5 w-3.5 text-emerald-700" />
                                ) : (
                                  <ArrowUpDown className="h-3.5 w-3.5 text-gray-400" />
                                )}
                              </div>
                            </th>
                            <th className="py-3.5 px-4 text-left">Mineral</th>
                            <th
                              onClick={() => toggleOrden('proveedor')}
                              className="py-3.5 px-4 text-left cursor-pointer hover:bg-slate-200/80 transition-colors"
                            >
                              <div className="flex items-center gap-1.5">
                                <span>Proveedor</span>
                                {ordenColumna === 'proveedor' ? (
                                  ordenDireccion === 'desc' ? <ArrowDown className="h-3.5 w-3.5 text-emerald-700" /> : <ArrowUp className="h-3.5 w-3.5 text-emerald-700" />
                                ) : (
                                  <ArrowUpDown className="h-3.5 w-3.5 text-gray-400" />
                                )}
                              </div>
                            </th>
                            <th
                              onClick={() => toggleOrden('peso')}
                              className="py-3.5 px-4 text-right cursor-pointer hover:bg-slate-200/80 transition-colors"
                            >
                              <div className="flex items-center justify-end gap-1.5">
                                <span>Peso Bruto (kg)</span>
                                {ordenColumna === 'peso' ? (
                                  ordenDireccion === 'desc' ? <ArrowDown className="h-3.5 w-3.5 text-emerald-700" /> : <ArrowUp className="h-3.5 w-3.5 text-emerald-700" />
                                ) : (
                                  <ArrowUpDown className="h-3.5 w-3.5 text-gray-400" />
                                )}
                              </div>
                            </th>
                            <th
                              onClick={() => toggleOrden('ley')}
                              className="py-3.5 px-4 text-right cursor-pointer hover:bg-slate-200/80 transition-colors"
                            >
                              <div className="flex items-center justify-end gap-1.5 text-emerald-800">
                                <span>Ley Ag</span>
                                {ordenColumna === 'ley' ? (
                                  ordenDireccion === 'desc' ? <ArrowDown className="h-3.5 w-3.5 text-emerald-700" /> : <ArrowUp className="h-3.5 w-3.5 text-emerald-700" />
                                ) : (
                                  <ArrowUpDown className="h-3.5 w-3.5 text-gray-400" />
                                )}
                              </div>
                            </th>
                            <th className="py-3.5 px-4 text-right">Prom. Ag</th>
                            <th className="py-3.5 px-4 text-right text-zinc-800">Ley Pb</th>
                            <th className="py-3.5 px-4 text-right">Prom. Pb</th>
                            <th className="py-3.5 px-4 text-right">Valor Bruto (Bs)</th>
                            <th className="py-3.5 px-4 text-center">Estado Venta</th>
                          </tr>
                        </thead>
                        <tbody className="divide-y divide-gray-200 bg-white">
                          {lotesMostrados.map((r) => {
                            const isChecked = selectedLoteIds.has(r.internacionId);
                            const leyPrincipal = r.ley_ag ?? r.ley_pb ?? 0;
                            const esLeyAlta = leyPrincipal >= 100;

                            return (
                              <tr
                                key={r.internacionId}
                                onClick={() => toggleSelectLote(r.internacionId)}
                                className={`cursor-pointer transition-colors ${
                                  r.yaVendido
                                    ? 'bg-blue-50/40 hover:bg-blue-50/70 border-l-4 border-l-blue-400 opacity-75'
                                    : isChecked
                                    ? 'bg-emerald-50/80 hover:bg-emerald-100/70 border-l-4 border-l-emerald-600 font-medium text-gray-900'
                                    : 'hover:bg-gray-50 opacity-60 border-l-4 border-l-transparent text-gray-500'
                                }`}
                              >
                                {/* Checkbox */}
                                <td
                                  className="py-3.5 px-4 text-center"
                                  onClick={(e) => e.stopPropagation()}
                                >
                                  {r.yaVendido ? (
                                    <span
                                      className="inline-block w-4 h-4 rounded bg-blue-200 text-blue-800 text-[9px] font-bold leading-4 text-center"
                                      title="Lote ya vendido en otro lote general"
                                    >
                                      ✓
                                    </span>
                                  ) : (
                                    <input
                                      type="checkbox"
                                      checked={isChecked}
                                      onChange={() => toggleSelectLote(r.internacionId)}
                                      className="w-5 h-5 text-emerald-600 rounded cursor-pointer accent-emerald-600 align-middle"
                                    />
                                  )}
                                </td>

                                {/* N° de Lote */}
                                <td className="py-3.5 px-4">
                                  <span className="font-mono text-sm font-bold text-emerald-900 bg-emerald-100/80 px-2.5 py-1 rounded-md border border-emerald-200">
                                    {r.lote}
                                  </span>
                                </td>

                                {/* Mineral */}
                                <td className="py-3.5 px-4">
                                  <span
                                    className={`inline-flex px-2 py-0.5 rounded text-xs font-bold border ${
                                      r.tipoMineral === 'PLATA'
                                        ? 'bg-slate-100 text-slate-800 border-slate-300'
                                        : r.tipoMineral === 'PLOMO'
                                        ? 'bg-zinc-100 text-zinc-800 border-zinc-300'
                                        : 'bg-amber-100 text-amber-800 border-amber-300'
                                    }`}
                                  >
                                    {r.tipoMineral}
                                  </span>
                                </td>

                                {/* Proveedor */}
                                <td className="py-3.5 px-4">
                                  <p className="text-sm font-semibold text-gray-900">{r.proveedor}</p>
                                </td>

                                {/* Peso Neto */}
                                <td className="py-3.5 px-4 text-right font-mono text-sm font-bold text-gray-900">
                                  {formatKg(r.peso)}
                                </td>

                                {/* Ley Ag & Prom Ag */}
                                <td className="py-3.5 px-4 text-right">
                                  {r.ley_ag !== null ? (
                                    <span
                                      className={`inline-flex items-center gap-1 px-3 py-1 rounded-lg text-sm font-extrabold font-mono ${
                                        r.ley_ag >= 100
                                          ? 'bg-amber-100 text-amber-900 border border-amber-300 shadow-sm'
                                          : 'bg-slate-100 text-slate-800 border border-slate-200'
                                      }`}
                                    >
                                      {r.ley_ag >= 100 && <Sparkles className="h-3.5 w-3.5 text-amber-600" />}
                                      {r.ley_ag}
                                    </span>
                                  ) : (
                                    <span className="text-gray-400">—</span>
                                  )}
                                </td>
                                <td className="py-3.5 px-4 text-right font-mono text-sm text-gray-900 font-semibold">
                                  {r.promedio_ag ? Number(r.promedio_ag).toLocaleString('es-BO') : '—'}
                                </td>

                                {/* Ley Pb & Prom Pb */}
                                <td className="py-3.5 px-4 text-right">
                                  {r.ley_pb !== null ? (
                                    <span
                                      className={`inline-flex items-center gap-1 px-3 py-1 rounded-lg text-sm font-extrabold font-mono ${
                                        r.ley_pb >= 100
                                          ? 'bg-amber-100 text-amber-900 border border-amber-300 shadow-sm'
                                          : 'bg-zinc-100 text-zinc-800 border border-zinc-200'
                                      }`}
                                    >
                                      {r.ley_pb >= 100 && <Sparkles className="h-3.5 w-3.5 text-amber-600" />}
                                      {r.ley_pb}
                                    </span>
                                  ) : (
                                    <span className="text-gray-400">—</span>
                                  )}
                                </td>
                                <td className="py-3.5 px-4 text-right font-mono text-sm text-gray-900 font-semibold">
                                  {r.promedio_pb ? Number(r.promedio_pb).toLocaleString('es-BO') : '—'}
                                </td>

                                {/* Costo Compra */}
                                <td className="py-3.5 px-4 text-right font-mono text-sm text-gray-600 font-medium">
                                  {formatBs(r.costo)}
                                </td>

                                {/* Estado Venta */}
                                <td className="py-3.5 px-4 text-center">
                                  {r.yaVendido ? (
                                    <span className="inline-block px-2.5 py-1 rounded-md text-[11px] font-bold bg-blue-100 text-blue-800 border border-blue-200">
                                      Vendido en {r.loteGeneralVendido || 'Lote Gral'}
                                    </span>
                                  ) : (
                                    <span className="inline-block px-2.5 py-1 rounded-md text-[11px] font-bold bg-emerald-100 text-emerald-800 border border-emerald-200">
                                      🟢 Disponible
                                    </span>
                                  )}
                                </td>
                              </tr>
                            );
                          })}
                        </tbody>

                        {/* Fila de TOTALES Prominente */}
                        <tfoot>
                          <tr className="bg-slate-900 text-white font-bold border-t-2 border-emerald-500">
                            <td colSpan={4} className="py-4 px-4 text-right uppercase tracking-wider text-xs text-slate-300">
                              TOTALES SELECCIONADOS ({metricasEnVivo.cantidad} lotes):
                            </td>
                            <td className="py-4 px-4 text-right font-mono text-base font-bold text-emerald-400">
                              {formatKg(metricasEnVivo.totalPeso)}
                            </td>
                            <td className="py-4 px-4 text-right">
                              <div className="inline-block bg-amber-400/20 border border-amber-400/40 px-2.5 py-1 rounded-md">
                                <span className="text-xs text-amber-200 block uppercase font-medium">Ley Ag Pond:</span>
                                <span className="font-mono text-base font-black text-amber-300">
                                  {metricasEnVivo.leyAgPonderada.toFixed(2)}
                                </span>
                              </div>
                            </td>
                            <td className="py-4 px-4 text-right font-mono text-base font-bold text-slate-100">
                              {Number(metricasEnVivo.totalPromAg).toLocaleString('es-BO')}
                            </td>
                            <td className="py-4 px-4 text-right">
                              <div className="inline-block bg-amber-400/20 border border-amber-400/40 px-2.5 py-1 rounded-md">
                                <span className="text-xs text-amber-200 block uppercase font-medium">Ley Pb Pond:</span>
                                <span className="font-mono text-base font-black text-amber-300">
                                  {metricasEnVivo.leyPbPonderada.toFixed(2)}
                                </span>
                              </div>
                            </td>
                            <td className="py-4 px-4 text-right font-mono text-base font-bold text-slate-100">
                              {Number(metricasEnVivo.totalPromPb).toLocaleString('es-BO')}
                            </td>
                            <td className="py-4 px-4 text-right font-mono text-base font-bold text-emerald-400">
                              {formatBs(metricasEnVivo.totalCosto)}
                            </td>
                            <td></td>
                          </tr>
                        </tfoot>
                      </table>
                    </div>
                  </div>

                  {/* FORMULARIO DE CIERRE DE LOTE GENERAL */}
                  <form onSubmit={handleCerrarLoteGeneral} className="card border border-emerald-300 bg-white shadow-md p-6 space-y-4">
                    <div className="border-b border-gray-100 pb-3 flex items-center justify-between">
                      <div>
                        <h3 className="text-lg font-bold text-gray-900 flex items-center gap-2">
                          <Lock className="h-5 w-5 text-emerald-600" />
                          <span>2. Cierre y Generación de Lote General</span>
                        </h3>
                        <p className="text-xs text-gray-500">
                          Al cerrar, se consolidará la venta en la base de datos y se generarán los comprobantes de exportación.
                        </p>
                      </div>
                      <span className="text-xs font-semibold px-2.5 py-1 rounded bg-emerald-100 text-emerald-800">
                        {metricasEnVivo.cantidad} lotes incluidos
                      </span>
                    </div>

                    <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
                      <div>
                        <label className="block text-xs font-semibold text-gray-700 mb-1">
                          N° de Lote General *
                        </label>
                        <input
                          type="text"
                          value={numeroLoteGeneral}
                          onChange={(e) => setNumeroLoteGeneral(e.target.value)}
                          placeholder="Ej: LOTE-GRAL-001"
                          className="input font-mono font-bold text-base text-emerald-900"
                          required
                        />
                      </div>
                      {(filtroTipoMineral === 'PLATA' || filtroTipoMineral === 'COMPLEJO') && (
                        <div>
                          <label className="block text-xs font-semibold text-gray-700 mb-1">
                            Ley Referencia Ag
                          </label>
                          <input
                            type="number"
                            step="any"
                            value={leyReferenciaAg}
                            onChange={(e) => setLeyReferenciaAg(e.target.value)}
                            placeholder="Ej: 100"
                            className="input text-sm"
                          />
                        </div>
                      )}
                      {(filtroTipoMineral === 'PLOMO' || filtroTipoMineral === 'COMPLEJO') && (
                        <div>
                          <label className="block text-xs font-semibold text-gray-700 mb-1">
                            Ley Referencia Pb
                          </label>
                          <input
                            type="number"
                            step="any"
                            value={leyReferenciaPb}
                            onChange={(e) => setLeyReferenciaPb(e.target.value)}
                            placeholder="Ej: 60"
                            className="input text-sm"
                          />
                        </div>
                      )}
                      <div className={filtroTipoMineral === 'COMPLEJO' ? 'sm:col-span-3' : 'sm:col-span-2'}>
                        <label className="block text-xs font-semibold text-gray-700 mb-1">
                          Observaciones
                        </label>
                        <input
                          type="text"
                          value={observaciones}
                          onChange={(e) => setObservaciones(e.target.value)}
                          placeholder="Ej: Venta consolidada a comercializadora / fundición"
                          className="input text-sm"
                        />
                      </div>
                    </div>

                    <div className="flex justify-end pt-2">
                      <button
                        type="submit"
                        disabled={guardandoCierre || metricasEnVivo.cantidad === 0}
                        className="btn btn-primary btn-md inline-flex items-center gap-2 bg-emerald-600 hover:bg-emerald-700 text-white shadow-md text-base px-6 py-2.5 font-bold"
                      >
                        {guardandoCierre ? (
                          <>
                            <Loader2 className="h-5 w-5 animate-spin" />
                            <span>Cerrando y Guardando...</span>
                          </>
                        ) : (
                          <>
                            <Lock className="h-5 w-5" />
                            <span>Cerrar y Guardar Lote General ({metricasEnVivo.leyAgPonderada ? `Ley ${metricasEnVivo.leyAgPonderada.toFixed(2)}` : ''})</span>
                          </>
                        )}
                      </button>
                    </div>
                  </form>
                </>
              )}
            </div>
          )}
        </div>
      )}

      {/* ===================== PESTAÑA 2: HISTORIAL DE VENTAS ===================== */}
      {activeTab === 'HISTORIAL' && (
        <div className="card shadow-sm border border-gray-200">
          <div className="p-4 border-b border-gray-100 flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3">
            <div>
              <h2 className="text-base font-bold text-gray-900">Historial de Lotes Generales Cerrados</h2>
              <p className="text-xs text-gray-500">
                Consulta y descarga los comprobantes de ventas anteriores en cualquier momento
              </p>
            </div>
            <div className="flex items-center gap-2">
              <select
                value={filtroHistorialMineral}
                onChange={(e) => setFiltroHistorialMineral(e.target.value)}
                className="input text-xs py-1"
              >
                <option value="">Todos los minerales</option>
                <option value="PLATA">Plata</option>
                <option value="PLOMO">Plomo</option>
                <option value="COMPLEJO">Complejo</option>
              </select>
              <button
                type="button"
                onClick={loadHistorial}
                className="btn btn-secondary btn-sm p-1.5"
                title="Actualizar lista"
              >
                <RefreshCw className="h-4 w-4 text-gray-600" />
              </button>
            </div>
          </div>

          {loadingHistorial ? (
            <div className="flex justify-center py-12">
              <Loader2 className="h-8 w-8 animate-spin text-emerald-600" />
            </div>
          ) : ventasHistorial.length === 0 ? (
            <div className="p-12 text-center text-gray-500 text-xs">
              No hay lotes generales de venta cerrados en el historial
            </div>
          ) : (
            <div className="overflow-x-auto rounded-xl border border-gray-200 shadow-sm bg-white">
              <table className="w-full border-collapse">
                <thead>
                  <tr className="bg-slate-100/90 text-slate-700 text-xs font-bold uppercase tracking-wider border-b border-gray-200">
                    <th className="py-3.5 px-4 text-left">N° Lote General</th>
                    <th className="py-3.5 px-4 text-left">Fecha Cierre</th>
                    <th className="py-3.5 px-4 text-left">Mineral</th>
                    <th className="py-3.5 px-4 text-center">Cant. Lotes</th>
                    <th className="py-3.5 px-4 text-right">Peso Bruto Total</th>
                    <th className="py-3.5 px-4 text-right">Ley Ponderada</th>
                    <th className="py-3.5 px-4 text-left">Operador</th>
                    <th className="py-3.5 px-4 text-right">Acciones</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-gray-200">
                  {ventasHistorial.map((v) => (
                    <tr key={v.id} className="hover:bg-slate-50 transition-colors">
                      <td className="py-3.5 px-4 font-mono font-bold text-emerald-800 text-sm">
                        {v.numeroLoteGeneral}
                      </td>
                      <td className="py-3.5 px-4 text-sm text-gray-600">
                        {new Date(v.fecha).toLocaleDateString('es-BO')}
                      </td>
                      <td className="py-3.5 px-4 text-sm">
                        <span className="font-semibold text-gray-800">{v.tipoMineral}</span>
                      </td>
                      <td className="py-3.5 px-4 text-center font-mono font-semibold text-sm">
                        {v._count?.detalles || 0}
                      </td>
                      <td className="py-3.5 px-4 text-right font-mono font-bold text-sm text-gray-900">
                        {formatKg(v.totalPesoNeto)}
                      </td>
                      <td className="py-3.5 px-4 text-right font-mono font-bold text-sm text-emerald-700">
                        {v.leyPonderadaAg && `Ag: ${Number(v.leyPonderadaAg).toFixed(2)} `}
                        {v.leyPonderadaPb && `Pb: ${Number(v.leyPonderadaPb).toFixed(2)}`}
                      </td>
                      <td className="py-3.5 px-4 text-sm text-gray-500">{v.usuario?.nombre || 'Admin'}</td>
                      <td className="py-3.5 px-4 text-right">
                        <div className="flex items-center justify-end gap-1.5">
                          <button
                            type="button"
                            onClick={() => handleVerDetalle(v.id)}
                            className="rounded-lg p-2 text-gray-600 hover:bg-gray-100 hover:text-indigo-600 transition-colors"
                            title="Ver Matriz y Detalle"
                          >
                            <Eye className="h-4 w-4" />
                          </button>
                          <button
                            type="button"
                            onClick={() => ventaService.downloadExcel(v.id, `venta-${v.numeroLoteGeneral}.xlsx`)}
                            className="rounded-lg p-2 text-emerald-700 hover:bg-emerald-50 transition-colors"
                            title="Descargar Excel (.xlsx)"
                          >
                            <FileSpreadsheet className="h-4 w-4" />
                          </button>
                          <button
                            type="button"
                            onClick={() => ventaService.downloadPdf(v.id, `venta-${v.numeroLoteGeneral}.pdf`)}
                            className="rounded-lg p-2 text-red-600 hover:bg-red-50 transition-colors"
                            title="Descargar PDF"
                          >
                            <FileDown className="h-4 w-4" />
                          </button>
                        </div>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </div>
      )}

      {/* MODAL DE DETALLE DE VENTA CERRADA */}
      <Modal
        open={detalleModalOpen}
        onClose={() => setDetalleModalOpen(false)}
        title={ventaDetalleItem ? `Detalle — ${ventaDetalleItem.numeroLoteGeneral}` : 'Detalle'}
        size="full"
      >
        {loadingDetalle ? (
          <div className="flex justify-center py-12">
            <Loader2 className="h-8 w-8 animate-spin text-emerald-600" />
          </div>
        ) : ventaDetalleItem ? (
          <div className="space-y-4">
            <div className="flex flex-wrap items-center justify-between gap-3 p-4 bg-emerald-50/70 border border-emerald-200 rounded-lg">
              <div>
                <p className="text-xs text-emerald-800 font-bold uppercase tracking-wider">
                  Lote General: {ventaDetalleItem.numeroLoteGeneral}
                </p>
                <p className="text-xs text-gray-600 mt-0.5">
                  Mineral: {ventaDetalleItem.tipoMineral} · Fecha: {new Date(ventaDetalleItem.fecha).toLocaleDateString('es-BO')}
                </p>
                {ventaDetalleItem.observaciones && (
                  <p className="text-xs text-gray-700 mt-1 italic">
                    Observaciones: {ventaDetalleItem.observaciones}
                  </p>
                )}
              </div>
              <div className="flex items-center gap-2">
                <button
                  type="button"
                  onClick={() => ventaService.downloadExcel(ventaDetalleItem.id, `venta-${ventaDetalleItem.numeroLoteGeneral}.xlsx`)}
                  className="btn btn-secondary btn-sm inline-flex items-center gap-1.5 text-emerald-800 border-emerald-300 hover:bg-emerald-100"
                >
                  <FileSpreadsheet className="h-4 w-4 text-emerald-600" />
                  <span>Descargar Excel</span>
                </button>
                <button
                  type="button"
                  onClick={() => ventaService.downloadPdf(ventaDetalleItem.id, `venta-${ventaDetalleItem.numeroLoteGeneral}.pdf`)}
                  className="btn btn-secondary btn-sm inline-flex items-center gap-1.5 text-red-800 border-red-300 hover:bg-red-50"
                >
                  <FileDown className="h-4 w-4 text-red-600" />
                  <span>Descargar PDF</span>
                </button>
              </div>
            </div>

            <div className="overflow-x-auto border border-gray-200 rounded-xl shadow-sm bg-white">
              <table className="w-full border-collapse">
                <thead>
                  <tr className="bg-slate-100/90 text-slate-700 text-xs font-bold uppercase tracking-wider border-b border-gray-200">
                    <th className="py-3.5 px-4 text-left">Lote</th>
                    <th className="py-3.5 px-4 text-left">Proveedor</th>
                    <th className="py-3.5 px-4 text-right">Peso Bruto (kg)</th>
                    {ventaDetalleItem.tipoMineral !== 'PLOMO' && (
                      <>
                        <th className="py-3.5 px-4 text-right">Ley Ag</th>
                        <th className="py-3.5 px-4 text-right">Prom. Ag</th>
                      </>
                    )}
                    {ventaDetalleItem.tipoMineral !== 'PLATA' && (
                      <>
                        <th className="py-3.5 px-4 text-right">Ley Pb</th>
                        <th className="py-3.5 px-4 text-right">Prom. Pb</th>
                      </>
                    )}
                    <th className="py-3.5 px-4 text-right">Valor Bruto (Bs)</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-gray-200">
                  {ventaDetalleItem.detalles?.map((d) => (
                    <tr key={d.id} className="hover:bg-slate-50 transition-colors">
                      <td className="py-3.5 px-4 font-mono font-bold text-emerald-800 text-sm">
                        {d.numeroLote}
                      </td>
                      <td className="py-3.5 px-4 font-medium text-sm text-gray-900">
                        {d.internacion?.proveedor?.nombreCompleto || '—'}
                      </td>
                      <td className="py-3.5 px-4 text-right font-mono font-bold text-sm text-gray-900">
                        {formatKg(d.pesoNeto)}
                      </td>
                      {ventaDetalleItem.tipoMineral !== 'PLOMO' && (
                        <>
                          <td className="py-3.5 px-4 text-right">
                            <span className="font-mono font-bold text-sm bg-slate-100 px-2 py-0.5 rounded text-slate-800">
                              {d.leyAg ?? '—'}
                            </span>
                          </td>
                          <td className="py-3.5 px-4 text-right font-mono font-medium text-sm text-gray-900">
                            {d.promedioAg ? Number(d.promedioAg).toLocaleString('es-BO') : '—'}
                          </td>
                        </>
                      )}
                      {ventaDetalleItem.tipoMineral !== 'PLATA' && (
                        <>
                          <td className="py-3.5 px-4 text-right">
                            <span className="font-mono font-bold text-sm bg-zinc-100 px-2 py-0.5 rounded text-zinc-800">
                              {d.leyPb ?? '—'}
                            </span>
                          </td>
                          <td className="py-3.5 px-4 text-right font-mono font-medium text-sm text-gray-900">
                            {d.promedioPb ? Number(d.promedioPb).toLocaleString('es-BO') : '—'}
                          </td>
                        </>
                      )}
                      <td className="py-3.5 px-4 text-right font-mono text-sm text-gray-600">
                        {formatBs(d.costoCompra)}
                      </td>
                    </tr>
                  ))}
                  <tr className="bg-slate-900 text-white font-bold border-t-2 border-emerald-500">
                    <td colSpan={2} className="py-4 px-4 text-right uppercase tracking-wider text-xs text-slate-300">
                      TOTALES:
                    </td>
                    <td className="py-4 px-4 text-right font-mono text-base font-bold text-emerald-400">
                      {formatKg(ventaDetalleItem.totalPesoNeto)}
                    </td>
                    {ventaDetalleItem.tipoMineral !== 'PLOMO' && (
                      <>
                        <td className="py-4 px-4 text-right">
                          <span className="font-mono text-base font-black text-amber-300">
                            Pond: {Number(ventaDetalleItem.leyPonderadaAg || 0).toFixed(2)}
                          </span>
                        </td>
                        <td className="py-4 px-4 text-right font-mono text-base font-bold text-slate-100">
                          {Number(ventaDetalleItem.totalPromedioAg || 0).toLocaleString('es-BO')}
                        </td>
                      </>
                    )}
                    {ventaDetalleItem.tipoMineral !== 'PLATA' && (
                      <>
                        <td className="py-4 px-4 text-right">
                          <span className="font-mono text-base font-black text-amber-300">
                            Pond: {Number(ventaDetalleItem.leyPonderadaPb || 0).toFixed(2)}
                          </span>
                        </td>
                        <td className="py-4 px-4 text-right font-mono text-base font-bold text-slate-100">
                          {Number(ventaDetalleItem.totalPromedioPb || 0).toLocaleString('es-BO')}
                        </td>
                      </>
                    )}
                    <td className="py-4 px-4 text-right font-mono text-base font-bold text-emerald-400">
                      {formatBs(ventaDetalleItem.costoTotalCompra)}
                    </td>
                  </tr>
                </tbody>
              </table>
            </div>
          </div>
        ) : null}
      </Modal>

      {/* MODAL DE CIERRE EXITOSO CON BOTONES DE DESCARGA INMEDIATA */}
      <Modal
        open={cierreExitosoModalOpen}
        onClose={() => setCierreExitosoModalOpen(false)}
        title="✅ Lote General Cerrado y Guardado"
        size="md"
      >
        {ventaRecienCreada && (
          <div className="space-y-4 text-center py-2">
            <div className="h-14 w-14 rounded-full bg-emerald-100 text-emerald-600 mx-auto flex items-center justify-center">
              <CheckCircle2 className="h-8 w-8" />
            </div>
            <div>
              <h3 className="text-lg font-bold text-gray-900">
                {ventaRecienCreada.numeroLoteGeneral}
              </h3>
              <p className="text-xs text-gray-600 mt-1">
                La venta ha sido consolidada con éxito en la base de datos con un peso neto de{' '}
                <strong>{formatKg(ventaRecienCreada.totalPesoNeto)}</strong> y Ley Ponderada de{' '}
                <strong className="text-emerald-700">
                  {ventaRecienCreada.leyPonderadaAg ? Number(ventaRecienCreada.leyPonderadaAg).toFixed(2) : Number(ventaRecienCreada.leyPonderadaPb).toFixed(2)}
                </strong>.
              </p>
            </div>

            <div className="grid grid-cols-2 gap-3 pt-2">
              <button
                type="button"
                onClick={() => ventaService.downloadExcel(ventaRecienCreada.id, `venta-${ventaRecienCreada.numeroLoteGeneral}.xlsx`)}
                className="btn btn-secondary btn-md inline-flex items-center justify-center gap-2 border-emerald-300 text-emerald-800 hover:bg-emerald-50"
              >
                <FileSpreadsheet className="h-4 w-4 text-emerald-600" />
                <span>Descargar Excel</span>
              </button>
              <button
                type="button"
                onClick={() => ventaService.downloadPdf(ventaRecienCreada.id, `venta-${ventaRecienCreada.numeroLoteGeneral}.pdf`)}
                className="btn btn-secondary btn-md inline-flex items-center justify-center gap-2 border-red-300 text-red-800 hover:bg-red-50"
              >
                <FileDown className="h-4 w-4 text-red-600" />
                <span>Descargar PDF</span>
              </button>
            </div>

            <div className="pt-2">
              <button
                type="button"
                onClick={() => {
                  setCierreExitosoModalOpen(false);
                  setActiveTab('HISTORIAL');
                }}
                className="btn btn-primary btn-sm w-full bg-emerald-600 text-white"
              >
                Ir al Historial de Ventas
              </button>
            </div>
          </div>
        )}
      </Modal>
    </div>
  );
};

export default MineralSales;
