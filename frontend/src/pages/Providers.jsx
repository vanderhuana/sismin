import { useState, useEffect, useCallback } from 'react';
import { useForm } from 'react-hook-form';
import { providerService, handleApiError, getApiErrorDetails } from '../services/api';
import Modal from '../components/ui/Modal';
import {
  Plus,
  Search,
  Pencil,
  Trash2,
  UserCheck,
  UserX,
  Loader2,
  AlertCircle,
  CheckCircle2,
  Truck,
  Building2,
  User,
  Filter,
  Phone,
  FileText,
  MapPin,
  Info
} from 'lucide-react';

const TIPOS = [
  { value: 'PERSONA_NATURAL', label: 'Persona Natural' },
  { value: 'EMPRESA', label: 'Empresa' }
];

const FILTROS_ACTIVO = [
  { value: '', label: 'Todos' },
  { value: 'true', label: 'Activos' },
  { value: 'false', label: 'Inactivos' }
];

const Providers = () => {
  const [proveedores, setProveedores] = useState([]);
  const [pagination, setPagination] = useState({ page: 1, limit: 10, total: 0, pages: 1 });
  const [search, setSearch] = useState('');
  const [filtroTipo, setFiltroTipo] = useState('');
  const [filtroActivo, setFiltroActivo] = useState('');
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [modalError, setModalError] = useState(null);
  const [success, setSuccess] = useState(null);
  const [modalOpen, setModalOpen] = useState(false);
  const [editingProvider, setEditingProvider] = useState(null);
  const [submitting, setSubmitting] = useState(false);

  const {
    register,
    handleSubmit,
    reset,
    setValue,
    watch,
    setError: setFieldError,
    clearErrors,
    formState: { errors, isValid, isDirty, touchedFields }
  } = useForm({
    mode: 'onChange',
    reValidateMode: 'onChange'
  });

  const watchedTipo = watch('tipo', 'PERSONA_NATURAL');
  const watchedDireccion = watch('direccion', '') || '';

  const loadProviders = useCallback(
    async (page = 1) => {
      try {
        setLoading(true);
        setError(null);
        const params = { page, limit: 10, search };
        if (filtroTipo) params.tipo = filtroTipo;
        if (filtroActivo !== '') params.activo = filtroActivo;

        const data = await providerService.getProviders(params);
        setProveedores(data.proveedores);
        setPagination(data.pagination);
      } catch (err) {
        setError(handleApiError(err));
      } finally {
        setLoading(false);
      }
    },
    [search, filtroTipo, filtroActivo]
  );

  useEffect(() => {
    loadProviders();
  }, [loadProviders]);

  const showSuccess = (message) => {
    setSuccess(message);
    setTimeout(() => setSuccess(null), 3000);
  };

  const openCreateModal = () => {
    setEditingProvider(null);
    setModalError(null);
    clearErrors();
    reset({
      nombreCompleto: '',
      ci: '',
      telefono: '',
      direccion: '',
      tipo: 'PERSONA_NATURAL'
    });
    setModalOpen(true);
  };

  const openEditModal = (proveedor) => {
    setEditingProvider(proveedor);
    setModalError(null);
    clearErrors();
    reset({
      nombreCompleto: proveedor.nombreCompleto || '',
      ci: proveedor.ci || '',
      telefono: proveedor.telefono || '',
      direccion: proveedor.direccion || '',
      tipo: proveedor.tipo || 'PERSONA_NATURAL'
    });
    setModalOpen(true);
  };

  const closeModal = () => {
    setModalOpen(false);
    setEditingProvider(null);
    setModalError(null);
    clearErrors();
    reset();
  };

  // Controles de entrada en tiempo real
  const handleNombreInput = (e) => {
    // Solo permitir letras, espacios, tildes, diéresis, ñ/Ñ y punto/apóstrofe
    const filtered = e.target.value.replace(/[^a-zA-ZÀ-ÿ\u00f1\u00d1\s'.]/g, '');
    setValue('nombreCompleto', filtered, { shouldValidate: true, shouldDirty: true });
  };

  const handleCiInput = (e) => {
    // Solo permitir dígitos numéricos, letras y guión (convertido a mayúsculas)
    const filtered = e.target.value.toUpperCase().replace(/[^0-9A-Z\-]/g, '');
    setValue('ci', filtered, { shouldValidate: true, shouldDirty: true });
  };

  const handleTelefonoInput = (e) => {
    // Solo permitir números, signo + al inicio, espacios o guiones
    let filtered = e.target.value.replace(/[^0-9+\s\-]/g, '');
    if (filtered.indexOf('+') > 0) {
      filtered = filtered.replace(/\+/g, (match, offset) => (offset === 0 ? '+' : ''));
    }
    setValue('telefono', filtered, { shouldValidate: true, shouldDirty: true });
  };

  const handleDireccionInput = (e) => {
    const filtered = e.target.value.slice(0, 300);
    setValue('direccion', filtered, { shouldValidate: true, shouldDirty: true });
  };

  const onSubmit = async (data) => {
    try {
      setSubmitting(true);
      setError(null);
      setModalError(null);

      const payload = {
        nombreCompleto: data.nombreCompleto.trim(),
        ci: data.ci.trim().toUpperCase(),
        telefono: data.telefono?.trim() || null,
        direccion: data.direccion?.trim() || null,
        tipo: data.tipo
      };

      if (editingProvider) {
        await providerService.updateProvider(editingProvider.id, payload);
        showSuccess('Proveedor actualizado correctamente');
      } else {
        await providerService.createProvider(payload);
        showSuccess('Proveedor registrado correctamente');
      }

      closeModal();
      loadProviders(pagination.page);
    } catch (err) {
      const { message, details, field } = getApiErrorDetails(err);
      setModalError(message);

      // Si el backend identificó un campo específico con error (ej. CI duplicado)
      if (field) {
        setFieldError(field, { type: 'server', message });
      }

      // Si el backend retornó validaciones por campo
      if (details && details.length > 0) {
        details.forEach((d) => {
          if (d.field) {
            setFieldError(d.field, { type: 'server', message: d.message });
          }
        });
      }
    } finally {
      setSubmitting(false);
    }
  };

  const handleToggleStatus = async (proveedor) => {
    try {
      const result = await providerService.toggleProviderStatus(proveedor.id);
      showSuccess(result.message);
      loadProviders(pagination.page);
    } catch (err) {
      setError(handleApiError(err));
    }
  };

  const handleDelete = async (proveedor) => {
    if (!window.confirm(`¿Eliminar o desactivar a "${proveedor.nombreCompleto}"?`)) return;

    try {
      const result = await providerService.deleteProvider(proveedor.id);
      showSuccess(result.message);
      loadProviders(pagination.page);
    } catch (err) {
      setError(handleApiError(err));
    }
  };

  const handleSearch = (e) => {
    e.preventDefault();
    loadProviders(1);
  };

  return (
    <div className="space-y-6">
      <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <h1 className="text-3xl font-bold text-gray-900">Proveedores</h1>
          <p className="mt-1 text-gray-600">Gestiona los proveedores de mineral</p>
        </div>
        <button onClick={openCreateModal} className="btn btn-primary btn-md">
          <Plus className="mr-2 h-4 w-4" />
          Nuevo proveedor
        </button>
      </div>

      {error && (
        <div className="flex items-start gap-3 rounded-lg border border-red-200 bg-red-50 p-4">
          <AlertCircle className="h-5 w-5 shrink-0 text-red-500" />
          <p className="text-sm text-red-800">{error}</p>
        </div>
      )}

      {success && (
        <div className="rounded-lg border border-green-200 bg-green-50 p-4 text-sm text-green-800">
          {success}
        </div>
      )}

      <div className="card">
        <div className="card-content space-y-4 border-b border-gray-100 pb-4">
          <form onSubmit={handleSearch} className="flex gap-2">
            <div className="relative flex-1">
              <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-gray-400" />
              <input
                type="text"
                placeholder="Buscar por nombre..."
                value={search}
                onChange={(e) => setSearch(e.target.value)}
                className="input pl-10"
              />
            </div>
            <button type="submit" className="btn btn-secondary btn-md">
              Buscar
            </button>
          </form>

          <div className="flex flex-wrap items-center gap-3">
            <Filter className="h-4 w-4 text-gray-400" />
            <select
              value={filtroTipo}
              onChange={(e) => setFiltroTipo(e.target.value)}
              className="input w-auto min-w-[160px]"
            >
              <option value="">Todos los tipos</option>
              {TIPOS.map((t) => (
                <option key={t.value} value={t.value}>
                  {t.label}
                </option>
              ))}
            </select>
            <select
              value={filtroActivo}
              onChange={(e) => setFiltroActivo(e.target.value)}
              className="input w-auto min-w-[140px]"
            >
              {FILTROS_ACTIVO.map((f) => (
                <option key={f.value} label={f.label} value={f.value}>
                  {f.label}
                </option>
              ))}
            </select>
          </div>
        </div>

        {loading ? (
          <div className="flex items-center justify-center py-16">
            <Loader2 className="h-8 w-8 animate-spin text-primary-600" />
          </div>
        ) : proveedores.length === 0 ? (
          <div className="py-16 text-center text-gray-500">
            <Truck className="mx-auto h-12 w-12 text-gray-300" />
            <p className="mt-2">No hay proveedores registrados</p>
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="table">
              <thead className="table-header">
                <tr className="table-header-row">
                  <th className="table-header-cell">Nombre completo</th>
                  <th className="table-header-cell">CI</th>
                  <th className="table-header-cell">Teléfono</th>
                  <th className="table-header-cell">Tipo</th>
                  <th className="table-header-cell">Estado</th>
                  <th className="table-header-cell">Internaciones</th>
                  <th className="table-header-cell text-right">Acciones</th>
                </tr>
              </thead>
              <tbody className="table-body">
                {proveedores.map((proveedor) => (
                  <tr key={proveedor.id} className="table-row">
                    <td className="table-cell">
                      <div className="flex items-center gap-2">
                        <div className="flex h-8 w-8 items-center justify-center rounded-full bg-green-100">
                          {proveedor.tipo === 'EMPRESA' ? (
                            <Building2 className="h-4 w-4 text-green-700" />
                          ) : (
                            <User className="h-4 w-4 text-green-700" />
                          )}
                        </div>
                        <div>
                          <p className="font-medium">{proveedor.nombreCompleto}</p>
                          {proveedor.direccion && (
                            <p className="text-xs text-gray-500 truncate max-w-[200px]">
                              {proveedor.direccion}
                            </p>
                          )}
                        </div>
                      </div>
                    </td>
                    <td className="table-cell font-mono text-sm">
                      {proveedor.ci || '—'}
                    </td>
                    <td className="table-cell text-gray-600">
                      {proveedor.telefono || '—'}
                    </td>
                    <td className="table-cell">
                      <span
                        className={`inline-flex rounded-full px-2.5 py-0.5 text-xs font-medium ${
                          proveedor.tipo === 'EMPRESA'
                            ? 'bg-indigo-100 text-indigo-800'
                            : 'bg-teal-100 text-teal-800'
                        }`}
                      >
                        {proveedor.tipo === 'EMPRESA' ? 'Empresa' : 'Persona Natural'}
                      </span>
                    </td>
                    <td className="table-cell">
                      <span
                        className={`inline-flex rounded-full px-2.5 py-0.5 text-xs font-medium ${
                          proveedor.activo
                            ? 'bg-green-100 text-green-800'
                            : 'bg-gray-100 text-gray-600'
                        }`}
                      >
                        {proveedor.activo ? 'Activo' : 'Inactivo'}
                      </span>
                    </td>
                    <td className="table-cell text-center text-gray-600">
                      {proveedor._count?.internaciones ?? 0}
                    </td>
                    <td className="table-cell">
                      <div className="flex justify-end gap-1">
                        <button
                          onClick={() => openEditModal(proveedor)}
                          className="rounded p-2 text-gray-500 hover:bg-gray-100 hover:text-primary-600"
                          title="Editar"
                        >
                          <Pencil className="h-4 w-4" />
                        </button>
                        <button
                          onClick={() => handleToggleStatus(proveedor)}
                          className="rounded p-2 text-gray-500 hover:bg-gray-100 hover:text-amber-600"
                          title={proveedor.activo ? 'Desactivar' : 'Activar'}
                        >
                          {proveedor.activo ? (
                            <UserX className="h-4 w-4" />
                          ) : (
                            <UserCheck className="h-4 w-4" />
                          )}
                        </button>
                        <button
                          onClick={() => handleDelete(proveedor)}
                          className="rounded p-2 text-gray-500 hover:bg-gray-100 hover:text-red-600"
                          title="Eliminar"
                        >
                          <Trash2 className="h-4 w-4" />
                        </button>
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}

        {pagination.pages > 1 && (
          <div className="flex items-center justify-between border-t border-gray-100 px-6 py-4">
            <p className="text-sm text-gray-500">
              {pagination.total} proveedor{pagination.total !== 1 ? 'es' : ''} en total
            </p>
            <div className="flex gap-2">
              <button
                disabled={pagination.page <= 1}
                onClick={() => loadProviders(pagination.page - 1)}
                className="btn btn-secondary btn-sm disabled:opacity-50"
              >
                Anterior
              </button>
              <span className="flex items-center px-3 text-sm text-gray-600">
                Página {pagination.page} de {pagination.pages}
              </span>
              <button
                disabled={pagination.page >= pagination.pages}
                onClick={() => loadProviders(pagination.page + 1)}
                className="btn btn-secondary btn-sm disabled:opacity-50"
              >
                Siguiente
              </button>
            </div>
          </div>
        )}
      </div>

      <Modal
        open={modalOpen}
        onClose={closeModal}
        title={editingProvider ? 'Editar proveedor' : 'Nuevo proveedor'}
        size="md"
      >
        <form onSubmit={handleSubmit(onSubmit)} className="space-y-4">
          {/* Mensaje de error dentro del modal */}
          {modalError && (
            <div className="flex items-start gap-2.5 rounded-lg border border-red-200 bg-red-50 p-3 text-sm text-red-800 animate-fade-in">
              <AlertCircle className="h-5 w-5 shrink-0 text-red-600 mt-0.5" />
              <div className="flex-1">
                <p className="font-semibold text-red-900">Error al guardar datos:</p>
                <p className="mt-0.5 text-xs text-red-700">{modalError}</p>
              </div>
            </div>
          )}

          {/* Tipo de Proveedor */}
          <div>
            <label className="mb-1 block text-sm font-medium text-gray-700">
              Tipo de proveedor *
            </label>
            <div className="grid grid-cols-2 gap-3">
              {TIPOS.map((t) => {
                const isSelected = watchedTipo === t.value;
                const Icon = t.value === 'EMPRESA' ? Building2 : User;
                return (
                  <button
                    key={t.value}
                    type="button"
                    onClick={() => setValue('tipo', t.value, { shouldValidate: true })}
                    className={`flex items-center justify-center gap-2 rounded-lg border px-3 py-2.5 text-sm font-medium transition-colors ${
                      isSelected
                        ? 'border-primary-600 bg-primary-50 text-primary-700 shadow-sm'
                        : 'border-gray-200 bg-white text-gray-600 hover:bg-gray-50'
                    }`}
                  >
                    <Icon className={`h-4 w-4 ${isSelected ? 'text-primary-600' : 'text-gray-400'}`} />
                    <span>{t.label}</span>
                  </button>
                );
              })}
            </div>
          </div>

          {/* Nombre Completo / Razón Social */}
          <div>
            <div className="flex items-center justify-between mb-1">
              <label className="block text-sm font-medium text-gray-700">
                {watchedTipo === 'EMPRESA' ? 'Razón Social / Nombre de Empresa' : 'Nombre completo'} *
              </label>
              <span className="text-xs text-gray-400">Solo letras y espacios</span>
            </div>
            <div className="relative">
              <div className="pointer-events-none absolute inset-y-0 left-0 flex items-center pl-3">
                {watchedTipo === 'EMPRESA' ? (
                  <Building2 className="h-4 w-4 text-gray-400" />
                ) : (
                  <User className="h-4 w-4 text-gray-400" />
                )}
              </div>
              <input
                {...register('nombreCompleto', {
                  required: 'El nombre completo es requerido',
                  minLength: { value: 3, message: 'Debe tener al menos 3 caracteres' },
                  maxLength: { value: 100, message: 'No puede exceder 100 caracteres' },
                  validate: (val) => {
                    if (!val || !val.trim()) return 'El nombre no puede estar en blanco';
                    if (!/^[a-zA-ZÀ-ÿ\u00f1\u00d1\s'.]+$/.test(val.trim())) {
                      return 'Solo se permiten letras y espacios (sin números ni símbolos)';
                    }
                    return true;
                  }
                })}
                onChange={handleNombreInput}
                className={`input pl-9 pr-8 ${
                  errors.nombreCompleto
                    ? 'input-error'
                    : touchedFields.nombreCompleto
                    ? 'border-green-500 focus-visible:ring-green-500'
                    : ''
                }`}
                placeholder={
                  watchedTipo === 'EMPRESA'
                    ? 'Ej: Minera San Cristóbal S.A.'
                    : 'Ej: Juan Carlos Pérez'
                }
              />
              {touchedFields.nombreCompleto && !errors.nombreCompleto && (
                <div className="pointer-events-none absolute inset-y-0 right-0 flex items-center pr-3">
                  <CheckCircle2 className="h-4 w-4 text-green-500" />
                </div>
              )}
            </div>
            {errors.nombreCompleto && (
              <p className="mt-1 flex items-center gap-1 text-xs text-red-600">
                <AlertCircle className="h-3.5 w-3.5 shrink-0" />
                <span>{errors.nombreCompleto.message}</span>
              </p>
            )}
          </div>

          {/* Cédula de Identidad (CI / NIT) */}
          <div>
            <div className="flex items-center justify-between mb-1">
              <label className="block text-sm font-medium text-gray-700">
                {watchedTipo === 'EMPRESA' ? 'NIT / Documento Fiscal' : 'Cédula de Identidad (CI)'} *
              </label>
              <span className="text-xs text-gray-400">Min. 5 caracteres</span>
            </div>
            <div className="relative">
              <div className="pointer-events-none absolute inset-y-0 left-0 flex items-center pl-3">
                <FileText className="h-4 w-4 text-gray-400" />
              </div>
              <input
                {...register('ci', {
                  required: 'La cédula de identidad (CI / NIT) es requerida',
                  minLength: { value: 5, message: 'La CI debe tener al menos 5 caracteres' },
                  maxLength: { value: 20, message: 'La CI no puede superar 20 caracteres' },
                  validate: (val) => {
                    if (!val || !val.trim()) return 'El documento es obligatorio';
                    if (!/^[0-9a-zA-Z\-]+$/.test(val.trim())) {
                      return 'Solo se permiten números, letras y guión (ej: 1234567 o 1234567-1A)';
                    }
                    return true;
                  }
                })}
                onChange={handleCiInput}
                className={`input pl-9 pr-8 font-mono ${
                  errors.ci
                    ? 'input-error'
                    : touchedFields.ci
                    ? 'border-green-500 focus-visible:ring-green-500'
                    : ''
                }`}
                placeholder={watchedTipo === 'EMPRESA' ? 'Ej: 20345678901' : 'Ej: 1234567 o 1234567-1A'}
              />
              {touchedFields.ci && !errors.ci && (
                <div className="pointer-events-none absolute inset-y-0 right-0 flex items-center pr-3">
                  <CheckCircle2 className="h-4 w-4 text-green-500" />
                </div>
              )}
            </div>
            {errors.ci ? (
              <p className="mt-1 flex items-center gap-1 text-xs text-red-600">
                <AlertCircle className="h-3.5 w-3.5 shrink-0" />
                <span>{errors.ci.message}</span>
              </p>
            ) : (
              <p className="mt-1 flex items-center gap-1 text-[11px] text-gray-400">
                <Info className="h-3 w-3 shrink-0" />
                <span>Solo números y letras sin espacios (ej: 8492019 o 8492019-1B)</span>
              </p>
            )}
          </div>

          {/* Teléfono */}
          <div>
            <div className="flex items-center justify-between mb-1">
              <label className="block text-sm font-medium text-gray-700">
                Teléfono / Celular
              </label>
              <span className="text-xs text-gray-400">Opcional (7 a 15 dígitos)</span>
            </div>
            <div className="relative">
              <div className="pointer-events-none absolute inset-y-0 left-0 flex items-center pl-3">
                <Phone className="h-4 w-4 text-gray-400" />
              </div>
              <input
                {...register('telefono', {
                  validate: (val) => {
                    if (!val || !val.trim()) return true;
                    const cleaned = val.replace(/[\s\-]/g, '');
                    if (cleaned.length < 7) return 'El teléfono debe tener al menos 7 dígitos';
                    if (cleaned.length > 15) return 'El teléfono no puede exceder 15 dígitos';
                    if (!/^[0-9+]+$/.test(cleaned)) {
                      return 'Solo debe contener dígitos numéricos (sin letras)';
                    }
                    return true;
                  }
                })}
                onChange={handleTelefonoInput}
                className={`input pl-9 ${errors.telefono ? 'input-error' : ''}`}
                placeholder="Ej: 70123456 o 22445566"
              />
            </div>
            {errors.telefono && (
              <p className="mt-1 flex items-center gap-1 text-xs text-red-600">
                <AlertCircle className="h-3.5 w-3.5 shrink-0" />
                <span>{errors.telefono.message}</span>
              </p>
            )}
          </div>

          {/* Dirección */}
          <div>
            <div className="flex items-center justify-between mb-1">
              <label className="block text-sm font-medium text-gray-700">
                Dirección / Localidad
              </label>
              <span className="text-xs text-gray-400">
                {watchedDireccion.length}/300 caracteres
              </span>
            </div>
            <div className="relative">
              <div className="pointer-events-none absolute top-3 left-3">
                <MapPin className="h-4 w-4 text-gray-400" />
              </div>
              <textarea
                {...register('direccion', {
                  maxLength: { value: 300, message: 'La dirección no puede exceder 300 caracteres' }
                })}
                onChange={handleDireccionInput}
                rows={2}
                className={`input min-h-[72px] resize-y pl-9 ${errors.direccion ? 'input-error' : ''}`}
                placeholder="Ej: Mina Porco, Potosí o Calle Los Pinos #456"
              />
            </div>
            {errors.direccion && (
              <p className="mt-1 flex items-center gap-1 text-xs text-red-600">
                <AlertCircle className="h-3.5 w-3.5 shrink-0" />
                <span>{errors.direccion.message}</span>
              </p>
            )}
          </div>

          {/* Botones de acción */}
          <div className="flex justify-end gap-2 pt-3 border-t border-gray-100">
            <button
              type="button"
              onClick={closeModal}
              disabled={submitting}
              className="btn btn-secondary btn-md"
            >
              Cancelar
            </button>
            <button
              type="submit"
              disabled={submitting}
              className="btn btn-primary btn-md shadow-sm"
            >
              {submitting ? (
                <>
                  <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                  {editingProvider ? 'Actualizando...' : 'Guardando...'}
                </>
              ) : editingProvider ? (
                'Actualizar proveedor'
              ) : (
                'Registrar proveedor'
              )}
            </button>
          </div>
        </form>
      </Modal>
    </div>
  );
};

export default Providers;
