import { useState, useEffect } from 'react';
import { useNavigate, Link } from 'react-router-dom';
import { useForm } from 'react-hook-form';
import { useAuth } from '../hooks/useAuthStore';
import { Eye, EyeOff, PackageCheck, AlertCircle, Loader2 } from 'lucide-react';

const LoginOld = () => {
  const [showPassword, setShowPassword] = useState(false);
  const navigate = useNavigate();
  const { login, isAuthenticated, isLoading, error, clearError } = useAuth();

  const {
    register,
    handleSubmit,
    formState: { errors },
    setError
  } = useForm();

  // Redirigir si ya está autenticado
  useEffect(() => {
    if (isAuthenticated) {
      navigate('/', { replace: true });
    }
  }, [isAuthenticated, navigate]);

  // Limpiar errores al desmontar
  useEffect(() => {
    return () => clearError();
  }, [clearError]);

  const onSubmit = async (data) => {
    clearError();
    
    const result = await login(data);
    
    if (result.success) {
      navigate('/', { replace: true });
    } else {
      // Mostrar error específico en el campo correspondiente
      if (result.error.toLowerCase().includes('usuario')) {
        setError('nombre', { type: 'manual', message: result.error });
      } else if (result.error.toLowerCase().includes('contraseña')) {
        setError('password', { type: 'manual', message: result.error });
      }
    }
  };

  return (
    <div className="min-h-screen flex">
      {/* Panel izquierdo - Información */}
      <div className="hidden lg:flex lg:flex-1 lg:flex-col lg:justify-center lg:px-8 xl:px-12 bg-gradient-to-br from-primary-600 to-primary-800">
        <div className="mx-auto max-w-md">
          <div className="flex items-center mb-8">
            <div className="flex-shrink-0">
              <PackageCheck className="h-12 w-12 text-white" />
            </div>
            <div className="ml-4">
              <h1 className="text-2xl font-bold text-white">Sistema Minero</h1>
              <p className="text-primary-100">Gestión de Minerales</p>
            </div>
          </div>
          
          <div className="space-y-6 text-white">
            <div>
              <h2 className="text-lg font-semibold mb-2">Funcionalidades del Sistema</h2>
              <ul className="space-y-2 text-primary-100">
                <li>• Gestión de proveedores</li>
                <li>• Registro de entrada de mineral</li>
                <li>• Cálculos automáticos de pago</li>
                <li>• Generación de comprobantes</li>
                <li>• Control de usuarios y permisos</li>
              </ul>
            </div>
            
            <div>
              <h3 className="text-lg font-semibold mb-2">Tipos de Mineral</h3>
              <ul className="space-y-2 text-primary-100">
                <li>• Plata</li>
                <li>• Plomo</li>
                <li>• Complejo (Plata + Plomo)</li>
              </ul>
            </div>
          </div>
        </div>
      </div>

      {/* Panel derecho - Formulario de login */}
      <div className="flex-1 flex flex-col justify-center px-6 py-12 lg:px-8 lg:flex-none lg:w-96 xl:w-[28rem]">
        <div className="mx-auto w-full max-w-md">
          {/* Logo para móvil */}
          <div className="lg:hidden flex items-center justify-center mb-8">
            <PackageCheck className="h-10 w-10 text-primary-600" />
            <div className="ml-3">
              <h1 className="text-xl font-bold text-gray-900">Sistema Minero</h1>
              <p className="text-sm text-gray-500">Gestión de Minerales</p>
            </div>
          </div>

          <div>
            <h2 className="text-2xl font-bold leading-9 tracking-tight text-gray-900">
              Iniciar Sesión
            </h2>
            <p className="mt-2 text-sm leading-6 text-gray-500">
              Ingresa tus credenciales para acceder al sistema
            </p>
          </div>

          <div className="mt-8">
            {/* Error general */}
            {error && (
              <div className="mb-4 rounded-md bg-red-50 p-4 fade-in">
                <div className="flex">
                  <AlertCircle className="h-5 w-5 text-red-400" />
                  <div className="ml-3">
                    <p className="text-sm font-medium text-red-800">{error}</p>
                  </div>
                </div>
              </div>
            )}

            <form className="space-y-6" onSubmit={handleSubmit(onSubmit)}>
              <div>
                <label htmlFor="nombre" className="block text-sm font-medium leading-6 text-gray-900">
                  Usuario
                </label>
                <div className="mt-2">
                  <input
                    id="nombre"
                    type="text"
                    autoComplete="username"
                    {...register('nombre', {
                      required: 'El usuario es requerido',
                      minLength: {
                        value: 2,
                        message: 'El usuario debe tener al menos 2 caracteres'
                      }
                    })}
                    className={`input ${errors.nombre ? 'input-error' : ''}`}
                    placeholder="Ingresa tu nombre de usuario"
                  />
                  {errors.nombre && (
                    <p className="mt-2 text-sm text-red-600">{errors.nombre.message}</p>
                  )}
                </div>
              </div>

              <div>
                <label htmlFor="password" className="block text-sm font-medium leading-6 text-gray-900">
                  Contraseña
                </label>
                <div className="mt-2 relative">
                  <input
                    id="password"
                    type={showPassword ? 'text' : 'password'}
                    autoComplete="current-password"
                    {...register('password', {
                      required: 'La contraseña es requerida',
                      minLength: {
                        value: 6,
                        message: 'La contraseña debe tener al menos 6 caracteres'
                      }
                    })}
                    className={`input pr-10 ${errors.password ? 'input-error' : ''}`}
                    placeholder="Ingresa tu contraseña"
                  />
                  <button
                    type="button"
                    className="absolute inset-y-0 right-0 pr-3 flex items-center"
                    onClick={() => setShowPassword(!showPassword)}
                  >
                    {showPassword ? (
                      <EyeOff className="h-4 w-4 text-gray-400" />
                    ) : (
                      <Eye className="h-4 w-4 text-gray-400" />
                    )}
                  </button>
                  {errors.password && (
                    <p className="mt-2 text-sm text-red-600">{errors.password.message}</p>
                  )}
                </div>
              </div>

              <div>
                <button
                  type="submit"
                  disabled={isLoading}
                  className="btn btn-primary btn-lg w-full flex justify-center"
                >
                  {isLoading ? (
                    <>
                      <Loader2 className="w-4 h-4 mr-2 animate-spin" />
                      Iniciando sesión...
                    </>
                  ) : (
                    'Iniciar Sesión'
                  )}
                </button>
              </div>
            </form>

            {/* Información de credenciales de prueba (solo en desarrollo) */}
            {import.meta.env.DEV && (
              <div className="mt-8 p-4 bg-blue-50 rounded-lg border border-blue-200">
                <h4 className="text-sm font-medium text-blue-900 mb-2">Credenciales de Prueba:</h4>
                <div className="text-xs text-blue-800 space-y-1">
                  <p><strong>Admin:</strong> admin / admin123</p>
                  <p><strong>Operador:</strong> operador / moderado123</p>
                </div>
              </div>
            )}
          </div>
        </div>
      </div>
    </div>
  );
};

export default LoginOld;
