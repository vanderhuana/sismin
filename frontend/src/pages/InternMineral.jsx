import { useState, useEffect, useCallback, useMemo } from 'react';
import { Link } from 'react-router-dom';
import { useForm } from 'react-hook-form';
import {
  internacionService,
  providerService,
  anticipoService,
  handleApiError,
  getApiErrorDetails
} from '../services/api';
import Modal from '../components/ui/Modal';
import {
  PackageCheck,
  Loader2,
  AlertCircle,
  CheckCircle2,
  Pencil,
  Trash2,
  Filter,
  Scale,
  Search,
  Calculator,
  History,
  Eye,
  FileText,
  Calendar,
  Layers,
  Clock,
  Coins,
  ArrowRight,
  User,
  X,
  Info,
  RotateCcw,
  Sparkles,
  Tag
} from 'lucide-react';

const TIPOS_MINERAL = [
  {
    value: 'PLATA',
    label: 'Plata (Ag)',
    symbol: 'Ag',
    badgeClass: 'bg-slate-100 text-slate-800 border-slate-300',
    activeClass: 'border-slate-500 bg-slate-50 ring-2 ring-slate-400',
    desc: 'Mineral simple de plata'
  },
  {
    value: 'PLOMO',
    label: 'Plomo (Pb)',
    symbol: 'Pb',
    badgeClass: 'bg-zinc-100 text-zinc-800 border-zinc-300',
    activeClass: 'border-zinc-500 bg-zinc-50 ring-2 ring-zinc-400',
    desc: 'Mineral simple de plomo'
  },
  {
    value: 'COMPLEJO',
    label: 'Complejo (Ag + Pb)',
    symbol: 'Ag+Pb',
    badgeClass: 'bg-amber-100 text-amber-800 border-amber-300',
    activeClass: 'border-amber-500 bg-amber-50 ring-2 ring-amber-400',
    desc: 'Mineral mixto plata y plomo'
  }
];

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

// Sanitizador de número para kilos (sólo números enteros sin decimales)
const sanitizeKilosInput = (raw) => {
  if (!raw) return '';
  return raw.replace(/[^0-9]/g, '');
};

// Sanitizador de número para moneda (sólo números enteros sin decimales)
const sanitizeMoneyInput = (raw) => {
  if (!raw) return '';
  return raw.replace(/[^0-9]/g, '');
};

const handleNumericKeyDown = (e) => {
  if (['e', 'E', '+', '-', '.', ','].includes(e.key)) {
    e.preventDefault();
  }
};

const InternMineral = () => {
  const [proveedores, setProveedores] = useState([]);
  const [internaciones, setInternaciones] = useState([]);
  const [stats, setStats] = useState(null);
  const [pagination, setPagination] = useState({ page: 1, limit: 10, total: 0, pages: 1 });
  const [filtroEstado, setFiltroEstado] = useState('');
  const [filtroTipo, setFiltroTipo] = useState('');
  const [filtroFecha, setFiltroFecha] = useState('');
  const [busquedaProveedor, setBusquedaProveedor] = useState('');
  const [busquedaLista, setBusquedaLista] = useState('');
  const [busquedaAplicada, setBusquedaAplicada] = useState('');
  const [loading, setLoading] = useState(true);
  const [loadingProveedores, setLoadingProveedores] = useState(true);
  const [downloadingId, setDownloadingId] = useState(null);
  const [error, setError] = useState(null);
  const [formError, setFormError] = useState(null);
  const [editModalError, setEditModalError] = useState(null);
  const [success, setSuccess] = useState(null);
  const [editModalOpen, setEditModalOpen] = useState(false);
  const [historialModalOpen, setHistorialModalOpen] = useState(false);
  const [detailModalOpen, setDetailModalOpen] = useState(false);
  const [editingItem, setEditingItem] = useState(null);
  const [detailItem, setDetailItem] = useState(null);
  const [submitting, setSubmitting] = useState(false);

  // Estado para gestión e historial de anticipos por lote
  const [anticiposModalOpen, setAnticiposModalOpen] = useState(false);
  const [anticiposLoteItem, setAnticiposLoteItem] = useState(null);
  const [anticiposHistory, setAnticiposHistory] = useState([]);
  const [loadingAnticipos, setLoadingAnticipos] = useState(false);
  const [savingAnticipo, setSavingAnticipo] = useState(false);
  const [nuevoAnticipoMonto, setNuevoAnticipoMonto] = useState('');
  const [nuevoAnticipoGlosa, setNuevoAnticipoGlosa] = useState('');
  const [anticiposError, setAnticiposError] = useState(null);

  // Formulario de Registro
  const createForm = useForm({
    mode: 'onChange',
    reValidateMode: 'onChange',
    defaultValues: {
      lote: '',
      proveedorId: '',
      tipoMineral: 'PLATA',
      kilosBruto: '',
      anticipo: ''
    }
  });

  const {
    register: createRegister,
    handleSubmit: handleCreateSubmit,
    reset: resetCreateForm,
    setValue: setCreateValue,
    watch: watchCreate,
    setError: setCreateFieldError,
    clearErrors: clearCreateErrors,
    formState: { errors: createErrors, isDirty: createIsDirty }
  } = createForm;

  const watchedCreateLote = watchCreate('lote');
  const watchedCreateProveedorId = watchCreate('proveedorId');
  const watchedCreateTipoMineral = watchCreate('tipoMineral');
  const watchedCreateKilos = watchCreate('kilosBruto');
  const watchedCreateAnticipo = watchCreate('anticipo');

  // Formulario de Edición
  const editForm = useForm({
    mode: 'onChange',
    reValidateMode: 'onChange'
  });

  const {
    register: editRegister,
    handleSubmit: handleEditSubmit,
    reset: resetEditForm,
    setValue: setEditValue,
    watch: watchEdit,
    setError: setEditFieldError,
    clearErrors: clearEditErrors,
    formState: { errors: editErrors }
  } = editForm;

  const watchedEditTipoMineral = watchEdit('tipoMineral');
  const watchedEditKilos = watchEdit('kilosBruto');
  const watchedEditAnticipo = watchEdit('anticipo');

  // Cargar proveedores activos
  const loadProveedores = async () => {
    try {
      setLoadingProveedores(true);
      const data = await providerService.getActiveProviders();
      setProveedores(data || []);
    } catch (err) {
      setError(handleApiError(err));
    } finally {
      setLoadingProveedores(false);
    }
  };

  // Cargar estadísticas
  const loadStats = async () => {
    try {
      const data = await internacionService.getDashboardStats();
      setStats(data);
    } catch {
      // no bloquear si falla el stat
    }
  };

  // Proveedores filtrados por la búsqueda
  const proveedoresFiltrados = useMemo(() => {
    if (!busquedaProveedor.trim()) return proveedores;
    const q = busquedaProveedor.toLowerCase().trim();
    return proveedores.filter(
      (p) =>
        p.nombreCompleto.toLowerCase().includes(q) ||
        (p.ci && p.ci.toLowerCase().includes(q))
    );
  }, [proveedores, busquedaProveedor]);

  // Proveedor seleccionado en el formulario de creación
  const proveedorSeleccionado = useMemo(() => {
    if (!watchedCreateProveedorId) return null;
    return proveedores.find((p) => String(p.id) === String(watchedCreateProveedorId));
  }, [proveedores, watchedCreateProveedorId]);

  // Cargar internaciones con filtros
  const loadInternaciones = useCallback(
    async (page = 1) => {
      try {
        setLoading(true);
        setError(null);
        const params = { page, limit: 10 };
        if (filtroEstado) params.estado = filtroEstado;
        if (filtroTipo) params.tipoMineral = filtroTipo;
        if (busquedaAplicada.trim()) params.search = busquedaAplicada.trim();

        if (filtroFecha === 'hoy') {
          const hoy = new Date().toISOString().split('T')[0];
          params.fechaDesde = hoy;
          params.fechaHasta = hoy;
        } else if (filtroFecha === 'semana') {
          const haceUnaSemana = new Date();
          haceUnaSemana.setDate(haceUnaSemana.getDate() - 7);
          params.fechaDesde = haceUnaSemana.toISOString().split('T')[0];
        } else if (filtroFecha === 'mes') {
          const haceUnMes = new Date();
          haceUnMes.setDate(haceUnMes.getDate() - 30);
          params.fechaDesde = haceUnMes.toISOString().split('T')[0];
        }

        const data = await internacionService.getInternaciones(params);
        setInternaciones(data.internaciones || []);
        setPagination(data.pagination || { page: 1, limit: 10, total: 0, pages: 1 });
      } catch (err) {
        setError(handleApiError(err));
      } finally {
        setLoading(false);
      }
    },
    [filtroEstado, filtroTipo, filtroFecha, busquedaAplicada]
  );

  useEffect(() => {
    loadProveedores();
    loadStats();
  }, []);

  useEffect(() => {
    loadInternaciones();
  }, [loadInternaciones]);

  const showSuccess = (message) => {
    setSuccess(message);
    setTimeout(() => setSuccess(null), 4500);
  };

  // Manejo de input de lote manual en creación
  const handleCreateLoteChange = (e) => {
    const val = e.target.value.toUpperCase();
    setCreateValue('lote', val, { shouldValidate: true, shouldDirty: true });
    setFormError(null);
  };

  // Sugerir próximo número correlativo de lote si el usuario lo desea
  const handleSugerirLote = async () => {
    try {
      const data = await internacionService.getNextLote();
      if (data?.nextLote) {
        setCreateValue('lote', data.nextLote, { shouldValidate: true, shouldDirty: true });
        clearCreateErrors('lote');
        setFormError(null);
      }
    } catch {
      setCreateValue('lote', `LOTE-${(pagination.total + 1).toString().padStart(3, '0')}`, {
        shouldValidate: true,
        shouldDirty: true
      });
    }
  };

  // Manejo de input de kilos en creación
  const handleCreateKilosChange = (e) => {
    const clean = sanitizeKilosInput(e.target.value);
    setCreateValue('kilosBruto', clean, { shouldValidate: true, shouldDirty: true });
    setFormError(null);
  };

  // Manejo de input de anticipo en creación
  const handleCreateAnticipoChange = (e) => {
    const clean = sanitizeMoneyInput(e.target.value);
    setCreateValue('anticipo', clean, { shouldValidate: true, shouldDirty: true });
    setFormError(null);
  };

  // Manejo de input de kilos en edición
  const handleEditKilosChange = (e) => {
    const clean = sanitizeKilosInput(e.target.value);
    setEditValue('kilosBruto', clean, { shouldValidate: true, shouldDirty: true });
    setEditModalError(null);
  };

  // Manejo de input de anticipo en edición
  const handleEditAnticipoChange = (e) => {
    const clean = sanitizeMoneyInput(e.target.value);
    setEditValue('anticipo', clean, { shouldValidate: true, shouldDirty: true });
    setEditModalError(null);
  };

  // Selección rápida de proveedor
  const handleSelectProveedor = (provId) => {
    setCreateValue('proveedorId', String(provId), { shouldValidate: true, shouldDirty: true });
    clearCreateErrors('proveedorId');
    setFormError(null);
  };

  const handleClearProveedor = () => {
    setCreateValue('proveedorId', '', { shouldValidate: true, shouldDirty: true });
    setBusquedaProveedor('');
  };

  // Envío del registro de internación
  const onCreateSubmit = async (data) => {
    try {
      setSubmitting(true);
      setFormError(null);
      setError(null);

      const loteTrimmed = (data.lote || '').trim().toUpperCase();
      if (!loteTrimmed) {
        setCreateFieldError('lote', {
          type: 'manual',
          message: 'Debes ingresar el número de lote'
        });
        return;
      }

      const kilos = Math.trunc(parseFloat(data.kilosBruto));
      if (isNaN(kilos) || kilos <= 0) {
        setCreateFieldError('kilosBruto', {
          type: 'manual',
          message: 'Los kilos bruto deben ser un número entero mayor a cero (0)'
        });
        return;
      }

      const anticipoEnBascula = data.anticipo ? Math.trunc(parseFloat(data.anticipo)) : 0;
      if (isNaN(anticipoEnBascula) || anticipoEnBascula < 0) {
        setCreateFieldError('anticipo', {
          type: 'manual',
          message: 'El anticipo no puede ser negativo'
        });
        return;
      }

      const payload = {
        lote: loteTrimmed,
        proveedorId: parseInt(data.proveedorId, 10),
        tipoMineral: data.tipoMineral,
        kilosBruto: kilos,
        anticipo: anticipoEnBascula
      };

      const result = await internacionService.createInternacion(payload);
      showSuccess(`✅ Internación registrada con éxito — Lote asignado: ${result.internacion.lote}`);

      // Resetear formulario a valores limpios
      resetCreateForm({
        lote: '',
        proveedorId: '',
        tipoMineral: 'PLATA',
        kilosBruto: '',
        anticipo: ''
      });
      setBusquedaProveedor('');

      // Recargar lista y métricas
      loadInternaciones(1);
      loadStats();
    } catch (err) {
      const errDetails = getApiErrorDetails(err);
      setFormError(errDetails.message);
      if (errDetails.field) {
        setCreateFieldError(errDetails.field, {
          type: 'server',
          message: errDetails.message
        });
      }
    } finally {
      setSubmitting(false);
    }
  };

  // Abrir modal de edición
  const openEditModal = (item) => {
    setEditingItem(item);
    setEditModalError(null);
    clearEditErrors();
    resetEditForm({
      lote: item.lote || '',
      proveedorId: String(item.proveedorId),
      tipoMineral: item.tipoMineral,
      kilosBruto: String(item.kilosBruto),
      anticipo: String(item.anticipo || 0)
    });
    setEditModalOpen(true);
  };

  const closeEditModal = () => {
    setEditModalOpen(false);
    setEditingItem(null);
    setEditModalError(null);
    resetEditForm({
      lote: '',
      proveedorId: '',
      tipoMineral: 'PLATA',
      kilosBruto: '',
      anticipo: ''
    });
  };

  // Envío de actualización de internación
  const onEditSubmit = async (data) => {
    try {
      setSubmitting(true);
      setEditModalError(null);

      const loteTrimmed = (data.lote || '').trim().toUpperCase();
      if (!loteTrimmed) {
        setEditFieldError('lote', {
          type: 'manual',
          message: 'El número de lote no puede estar vacío'
        });
        return;
      }

      const kilos = Math.trunc(parseFloat(data.kilosBruto));
      if (isNaN(kilos) || kilos <= 0) {
        setEditFieldError('kilosBruto', {
          type: 'manual',
          message: 'Los kilos bruto deben ser un número entero mayor a 0'
        });
        return;
      }

      const anticipo = data.anticipo ? Math.trunc(parseFloat(data.anticipo)) : 0;
      if (isNaN(anticipo) || anticipo < 0) {
        setEditFieldError('anticipo', {
          type: 'manual',
          message: 'El anticipo no puede ser negativo'
        });
        return;
      }

      const payload = {
        lote: loteTrimmed,
        proveedorId: parseInt(data.proveedorId, 10),
        tipoMineral: data.tipoMineral,
        kilosBruto: kilos,
        anticipo
      };

      await internacionService.updateInternacion(editingItem.id, payload);
      showSuccess(`✅ Lote ${loteTrimmed} actualizado correctamente`);
      closeEditModal();
      loadInternaciones(pagination.page);
      loadStats();
    } catch (err) {
      const errDetails = getApiErrorDetails(err);
      setEditModalError(errDetails.message);
      if (errDetails.field) {
        setEditFieldError(errDetails.field, {
          type: 'server',
          message: errDetails.message
        });
      }
    } finally {
      setSubmitting(false);
    }
  };

  // Eliminar internación
  const handleDelete = async (item) => {
    if (!window.confirm(`¿Estás seguro de eliminar la internación con ${item.lote}?\n\nEsta acción no se puede deshacer.`)) {
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

  // Descargar Boleta o Comprobante Oficial en PDF
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

  const canEdit = (item) => item.estado === 'EN_ESPERA_LEY' && !item.calculo;
  const canCalculate = (item) => canEdit(item);
  const canDelete = (item) => !item.calculo;

  const getMineralStyle = (tipo) =>
    TIPOS_MINERAL.find((t) => t.value === tipo)?.badgeClass || 'bg-gray-100 text-gray-800 border-gray-200';

  const getMineralLabel = (tipo) =>
    TIPOS_MINERAL.find((t) => t.value === tipo)?.label || tipo;

  const openDetail = async (item) => {
    try {
      const full = await internacionService.getInternacion(item.id);
      setDetailItem(full);
      setDetailModalOpen(true);
    } catch (err) {
      setError(handleApiError(err));
    }
  };

  const openHistorial = () => {
    setHistorialModalOpen(true);
    loadInternaciones(pagination.page);
  };

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
        monto,
        glosa: nuevoAnticipoGlosa.trim() || 'Adelanto en efectivo'
      });
      showSuccess(`✅ Anticipo de ${formatBs(monto)} registrado correctamente`);
      setNuevoAnticipoMonto('');
      setNuevoAnticipoGlosa('');
      await loadAnticiposForLote(anticiposLoteItem.id);
      loadInternaciones(pagination.page);
      loadStats();
    } catch (err) {
      setAnticiposError(handleApiError(err));
    } finally {
      setSavingAnticipo(false);
    }
  };

  const handleEliminarAnticipo = async (anticipoId) => {
    if (!window.confirm('¿Estás seguro de eliminar este registro de anticipo? Se restará del total del lote.')) return;
    try {
      await anticipoService.deleteAnticipo(anticipoId);
      showSuccess('Anticipo eliminado');
      if (anticiposLoteItem) {
        await loadAnticiposForLote(anticiposLoteItem.id);
      }
      loadInternaciones(pagination.page);
      loadStats();
    } catch (err) {
      setAnticiposError(handleApiError(err));
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

  // Renderizar contenido de detalle de una internación
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
              className={`inline-flex items-center gap-1 rounded-full px-3 py-1 text-xs font-semibold ${
                estadoLabel[item.estado]?.color || 'bg-gray-100 text-gray-800'
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
            <p className="text-xs text-gray-600">CI / NIT: {item.proveedor?.ci || 'Sin registro'}</p>
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
                {c.estadoPago === 'PAGADO' ? '✓ Pagado' : 'Pendiente de pago'}
              </span>
            </div>

            <dl className="space-y-2 text-xs sm:text-sm">
              {item.tipoMineral === 'COMPLEJO' ? (
                <>
                  <div className="flex justify-between">
                    <dt className="text-gray-600">Ley Plata</dt>
                    <dd className="font-medium">{c.leyPlata} DM · Escala {c.valorEscalaPlata}</dd>
                  </div>
                  <div className="flex justify-between">
                    <dt className="text-gray-600">Ley Plomo</dt>
                    <dd className="font-medium">{c.leyPlomo} DM · Escala {c.valorEscalaPlomo}</dd>
                  </div>
                  <div className="flex justify-between font-semibold text-primary-800">
                    <dt>Valor Escala Total</dt>
                    <dd>{c.valorEscalaTotal}</dd>
                  </div>
                </>
              ) : (
                <div className="flex justify-between">
                  <dt className="text-gray-600">Ley {item.tipoMineral}</dt>
                  <dd className="font-medium">{c.ley} DM · Escala {c.valorEscala}</dd>
                </div>
              )}

              <div className="flex justify-between">
                <dt className="text-gray-600">Humedad descontada</dt>
                <dd className="font-medium">{c.humedadPorcentaje}%</dd>
              </div>
              <div className="flex justify-between">
                <dt className="text-gray-600">Kilos Neto</dt>
                <dd className="font-bold text-gray-900">{formatKilos(c.kilosNeto)} kg</dd>
              </div>
              <div className="flex justify-between border-t pt-2 font-medium">
                <dt>Valor Bruto</dt>
                <dd>{formatBs(c.valorBruto)}</dd>
              </div>
              <div className="flex justify-between text-red-600">
                <dt>(-) Regalías ({c.regaliasPorcentaje}%)</dt>
                <dd>- {formatBs(c.regaliasMonto)}</dd>
              </div>
              {Number(c.anticipos) > 0 && (
                <div className="flex justify-between text-red-600">
                  <dt>(-) Anticipos</dt>
                  <dd>- {formatBs(c.anticipos)}</dd>
                </div>
              )}
              {Number(c.transporte) > 0 && (
                <div className="flex justify-between text-green-700">
                  <dt>(+) Transporte</dt>
                  <dd>+ {formatBs(c.transporte)}</dd>
                </div>
              )}
              <div className="flex justify-between border-t-2 border-gray-300 pt-2 text-base font-bold">
                <dt className="text-gray-900">Saldo Final Liquidado</dt>
                <dd className="text-primary-700">{formatBs(c.saldoFinal)}</dd>
              </div>
            </dl>
          </div>
        ) : (
          <div className="rounded-lg bg-amber-50 p-3.5 text-center text-xs sm:text-sm text-amber-800 border border-amber-200">
            <p className="font-medium">⏳ Mineral en espera de resultados de ley</p>
            <p className="mt-0.5 text-amber-700 text-xs">
              El pago podrá ser procesado una vez obtenidos los ensayos del laboratorio químico.
            </p>
          </div>
        )}

        {/* Acciones en el modal */}
        <div className="flex flex-wrap items-center justify-between gap-2 pt-3 border-t">
          <button
            type="button"
            onClick={() => handleDownloadBoleta(item)}
            disabled={downloadingId === item.id}
            className={`btn btn-sm inline-flex items-center gap-1.5 ${
              item.calculo || item.estado === 'PAGADO' || item.estado === 'CALCULADO'
                ? 'btn-primary'
                : 'btn-secondary'
            }`}
          >
            {downloadingId === item.id ? (
              <Loader2 className="h-4 w-4 animate-spin" />
            ) : (
              <FileText className="h-4 w-4" />
            )}
            <span>
              {item.calculo || item.estado === 'PAGADO' || item.estado === 'CALCULADO'
                ? 'Descargar Comprobante Oficial (PDF)'
                : 'Descargar Boleta de Recepción (PDF)'}
            </span>
          </button>

          {canCalculate(item) && (
            <Link
              to="/calcular"
              state={{ internacionId: item.id }}
              className="btn btn-primary btn-sm inline-flex items-center gap-1.5"
            >
              <Calculator className="h-4 w-4" />
              <span>Proceder al Cálculo</span>
            </Link>
          )}
        </div>
      </div>
    );
  };

  return (
    <div className="space-y-6">
      {/* Encabezado Principal */}
      <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <div className="flex items-center gap-2">
            <div className="flex h-10 w-10 items-center justify-center rounded-lg bg-primary-100 text-primary-700">
              <Scale className="h-6 w-6" />
            </div>
            <div>
              <h1 className="text-2xl sm:text-3xl font-bold text-gray-900">Internar Mineral</h1>
              <p className="text-sm text-gray-500">
                Fase 1: Recepción de mineral, pesaje en báscula y emisión de boleta
              </p>
            </div>
          </div>
        </div>

        <div className="flex items-center gap-2">
          <button
            type="button"
            onClick={openHistorial}
            className="btn btn-secondary btn-md inline-flex items-center gap-2"
          >
            <History className="h-4 w-4 text-gray-600" />
            <span>Ver Historial</span>
          </button>
        </div>
      </div>

      {/* Tarjetas de Métricas Rápidas */}
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

      {/* Mensajes de Alerta Globales */}
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
        <div className="flex items-center gap-3 rounded-xl border border-green-200 bg-green-50 p-4 text-sm font-medium text-green-800 shadow-sm animate-fade-in">
          <CheckCircle2 className="h-5 w-5 shrink-0 text-green-600" />
          <span>{success}</span>
        </div>
      )}

      {/* FORMULARIO DE REGISTRO / ENTRADA EN BÁSCULA */}
      <div className="card shadow-sm border border-gray-200 overflow-hidden">
        <div className="bg-gradient-to-r from-gray-50 to-white px-6 py-4 border-b border-gray-200 flex items-center justify-between">
          <div>
            <h2 className="text-lg font-bold text-gray-900 flex items-center gap-2">
              <Scale className="h-5 w-5 text-primary-600" />
              Registro de Entrada de Mineral (Báscula)
            </h2>
            <p className="text-xs text-gray-500 mt-0.5">
              Control estricto de pesaje y registro de lote manual para un control operativo exacto.
            </p>
          </div>
          <span className="hidden sm:inline-flex items-center gap-1 rounded-full bg-primary-50 px-2.5 py-1 text-xs font-medium text-primary-700 border border-primary-200">
            <Sparkles className="h-3 w-3" />
            Control en Tiempo Real
          </span>
        </div>

        <div className="p-6">
          {formError && (
            <div className="mb-4 flex items-start gap-2.5 rounded-lg border border-red-200 bg-red-50 p-3 text-xs text-red-700">
              <AlertCircle className="h-4 w-4 shrink-0 text-red-500 mt-0.5" />
              <span>{formError}</span>
            </div>
          )}

          {loadingProveedores ? (
            <div className="flex flex-col items-center justify-center py-12">
              <Loader2 className="h-8 w-8 animate-spin text-primary-600" />
              <p className="mt-2 text-sm text-gray-500">Cargando lista de proveedores activos...</p>
            </div>
          ) : proveedores.length === 0 ? (
            <div className="rounded-xl bg-amber-50 p-6 text-center border border-amber-200">
              <AlertCircle className="mx-auto h-8 w-8 text-amber-600" />
              <h3 className="mt-2 text-base font-semibold text-amber-900">
                No hay proveedores activos registrados
              </h3>
              <p className="mt-1 text-sm text-amber-700">
                Para registrar una internación de mineral, primero debes registrar o activar al menos un proveedor.
              </p>
              <Link to="/proveedores" className="btn btn-primary btn-sm mt-4 inline-flex items-center gap-1">
                Ir al módulo de Proveedores
                <ArrowRight className="h-4 w-4" />
              </Link>
            </div>
          ) : (
            <form onSubmit={handleCreateSubmit(onCreateSubmit)} className="space-y-6">
              {/* SECCIÓN 1: PROVEEDOR */}
              <div className="space-y-2">
                <div className="flex items-center justify-between">
                  <label className="text-sm font-semibold text-gray-800 flex items-center gap-1">
                    <User className="h-4 w-4 text-gray-500" />
                    <span>Proveedor de Mineral *</span>
                  </label>
                  {proveedorSeleccionado && (
                    <button
                      type="button"
                      onClick={handleClearProveedor}
                      className="text-xs text-primary-600 hover:text-primary-800 font-medium inline-flex items-center gap-1"
                    >
                      <RotateCcw className="h-3 w-3" /> Cambiar proveedor
                    </button>
                  )}
                </div>

                {proveedorSeleccionado ? (
                  <div className="flex items-center justify-between rounded-lg border-2 border-primary-500 bg-primary-50/40 p-3.5 transition-all">
                    <div className="flex items-center gap-3">
                      <div className="flex h-9 w-9 items-center justify-center rounded-full bg-primary-600 text-white font-bold text-sm">
                        {proveedorSeleccionado.nombreCompleto.charAt(0).toUpperCase()}
                      </div>
                      <div>
                        <p className="text-sm font-bold text-gray-900">
                          {proveedorSeleccionado.nombreCompleto}
                        </p>
                        <div className="flex items-center gap-2 text-xs text-gray-600">
                          <span>CI/NIT: {proveedorSeleccionado.ci || 'Sin registro'}</span>
                          <span>•</span>
                          <span className="rounded bg-white px-1.5 py-0.5 border border-gray-200 text-gray-700 font-medium">
                            {proveedorSeleccionado.tipo === 'EMPRESA' ? 'Empresa' : 'Persona Natural'}
                          </span>
                        </div>
                      </div>
                    </div>
                    <span className="flex items-center gap-1 rounded-full bg-primary-100 px-2.5 py-1 text-xs font-semibold text-primary-800">
                      <CheckCircle2 className="h-3.5 w-3.5 text-primary-600" />
                      Seleccionado
                    </span>
                  </div>
                ) : (
                  <div className="space-y-2">
                    <div className="relative">
                      <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-gray-400" />
                      <input
                        type="text"
                        value={busquedaProveedor}
                        onChange={(e) => setBusquedaProveedor(e.target.value)}
                        className="input pl-9 text-sm"
                        placeholder="Buscar proveedor por nombre o CI para seleccionar..."
                      />
                    </div>

                    <div className="max-h-44 overflow-y-auto rounded-lg border border-gray-200 bg-white divide-y divide-gray-100 shadow-inner">
                      {proveedoresFiltrados.length === 0 ? (
                        <p className="py-4 text-center text-xs text-gray-500">
                          No se encontraron proveedores que coincidan con la búsqueda.
                        </p>
                      ) : (
                        proveedoresFiltrados.map((p) => (
                          <button
                            type="button"
                            key={p.id}
                            onClick={() => handleSelectProveedor(p.id)}
                            className="w-full px-3.5 py-2.5 text-left hover:bg-primary-50/60 flex items-center justify-between transition-colors group"
                          >
                            <div>
                              <p className="text-sm font-medium text-gray-900 group-hover:text-primary-700">
                                {p.nombreCompleto}
                              </p>
                              <p className="text-xs text-gray-500">
                                CI: {p.ci || '—'} · {p.tipo === 'EMPRESA' ? 'Empresa' : 'Persona Natural'}
                              </p>
                            </div>
                            <span className="text-xs font-medium text-gray-400 group-hover:text-primary-600">
                              Seleccionar →
                            </span>
                          </button>
                        ))
                      )}
                    </div>
                  </div>
                )}

                {/* Input oculto registrado para validación de react-hook-form */}
                <input
                  type="hidden"
                  {...createRegister('proveedorId', {
                    required: 'Debes seleccionar un proveedor de la lista'
                  })}
                />
                {createErrors.proveedorId && (
                  <p className="mt-1 flex items-center gap-1 text-xs text-red-600">
                    <AlertCircle className="h-3.5 w-3.5 shrink-0" />
                    <span>{createErrors.proveedorId.message}</span>
                  </p>
                )}
              </div>

              {/* SECCIÓN 2: TIPO DE MINERAL */}
              <div className="space-y-2">
                <label className="text-sm font-semibold text-gray-800">
                  Tipo de Mineral *
                </label>
                <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
                  {TIPOS_MINERAL.map((t) => {
                    const isSelected = watchedCreateTipoMineral === t.value;
                    return (
                      <button
                        type="button"
                        key={t.value}
                        onClick={() => {
                          setCreateValue('tipoMineral', t.value, { shouldValidate: true });
                          setFormError(null);
                        }}
                        className={`p-3.5 rounded-xl border text-left transition-all flex flex-col justify-between ${
                          isSelected
                            ? `${t.activeClass} shadow-sm`
                            : 'border-gray-200 hover:border-gray-300 bg-white'
                        }`}
                      >
                        <div className="flex items-center justify-between">
                          <span className="font-bold text-sm text-gray-900">{t.label}</span>
                          <span
                            className={`rounded-full px-2 py-0.5 text-xs font-mono font-bold ${t.badgeClass}`}
                          >
                            {t.symbol}
                          </span>
                        </div>
                        <p className="text-xs text-gray-500 mt-1">{t.desc}</p>
                      </button>
                    );
                  })}
                </div>
              </div>

              {/* SECCIÓN 3: CONTROL DE LOTE, PESO Y ANTICIPO */}
              <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                {/* Número de Lote Manual */}
                <div>
                  <div className="flex items-center justify-between mb-1">
                    <label className="text-sm font-semibold text-gray-800 flex items-center gap-1.5">
                      <Tag className="h-4 w-4 text-primary-600" />
                      <span>Número de Lote *</span>
                    </label>
                    <button
                      type="button"
                      onClick={handleSugerirLote}
                      className="text-xs text-primary-600 hover:text-primary-800 font-medium inline-flex items-center gap-1 transition-colors hover:underline"
                      title="Sugerir siguiente correlativo disponible"
                    >
                      <Sparkles className="h-3 w-3" />
                      Sugerir
                    </button>
                  </div>
                  <div className="relative">
                    <Tag className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-gray-400" />
                    <input
                      type="text"
                      {...createRegister('lote', {
                        required: 'Ingresa el número de lote manual',
                        validate: (val) => {
                          if (!val || !val.trim()) return 'El número de lote es obligatorio';
                          if (val.trim().length > 50) return 'El lote no puede exceder 50 caracteres';
                          return true;
                        }
                      })}
                      value={watchedCreateLote || ''}
                      onChange={handleCreateLoteChange}
                      className={`input pl-9 text-base font-mono uppercase font-bold tracking-wide ${
                        createErrors.lote ? 'input-error' : ''
                      }`}
                      placeholder="Ej: LOTE-001 o LT-204"
                      autoComplete="off"
                    />
                  </div>
                  <p className="mt-1 text-xs text-gray-500">
                    Asigna el código o número de lote físico/manual para control exacto.
                  </p>
                  {createErrors.lote && (
                    <p className="mt-1 flex items-center gap-1 text-xs text-red-600 font-medium">
                      <AlertCircle className="h-3.5 w-3.5 shrink-0" />
                      <span>{createErrors.lote.message}</span>
                    </p>
                  )}
                </div>

                {/* Kilos Bruto */}
                <div>
                  <div className="flex items-center justify-between mb-1">
                    <label className="text-sm font-semibold text-gray-800 flex items-center gap-1.5">
                      <Scale className="h-4 w-4 text-primary-600" />
                      <span>Kilos Bruto en Báscula *</span>
                    </label>
                    {watchedCreateKilos && !isNaN(Number(watchedCreateKilos)) && Number(watchedCreateKilos) > 0 && (
                      <span className="text-xs font-medium text-primary-700 bg-primary-50 px-2 py-0.5 rounded">
                        ⚖️ {formatKilos(watchedCreateKilos)} kg
                      </span>
                    )}
                  </div>
                  <div className="relative">
                    <Scale className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-gray-400" />
                    <input
                      type="text"
                      inputMode="numeric"
                      {...createRegister('kilosBruto', {
                        required: 'Ingresa los kilos bruto pesados en báscula',
                        validate: (val) => {
                          const n = parseInt(val, 10);
                          if (isNaN(n) || n <= 0) return 'El peso debe ser un número entero mayor a 0 kg';
                          return true;
                        }
                      })}
                      onKeyDown={handleNumericKeyDown}
                      onChange={handleCreateKilosChange}
                      className={`input pl-9 text-base font-medium ${
                        createErrors.kilosBruto ? 'input-error' : ''
                      }`}
                      placeholder="Ej: 1500"
                    />
                  </div>
                  <p className="mt-1 text-xs text-gray-500">
                    Ingresa el peso bruto exacto en números enteros (sin decimales).
                  </p>
                  {createErrors.kilosBruto && (
                    <p className="mt-1 flex items-center gap-1 text-xs text-red-600 font-medium">
                      <AlertCircle className="h-3.5 w-3.5 shrink-0" />
                      <span>{createErrors.kilosBruto.message}</span>
                    </p>
                  )}
                </div>

                {/* Anticipo */}
                <div>
                  <div className="flex items-center justify-between mb-1">
                    <label className="text-sm font-semibold text-gray-800 flex items-center gap-1.5">
                      <Coins className="h-4 w-4 text-emerald-600" />
                      <span>Anticipo en Báscula (Bs)</span>
                    </label>
                    {watchedCreateAnticipo && !isNaN(Number(watchedCreateAnticipo)) && Number(watchedCreateAnticipo) > 0 && (
                      <span className="text-xs font-medium text-emerald-700 bg-emerald-50 px-2 py-0.5 rounded">
                        💵 {formatBs(Number(watchedCreateAnticipo))}
                      </span>
                    )}
                  </div>
                  <div className="relative">
                    <Coins className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-gray-400" />
                    <input
                      type="text"
                      inputMode="numeric"
                      {...createRegister('anticipo', {
                        validate: (val) => {
                          if (!val) return true;
                          const n = parseInt(val, 10);
                          if (isNaN(n) || n < 0) return 'El anticipo no puede ser negativo';
                          return true;
                        }
                      })}
                      onKeyDown={handleNumericKeyDown}
                      onChange={handleCreateAnticipoChange}
                      className={`input pl-9 text-base font-medium ${
                        createErrors.anticipo ? 'input-error' : ''
                      }`}
                      placeholder="0 (Opcional)"
                    />
                  </div>
                  <p className="mt-1 text-xs text-gray-500">
                    Monto anticipado entero en Bolivianos. Dejar en 0 si no hubo anticipo.
                  </p>
                  {createErrors.anticipo && (
                    <p className="mt-1 flex items-center gap-1 text-xs text-red-600 font-medium">
                      <AlertCircle className="h-3.5 w-3.5 shrink-0" />
                      <span>{createErrors.anticipo.message}</span>
                    </p>
                  )}
                </div>
              </div>

              {/* Botón de envío */}
              <div className="flex items-center justify-end gap-3 pt-4 border-t border-gray-100">
                <button
                  type="submit"
                  disabled={submitting}
                  className="btn btn-primary btn-md shadow-md inline-flex items-center gap-2 px-6"
                >
                  {submitting ? (
                    <>
                      <Loader2 className="h-4 w-4 animate-spin" />
                      <span>Registrando internación de mineral...</span>
                    </>
                  ) : (
                    <>
                      <PackageCheck className="h-5 w-5" />
                      <span>Registrar Internación de Mineral</span>
                    </>
                  )}
                </button>
              </div>
            </form>
          )}
        </div>
      </div>

      {/* LISTADO / TABLA DE INTERNACIONES */}
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

        {/* Tabla */}
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
                : 'Registra una nueva internación con el formulario de arriba'}
            </p>
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="table">
              <thead className="table-header">
                <tr className="table-header-row">
                  <th className="table-header-cell">Lote</th>
                  <th className="table-header-cell">Fecha y Hora</th>
                  <th className="table-header-cell">Proveedor</th>
                  <th className="table-header-cell">Mineral</th>
                  <th className="table-header-cell text-right">Kilos Bruto</th>
                  <th className="table-header-cell text-right">Anticipo</th>
                  <th className="table-header-cell text-center">Estado</th>
                  <th className="table-header-cell">Operador</th>
                  <th className="table-header-cell text-right">Acciones</th>
                </tr>
              </thead>
              <tbody className="table-body">
                {internaciones.map((item) => (
                  <tr key={item.id} className="table-row hover:bg-gray-50/70 transition-colors">
                    {/* Lote */}
                    <td className="table-cell font-mono font-bold text-primary-700">
                      {item.lote}
                    </td>

                    {/* Fecha */}
                    <td className="table-cell text-xs text-gray-600">
                      {formatFecha(item.fechaInternacion)}
                    </td>

                    {/* Proveedor */}
                    <td className="table-cell">
                      <p className="font-semibold text-gray-900 text-sm">
                        {item.proveedor?.nombreCompleto}
                      </p>
                      <p className="text-xs text-gray-500">CI: {item.proveedor?.ci || '—'}</p>
                    </td>

                    {/* Mineral */}
                    <td className="table-cell">
                      <span
                        className={`inline-flex rounded-full px-2.5 py-0.5 text-xs font-semibold ${getMineralStyle(
                          item.tipoMineral
                        )}`}
                      >
                        {getMineralLabel(item.tipoMineral)}
                      </span>
                    </td>

                    {/* Kilos Bruto */}
                    <td className="table-cell text-right font-mono font-semibold text-gray-900">
                      {formatKilos(item.kilosBruto)} kg
                    </td>

                    {/* Anticipo */}
                    <td className="table-cell text-right text-xs">
                      <button
                        type="button"
                        onClick={() => openAnticiposModal(item)}
                        className="inline-flex items-center gap-1.5 rounded-lg border border-emerald-200 bg-emerald-50 px-2 py-1 text-emerald-800 hover:bg-emerald-100 hover:border-emerald-300 transition-colors font-mono font-semibold"
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
                    <td className="table-cell text-center">
                      <span
                        className={`inline-flex rounded-full px-2.5 py-0.5 text-xs font-medium ${
                          estadoLabel[item.estado]?.color || 'bg-gray-100 text-gray-800'
                        }`}
                      >
                        {estadoLabel[item.estado]?.text || item.estado}
                      </span>
                    </td>

                    {/* Operador */}
                    <td className="table-cell text-xs text-gray-500">
                      {item.usuario?.nombre || 'Balanza'}
                    </td>

                    {/* Acciones */}
                    <td className="table-cell text-right">
                      <div className="flex items-center justify-end gap-1">
                        {/* Boleta o Comprobante PDF */}
                        {(() => {
                          const hasCalc = Boolean(item.calculo || item.estado === 'PAGADO' || item.estado === 'CALCULADO');
                          return (
                            <button
                              type="button"
                              onClick={() => handleDownloadBoleta(item)}
                              disabled={downloadingId === item.id}
                              className={`rounded p-1.5 transition-colors ${
                                hasCalc
                                  ? 'text-emerald-700 hover:bg-emerald-50 hover:text-emerald-900'
                                  : 'text-gray-600 hover:bg-gray-100 hover:text-primary-700'
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
                          className="rounded p-1.5 text-gray-600 hover:bg-gray-100 hover:text-indigo-600 transition-colors"
                          title="Ver detalle completo"
                        >
                          <Eye className="h-4 w-4" />
                        </button>

                        {/* Anticipos de este lote */}
                        <button
                          type="button"
                          onClick={() => openAnticiposModal(item)}
                          className="rounded p-1.5 text-emerald-600 hover:bg-emerald-50 hover:text-emerald-800 transition-colors"
                          title="Gestionar anticipos / historial de entregas"
                        >
                          <Coins className="h-4 w-4" />
                        </button>



                        {/* Calcular pago si está en espera */}
                        {canCalculate(item) && (
                          <Link
                            to="/calcular"
                            state={{ internacionId: item.id }}
                            className="btn btn-primary btn-sm inline-flex items-center gap-1 py-1 px-2.5"
                            title="Calcular Liquidación de Pago"
                          >
                            <Calculator className="h-3.5 w-3.5" />
                            <span className="hidden md:inline">Calcular</span>
                          </Link>
                        )}

                        {/* Editar */}
                        {canEdit(item) && (
                          <button
                            type="button"
                            onClick={() => openEditModal(item)}
                            className="rounded p-1.5 text-gray-600 hover:bg-gray-100 hover:text-amber-700 transition-colors"
                            title="Editar datos de internación"
                          >
                            <Pencil className="h-4 w-4" />
                          </button>
                        )}

                        {/* Eliminar */}
                        {canDelete(item) && (
                          <button
                            type="button"
                            onClick={() => handleDelete(item)}
                            className="rounded p-1.5 text-gray-600 hover:bg-red-50 hover:text-red-600 transition-colors"
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

          {/* Número de Lote en edición */}
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

          {/* Selección de proveedor en edición */}
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

          {/* Tipo de Mineral en edición */}
          <div>
            <label className="mb-1 block text-sm font-medium text-gray-700">
              Tipo de Mineral *
            </label>
            <select
              {...editRegister('tipoMineral', { required: 'El tipo de mineral es obligatorio' })}
              className="input text-sm"
            >
              {TIPOS_MINERAL.map((t) => (
                <option key={t.value} value={t.value}>
                  {t.label}
                </option>
              ))}
            </select>
          </div>

          {/* Kilos Bruto en edición */}
          <div>
            <div className="flex items-center justify-between mb-1">
              <label className="block text-sm font-medium text-gray-700">
                Kilos Bruto *
              </label>
              {watchedEditKilos && !isNaN(Number(watchedEditKilos)) && Number(watchedEditKilos) > 0 && (
                <span className="text-xs font-semibold text-primary-700">
                  {formatKilos(watchedEditKilos)} kg
                </span>
              )}
            </div>
            <input
              type="text"
              inputMode="numeric"
              {...editRegister('kilosBruto', {
                required: 'Ingresa los kilos bruto',
                validate: (v) => {
                  const n = parseInt(v, 10);
                  if (isNaN(n) || n <= 0) return 'Los kilos deben ser un número entero mayor a 0';
                  return true;
                }
              })}
              onKeyDown={handleNumericKeyDown}
              onChange={handleEditKilosChange}
              className={`input text-base font-medium ${editErrors.kilosBruto ? 'input-error' : ''}`}
              placeholder="Ej: 1500"
            />
            {editErrors.kilosBruto && (
              <p className="mt-1 text-xs text-red-600">{editErrors.kilosBruto.message}</p>
            )}
          </div>

          {/* Anticipo en edición */}
          <div>
            <div className="flex items-center justify-between mb-1">
              <label className="block text-sm font-medium text-gray-700">
                Anticipo (Bs)
              </label>
              {watchedEditAnticipo && !isNaN(Number(watchedEditAnticipo)) && Number(watchedEditAnticipo) > 0 && (
                <span className="text-xs font-semibold text-emerald-700">
                  {formatBs(watchedEditAnticipo)}
                </span>
              )}
            </div>
            <input
              type="text"
              inputMode="numeric"
              {...editRegister('anticipo', {
                validate: (v) => {
                  if (!v) return true;
                  const n = parseInt(v, 10);
                  if (isNaN(n) || n < 0) return 'El anticipo no puede ser negativo';
                  return true;
                }
              })}
              onKeyDown={handleNumericKeyDown}
              onChange={handleEditAnticipoChange}
              className={`input text-base font-medium ${editErrors.anticipo ? 'input-error' : ''}`}
              placeholder="0"
            />
            {editErrors.anticipo && (
              <p className="mt-1 text-xs text-red-600">{editErrors.anticipo.message}</p>
            )}
          </div>

          <div className="flex justify-end gap-2 pt-3 border-t">
            <button
              type="button"
              onClick={closeEditModal}
              disabled={submitting}
              className="btn btn-secondary btn-md"
            >
              Cancelar
            </button>
            <button
              type="submit"
              disabled={submitting}
              className="btn btn-primary btn-md inline-flex items-center gap-1.5"
            >
              {submitting ? (
                <>
                  <Loader2 className="h-4 w-4 animate-spin" />
                  <span>Guardando cambios...</span>
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

      {/* MODAL HISTORIAL COMPLETO */}
      <Modal
        open={historialModalOpen}
        onClose={() => setHistorialModalOpen(false)}
        title="Historial de Internaciones"
        size="xl"
      >
        <div className="space-y-4">
          <div className="flex gap-2">
            <div className="relative flex-1">
              <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-gray-400" />
              <input
                type="text"
                value={busquedaLista}
                onChange={(e) => setBusquedaLista(e.target.value)}
                className="input pl-9 text-sm"
                placeholder="Filtrar por lote, proveedor o CI..."
              />
            </div>
            <button
              type="button"
              onClick={() => setBusquedaAplicada(busquedaLista)}
              className="btn btn-secondary btn-sm"
            >
              Buscar
            </button>
          </div>

          {loading ? (
            <div className="flex justify-center py-10">
              <Loader2 className="h-6 w-6 animate-spin text-primary-600" />
            </div>
          ) : internaciones.length === 0 ? (
            <p className="py-8 text-center text-sm text-gray-500">No hay registros para mostrar</p>
          ) : (
            <div className="overflow-x-auto max-h-96">
              <table className="table text-xs">
                <thead className="table-header sticky top-0">
                  <tr className="table-header-row">
                    <th className="table-header-cell">Lote</th>
                    <th className="table-header-cell">Fecha</th>
                    <th className="table-header-cell">Proveedor</th>
                    <th className="table-header-cell">Mineral</th>
                    <th className="table-header-cell text-right">Peso Bruto</th>
                    <th className="table-header-cell text-center">Estado</th>
                    <th className="table-header-cell text-right">Acción</th>
                  </tr>
                </thead>
                <tbody className="table-body">
                  {internaciones.map((it) => (
                    <tr key={it.id} className="table-row">
                      <td className="table-cell font-mono font-bold text-primary-700">{it.lote}</td>
                      <td className="table-cell">{formatFecha(it.fechaInternacion)}</td>
                      <td className="table-cell font-medium">{it.proveedor?.nombreCompleto}</td>
                      <td className="table-cell">{getMineralLabel(it.tipoMineral)}</td>
                      <td className="table-cell text-right font-mono font-semibold">
                        {formatKilos(it.kilosBruto)} kg
                      </td>
                      <td className="table-cell text-center">
                        <span
                          className={`rounded-full px-2 py-0.5 text-xs ${
                            estadoLabel[it.estado]?.color || ''
                          }`}
                        >
                          {estadoLabel[it.estado]?.text}
                        </span>
                      </td>
                      <td className="table-cell text-right">
                        <button
                          type="button"
                          onClick={() => {
                            setHistorialModalOpen(false);
                            openDetail(it);
                          }}
                          className="btn btn-secondary btn-sm p-1.5"
                          title="Ver detalle"
                        >
                          <Eye className="h-3.5 w-3.5" />
                        </button>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}

          {pagination.pages > 1 && (
            <div className="flex justify-between items-center pt-2 border-t">
              <span className="text-xs text-gray-500">
                Página {pagination.page} de {pagination.pages}
              </span>
              <div className="flex gap-1.5">
                <button
                  type="button"
                  disabled={pagination.page <= 1}
                  onClick={() => loadInternaciones(pagination.page - 1)}
                  className="btn btn-secondary btn-sm"
                >
                  Anterior
                </button>
                <button
                  type="button"
                  disabled={pagination.page >= pagination.pages}
                  onClick={() => loadInternaciones(pagination.page + 1)}
                  className="btn btn-secondary btn-sm"
                >
                  Siguiente
                </button>
              </div>
            </div>
          )}
        </div>
      </Modal>

      {/* MODAL DE HISTORIAL Y REGISTRO DE ANTICIPOS */}
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
                <p className="text-xs text-emerald-800 font-semibold uppercase tracking-wider">Lote / Proveedor</p>
                <p className="text-base font-bold text-gray-900">
                  {anticiposLoteItem.lote} — {anticiposLoteItem.proveedor?.nombreCompleto}
                </p>
                <p className="text-xs text-gray-600">
                  Mineral: {getMineralLabel(anticiposLoteItem.tipoMineral)} · {formatKilos(anticiposLoteItem.kilosBruto)} kg bruto
                </p>
              </div>
              <div className="text-right">
                <p className="text-xs text-emerald-800 font-medium">Total Acumulado en Lote</p>
                <p className="text-xl font-bold font-mono text-emerald-700">
                  {formatBs(anticiposLoteItem.anticipo)}
                </p>
              </div>
            </div>
          )}

          {anticiposError && (
            <div className="flex items-start gap-2 rounded-lg border border-red-200 bg-red-50 p-3 text-xs text-red-700">
              <AlertCircle className="h-4 w-4 shrink-0 text-red-500 mt-0.5" />
              <span>{anticiposError}</span>
            </div>
          )}

          {/* Formulario para registrar una nueva entrega de dinero (solo si no está PAGADO) */}
          {anticiposLoteItem?.estado !== 'PAGADO' ? (
            <form onSubmit={handleCrearAnticipo} className="rounded-lg border border-gray-200 bg-white p-4 shadow-sm space-y-3">
              <h4 className="text-sm font-bold text-gray-900 flex items-center gap-1.5">
                <Coins className="h-4 w-4 text-emerald-600" />
                <span>Registrar Nueva Entrega de Anticipo</span>
              </h4>
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                <div>
                  <label className="block text-xs font-semibold text-gray-700 mb-1">
                    Monto a entregar (Bs) *
                  </label>
                  <input
                    type="text"
                    inputMode="numeric"
                    value={nuevoAnticipoMonto}
                    onChange={(e) => setNuevoAnticipoMonto(sanitizeMoneyInput(e.target.value))}
                    onKeyDown={handleNumericKeyDown}
                    placeholder="Ej: 500"
                    className="input text-sm"
                    required
                  />
                </div>
                <div>
                  <label className="block text-xs font-semibold text-gray-700 mb-1">
                    Motivo / Glosa
                  </label>
                  <input
                    type="text"
                    value={nuevoAnticipoGlosa}
                    onChange={(e) => setNuevoAnticipoGlosa(e.target.value)}
                    placeholder="Ej: Adelanto para víveres o combustible"
                    className="input text-sm"
                  />
                </div>
              </div>
              <div className="flex justify-end">
                <button
                  type="submit"
                  disabled={savingAnticipo || !nuevoAnticipoMonto}
                  className="btn btn-primary btn-sm inline-flex items-center gap-1.5 bg-emerald-600 hover:bg-emerald-700 text-white"
                >
                  {savingAnticipo ? (
                    <>
                      <Loader2 className="h-4 w-4 animate-spin" />
                      <span>Guardando...</span>
                    </>
                  ) : (
                    <>
                      <Coins className="h-4 w-4" />
                      <span>+ Registrar y Sumar al Lote</span>
                    </>
                  )}
                </button>
              </div>
            </form>
          ) : (
            <div className="rounded-lg bg-gray-50 border border-gray-200 p-3 text-xs text-gray-600">
              ℹ️ Este lote ya se encuentra completamente liquidado y pagado. El historial queda en modo solo lectura.
            </div>
          )}

          {/* Historial detallado de entregas */}
          <div className="space-y-2">
            <h4 className="text-sm font-bold text-gray-900 flex items-center justify-between">
              <span>Historial Cronológico de Entregas</span>
              <span className="text-xs font-normal text-gray-500">
                {anticiposHistory.length} entrega(s) registrada(s)
              </span>
            </h4>

            {loadingAnticipos ? (
              <div className="flex justify-center py-6">
                <Loader2 className="h-6 w-6 animate-spin text-emerald-600" />
              </div>
            ) : anticiposHistory.length === 0 ? (
              <p className="py-6 text-center text-xs text-gray-500 rounded-lg border border-dashed border-gray-200">
                No hay entregas de anticipos registradas para este lote
              </p>
            ) : (
              <div className="overflow-x-auto border border-gray-200 rounded-lg">
                <table className="table text-xs">
                  <thead className="table-header">
                    <tr className="table-header-row bg-gray-50">
                      <th className="table-header-cell">Fecha y Hora</th>
                      <th className="table-header-cell">Motivo / Glosa</th>
                      <th className="table-header-cell">Registrado por</th>
                      <th className="table-header-cell text-right">Monto (Bs)</th>
                      {anticiposLoteItem?.estado !== 'PAGADO' && (
                        <th className="table-header-cell text-center w-12">Acción</th>
                      )}
                    </tr>
                  </thead>
                  <tbody className="table-body">
                    {anticiposHistory.map((ant) => (
                      <tr key={ant.id} className="table-row">
                        <td className="table-cell whitespace-nowrap font-mono text-gray-600">
                          {formatFecha(ant.fecha)}
                        </td>
                        <td className="table-cell font-medium text-gray-800">
                          {ant.glosa || ant.observacion || 'Adelanto en efectivo'}
                        </td>
                        <td className="table-cell text-gray-500">
                          {ant.usuario?.nombre || 'Balanza'}
                        </td>
                        <td className="table-cell text-right font-mono font-bold text-emerald-700">
                          {formatBs(ant.monto)}
                        </td>
                        {anticiposLoteItem?.estado !== 'PAGADO' && (
                          <td className="table-cell text-center">
                            <button
                              type="button"
                              onClick={() => handleEliminarAnticipo(ant.id)}
                              className="rounded p-1 text-gray-400 hover:bg-red-50 hover:text-red-600 transition-colors"
                              title="Eliminar este anticipo"
                            >
                              <Trash2 className="h-3.5 w-3.5" />
                            </button>
                          </td>
                        )}
                      </tr>
                    ))}
                    <tr className="bg-gray-50 font-bold border-t border-gray-200">
                      <td colSpan={3} className="table-cell text-right uppercase tracking-wider text-gray-700">
                        Total Anticipos Entregados:
                      </td>
                      <td className="table-cell text-right font-mono text-emerald-800 text-sm">
                        {formatBs(
                          anticiposHistory.reduce((s, a) => s + Math.trunc(Number(a.monto) || 0), 0)
                        )}
                      </td>
                      {anticiposLoteItem?.estado !== 'PAGADO' && <td className="table-cell" />}
                    </tr>
                  </tbody>
                </table>
              </div>
            )}
          </div>
        </div>
      </Modal>

    </div>
  );
};

export default InternMineral;
