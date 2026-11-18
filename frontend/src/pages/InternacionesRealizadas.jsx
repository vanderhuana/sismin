import { useState, useEffect, useCallback } from 'react';
import { Link } from 'react-router-dom';
import { useForm } from 'react-hook-form';
import {
  PackageCheck,
  Scale,
  Coins,
  AlertCircle,
  CheckCircle2,
  Clock,
  Search,
  Filter,
  RotateCcw,
  Calendar,
  Eye,
  Pencil,
  Trash2,
  Download,
  FileText,
  Plus,
  ChevronLeft,
  ChevronRight,
  X,
  User,
  Phone,
  Tag,
  RefreshCw,
  Loader2,
  Layers,
  Calculator
} from 'lucide-react';

import Modal from '../components/ui/Modal';
import { useAuth } from '../hooks/useAuthStore';
import { internacionService, anticipoService, providerService } from '../services/api';
import {
  TIPOS_MINERAL,
  ELEMENTOS_BASE,
  VARIANTES_MINERAL,
  parseTipoMineral,
  buildTipoMineral,
  getMineralBadge,
  getMineralLabel
} from './InternMineral';

const ESTADOS = [
  { value: '', label: 'Pendientes / Activos' },
  { value: 'EN_ESPERA_LEY', label: 'En espera de ley' },
  { value: 'CALCULADO', label: 'Calculado' },
  { value: 'PAGADO', label: 'Pagado' },
  { value: 'TODOS', label: 'Todos los estados' }
];

const estadoLabel = {
  EN_ESPERA_LEY: {
    text: 'En espera de ley',
    color: 'bg-amber-100 text-amber-800 border border-amber-200'
  },
  CALCULADO: {
    text: 'Calculado',
    color: 'bg-blue-100 text-blue-800 border border-blue-200'
  },
  PAGADO: {
    text: 'Pagado',
    color: 'bg-green-100 text-green-800 border border-green-200'
  }
};

const formatKilos = (kilos) => {
  const n = Number(kilos);
  return isNaN(n)
    ? '0'
    : Math.trunc(n).toLocaleString('es-BO', { minimumFractionDigits: 0, maximumFractionDigits: 0 });
};

const formatBs = (monto) => {
  const n = Number(monto);
  return isNaN(n)
    ? 'Bs 0'
    : Math.trunc(n).toLocaleString('es-BO', {
        style: 'currency',
        currency: 'BOB',
        minimumFractionDigits: 0,
        maximumFractionDigits: 0
      });
};

const formatFecha = (fecha) => {
  if (!fecha) return '—';
  return new Date(fecha).toLocaleString('es-BO', {
    day: '2-digit',
    month: '2-digit',
    year: 'numeric',
    hour: '2-digit',
    minute: '2-digit'
  });
};

const sanitizeKilosInput = (raw) => (!raw ? '' : raw.replace(/[^0-9]/g, ''));
const sanitizeMoneyInput = (raw) => (!raw ? '' : raw.replace(/[^0-9]/g, ''));

const getMineralStyle = (tipo) =>
  TIPOS_MINERAL.find((t) => t.value === tipo)?.badgeClass || 'bg-gray-100 text-gray-800 border-gray-200';

const InternacionesRealizadas = () => {
  const [internaciones, setInternaciones] = useState([]);
  const [stats, setStats] = useState(null);
  const [proveedores, setProveedores] = useState([]);
  const [pagination, setPagination] = useState({ page: 1, limit: 10, total: 0, pages: 1 });
  const [filtroEstado, setFiltroEstado] = useState('');
  const [filtroTipo, setFiltroTipo] = useState('');
  const [filtroFecha, setFiltroFecha] = useState('');
  const [busquedaLista, setBusquedaLista] = useState('');
  const [busquedaAplicada, setBusquedaAplicada] = useState('');
  const [loading, setLoading] = useState(true);
  const [downloadingId, setDownloadingId] = useState(null);
  const [error, setError] = useState(null);
  const [success, setSuccess] = useState(null);

  // Modales
  const [detailModalOpen, setDetailModalOpen] = useState(false);
  const [detailItem, setDetailItem] = useState(null);
  const [editModalOpen, setEditModalOpen] = useState(false);
  const [editingItem, setEditingItem] = useState(null);
  const [editModalError, setEditModalError] = useState(null);
  const [submittingEdit, setSubmittingEdit] = useState(false);

  // Modal Anticipos
  const [anticiposModalOpen, setAnticiposModalOpen] = useState(false);
  const [anticiposLoteItem, setAnticiposLoteItem] = useState(null);
  const [anticiposHistory, setAnticiposHistory] = useState([]);
  const [loadingAnticipos, setLoadingAnticipos] = useState(false);
  const [savingAnticipo, setSavingAnticipo] = useState(false);
  const [nuevoAnticipoMonto, setNuevoAnticipoMonto] = useState('');
  const [nuevoAnticipoGlosa, setNuevoAnticipoGlosa] = useState('');
  const [anticiposError, setAnticiposError] = useState(null);

  const { isAdmin } = useAuth();

  // Condiciones de edición, cálculo y eliminación idénticas a Internar Mineral
  const canEdit = (item) => item.estado === 'EN_ESPERA_LEY' && !item.calculo;
  const canCalculate = (item) => canEdit(item);
  const canDelete = (item) => !item.calculo && item.estado === 'EN_ESPERA_LEY';

  // Formulario de edición
  const editForm = useForm({
    mode: 'onChange',
    defaultValues: {
      lote: '',
      proveedorId: '',
      tipoMineral: 'PLATA',
      kilosBruto: '',
      anticipo: ''
    }
  });

  const {
    register: editRegister,
    handleSubmit: handleEditSubmit,
    setValue: setEditValue,
    reset: resetEditForm,
    formState: { errors: editErrors }
  } = editForm;

  const showSuccess = (msg) => {
    setSuccess(msg);
    setTimeout(() => setSuccess(null), 4000);
  };

  const handleApiError = (err) => {
    return err?.response?.data?.message || err?.message || 'Error en la operación';
  };

  // Cargar estadísticas
  const loadStats = useCallback(async () => {
    try {
      const data = await internacionService.getDashboardStats();
      setStats(data);
    } catch (err) {
      console.error('Error al cargar estadísticas:', err);
    }
  }, []);

  // Cargar internaciones con filtros
  const loadInternaciones = useCallback(async (page = 1) => {
    try {
      setLoading(true);
      setError(null);
      const params = { page, limit: 10 };
      if (filtroEstado) params.estado = filtroEstado;
      if (filtroTipo) params.tipoMineral = filtroTipo;
      if (filtroFecha) params.fecha = filtroFecha;
      if (busquedaAplicada && busquedaAplicada.trim()) {
        params.search = busquedaAplicada.trim();
      }

      const data = await internacionService.getInternaciones(params);
      setInternaciones(data.internaciones || []);
      setPagination(data.pagination || { page: 1, limit: 10, total: 0, pages: 1 });
    } catch (err) {
      setError(handleApiError(err));
    } finally {
      setLoading(false);
    }
  }, [filtroEstado, filtroTipo, filtroFecha, busquedaAplicada]);

  // Cargar proveedores para select de edición
  const loadProveedores = useCallback(async () => {
    try {
      const data = await providerService.getProviders({ limit: 100, activo: true });
      setProveedores(data.proveedores || []);
    } catch (err) {
      console.error('Error cargando proveedores:', err);
    }
  }, []);

  useEffect(() => {
    loadStats();
    loadProveedores();
  }, [loadStats, loadProveedores]);

  useEffect(() => {
    loadInternaciones(1);
  }, [loadInternaciones]);

  // Descargar Boleta o Comprobante Oficial en PDF (idéntico a Internar Mineral)
  const handleDownloadBoleta = async (item) => {
    try {
      setDownloadingId(item.id);
      const response = await internacionService.downloadBoletaPdf(item.id);
      const blob = new Blob([response.data], { type: 'application/pdf' });
      const url = window.URL.createObjectURL(blob);
      const link = document.createElement('a');
      link.href = url;
      const isCalculadoOPagado = Boolean(item.calculo || item.estado === 'PAGADO' || item.estado === 'CALCULADO');
      link.download = isCalculadoOPagado ? `comprobante-${item.lote}.pdf` : `boleta-recepcion-${item.lote}.pdf`;
      link.click();
      window.URL.revokeObjectURL(url);
    } catch (err) {
      setError(handleApiError(err));
    } finally {
      setDownloadingId(null);
    }
  };

  // Abrir Modal de Detalle
  const openDetail = async (item) => {
    try {
      const full = await internacionService.getInternacion(item.id);
      setDetailItem(full);
      setDetailModalOpen(true);
    } catch (err) {
      setError(handleApiError(err));
    }
  };

  // Abrir Modal de Edición
  const openEditModal = (item) => {
    setEditingItem(item);
    setEditModalError(null);
    resetEditForm({
      lote: item.lote,
      proveedorId: String(item.proveedorId || item.proveedor?.id || ''),
      tipoMineral: item.tipoMineral,
      kilosBruto: Math.trunc(Number(item.kilosBruto) || 0).toString(),
      anticipo: Math.trunc(Number(item.anticipo) || 0).toString()
    });
    setEditModalOpen(true);
  };

  const closeEditModal = () => {
    setEditModalOpen(false);
    setEditingItem(null);
    setEditModalError(null);
  };

  // Guardar Edición
  const onEditSubmit = async (formData) => {
    if (!editingItem) return;
    try {
      setSubmittingEdit(true);
      setEditModalError(null);

      const kilos = Math.trunc(parseFloat(formData.kilosBruto));
      const anticipoVal = formData.anticipo ? Math.trunc(parseFloat(formData.anticipo)) : 0;

      const payload = {
        lote: formData.lote.trim().toUpperCase(),
        proveedorId: parseInt(formData.proveedorId, 10),
        tipoMineral: formData.tipoMineral,
        kilosBruto: kilos,
        anticipo: anticipoVal
      };

      await internacionService.updateInternacion(editingItem.id, payload);
      showSuccess(`Internación ${payload.lote} actualizada correctamente`);
      closeEditModal();
      loadInternaciones(pagination.page);
      loadStats();
    } catch (err) {
      setEditModalError(handleApiError(err));
    } finally {
      setSubmittingEdit(false);
    }
  };

  // Modal Anticipos en Báscula
  const openAnticiposModal = async (item) => {
    setAnticiposLoteItem(item);
    setAnticiposModalOpen(true);
    setNuevoAnticipoMonto('');
    setNuevoAnticipoGlosa('');
    setAnticiposError(null);
    await loadAnticiposForLote(item.id);
  };

  const loadAnticiposForLote = async (internacionId) => {
    try {
      setLoadingAnticipos(true);
      const res = await anticipoService.getAnticiposByInternacion(internacionId);
      setAnticiposHistory(res.anticipos || []);
    } catch (err) {
      setAnticiposError(handleApiError(err));
    } finally {
      setLoadingAnticipos(false);
    }
  };

  const handleCrearAnticipo = async (e) => {
    e.preventDefault();
    if (!anticiposLoteItem) return;
    const monto = Math.trunc(parseFloat(nuevoAnticipoMonto));
    if (isNaN(monto) || monto <= 0) {
      setAnticiposError('Ingresa un monto de anticipo válido mayor a 0');
      return;
    }
    try {
      setSavingAnticipo(true);
      setAnticiposError(null);

      await anticipoService.createAnticipo({
        internacionId: anticiposLoteItem.id,
        proveedorId: anticiposLoteItem.proveedorId || anticiposLoteItem.proveedor?.id,
        monto,
        glosa: nuevoAnticipoGlosa.trim() || `Entrega en báscula - ${anticiposLoteItem.lote}`
      });

      const anterior = Math.trunc(Number(anticiposLoteItem.anticipo) || 0);
      const nuevoTotal = anterior + monto;

      showSuccess(`✅ Anticipo de ${formatBs(monto)} registrado para el lote ${anticiposLoteItem.lote} (Total: ${formatBs(nuevoTotal)})`);
      setNuevoAnticipoMonto('');
      setNuevoAnticipoGlosa('');
      setAnticiposLoteItem({ ...anticiposLoteItem, anticipo: nuevoTotal });

      await loadAnticiposForLote(anticiposLoteItem.id);
      loadInternaciones(pagination.page);
      loadStats();
    } catch (err) {
      setAnticiposError(handleApiError(err));
    } finally {
      setSavingAnticipo(false);
    }
  };

  const handleEliminarEntrega = async (anticipoId) => {
    if (!window.confirm('¿Estás seguro de eliminar este registro de anticipo?')) return;
    try {
      await anticipoService.deleteAnticipo(anticipoId);
      showSuccess('Entrega de anticipo eliminada exitosamente');
      if (anticiposLoteItem) {
        const res = await anticipoService.getAnticiposByInternacion(anticiposLoteItem.id);
        const nuevoHistorial = res.anticipos || [];
        setAnticiposHistory(nuevoHistorial);
        const nuevoTotal = nuevoHistorial.reduce((s, a) => s + Math.trunc(Number(a.monto) || 0), 0);
        setAnticiposLoteItem((prev) => ({ ...prev, anticipo: nuevoTotal }));
      }
      loadInternaciones(pagination.page);
      loadStats();
    } catch (err) {
      setAnticiposError(handleApiError(err));
    }
  };

  // Eliminar Internación
  const handleDelete = async (item) => {
    if (!window.confirm(`¿Estás seguro de eliminar la internación del lote ${item.lote}?`)) {
      return;
    }
    try {
      await internacionService.deleteInternacion(item.id);
      showSuccess(`Internación ${item.lote} eliminada correctamente`);
      loadInternaciones(pagination.page);
      loadStats();
    } catch (err) {
      setError(handleApiError(err));
    }
  };

  const resetAllFilters = () => {
    setFiltroEstado('');
    setFiltroTipo('');
    setFiltroFecha('');
    setBusquedaLista('');
    setBusquedaAplicada('');
  };

  const hasActiveFilters =
    Boolean(filtroEstado) || Boolean(filtroTipo) || Boolean(filtroFecha) || Boolean(busquedaAplicada);

  // Renderizar contenido de detalle de una internación (idéntico a Internar Mineral)
  const renderDetalleContent = (item) => {
    if (!item) return null;
    const c = item.calculo;

    return (
      <div className="space-y-4 text-sm">
        {/* Cabecera de la ficha */}
        <div className="flex items-center justify-between rounded-lg bg-gray-50 p-4 border border-gray-200">
          <div>
            <span className="text-xs font-semibold uppercase tracking-wider text-gray-400">
              Ficha de Pesaje
            </span>
            <p className="text-2xl font-mono font-bold text-primary-700">{item.lote}</p>
          </div>
          <div className="text-right">
            <span
              className={`inline-flex items-center gap-1 rounded-full px-3 py-1 text-xs font-semibold border ${
                estadoLabel[item.estado]?.color || 'bg-gray-100 text-gray-800 border-gray-200'
              }`}
            >
              <Clock className="h-3 w-3" />
              {estadoLabel[item.estado]?.text || item.estado}
            </span>
            <p className="mt-1 text-xs text-gray-500">{formatFecha(item.fechaInternacion)}</p>
          </div>
        </div>

        {/* Proveedor y recepción */}
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 rounded-lg border border-gray-100 p-4 bg-white shadow-sm">
          <div>
            <p className="text-xs font-medium text-gray-500">Proveedor</p>
            <p className="font-semibold text-gray-900">{item.proveedor?.nombreCompleto}</p>
            <p className="text-xs text-gray-600 font-mono">CI / NIT: {item.proveedor?.ci || 'Sin registro'}</p>
            {item.proveedor?.telefono && (
              <p className="text-xs text-gray-600">Tel: {item.proveedor.telefono}</p>
            )}
          </div>
          <div>
            <p className="text-xs font-medium text-gray-500">Operador de Báscula</p>
            <p className="font-semibold text-gray-900">{item.usuario?.nombre || 'Balanza Central'}</p>
            <p className="text-xs text-gray-500">
              Registrado el {new Date(item.createdAt).toLocaleDateString('es-BO')}
            </p>
          </div>
        </div>

        {/* Datos de pesaje */}
        <div className="grid grid-cols-3 gap-3 rounded-lg bg-primary-50/50 p-4 border border-primary-100 text-center">
          <div>
            <p className="text-xs text-primary-700 font-medium">Mineral</p>
            <p className="text-base font-bold text-gray-900">{getMineralLabel(item.tipoMineral)}</p>
          </div>
          <div>
            <p className="text-xs text-primary-700 font-medium">Peso en Báscula</p>
            <p className="text-base font-bold text-primary-900">{formatKilos(item.kilosBruto)} kg</p>
          </div>
          <div>
            <p className="text-xs text-primary-700 font-medium">Anticipo Entregado</p>
            <p className="text-base font-bold text-gray-900">
              {Number(item.anticipo) > 0 ? formatBs(item.anticipo) : 'Sin anticipo'}
            </p>
          </div>
        </div>

        {/* Información del cálculo si ya existe */}
        {c ? (
          <div className="rounded-lg border border-gray-200 bg-white p-4 shadow-sm">
            <div className="flex items-center justify-between border-b pb-2 mb-3">
              <h4 className="font-semibold text-gray-900 flex items-center gap-1.5">
                <Calculator className="h-4 w-4 text-primary-600" />
                Liquidación y Cálculo de Pago
              </h4>
              <span
                className={`rounded-full px-2.5 py-0.5 text-xs font-semibold ${
                  c.estadoPago === 'PAGADO' ? 'bg-green-100 text-green-800' : 'bg-yellow-100 text-yellow-800'
                }`}
              >
                {c.estadoPago}
              </span>
            </div>

            <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 text-xs mb-3">
              <div>
                <span className="text-gray-500">Kilos Netos:</span>
                <p className="font-semibold">{formatKilos(c.kilosNetos)} kg</p>
              </div>
              <div>
                <span className="text-gray-500">Valor Neto:</span>
                <p className="font-semibold">{formatBs(c.valorNeto)}</p>
              </div>
              <div>
                <span className="text-gray-500">Anticipos:</span>
                <p className="font-semibold text-amber-700">-{formatBs(c.anticipos)}</p>
              </div>
              <div>
                <span className="text-gray-500 font-bold">Saldo Final:</span>
                <p className="font-bold text-primary-700 text-sm">{formatBs(c.saldoFinal)}</p>
              </div>
            </div>

            <p className="text-[11px] text-gray-400">
              Liquidación calculada el {new Date(c.fechaCalculo).toLocaleDateString('es-BO')}
            </p>
          </div>
        ) : (
          <div className="rounded-lg border border-dashed border-gray-200 p-4 text-center text-xs text-gray-500">
            Este lote aún no tiene liquidación de pago calculada (está pendiente de ensaye de ley).
          </div>
        )}

        <div className="flex justify-end gap-2 pt-2 border-t">
          <button
            type="button"
            onClick={() => handleDownloadBoleta(item)}
            className="btn btn-secondary btn-sm inline-flex items-center gap-1.5"
          >
            <FileText className="h-4 w-4" />
            <span>Descargar Documento</span>
          </button>
          <button
            type="button"
            onClick={() => setDetailModalOpen(false)}
            className="btn btn-primary btn-sm"
          >
            Cerrar
          </button>
        </div>
      </div>
    );
  };

  return (
    <div className="space-y-6 pb-12">
      {/* HEADER DE LA PÁGINA */}
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
        <div>
          <h2 className="text-2xl font-bold text-gray-900 tracking-tight">Internaciones Realizadas</h2>
          <p className="text-sm text-gray-500">
            Historial de lotes ingresados a la planta y estado de cálculo de liquidación
          </p>
        </div>

        <div className="flex items-center gap-2">
          <button
            type="button"
            onClick={() => {
              loadInternaciones(pagination.page);
              loadStats();
            }}
            disabled={loading}
            className="btn btn-secondary btn-md inline-flex items-center gap-2"
            title="Actualizar datos"
          >
            <RefreshCw className={`h-4 w-4 ${loading ? 'animate-spin' : ''}`} />
            <span>Actualizar</span>
          </button>

          <Link
            to="/internar"
            className="btn btn-primary btn-md inline-flex items-center gap-2"
          >
            <Plus className="h-4 w-4" />
            <span>Nueva Internación</span>
          </Link>
        </div>
      </div>

      {/* TARJETAS DE MÉTRICAS RÁPIDAS (IDÉNTICAS EN COLORES Y LEYENDAS A INTERNAR MINERAL) */}
      {stats && (
        <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
          <div className="rounded-xl border border-gray-200 bg-white p-3.5 shadow-sm">
            <div className="flex items-center gap-2 text-xs font-medium text-gray-500">
              <Layers className="h-4 w-4 text-primary-600" />
              <span>Total Lotes</span>
            </div>
            <p className="mt-1 text-xl sm:text-2xl font-bold text-gray-900">
              {stats.totalInternaciones || 0}
            </p>
          </div>

          <div className="rounded-xl border border-amber-200 bg-amber-50/50 p-3.5 shadow-sm">
            <div className="flex items-center gap-2 text-xs font-medium text-amber-700">
              <Clock className="h-4 w-4 text-amber-600" />
              <span>En Espera de Ley</span>
            </div>
            <p className="mt-1 text-xl sm:text-2xl font-bold text-amber-900">
              {stats.estados?.enEsperaLey || 0}
            </p>
          </div>

          <div className="rounded-xl border border-blue-200 bg-blue-50/50 p-3.5 shadow-sm">
            <div className="flex items-center gap-2 text-xs font-medium text-blue-700">
              <Calculator className="h-4 w-4 text-blue-600" />
              <span>Calculados</span>
            </div>
            <p className="mt-1 text-xl sm:text-2xl font-bold text-blue-900">
              {stats.estados?.calculadas || 0}
            </p>
          </div>

          <div className="rounded-xl border border-gray-200 bg-white p-3.5 shadow-sm">
            <div className="flex items-center gap-2 text-xs font-medium text-gray-500">
              <Scale className="h-4 w-4 text-indigo-600" />
              <span>Total Kilos Bruto</span>
            </div>
            <p className="mt-1 text-xl sm:text-2xl font-bold text-gray-900">
              {formatKilos(stats.totalKilosBruto || 0)}
              <span className="text-xs font-normal text-gray-500 ml-1">kg</span>
            </p>
          </div>
        </div>
      )}

      {/* MENSAJES DE ALERTA GLOBALES */}
      {error && (
        <div className="flex items-start gap-3 rounded-xl border border-red-200 bg-red-50 p-4 shadow-sm">
          <AlertCircle className="h-5 w-5 shrink-0 text-red-500 mt-0.5" />
          <div className="flex-1">
            <h4 className="text-sm font-semibold text-red-800">Ocurrió un error</h4>
            <p className="text-xs text-red-700 mt-0.5">{error}</p>
          </div>
          <button
            type="button"
            onClick={() => setError(null)}
            className="text-red-400 hover:text-red-600"
          >
            <X className="h-4 w-4" />
          </button>
        </div>
      )}

      {success && (
        <div className="flex items-center gap-2 rounded-xl border border-green-200 bg-green-50 p-4 text-sm text-green-800 shadow-sm">
          <CheckCircle2 className="h-5 w-5 text-green-600 shrink-0" />
          <span>{success}</span>
        </div>
      )}

      {/* LISTADO / TABLA DE INTERNACIONES REGISTRADAS */}
      <div className="card shadow-sm border border-gray-200">
        <div className="p-4 sm:p-6 border-b border-gray-100 space-y-4">
          <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3">
            <div>
              <h3 className="text-lg font-bold text-gray-900">Internaciones Registradas</h3>
              <p className="text-xs text-gray-500">
                Control de lotes ingresados a la planta y estado de cálculo de liquidación
              </p>
            </div>
            <div className="flex items-center gap-2">
              {hasActiveFilters && (
                <button
                  type="button"
                  onClick={resetAllFilters}
                  className="text-xs font-medium text-primary-600 hover:text-primary-800 flex items-center gap-1"
                >
                  <RotateCcw className="h-3.5 w-3.5" /> Limpiar filtros
                </button>
              )}
            </div>
          </div>

          {/* Barra de Filtros y Búsqueda */}
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-3">
            {/* Buscador de texto */}
            <form
              onSubmit={(e) => {
                e.preventDefault();
                setBusquedaAplicada(busquedaLista);
              }}
              className="sm:col-span-2 flex gap-2"
            >
              <div className="relative flex-1">
                <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-gray-400" />
                <input
                  type="text"
                  value={busquedaLista}
                  onChange={(e) => setBusquedaLista(e.target.value)}
                  className="input pl-9 text-sm"
                  placeholder="Buscar por lote, proveedor o CI..."
                />
              </div>
              <button type="submit" className="btn btn-secondary btn-sm px-4">
                Buscar
              </button>
            </form>

            {/* Filtro Estado */}
            <select
              value={filtroEstado}
              onChange={(e) => setFiltroEstado(e.target.value)}
              className="input text-sm"
            >
              {ESTADOS.map((e) => (
                <option key={e.value} value={e.value}>
                  {e.label}
                </option>
              ))}
            </select>

            {/* Filtro Mineral */}
            <select
              value={filtroTipo}
              onChange={(e) => setFiltroTipo(e.target.value)}
              className="input text-sm"
            >
              <option value="">Todos los minerales</option>
              {TIPOS_MINERAL.map((t) => (
                <option key={t.value} value={t.value}>
                  {t.label}
                </option>
              ))}
            </select>
          </div>
        </div>

        {/* Tabla compacta y sin scroll horizontal */}
        {loading ? (
          <div className="flex flex-col items-center justify-center py-20">
            <Loader2 className="h-8 w-8 animate-spin text-primary-600" />
            <p className="mt-2 text-sm text-gray-500">Cargando registros de internaciones...</p>
          </div>
        ) : internaciones.length === 0 ? (
          <div className="py-16 text-center text-gray-500">
            <PackageCheck className="mx-auto h-12 w-12 text-gray-300" />
            <p className="mt-2 text-base font-semibold text-gray-700">No se encontraron internaciones</p>
            <p className="text-xs text-gray-500">
              {hasActiveFilters
                ? 'Prueba modificando o limpiando los filtros de búsqueda'
                : 'No hay internaciones registradas en el sistema'}
            </p>
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full border-collapse text-left">
              <thead>
                <tr className="bg-slate-50/80 border-b border-gray-200 text-xs font-bold text-gray-600 uppercase tracking-wider">
                  <th className="py-3.5 px-4">Lote / Mineral</th>
                  <th className="py-3.5 px-4">Fecha / Operador</th>
                  <th className="py-3.5 px-4">Proveedor</th>
                  <th className="py-3.5 px-4 text-right">Kilos Bruto</th>
                  <th className="py-3.5 px-4 text-right">Anticipo</th>
                  <th className="py-3.5 px-4 text-center">Estado</th>
                  <th className="py-3.5 px-4 text-right">Acciones</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-100 bg-white">
                {internaciones.map((item) => (
                  <tr
                    key={item.id}
                    className="border-b border-gray-150 transition-all duration-150 even:bg-slate-50/70 hover:bg-indigo-50/45 hover:shadow-xs"
                  >
                    {/* Lote con Mineral Abajo */}
                    <td className="py-3.5 px-4 whitespace-nowrap">
                      <div className="flex flex-col gap-1 items-start">
                        <span className="font-mono font-bold text-xs bg-slate-100 text-slate-800 border border-slate-300 px-2.5 py-0.5 rounded-md">
                          {item.lote}
                        </span>
                        <span
                          className={`inline-flex px-2 py-0.5 rounded-full text-[11px] font-semibold border ${getMineralStyle(
                            item.tipoMineral
                          )}`}
                        >
                          {getMineralLabel(item.tipoMineral)}
                        </span>
                      </div>
                    </td>

                    {/* Fecha y Operador Abajo */}
                    <td className="py-3.5 px-4 whitespace-nowrap text-xs text-gray-600">
                      <p className="font-semibold text-gray-900">{formatFecha(item.fechaInternacion)}</p>
                      <p className="text-[11px] text-gray-500 font-medium mt-0.5">
                        Op: {item.usuario?.nombre || 'Balanza'}
                      </p>
                    </td>

                    {/* Proveedor con CI Abajo */}
                    <td className="py-3.5 px-4">
                      <p className="font-semibold text-gray-900 text-sm">
                        {item.proveedor?.nombreCompleto}
                      </p>
                      <p className="text-xs text-gray-500 font-mono mt-0.5">
                        CI: {item.proveedor?.ci || '—'}
                      </p>
                    </td>

                    {/* Kilos Bruto */}
                    <td className="py-3.5 px-4 text-right whitespace-nowrap font-mono font-semibold text-gray-900 text-sm">
                      {formatKilos(item.kilosBruto)} <span className="text-xs font-normal text-gray-500">kg</span>
                    </td>

                    {/* Anticipo */}
                    <td className="py-3.5 px-4 text-right whitespace-nowrap text-xs">
                      <button
                        type="button"
                        onClick={() => openAnticiposModal(item)}
                        className="inline-flex items-center gap-1.5 rounded-lg border border-emerald-200 bg-emerald-50 px-2.5 py-1 text-emerald-800 hover:bg-emerald-100 hover:border-emerald-300 transition-colors font-mono font-semibold shadow-xs"
                        title="Ver historial o registrar entregas de anticipos para este lote"
                      >
                        <Coins className="h-3.5 w-3.5 text-emerald-600" />
                        <span>{Number(item.anticipo) > 0 ? formatBs(item.anticipo) : 'Bs 0'}</span>
                        <span className="text-[10px] font-bold text-emerald-700 bg-emerald-200/60 rounded px-1">
                          {item.estado === 'PAGADO' ? 'Ver' : '+'}
                        </span>
                      </button>
                    </td>

                    {/* Estado */}
                    <td className="py-3.5 px-4 text-center whitespace-nowrap">
                      <span
                        className={`inline-flex rounded-full px-2.5 py-0.5 text-xs font-medium border ${
                          estadoLabel[item.estado]?.color || 'bg-gray-100 text-gray-800 border-gray-200'
                        }`}
                      >
                        {estadoLabel[item.estado]?.text || item.estado}
                      </span>
                    </td>

                    {/* Acciones */}
                    <td className="py-3.5 px-4 text-right whitespace-nowrap">
                      <div className="flex items-center justify-end gap-1.5">
                        {/* Calcular pago si está en espera de ley */}
                        {canCalculate(item) && (
                          <Link
                            to="/calcular"
                            state={{ internacionId: item.id }}
                            className="btn btn-primary btn-sm inline-flex items-center gap-1.5 py-1 px-2.5 text-xs font-semibold shadow-xs"
                            title="Calcular Liquidación de Pago"
                          >
                            <Calculator className="h-3.5 w-3.5" />
                            <span>Calcular</span>
                          </Link>
                        )}

                        {/* Boleta o Comprobante PDF */}
                        {(() => {
                          const hasCalc = Boolean(item.calculo || item.estado === 'PAGADO' || item.estado === 'CALCULADO');
                          return (
                            <button
                              type="button"
                              onClick={() => handleDownloadBoleta(item)}
                              disabled={downloadingId === item.id}
                              className={`rounded-lg p-1.5 border transition-all shadow-xs ${
                                hasCalc
                                  ? 'border-emerald-200 bg-emerald-50/60 text-emerald-700 hover:bg-emerald-100 hover:text-emerald-900'
                                  : 'border-gray-200 bg-white text-gray-600 hover:bg-gray-100 hover:text-primary-700'
                              }`}
                              title={hasCalc ? "Descargar Comprobante Oficial (PDF)" : "Descargar Boleta de Recepción (PDF)"}
                            >
                              {downloadingId === item.id ? (
                                <Loader2 className="h-4 w-4 animate-spin text-primary-600" />
                              ) : (
                                <FileText className="h-4 w-4" />
                              )}
                            </button>
                          );
                        })()}

                        {/* Ver Detalle */}
                        <button
                          type="button"
                          onClick={() => openDetail(item)}
                          className="rounded-lg p-1.5 border border-gray-200 bg-white text-gray-600 hover:bg-indigo-50 hover:border-indigo-200 hover:text-indigo-600 transition-all shadow-xs"
                          title="Ver detalle completo"
                        >
                          <Eye className="h-4 w-4" />
                        </button>

                        {/* Editar: sólo si está en espera de ley y no tiene cálculo */}
                        {canEdit(item) && (
                          <button
                            type="button"
                            onClick={() => openEditModal(item)}
                            className="rounded-lg p-1.5 border border-gray-200 bg-white text-gray-600 hover:bg-amber-50 hover:border-amber-200 hover:text-amber-700 transition-all shadow-xs"
                            title="Editar datos de internación"
                          >
                            <Pencil className="h-4 w-4" />
                          </button>
                        )}

                        {/* Eliminar: sólo si no tiene cálculo y está en espera de ley */}
                        {canDelete(item) && (
                          <button
                            type="button"
                            onClick={() => handleDelete(item)}
                            className="rounded-lg p-1.5 border border-gray-200 bg-white text-gray-600 hover:bg-red-50 hover:border-red-200 hover:text-red-600 transition-all shadow-xs"
                            title="Eliminar internación"
                          >
                            <Trash2 className="h-4 w-4" />
                          </button>
                        )}
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}

        {/* Paginación */}
        {pagination.pages > 1 && (
          <div className="flex items-center justify-between border-t border-gray-100 px-6 py-4">
            <p className="text-xs text-gray-500">
              Total {pagination.total} internación{pagination.total !== 1 ? 'es' : ''}
            </p>
            <div className="flex gap-2">
              <button
                type="button"
                disabled={pagination.page <= 1}
                onClick={() => loadInternaciones(pagination.page - 1)}
                className="btn btn-secondary btn-sm disabled:opacity-50"
              >
                Anterior
              </button>
              <span className="flex items-center px-3 text-xs text-gray-600 font-medium">
                Página {pagination.page} de {pagination.pages}
              </span>
              <button
                type="button"
                disabled={pagination.page >= pagination.pages}
                onClick={() => loadInternaciones(pagination.page + 1)}
                className="btn btn-secondary btn-sm disabled:opacity-50"
              >
                Siguiente
              </button>
            </div>
          </div>
        )}
      </div>

      {/* MODAL DE EDICIÓN DE INTERNACIÓN */}
      <Modal
        open={editModalOpen}
        onClose={closeEditModal}
        title={editingItem ? `Editar Internación — ${editingItem.lote}` : 'Editar Internación'}
        size="md"
      >
        <form onSubmit={handleEditSubmit(onEditSubmit)} className="space-y-4">
          <p className="text-xs text-gray-500">
            Puedes corregir el lote, el proveedor, el tipo de mineral, los kilos bruto y el anticipo mientras la internación se encuentre en espera de ley.
          </p>

          {editModalError && (
            <div className="flex items-start gap-2 rounded-lg border border-red-200 bg-red-50 p-3 text-xs text-red-700">
              <AlertCircle className="h-4 w-4 shrink-0 text-red-500 mt-0.5" />
              <span>{editModalError}</span>
            </div>
          )}

          {/* Número de Lote */}
          <div>
            <label className="mb-1 block text-sm font-medium text-gray-700 flex items-center gap-1.5">
              <Tag className="h-4 w-4 text-primary-600" />
              <span>Número de Lote *</span>
            </label>
            <input
              type="text"
              {...editRegister('lote', {
                required: 'El número de lote es obligatorio',
                validate: (v) => {
                  if (!v || !v.trim()) return 'El número de lote es obligatorio';
                  if (v.trim().length > 50) return 'El lote no puede exceder 50 caracteres';
                  return true;
                }
              })}
              onChange={(e) => {
                setEditValue('lote', e.target.value.toUpperCase(), { shouldValidate: true, shouldDirty: true });
                setEditModalError(null);
              }}
              className={`input text-base font-mono uppercase font-bold tracking-wide ${
                editErrors.lote ? 'input-error' : ''
              }`}
              placeholder="Ej: LOTE-001"
              autoComplete="off"
            />
            {editErrors.lote && (
              <p className="mt-1 text-xs text-red-600 font-medium">{editErrors.lote.message}</p>
            )}
          </div>

          {/* Selección de proveedor */}
          <div>
            <label className="mb-1 block text-sm font-medium text-gray-700">
              Proveedor *
            </label>
            <select
              {...editRegister('proveedorId', { required: 'El proveedor es obligatorio' })}
              className={`input text-sm ${editErrors.proveedorId ? 'input-error' : ''}`}
            >
              {proveedores.map((p) => (
                <option key={p.id} value={p.id}>
                  {p.nombreCompleto} {p.ci ? `(CI: ${p.ci})` : ''}
                </option>
              ))}
            </select>
            {editErrors.proveedorId && (
              <p className="mt-1 text-xs text-red-600">{editErrors.proveedorId.message}</p>
            )}
          </div>

          {/* Tipo de Mineral */}
          <div>
            <label className="mb-1 block text-sm font-medium text-gray-700">
              Tipo de Mineral *
            </label>
            <select
              {...editRegister('tipoMineral', { required: 'El tipo de mineral es obligatorio' })}
              className="input text-sm"
            >
              {TIPOS_MINERAL.map((tipo) => (
                <option key={tipo.value} value={tipo.value}>
                  {tipo.label}
                </option>
              ))}
            </select>
          </div>

          {/* Kilos Bruto y Anticipo */}
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <div>
              <label className="mb-1 block text-sm font-medium text-gray-700">
                Kilos Bruto *
              </label>
              <input
                type="text"
                {...editRegister('kilosBruto', {
                  required: 'Los kilos bruto son obligatorios',
                  validate: (v) => {
                    const n = parseFloat(v);
                    if (isNaN(n) || n <= 0) return 'Debe ser mayor a 0';
                    return true;
                  }
                })}
                onChange={(e) => setEditValue('kilosBruto', sanitizeKilosInput(e.target.value))}
                className={`input text-sm font-mono ${editErrors.kilosBruto ? 'input-error' : ''}`}
                placeholder="0"
              />
              {editErrors.kilosBruto && (
                <p className="mt-1 text-xs text-red-600">{editErrors.kilosBruto.message}</p>
              )}
            </div>

            <div>
              <label className="mb-1 block text-sm font-medium text-gray-700">
                Anticipo Inicial (Bs)
              </label>
              <input
                type="text"
                {...editRegister('anticipo')}
                onChange={(e) => setEditValue('anticipo', sanitizeMoneyInput(e.target.value))}
                className="input text-sm font-mono"
                placeholder="0"
              />
            </div>
          </div>

          <div className="flex justify-end gap-2 pt-2 border-t">
            <button
              type="button"
              onClick={closeEditModal}
              disabled={submittingEdit}
              className="btn btn-secondary btn-sm"
            >
              Cancelar
            </button>
            <button
              type="submit"
              disabled={submittingEdit}
              className="btn btn-primary btn-sm inline-flex items-center gap-1.5"
            >
              {submittingEdit ? (
                <>
                  <Loader2 className="h-4 w-4 animate-spin" />
                  <span>Guardando...</span>
                </>
              ) : (
                <span>Guardar Cambios</span>
              )}
            </button>
          </div>
        </form>
      </Modal>

      {/* MODAL DETALLE DE INTERNACIÓN */}
      <Modal
        open={detailModalOpen}
        onClose={() => {
          setDetailModalOpen(false);
          setDetailItem(null);
        }}
        title={detailItem ? `Detalle de Internación — ${detailItem.lote}` : 'Detalle'}
        size="lg"
      >
        {renderDetalleContent(detailItem)}
      </Modal>

      {/* MODAL DE HISTORIAL Y REGISTRO DE ANTICIPOS EN BÁSCULA */}
      <Modal
        open={anticiposModalOpen}
        onClose={() => setAnticiposModalOpen(false)}
        title={anticiposLoteItem ? `Control de Anticipos — ${anticiposLoteItem.lote}` : 'Anticipos'}
        size="lg"
      >
        <div className="space-y-5">
          {anticiposLoteItem && (
            <div className="flex flex-wrap items-center justify-between gap-2 rounded-lg bg-emerald-50/70 border border-emerald-200 p-3.5">
              <div>
                <p className="text-xs text-emerald-800 font-medium">Anticipo Total en Báscula</p>
                <p className="text-2xl font-mono font-bold text-emerald-900">
                  {formatBs(anticiposLoteItem.anticipo)}
                </p>
              </div>
              <div className="text-right text-xs text-gray-600">
                <p className="font-semibold text-gray-900">{anticiposLoteItem.proveedor?.nombreCompleto}</p>
                <p className="font-mono text-gray-500">Lote: {anticiposLoteItem.lote}</p>
              </div>
            </div>
          )}

          {anticiposError && (
            <div className="flex items-start gap-2 rounded-lg border border-red-200 bg-red-50 p-3 text-xs text-red-700">
              <AlertCircle className="h-4 w-4 shrink-0 text-red-500 mt-0.5" />
              <span>{anticiposError}</span>
            </div>
          )}

          {/* Formulario para agregar una nueva entrega */}
          {anticiposLoteItem && anticiposLoteItem.estado === 'EN_ESPERA_LEY' ? (
            <form onSubmit={handleCrearAnticipo} className="rounded-lg border border-gray-200 bg-gray-50/60 p-3.5 space-y-3">
              <h4 className="text-xs font-bold uppercase tracking-wider text-gray-700">
                Registrar Nueva Entrega en Báscula
              </h4>
              <div className="grid grid-cols-1 sm:grid-cols-3 gap-2.5">
                <div>
                  <input
                    type="text"
                    value={nuevoAnticipoMonto}
                    onChange={(e) => setNuevoAnticipoMonto(sanitizeMoneyInput(e.target.value))}
                    placeholder="Monto en Bs (ej: 500)"
                    className="input text-sm font-mono"
                  />
                </div>
                <div className="sm:col-span-2 flex gap-2">
                  <input
                    type="text"
                    value={nuevoAnticipoGlosa}
                    onChange={(e) => setNuevoAnticipoGlosa(e.target.value)}
                    placeholder="Glosa opcional (ej: Adelanto para flete)"
                    className="input text-sm flex-1"
                  />
                  <button
                    type="submit"
                    disabled={savingAnticipo || !nuevoAnticipoMonto}
                    className="btn btn-primary btn-sm px-4 inline-flex items-center gap-1.5 shrink-0"
                  >
                    {savingAnticipo ? (
                      <Loader2 className="h-3.5 w-3.5 animate-spin" />
                    ) : (
                      <Plus className="h-3.5 w-3.5" />
                    )}
                    <span>Registrar</span>
                  </button>
                </div>
              </div>
            </form>
          ) : (
            <p className="text-xs text-gray-500 bg-gray-50 p-3 rounded-lg border border-gray-200">
              ℹ️ Este lote ya ha sido liquidado ({anticiposLoteItem?.estado}). No se pueden agregar nuevas entregas en báscula.
            </p>
          )}

          {/* Historial cronológico de entregas */}
          <div>
            <h4 className="text-xs font-bold uppercase tracking-wider text-gray-700 mb-2">
              Historial Cronológico de Entregas
            </h4>
            {loadingAnticipos ? (
              <div className="py-6 flex justify-center">
                <Loader2 className="h-5 w-5 animate-spin text-primary-600" />
              </div>
            ) : anticiposHistory.length === 0 ? (
              <p className="text-xs text-gray-400 text-center py-4 border rounded-lg bg-white">
                No hay entregas registradas en la cronología.
              </p>
            ) : (
              <div className="overflow-x-auto border rounded-xl bg-white max-h-56">
                <table className="w-full text-xs text-left">
                  <thead className="bg-gray-50 border-b border-gray-200 text-gray-600 font-semibold sticky top-0">
                    <tr>
                      <th className="py-2.5 px-3">Fecha y Hora</th>
                      <th className="py-2.5 px-3 text-right">Monto</th>
                      <th className="py-2.5 px-3">Glosa</th>
                      <th className="py-2.5 px-3 text-right">Acción</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-gray-100">
                    {anticiposHistory.map((ant) => (
                      <tr key={ant.id} className="hover:bg-gray-50">
                        <td className="py-2.5 px-3 whitespace-nowrap text-gray-600 font-mono">
                          {formatFecha(ant.fecha)}
                        </td>
                        <td className="py-2.5 px-3 text-right font-mono font-bold text-emerald-900">
                          {formatBs(ant.monto)}
                        </td>
                        <td className="py-2.5 px-3 text-gray-600 truncate max-w-[200px]">
                          {ant.glosa || 'Entrega en báscula'}
                        </td>
                        <td className="py-2.5 px-3 text-right">
                          {anticiposLoteItem?.estado === 'EN_ESPERA_LEY' ? (
                            <button
                              type="button"
                              onClick={() => handleEliminarEntrega(ant.id)}
                              className="p-1 text-gray-400 hover:text-red-600 transition-colors"
                              title="Anular entrega"
                            >
                              <Trash2 className="h-3.5 w-3.5" />
                            </button>
                          ) : (
                            <span className="text-gray-300 text-[10px]">Cerrado</span>
                          )}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}
          </div>

          <div className="flex justify-end pt-2 border-t">
            <button
              type="button"
              onClick={() => setAnticiposModalOpen(false)}
              className="btn btn-secondary btn-sm"
            >
              Cerrar
            </button>
          </div>
        </div>
      </Modal>
    </div>
  );
};

export default InternacionesRealizadas;
