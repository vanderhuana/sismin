import { useState, useEffect, useCallback } from 'react';
import { useForm } from 'react-hook-form';
import { useAuth } from '../hooks/useAuthStore';
import { userService, handleApiError } from '../services/api';
import AdminRoute from '../components/AdminRoute';
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
  Shield,
  User
} from 'lucide-react';

const ROLES = [
  { value: 'ADMIN', label: 'Administrador' },
  { value: 'MODERADO', label: 'Moderado' }
];

const Users = () => {
  const { user: currentUser } = useAuth();
  const [usuarios, setUsuarios] = useState([]);
  const [pagination, setPagination] = useState({ page: 1, limit: 10, total: 0, pages: 1 });
  const [search, setSearch] = useState('');
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [success, setSuccess] = useState(null);
  const [modalOpen, setModalOpen] = useState(false);
  const [editingUser, setEditingUser] = useState(null);
  const [submitting, setSubmitting] = useState(false);

  const {
    register,
    handleSubmit,
    reset,
    formState: { errors }
  } = useForm();

  const loadUsers = useCallback(async (page = 1, searchTerm = search) => {
    try {
      setLoading(true);
      setError(null);
      const data = await userService.getUsers({ page, limit: 10, search: searchTerm });
      setUsuarios(data.usuarios);
      setPagination(data.pagination);
    } catch (err) {
      setError(handleApiError(err));
    } finally {
      setLoading(false);
    }
  }, [search]);

  useEffect(() => {
    loadUsers();
  }, [loadUsers]);

  const showSuccess = (message) => {
    setSuccess(message);
    setTimeout(() => setSuccess(null), 3000);
  };

  const openCreateModal = () => {
    setEditingUser(null);
    reset({ nombre: '', password: '', rol: 'MODERADO' });
    setModalOpen(true);
  };

  const openEditModal = (usuario) => {
    setEditingUser(usuario);
    reset({ nombre: usuario.nombre, password: '', rol: usuario.rol });
    setModalOpen(true);
  };

  const closeModal = () => {
    setModalOpen(false);
    setEditingUser(null);
    reset();
  };

  const onSubmit = async (data) => {
    try {
      setSubmitting(true);
      setError(null);

      if (editingUser) {
        const payload = { nombre: data.nombre, rol: data.rol };
        if (data.password?.trim()) {
          payload.password = data.password;
        }
        await userService.updateUser(editingUser.id, payload);
        showSuccess('Usuario actualizado correctamente');
      } else {
        await userService.createUser(data);
        showSuccess('Usuario creado correctamente');
      }

      closeModal();
      loadUsers(pagination.page);
    } catch (err) {
      setError(handleApiError(err));
    } finally {
      setSubmitting(false);
    }
  };

  const handleToggleStatus = async (usuario) => {
    if (usuario.id === currentUser?.id) return;

    try {
      const result = await userService.toggleUserStatus(usuario.id);
      showSuccess(result.message);
      loadUsers(pagination.page);
    } catch (err) {
      setError(handleApiError(err));
    }
  };

  const handleDelete = async (usuario) => {
    if (usuario.id === currentUser?.id) return;
    if (!window.confirm(`¿Eliminar o desactivar al usuario "${usuario.nombre}"?`)) return;

    try {
      const result = await userService.deleteUser(usuario.id);
      showSuccess(result.message);
      loadUsers(pagination.page);
    } catch (err) {
      setError(handleApiError(err));
    }
  };

  const handleSearch = (e) => {
    e.preventDefault();
    loadUsers(1, search);
  };

  const formatDate = (date) =>
    new Date(date).toLocaleDateString('es-BO', {
      day: '2-digit',
      month: '2-digit',
      year: 'numeric'
    });

  return (
    <AdminRoute>
      <div className="space-y-6">
        <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
          <div>
            <h1 className="text-3xl font-bold text-gray-900">Usuarios</h1>
            <p className="mt-1 text-gray-600">Administra los usuarios del sistema</p>
          </div>
          <button onClick={openCreateModal} className="btn btn-primary btn-md">
            <Plus className="mr-2 h-4 w-4" />
            Nuevo usuario
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
          <div className="card-content border-b border-gray-100 pb-4">
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
          </div>

          {loading ? (
            <div className="flex items-center justify-center py-16">
              <Loader2 className="h-8 w-8 animate-spin text-primary-600" />
            </div>
          ) : usuarios.length === 0 ? (
            <div className="py-16 text-center text-gray-500">
              <User className="mx-auto h-12 w-12 text-gray-300" />
              <p className="mt-2">No hay usuarios registrados</p>
            </div>
          ) : (
            <div className="overflow-x-auto">
              <table className="table">
                <thead className="table-header">
                  <tr className="table-header-row">
                    <th className="table-header-cell">Nombre</th>
                    <th className="table-header-cell">Rol</th>
                    <th className="table-header-cell">Estado</th>
                    <th className="table-header-cell">Registro</th>
                    <th className="table-header-cell text-right">Acciones</th>
                  </tr>
                </thead>
                <tbody className="table-body">
                  {usuarios.map((usuario) => (
                    <tr key={usuario.id} className="table-row">
                      <td className="table-cell">
                        <div className="flex items-center gap-2">
                          <div className="flex h-8 w-8 items-center justify-center rounded-full bg-primary-100">
                            {usuario.rol === 'ADMIN' ? (
                              <Shield className="h-4 w-4 text-primary-600" />
                            ) : (
                              <User className="h-4 w-4 text-primary-600" />
                            )}
                          </div>
                          <span className="font-medium">{usuario.nombre}</span>
                          {usuario.id === currentUser?.id && (
                            <span className="rounded bg-primary-100 px-2 py-0.5 text-xs text-primary-700">
                              Tú
                            </span>
                          )}
                        </div>
                      </td>
                      <td className="table-cell">
                        <span
                          className={`inline-flex rounded-full px-2.5 py-0.5 text-xs font-medium ${
                            usuario.rol === 'ADMIN'
                              ? 'bg-purple-100 text-purple-800'
                              : 'bg-blue-100 text-blue-800'
                          }`}
                        >
                          {usuario.rol === 'ADMIN' ? 'Administrador' : 'Moderado'}
                        </span>
                      </td>
                      <td className="table-cell">
                        <span
                          className={`inline-flex rounded-full px-2.5 py-0.5 text-xs font-medium ${
                            usuario.activo
                              ? 'bg-green-100 text-green-800'
                              : 'bg-gray-100 text-gray-600'
                          }`}
                        >
                          {usuario.activo ? 'Activo' : 'Inactivo'}
                        </span>
                      </td>
                      <td className="table-cell text-gray-500">
                        {formatDate(usuario.createdAt)}
                      </td>
                      <td className="table-cell">
                        <div className="flex justify-end gap-1">
                          <button
                            onClick={() => openEditModal(usuario)}
                            className="rounded p-2 text-gray-500 hover:bg-gray-100 hover:text-primary-600"
                            title="Editar"
                          >
                            <Pencil className="h-4 w-4" />
                          </button>
                          {usuario.id !== currentUser?.id && (
                            <>
                              <button
                                onClick={() => handleToggleStatus(usuario)}
                                className="rounded p-2 text-gray-500 hover:bg-gray-100 hover:text-amber-600"
                                title={usuario.activo ? 'Desactivar' : 'Activar'}
                              >
                                {usuario.activo ? (
                                  <UserX className="h-4 w-4" />
                                ) : (
                                  <UserCheck className="h-4 w-4" />
                                )}
                              </button>
                              <button
                                onClick={() => handleDelete(usuario)}
                                className="rounded p-2 text-gray-500 hover:bg-gray-100 hover:text-red-600"
                                title="Eliminar"
                              >
                                <Trash2 className="h-4 w-4" />
                              </button>
                            </>
                          )}
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
                {pagination.total} usuario{pagination.total !== 1 ? 's' : ''} en total
              </p>
              <div className="flex gap-2">
                <button
                  disabled={pagination.page <= 1}
                  onClick={() => loadUsers(pagination.page - 1)}
                  className="btn btn-secondary btn-sm disabled:opacity-50"
                >
                  Anterior
                </button>
                <span className="flex items-center px-3 text-sm text-gray-600">
                  Página {pagination.page} de {pagination.pages}
                </span>
                <button
                  disabled={pagination.page >= pagination.pages}
                  onClick={() => loadUsers(pagination.page + 1)}
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
          title={editingUser ? 'Editar usuario' : 'Nuevo usuario'}
        >
          <form onSubmit={handleSubmit(onSubmit)} className="space-y-4">
            <div>
              <label className="mb-1 block text-sm font-medium text-gray-700">
                Nombre de usuario
              </label>
              <input
                {...register('nombre', {
                  required: 'El nombre es requerido',
                  minLength: { value: 2, message: 'Mínimo 2 caracteres' }
                })}
                className={`input ${errors.nombre ? 'input-error' : ''}`}
                placeholder="Ej: juan.perez"
              />
              {errors.nombre && (
                <p className="mt-1 text-sm text-red-600">{errors.nombre.message}</p>
              )}
            </div>

            <div>
              <label className="mb-1 block text-sm font-medium text-gray-700">
                Contraseña {editingUser && '(dejar vacío para no cambiar)'}
              </label>
              <input
                type="password"
                {...register('password', {
                  required: editingUser ? false : 'La contraseña es requerida',
                  minLength: { value: 6, message: 'Mínimo 6 caracteres' }
                })}
                className={`input ${errors.password ? 'input-error' : ''}`}
                placeholder="••••••••"
              />
              {errors.password && (
                <p className="mt-1 text-sm text-red-600">{errors.password.message}</p>
              )}
            </div>

            <div>
              <label className="mb-1 block text-sm font-medium text-gray-700">Rol</label>
              <select {...register('rol', { required: true })} className="input">
                {ROLES.map((rol) => (
                  <option key={rol.value} value={rol.value}>
                    {rol.label}
                  </option>
                ))}
              </select>
            </div>

            <div className="flex justify-end gap-2 pt-2">
              <button type="button" onClick={closeModal} className="btn btn-secondary btn-md">
                Cancelar
              </button>
              <button type="submit" disabled={submitting} className="btn btn-primary btn-md">
                {submitting ? (
                  <>
                    <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                    Guardando...
                  </>
                ) : editingUser ? (
                  'Actualizar'
                ) : (
                  'Crear usuario'
                )}
              </button>
            </div>
          </form>
        </Modal>
      </div>
    </AdminRoute>
  );
};

export default Users;
