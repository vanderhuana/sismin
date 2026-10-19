import { useState, useEffect, useMemo } from 'react';
import { useForm } from 'react-hook-form';
import { anticipoService, providerService, handleApiError } from '../services/api';
import Modal from '../components/ui/Modal';
import {
  Coins,
  Plus,
  Search,
  FileDown,
  Loader2,
  AlertCircle,
  CheckCircle2,
  User,
  Calendar,
  Layers,
  Printer,
  History,
  TrendingDown,
  Wallet,
  AlertTriangle,
  Receipt,
  FileText,
  DollarSign,
  Building,
  RefreshCw,
  Eye,
  CheckSquare,
  Sparkles
} from 'lucide-react';

const formatBs = (n) =>
  Number(Math.trunc(n) || 0).toLocaleString('es-BO', {
    style: 'currency',
    currency: 'BOB',
    minimumFractionDigits: 0,
    maximumFractionDigits: 0
  });

const formatFecha = (f) => {
  if (!f) return '-';
  const d = new Date(f);
  return d.toLocaleDateString('es-BO', {
    day: '2-digit',
    month: '2-digit',
    year: 'numeric'
  });
};

const MOTIVOS_RAPIDOS = [
  'Compra de explosivos / dinamita',
  'Combustible / Transporte',
  'Víveres y campamento',
  'Herramientas y repuestos',
  'Adelanto de caja / personal',
  'Servicio de maquinaria'
];

const Anticipos = () => {
  const [activeTab, setActiveTab] = useState('PROVEEDORES'); // 'PROVEEDORES' | 'HISTORIAL'
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [success, setSuccess] = useState(null);

  // Datos
  const [resumenProveedores, setResumenProveedores] = useState([]);
  const [granTotalPendiente, setGranTotalPendiente] = useState(0);
  const [historialAnticipos, setHistorialAnticipos] = useState([]);
  const [totalHistorial, setTotalHistorial] = useState(0);
  const [proveedoresLista, setProveedoresLista] = useState([]);

  // Filtros Historial
  const [filtroEstado, setFiltroEstado] = useState('TODOS');
  const [filtroBusqueda, setFiltroBusqueda] = useState('');
  const [filtroProveedorId, setFiltroProveedorId] = useState('');
  const [filtroFechaDesde, setFiltroFechaDesde] = useState('');
  const [filtroFechaHasta, setFiltroFechaHasta] = useState('');

  // Modal Nuevo Anticipo
  const [modalNuevoOpen, setModalNuevoOpen] = useState(false);
  const [guardando, setGuardando] = useState(false);
  const [descargandoPdfId, setDescargandoPdfId] = useState(null);

  // Modal Detalle de Amortizaciones
  const [modalAmortizacionesOpen, setModalAmortizacionesOpen] = useState(false);
  const [anticipoSeleccionado, setAnticipoSeleccionado] = useState(null);

  // Modal Éxito con descarga directa
  const [modalExitoOpen, setModalExitoOpen] = useState(false);
  const [anticipoRecienCreado, setAnticipoRecienCreado] = useState(null);

  const {
    register,
    handleSubmit,
    reset,
    setValue,
    watch,
    formState: { errors }
  } = useForm({
    defaultValues: {
      proveedorId: '',
      monto: '',
      fecha: new Date().toISOString().split('T')[0],
      glosa: '',
      observacion: ''
    }
  });

  const showSuccessMsg = (msg) => {
    setSuccess(msg);
    setTimeout(() => setSuccess(null), 4000);
  };

  // Cargar datos principales
  const loadData = async () => {
    try {
      setLoading(true);
      setError(null);

      const [resumenRes, provsRes] = await Promise.all([
        anticipoService.getResumenProveedores(),
        providerService.getActiveProviders()
      ]);

      setResumenProveedores(resumenRes.proveedores || []);
      setGranTotalPendiente(resumenRes.granTotalSaldoPendiente || 0);
      setProveedoresLista(provsRes.providers || provsRes || []);

      // Cargar historial inicial
      await loadHistorial();
    } catch (err) {
      setError(handleApiError(err));
    } finally {
      setLoading(false);
    }
  };

  // Cargar historial de anticipos según filtros
  const loadHistorial = async () => {
    try {
      const res = await anticipoService.getAnticipos({
        estado: filtroEstado !== 'TODOS' ? filtroEstado : undefined,
        proveedorId: filtroProveedorId || undefined,
        fechaDesde: filtroFechaDesde || undefined,
        fechaHasta: filtroFechaHasta || undefined,
        search: filtroBusqueda || undefined,
        limit: 50
      });

      setHistorialAnticipos(res.anticipos || []);
      setTotalHistorial(res.total || 0);
    } catch (err) {
      setError(handleApiError(err));
    }
  };

  useEffect(() => {
    loadData();
  }, []);

  useEffect(() => {
    if (!loading) {
      loadHistorial();
    }
  }, [filtroEstado, filtroProveedorId, filtroFechaDesde, filtroFechaHasta]);

  // Manejar búsqueda en historial
  const handleBuscarHistorial = (e) => {
    e.preventDefault();
    loadHistorial();
  };

  // Descargar Vale en PDF
  const handleDownloadValePdf = async (id, codigoVale) => {
    try {
      setDescargandoPdfId(id);
      const res = await anticipoService.downloadValePdf(id);
      const url = window.URL.createObjectURL(new Blob([res.data], { type: 'application/pdf' }));
      const link = document.createElement('a');
      link.href = url;
      link.download = `vale-anticipo-${codigoVale || id}.pdf`;
      link.click();
      window.URL.revokeObjectURL(url);
    } catch (err) {
      setError(handleApiError(err));
    } finally {
      setDescargandoPdfId(null);
    }
  };

  // Abrir modal para un proveedor preseleccionado
  const abrirModalNuevoParaProveedor = (provId) => {
    reset({
      proveedorId: String(provId),
      monto: '',
      fecha: new Date().toISOString().split('T')[0],
      glosa: '',
      observacion: ''
    });
    setModalNuevoOpen(true);
  };

  // Guardar nuevo anticipo
  const onSubmitNuevo = async (formData) => {
    try {
      setGuardando(true);
      setError(null);

      const payload = {
        proveedorId: parseInt(formData.proveedorId, 10),
        monto: Math.trunc(parseFloat(formData.monto)),
        fecha: formData.fecha ? `${formData.fecha}T12:00:00.000Z` : undefined,
        glosa: formData.glosa?.trim() || 'Anticipo entregado en caja',
        observacion: formData.observacion?.trim() || null
      };

      const res = await anticipoService.createAnticipo(payload);
      setModalNuevoOpen(false);
      reset();

      // Abrir modal de éxito con opción de impresión directa
      setAnticipoRecienCreado(res.anticipo);
      setModalExitoOpen(true);

      showSuccessMsg(res.message);
      loadData();
    } catch (err) {
      setError(handleApiError(err));
    } finally {
      setGuardando(false);
    }
  };

  // Ver amortizaciones de un anticipo
  const handleVerAmortizaciones = (anticipo) => {
    setAnticipoSeleccionado(anticipo);
    setModalAmortizacionesOpen(true);
  };

  // Proveedores filtrados para la vista de resumen
  const proveedoresFiltrados = useMemo(() => {
    if (!filtroBusqueda.trim()) return resumenProveedores;
    const q = filtroBusqueda.toLowerCase();
    return resumenProveedores.filter(
      (p) =>
        p.nombreCompleto?.toLowerCase().includes(q) ||
        p.ci?.toLowerCase().includes(q)
    );
  }, [resumenProveedores, filtroBusqueda]);

  return (
    <div className="space-y-6">
      {/* Encabezado */}
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
        <div>
          <div className="flex items-center gap-2">
            <div className="w-10 h-10 rounded-xl bg-amber-500/10 border border-amber-500/20 flex items-center justify-center text-amber-600">
              <Coins className="h-6 w-6" />
            </div>
            <div>
              <h1 className="text-2xl font-bold text-gray-900 flex items-center gap-2">
                <span>Anticipos a Proveedores</span>
                <span className="text-xs px-2.5 py-0.5 rounded-full bg-slate-900 text-white font-mono">
                  EMPRESA MINERA AyM
                </span>
              </h1>
              <p className="text-xs text-gray-500">
                Gestión independiente de préstamos y adelantos con emisión de vales impresos y control de saldos
              </p>
            </div>
          </div>
        </div>

        {/* Botón de Acción Principal y Pestañas */}
        <div className="flex items-center gap-3">
          <div className="flex rounded-lg bg-gray-100 p-1 border border-gray-200">
            <button
              type="button"
              onClick={() => setActiveTab('PROVEEDORES')}
              className={`flex items-center gap-1.5 px-3.5 py-1.5 text-xs font-semibold rounded-md transition-all ${
                activeTab === 'PROVEEDORES'
                  ? 'bg-white text-gray-900 shadow-xs'
                  : 'text-gray-600 hover:text-gray-900'
              }`}
            >
              <User className="h-3.5 w-3.5 text-emerald-600" />
              <span>Saldos por Proveedor</span>
            </button>
            <button
              type="button"
              onClick={() => setActiveTab('HISTORIAL')}
              className={`flex items-center gap-1.5 px-3.5 py-1.5 text-xs font-semibold rounded-md transition-all ${
                activeTab === 'HISTORIAL'
                  ? 'bg-white text-gray-900 shadow-xs'
                  : 'text-gray-600 hover:text-gray-900'
              }`}
            >
              <History className="h-3.5 w-3.5 text-blue-600" />
              <span>Historial de Vales ({totalHistorial})</span>
            </button>
          </div>

          <button
            type="button"
            onClick={() => {
              reset({
                proveedorId: '',
                monto: '',
                fecha: new Date().toISOString().split('T')[0],
                glosa: '',
                observacion: ''
              });
              setModalNuevoOpen(true);
            }}
            className="btn btn-primary bg-amber-600 hover:bg-amber-700 text-white text-xs font-bold px-4 py-2 shadow-sm inline-flex items-center gap-2"
          >
            <Plus className="h-4 w-4" />
            <span>+ Registrar Anticipo</span>
          </button>
        </div>
      </div>

      {/* Alertas */}
      {error && (
        <div className="flex items-start gap-3 rounded-xl border border-red-200 bg-red-50 p-4 shadow-sm">
          <AlertCircle className="h-5 w-5 shrink-0 text-red-500 mt-0.5" />
          <div className="flex-1">
            <h4 className="text-sm font-semibold text-red-800">Atención</h4>
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

      {/* Tarjetas Métricas KPI */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
        <div className="card p-4 border border-amber-200 bg-linear-to-br from-amber-50/70 to-white shadow-xs">
          <div className="flex items-center justify-between">
            <span className="text-xs font-bold text-amber-900 uppercase tracking-wider">
              Saldo Pendiente Total
            </span>
            <div className="p-2 rounded-lg bg-amber-100 text-amber-700">
              <Wallet className="h-4 w-4" />
            </div>
          </div>
          <p className="text-2xl font-black text-amber-900 mt-2 font-mono">
            {formatBs(granTotalPendiente)}
          </p>
          <p className="text-[11px] text-amber-700 mt-1">
            Deuda activa por cobrar en liquidaciones futuras
          </p>
        </div>

        <div className="card p-4 border border-blue-200 bg-linear-to-br from-blue-50/70 to-white shadow-xs">
          <div className="flex items-center justify-between">
            <span className="text-xs font-bold text-blue-900 uppercase tracking-wider">
              Proveedores con Deuda
            </span>
            <div className="p-2 rounded-lg bg-blue-100 text-blue-700">
              <User className="h-4 w-4" />
            </div>
          </div>
          <p className="text-2xl font-black text-blue-900 mt-2 font-mono">
            {resumenProveedores.length}
          </p>
          <p className="text-[11px] text-blue-700 mt-1">
            Mineros con anticipos vigentes de caja
          </p>
        </div>

        <div className="card p-4 border border-emerald-200 bg-linear-to-br from-emerald-50/70 to-white shadow-xs">
          <div className="flex items-center justify-between">
            <span className="text-xs font-bold text-emerald-900 uppercase tracking-wider">
              Vales Emitidos
            </span>
            <div className="p-2 rounded-lg bg-emerald-100 text-emerald-700">
              <Receipt className="h-4 w-4" />
            </div>
          </div>
          <p className="text-2xl font-black text-emerald-900 mt-2 font-mono">
            {totalHistorial}
          </p>
          <p className="text-[11px] text-emerald-700 mt-1">
            Total comprobantes registrados en el sistema
          </p>
        </div>

        <div className="card p-4 border border-slate-200 bg-linear-to-br from-slate-50 to-white shadow-xs">
          <div className="flex items-center justify-between">
            <span className="text-xs font-bold text-slate-800 uppercase tracking-wider">
              Estado del Módulo
            </span>
            <div className="p-2 rounded-lg bg-slate-200 text-slate-700">
              <CheckSquare className="h-4 w-4" />
            </div>
          </div>
          <div className="flex items-center gap-2 mt-2">
            <span className="w-2.5 h-2.5 rounded-full bg-emerald-500 animate-pulse"></span>
            <p className="text-sm font-bold text-slate-800">Sincronizado</p>
          </div>
          <p className="text-[11px] text-slate-500 mt-1">
            Vinculado con báscula y liquidación de lotes
          </p>
        </div>
      </div>

      {/* ======================= PESTAÑA 1: RESUMEN POR PROVEEDOR ======================= */}
      {activeTab === 'PROVEEDORES' && (
        <div className="space-y-4">
          {/* Barra de búsqueda de proveedor */}
          <div className="card p-3.5 bg-white border border-gray-200 flex flex-wrap items-center justify-between gap-3 shadow-xs">
            <div className="relative flex-1 min-w-[240px]">
              <Search className="absolute left-3 top-2.5 h-4 w-4 text-gray-400" />
              <input
                type="text"
                value={filtroBusqueda}
                onChange={(e) => setFiltroBusqueda(e.target.value)}
                placeholder="Buscar por nombre o CI de proveedor..."
                className="input input-sm pl-9 text-xs w-full"
              />
            </div>
            <button
              type="button"
              onClick={loadData}
              disabled={loading}
              className="btn btn-secondary btn-sm inline-flex items-center gap-1.5 text-xs text-gray-600 hover:text-gray-900"
            >
              <RefreshCw className={`h-3.5 w-3.5 ${loading ? 'animate-spin' : ''}`} />
              <span>Actualizar</span>
            </button>
          </div>

          {loading ? (
            <div className="card p-12 text-center text-gray-500">
              <Loader2 className="h-8 w-8 animate-spin mx-auto text-amber-600 mb-2" />
              <p className="text-xs">Cargando saldos y anticipos...</p>
            </div>
          ) : proveedoresFiltrados.length === 0 ? (
            <div className="card p-12 text-center border-2 border-dashed border-gray-200 bg-white rounded-2xl">
              <Coins className="h-12 w-12 text-gray-300 mx-auto mb-2" />
              <h3 className="text-base font-bold text-gray-800">No hay proveedores con anticipos pendientes</h3>
              <p className="text-xs text-gray-500 mt-1 max-w-sm mx-auto">
                No existen deudas activas en este momento. Cuando entregues un anticipo de oficina, aparecerá aquí su saldo.
              </p>
              <button
                type="button"
                onClick={() => setModalNuevoOpen(true)}
                className="btn btn-primary bg-amber-600 hover:bg-amber-700 text-white text-xs font-bold px-4 py-2 mt-4 inline-flex items-center gap-1.5"
              >
                <Plus className="h-4 w-4" />
                <span>+ Registrar Primer Anticipo</span>
              </button>
            </div>
          ) : (
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
              {proveedoresFiltrados.map((prov) => (
                <div
                  key={prov.proveedorId}
                  className="card border border-gray-200 bg-white p-4 shadow-sm hover:shadow-md transition-all space-y-3 rounded-xl"
                >
                  <div className="flex items-start justify-between gap-2 border-b border-gray-100 pb-2.5">
                    <div>
                      <h3 className="text-sm font-bold text-gray-900">{prov.nombreCompleto}</h3>
                      <p className="text-xs text-gray-500 font-mono mt-0.5">
                        CI: <span className="font-semibold text-gray-700">{prov.ci || 'S/N'}</span>
                        {prov.telefono && ` • Tel: ${prov.telefono}`}
                      </p>
                    </div>
                    <span className="badge bg-amber-100 text-amber-900 border border-amber-300 text-[10px] font-bold px-2 py-0.5">
                      {prov.cantidadAnticiposActivos} {prov.cantidadAnticiposActivos === 1 ? 'vale activo' : 'vales activos'}
                    </span>
                  </div>

                  {/* Saldo Pendiente Destacado */}
                  <div className="rounded-lg bg-amber-50/70 border border-amber-200 p-2.5">
                    <div className="flex items-center justify-between">
                      <span className="text-[11px] font-semibold text-amber-800">Saldo Pendiente:</span>
                      <span className="text-base font-black text-amber-950 font-mono">
                        {formatBs(prov.saldoPendienteTotal)}
                      </span>
                    </div>
                    <div className="flex items-center justify-between text-[10px] text-gray-500 mt-1">
                      <span>Monto original entregado:</span>
                      <span>{formatBs(prov.montoOriginalTotal)}</span>
                    </div>
                  </div>

                  {/* Mini-lista de vales activos */}
                  <div className="space-y-1.5">
                    <p className="text-[10px] font-bold text-gray-500 uppercase">Vales con saldo:</p>
                    {prov.anticipos.map((ant) => (
                      <div
                        key={ant.id}
                        className="flex items-center justify-between text-xs bg-gray-50 p-2 rounded border border-gray-200"
                      >
                        <div className="flex-1 truncate mr-2">
                          <span className="font-mono font-bold text-slate-800 mr-1.5">{ant.codigoVale}</span>
                          <span className="text-[11px] text-gray-500 truncate">{ant.glosa}</span>
                        </div>
                        <div className="flex items-center gap-1.5 shrink-0">
                          <span className="font-mono font-bold text-amber-700">{formatBs(ant.saldoPendiente)}</span>
                          <button
                            type="button"
                            onClick={() => handleDownloadValePdf(ant.id, ant.codigoVale)}
                            disabled={descargandoPdfId === ant.id}
                            className="p-1 rounded text-gray-500 hover:text-amber-700 hover:bg-amber-50"
                            title="Descargar Vale PDF"
                          >
                            {descargandoPdfId === ant.id ? (
                              <Loader2 className="h-3.5 w-3.5 animate-spin" />
                            ) : (
                              <Printer className="h-3.5 w-3.5" />
                            )}
                          </button>
                        </div>
                      </div>
                    ))}
                  </div>

                  {/* Botones de Acción */}
                  <div className="flex items-center justify-end gap-2 pt-2 border-t border-gray-100">
                    <button
                      type="button"
                      onClick={() => abrirModalNuevoParaProveedor(prov.proveedorId)}
                      className="btn btn-primary btn-sm bg-amber-600 hover:bg-amber-700 text-white text-xs font-bold inline-flex items-center gap-1 px-3 py-1.5"
                    >
                      <Plus className="h-3.5 w-3.5" />
                      <span>Dar Anticipo</span>
                    </button>
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>
      )}

      {/* ======================= PESTAÑA 2: HISTORIAL DE VALES ======================= */}
      {activeTab === 'HISTORIAL' && (
        <div className="space-y-4">
          {/* Filtros de Historial */}
          <div className="card p-4 bg-white border border-gray-200 shadow-xs space-y-3">
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-3">
              <div>
                <label className="block text-xs font-bold text-gray-700 mb-1">Estado del Anticipo</label>
                <select
                  value={filtroEstado}
                  onChange={(e) => setFiltroEstado(e.target.value)}
                  className="input input-sm text-xs w-full"
                >
                  <option value="TODOS">Todos los Estados</option>
                  <option value="PENDIENTE">🟢 Pendiente (100% por cobrar)</option>
                  <option value="PARCIAL">🟡 Parcial (Cobrado parcialmente)</option>
                  <option value="COBRADO">⚪ Cobrado Total (Saldo Bs 0)</option>
                </select>
              </div>

              <div>
                <label className="block text-xs font-bold text-gray-700 mb-1">Filtrar por Proveedor</label>
                <select
                  value={filtroProveedorId}
                  onChange={(e) => setFiltroProveedorId(e.target.value)}
                  className="input input-sm text-xs w-full"
                >
                  <option value="">Todos los Proveedores</option>
                  {proveedoresLista.map((p) => (
                    <option key={p.id} value={p.id}>
                      {p.nombreCompleto} ({p.ci || 'S/N'})
                    </option>
                  ))}
                </select>
              </div>

              <div>
                <label className="block text-xs font-bold text-gray-700 mb-1">Desde Fecha</label>
                <input
                  type="date"
                  value={filtroFechaDesde}
                  onChange={(e) => setFiltroFechaDesde(e.target.value)}
                  className="input input-sm text-xs w-full"
                />
              </div>

              <div>
                <label className="block text-xs font-bold text-gray-700 mb-1">Hasta Fecha</label>
                <input
                  type="date"
                  value={filtroFechaHasta}
                  onChange={(e) => setFiltroFechaHasta(e.target.value)}
                  className="input input-sm text-xs w-full"
                />
              </div>
            </div>

            {/* Búsqueda de texto */}
            <form onSubmit={handleBuscarHistorial} className="flex items-center gap-2 pt-1">
              <div className="relative flex-1">
                <Search className="absolute left-3 top-2.5 h-4 w-4 text-gray-400" />
                <input
                  type="text"
                  value={filtroBusqueda}
                  onChange={(e) => setFiltroBusqueda(e.target.value)}
                  placeholder="Buscar por código de vale, concepto, o minero..."
                  className="input input-sm pl-9 text-xs w-full"
                />
              </div>
              <button
                type="submit"
                className="btn btn-secondary btn-sm text-xs font-semibold px-4"
              >
                Buscar
              </button>
              {(filtroBusqueda || filtroProveedorId || filtroFechaDesde || filtroFechaHasta || filtroEstado !== 'TODOS') && (
                <button
                  type="button"
                  onClick={() => {
                    setFiltroBusqueda('');
                    setFiltroProveedorId('');
                    setFiltroFechaDesde('');
                    setFiltroFechaHasta('');
                    setFiltroEstado('TODOS');
                  }}
                  className="btn btn-secondary btn-sm text-xs text-red-600 hover:bg-red-50"
                >
                  Limpiar Filtros
                </button>
              )}
            </form>
          </div>

          {/* Tabla de Historial */}
          <div className="card overflow-hidden border border-gray-200 bg-white shadow-xs">
            <div className="overflow-x-auto">
              <table className="w-full text-left text-xs">
                <thead className="bg-gray-50 border-b border-gray-200 text-gray-700 font-bold uppercase tracking-wider text-[11px]">
                  <tr>
                    <th className="py-3 px-4">Código Vale</th>
                    <th className="py-3 px-4">Fecha</th>
                    <th className="py-3 px-4">Proveedor</th>
                    <th className="py-3 px-4">Concepto / Glosa</th>
                    <th className="py-3 px-4 text-right">Monto Original</th>
                    <th className="py-3 px-4 text-right">Saldo Pendiente</th>
                    <th className="py-3 px-4 text-center">Estado</th>
                    <th className="py-3 px-4 text-center">Acciones</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-gray-100">
                  {historialAnticipos.length === 0 ? (
                    <tr>
                      <td colSpan="8" className="py-8 text-center text-gray-500">
                        No se encontraron anticipos con los filtros seleccionados.
                      </td>
                    </tr>
                  ) : (
                    historialAnticipos.map((item) => (
                      <tr key={item.id} className="hover:bg-gray-50/80 transition-colors">
                        <td className="py-3 px-4 font-mono font-bold text-slate-900">
                          {item.codigoVale || `VALE-${item.id}`}
                        </td>
                        <td className="py-3 px-4 text-gray-600 font-mono">
                          {formatFecha(item.fecha)}
                        </td>
                        <td className="py-3 px-4">
                          <p className="font-semibold text-gray-900">{item.proveedor?.nombreCompleto || 'Sin nombre'}</p>
                          <p className="text-[10px] text-gray-500 font-mono">CI: {item.proveedor?.ci || 'S/N'}</p>
                        </td>
                        <td className="py-3 px-4 text-gray-700 max-w-xs truncate" title={item.glosa}>
                          {item.glosa}
                          {item.internacion?.lote && (
                            <span className="ml-1 text-[10px] text-blue-600 bg-blue-50 px-1.5 py-0.5 rounded border border-blue-200">
                              Báscula: {item.internacion.lote}
                            </span>
                          )}
                        </td>
                        <td className="py-3 px-4 text-right font-mono font-semibold text-gray-900">
                          {formatBs(item.monto)}
                        </td>
                        <td className="py-3 px-4 text-right font-mono font-bold text-amber-700">
                          {formatBs(item.saldoPendiente)}
                        </td>
                        <td className="py-3 px-4 text-center">
                          {item.estado === 'PENDIENTE' && (
                            <span className="badge bg-blue-100 text-blue-800 border border-blue-200 text-[10px] font-bold">
                              🟢 Pendiente
                            </span>
                          )}
                          {item.estado === 'PARCIAL' && (
                            <span className="badge bg-amber-100 text-amber-800 border border-amber-200 text-[10px] font-bold">
                              🟡 Parcial
                            </span>
                          )}
                          {item.estado === 'COBRADO' && (
                            <span className="badge bg-emerald-100 text-emerald-800 border border-emerald-200 text-[10px] font-bold">
                              ⚪ Cobrado Total
                            </span>
                          )}
                          {item.estado === 'ANULADO' && (
                            <span className="badge bg-red-100 text-red-800 border border-red-200 text-[10px] font-bold">
                              ❌ Anulado
                            </span>
                          )}
                        </td>
                        <td className="py-3 px-4 text-center">
                          <div className="flex items-center justify-center gap-1.5">
                            {/* Botón Imprimir Vale PDF */}
                            <button
                              type="button"
                              onClick={() => handleDownloadValePdf(item.id, item.codigoVale)}
                              disabled={descargandoPdfId === item.id}
                              className="btn btn-secondary btn-sm p-1.5 text-xs text-amber-800 hover:bg-amber-50 border border-amber-200"
                              title="Imprimir Vale de Anticipo en PDF"
                            >
                              {descargandoPdfId === item.id ? (
                                <Loader2 className="h-3.5 w-3.5 animate-spin" />
                              ) : (
                                <Printer className="h-3.5 w-3.5" />
                              )}
                            </button>

                            {/* Botón Ver Amortizaciones si tiene descuentos */}
                            {item.descuentos && item.descuentos.length > 0 && (
                              <button
                                type="button"
                                onClick={() => handleVerAmortizaciones(item)}
                                className="btn btn-secondary btn-sm p-1.5 text-xs text-blue-700 hover:bg-blue-50 border border-blue-200"
                                title="Ver en qué liquidaciones se descontó este anticipo"
                              >
                                <Eye className="h-3.5 w-3.5" />
                              </button>
                            )}
                          </div>
                        </td>
                      </tr>
                    ))
                  )}
                </tbody>
              </table>
            </div>
          </div>
        </div>
      )}

      {/* ======================= MODAL: NUEVO ANTICIPO ======================= */}
      {modalNuevoOpen && (
        <Modal
          open={modalNuevoOpen}
          onClose={() => setModalNuevoOpen(false)}
          title="Registrar Nuevo Anticipo de Fondos"
        >
          <form onSubmit={handleSubmit(onSubmitNuevo)} className="space-y-4">
            <div className="bg-amber-50 border border-amber-200 rounded-lg p-3 text-xs text-amber-900 flex items-start gap-2">
              <Coins className="h-4 w-4 shrink-0 mt-0.5 text-amber-600" />
              <div>
                <strong>Empresa Minera "AyM":</strong> Este anticipo se registrará en la cuenta personal del proveedor.
                Al momento de liquidar sus lotes, el sistema te avisará para descontarlo de forma parcial o total.
              </div>
            </div>

            {/* Selector de Proveedor */}
            <div>
              <label className="block text-xs font-bold text-gray-700 mb-1">
                Proveedor / Minero *
              </label>
              <select
                {...register('proveedorId', { required: 'Selecciona un proveedor' })}
                className={`input text-xs w-full ${errors.proveedorId ? 'input-error' : ''}`}
              >
                <option value="">-- Seleccionar Proveedor --</option>
                {proveedoresLista.map((p) => (
                  <option key={p.id} value={p.id}>
                    {p.nombreCompleto} — CI: {p.ci || 'S/N'}
                  </option>
                ))}
              </select>
              {errors.proveedorId && (
                <p className="text-xs text-red-600 mt-1">{errors.proveedorId.message}</p>
              )}
            </div>

            {/* Monto y Fecha */}
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
              <div>
                <label className="block text-xs font-bold text-gray-700 mb-1">
                  Monto Entregado (Bs) *
                </label>
                <input
                  type="number"
                  step="1"
                  min="1"
                  placeholder="Ej: 5000"
                  {...register('monto', {
                    required: 'El monto es obligatorio',
                    min: { value: 1, message: 'Debe ser mayor a 0' }
                  })}
                  className={`input font-mono font-bold text-sm w-full ${errors.monto ? 'input-error' : ''}`}
                />
                {errors.monto && (
                  <p className="text-xs text-red-600 mt-1">{errors.monto.message}</p>
                )}
              </div>

              <div>
                <label className="block text-xs font-bold text-gray-700 mb-1">
                  Fecha de Entrega *
                </label>
                <input
                  type="date"
                  {...register('fecha', { required: 'La fecha es requerida' })}
                  className="input text-xs w-full font-mono"
                />
              </div>
            </div>

            {/* Glosa / Motivo */}
            <div>
              <label className="block text-xs font-bold text-gray-700 mb-1">
                Motivo / Glosa del Anticipo *
              </label>
              <input
                type="text"
                placeholder="Ej: Adelanto para compra de dinamita y combustible..."
                {...register('glosa', { required: 'Indica el motivo del anticipo' })}
                className={`input text-xs w-full ${errors.glosa ? 'input-error' : ''}`}
              />
              {errors.glosa && (
                <p className="text-xs text-red-600 mt-1">{errors.glosa.message}</p>
              )}

              {/* Botones de sugerencias rápidas */}
              <div className="flex flex-wrap items-center gap-1.5 mt-2">
                <span className="text-[10px] text-gray-400 font-semibold mr-1">Atajos rápidos:</span>
                {MOTIVOS_RAPIDOS.map((motivo) => (
                  <button
                    key={motivo}
                    type="button"
                    onClick={() => setValue('glosa', motivo, { shouldDirty: true })}
                    className="text-[10px] px-2 py-0.5 rounded bg-gray-100 hover:bg-amber-100 text-gray-700 hover:text-amber-900 border border-gray-200 transition-colors"
                  >
                    + {motivo}
                  </button>
                ))}
              </div>
            </div>

            {/* Observaciones adicionales */}
            <div>
              <label className="block text-xs font-semibold text-gray-600 mb-1">
                Observaciones Adicionales (Opcional)
              </label>
              <textarea
                rows="2"
                placeholder="Detalles sobre las condiciones pactadas, número de recibo manual, etc."
                {...register('observacion')}
                className="input text-xs w-full"
              />
            </div>

            {/* Botones de Guardar */}
            <div className="flex items-center justify-end gap-2 pt-3 border-t border-gray-100">
              <button
                type="button"
                onClick={() => setModalNuevoOpen(false)}
                className="btn btn-secondary text-xs"
              >
                Cancelar
              </button>
              <button
                type="submit"
                disabled={guardando}
                className="btn btn-primary bg-amber-600 hover:bg-amber-700 text-white font-bold text-xs inline-flex items-center gap-2 px-5 py-2 shadow-sm"
              >
                {guardando ? (
                  <>
                    <Loader2 className="h-4 w-4 animate-spin" />
                    <span>Guardando...</span>
                  </>
                ) : (
                  <>
                    <Printer className="h-4 w-4" />
                    <span>Registrar y Emitir Vale</span>
                  </>
                )}
              </button>
            </div>
          </form>
        </Modal>
      )}

      {/* ======================= MODAL: ÉXITO Y DESCARGA DIRECTA DE VALE ======================= */}
      {modalExitoOpen && anticipoRecienCreado && (
        <Modal
          open={modalExitoOpen}
          onClose={() => setModalExitoOpen(false)}
          title="¡Anticipo Registrado Exitosamente!"
        >
          <div className="space-y-4 text-center py-2">
            <div className="mx-auto w-14 h-14 rounded-full bg-emerald-100 text-emerald-600 flex items-center justify-center">
              <CheckCircle2 className="h-8 w-8" />
            </div>

            <div>
              <h3 className="text-base font-bold text-gray-900">
                Vale {anticipoRecienCreado.codigoVale || ''} Generado
              </h3>
              <p className="text-xs text-gray-600 mt-1">
                Se registró el anticipo de{' '}
                <strong className="text-emerald-800 font-mono text-sm">
                  {formatBs(anticipoRecienCreado.monto)}
                </strong>{' '}
                a nombre de{' '}
                <strong className="text-gray-900">
                  {anticipoRecienCreado.proveedor?.nombreCompleto}
                </strong>
                .
              </p>
            </div>

            <div className="rounded-xl border border-amber-200 bg-amber-50/80 p-3.5 text-xs text-amber-900 text-left">
              <p className="font-semibold flex items-center gap-1.5">
                <Printer className="h-4 w-4 text-amber-700" />
                <span>Vale Oficial Empresa Minera "AyM"</span>
              </p>
              <p className="mt-1 text-[11px] text-amber-800">
                El comprobante incluye 2 copias por hoja (Original para Contabilidad y Copia para el Proveedor) con los espacios de firmas correspondientes.
              </p>
            </div>

            <div className="flex flex-col sm:flex-row items-center justify-center gap-2 pt-2">
              <button
                type="button"
                onClick={() => {
                  handleDownloadValePdf(anticipoRecienCreado.id, anticipoRecienCreado.codigoVale);
                  setModalExitoOpen(false);
                }}
                className="btn btn-primary bg-amber-600 hover:bg-amber-700 text-white font-bold text-xs w-full sm:w-auto inline-flex items-center justify-center gap-2 px-6 py-2.5 shadow-md"
              >
                <Printer className="h-4 w-4" />
                <span>🖨️ Imprimir / Descargar Vale en PDF</span>
              </button>
              <button
                type="button"
                onClick={() => setModalExitoOpen(false)}
                className="btn btn-secondary text-xs w-full sm:w-auto"
              >
                Cerrar
              </button>
            </div>
          </div>
        </Modal>
      )}

      {/* ======================= MODAL: DETALLE DE AMORTIZACIONES ======================= */}
      {modalAmortizacionesOpen && anticipoSeleccionado && (
        <Modal
          open={modalAmortizacionesOpen}
          onClose={() => setModalAmortizacionesOpen(false)}
          title={`Trazabilidad de Amortizaciones — ${anticipoSeleccionado.codigoVale}`}
        >
          <div className="space-y-4">
            <div className="grid grid-cols-2 gap-2 text-xs bg-gray-50 p-3 rounded-lg border border-gray-200">
              <div>
                <span className="text-gray-500">Proveedor:</span>
                <p className="font-bold text-gray-900">{anticipoSeleccionado.proveedor?.nombreCompleto}</p>
              </div>
              <div>
                <span className="text-gray-500">Monto Inicial:</span>
                <p className="font-bold font-mono text-gray-900">{formatBs(anticipoSeleccionado.monto)}</p>
              </div>
              <div>
                <span className="text-gray-500">Saldo Restante:</span>
                <p className="font-bold font-mono text-amber-700">{formatBs(anticipoSeleccionado.saldoPendiente)}</p>
              </div>
              <div>
                <span className="text-gray-500">Estado:</span>
                <p className="font-bold text-gray-800">{anticipoSeleccionado.estado}</p>
              </div>
            </div>

            <div>
              <h4 className="text-xs font-bold text-gray-800 uppercase tracking-wider mb-2">
                Historial de Descuentos en Liquidaciones:
              </h4>

              {anticipoSeleccionado.descuentos && anticipoSeleccionado.descuentos.length > 0 ? (
                <div className="divide-y divide-gray-100 border border-gray-200 rounded-lg overflow-hidden text-xs">
                  {anticipoSeleccionado.descuentos.map((desc, idx) => (
                    <div key={desc.id} className="p-3 bg-white flex items-center justify-between">
                      <div>
                        <p className="font-bold text-gray-900">
                          Descuento #{idx + 1} en Lote {desc.calculo?.internacion?.lote || `ID ${desc.calculoId}`}
                        </p>
                        <p className="text-[11px] text-gray-500 font-mono">
                          Fecha: {formatFecha(desc.fecha)}
                        </p>
                      </div>
                      <span className="font-mono font-bold text-emerald-700 text-sm">
                        - {formatBs(desc.montoDescontado)}
                      </span>
                    </div>
                  ))}
                </div>
              ) : (
                <p className="text-xs text-gray-500 text-center py-4">
                  Este anticipo aún no ha tenido amortizaciones en ninguna liquidación.
                </p>
              )}
            </div>

            <div className="flex justify-end pt-2 border-t border-gray-100">
              <button
                type="button"
                onClick={() => setModalAmortizacionesOpen(false)}
                className="btn btn-secondary text-xs"
              >
                Cerrar
              </button>
            </div>
          </div>
        </Modal>
      )}
    </div>
  );
};

export default Anticipos;
