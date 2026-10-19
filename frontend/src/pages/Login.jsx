import { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { useForm } from 'react-hook-form';
import { useAuth } from '../hooks/useAuthStore';
import { User, Lock, Eye, EyeOff, AlertCircle, Loader2, ArrowRight } from 'lucide-react';
import bgDesigner from '../assets/Designer.png';
import logoEmblem from '../assets/Emblema del minero con pico.png';

const Login = () => {
  const [showPassword, setShowPassword] = useState(false);
  const [recordarme, setRecordarme] = useState(true);
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
      if (result.error?.toLowerCase().includes('usuario')) {
        setError('nombre', { type: 'manual', message: result.error });
      } else if (result.error?.toLowerCase().includes('contraseña')) {
        setError('password', { type: 'manual', message: result.error });
      }
    }
  };

  return (
    <div
      className="min-h-screen w-full relative flex flex-col justify-between overflow-x-hidden font-sans"
      style={{
        backgroundImage: `url(${bgDesigner})`,
        backgroundSize: 'cover',
        backgroundPosition: 'center',
        backgroundRepeat: 'no-repeat'
      }}
    >
      {/* Capa de tinte suave para realzar contraste y profundidad */}
      <div className="absolute inset-0 bg-slate-950/25 pointer-events-none" />

      {/* Espaciador superior para centrado visual */}
      <div className="hidden sm:block h-6 sm:h-10" />

      {/* Contenedor Principal (Totalmente Responsive) */}
      {/* Posicionado hacia centro-derecha (lg:pr-36 xl:pr-56) para balance idéntico al mockup */}
      <main className="relative z-10 flex-1 flex items-center justify-center lg:justify-end px-4 sm:px-8 lg:pr-36 xl:pr-56 2xl:pr-72 py-6 sm:py-10">
        <div className="w-full max-w-[420px] sm:max-w-[440px]">
          
          {/* Tarjeta de Login con Efecto Glassmorphism y Transparencia */}
          <div className="relative rounded-2xl sm:rounded-3xl p-6 sm:p-8 bg-slate-950/60 backdrop-blur-xl border border-sky-400/30 shadow-2xl shadow-sky-950/60 overflow-hidden transition-all duration-300 hover:border-sky-400/40">
            
            {/* Destellos sutiles de fondo en las esquinas del cristal */}
            <div className="absolute -top-20 -right-20 w-44 h-44 bg-sky-500/10 rounded-full blur-3xl pointer-events-none" />
            <div className="absolute -bottom-20 -left-20 w-44 h-44 bg-amber-500/10 rounded-full blur-3xl pointer-events-none" />

            {/* Emblema del Minero y Títulos Institucionales */}
            <div className="flex flex-col items-center text-center">
              <div className="w-20 h-20 sm:w-24 sm:h-24 rounded-full border-2 border-amber-500/70 p-1 bg-amber-500/10 shadow-lg shadow-amber-500/20 flex items-center justify-center overflow-hidden mb-3">
                <img
                  src={logoEmblem}
                  alt="Emblema Minera AyM"
                  className="w-full h-full object-cover scale-105"
                />
              </div>

              <h1 className="font-black text-2xl sm:text-3xl text-white tracking-[0.3em] uppercase">
                A Y M
              </h1>
              <p className="text-[10px] sm:text-xs font-semibold text-slate-300 tracking-[0.2em] uppercase mt-1">
                SISTEMA DE GESTIÓN MINERA
              </p>
            </div>

            {/* Sección de Bienvenida */}
            <div className="mt-6 mb-5">
              <h2 className="text-xl sm:text-2xl font-bold text-white tracking-tight">
                Bienvenido
              </h2>
              <div className="w-12 h-1 bg-amber-500 rounded-full mt-1.5 mb-2 shadow-sm shadow-amber-500/50" />
              <p className="text-xs sm:text-sm text-slate-300 font-normal">
                Ingresa tus credenciales para acceder al sistema
              </p>
            </div>

            {/* Alerta de Error General */}
            {error && (
              <div className="mb-4 rounded-xl bg-red-950/60 border border-red-500/50 p-3.5 text-xs text-red-200 flex items-center gap-2.5 animate-fadeIn">
                <AlertCircle className="h-4 w-4 text-red-400 flex-shrink-0" />
                <span>{error}</span>
              </div>
            )}

            {/* Formulario de Inicio de Sesión */}
            <form onSubmit={handleSubmit(onSubmit)} className="space-y-4">
              {/* Campo Usuario */}
              <div>
                <div className="relative">
                  <div className="absolute inset-y-0 left-0 pl-3.5 flex items-center pointer-events-none text-slate-400">
                    <User className="h-4 w-4" />
                  </div>
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
                    className={`w-full bg-slate-900/60 border ${
                      errors.nombre ? 'border-red-500 focus:border-red-500' : 'border-slate-700/60 focus:border-amber-400'
                    } focus:ring-1 focus:ring-amber-400 text-white placeholder-slate-400 text-sm rounded-xl py-3 pl-11 pr-4 outline-none transition-all duration-200`}
                    placeholder="Usuario"
                  />
                </div>
                {errors.nombre && (
                  <p className="mt-1 text-xs text-red-400 pl-1">{errors.nombre.message}</p>
                )}
              </div>

              {/* Campo Contraseña */}
              <div>
                <div className="relative">
                  <div className="absolute inset-y-0 left-0 pl-3.5 flex items-center pointer-events-none text-slate-400">
                    <Lock className="h-4 w-4" />
                  </div>
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
                    className={`w-full bg-slate-900/60 border ${
                      errors.password ? 'border-red-500 focus:border-red-500' : 'border-slate-700/60 focus:border-amber-400'
                    } focus:ring-1 focus:ring-amber-400 text-white placeholder-slate-400 text-sm rounded-xl py-3 pl-11 pr-11 outline-none transition-all duration-200`}
                    placeholder="Contraseña"
                  />
                  <button
                    type="button"
                    tabIndex={-1}
                    className="absolute inset-y-0 right-0 pr-3.5 flex items-center text-slate-400 hover:text-white transition-colors"
                    onClick={() => setShowPassword(!showPassword)}
                  >
                    {showPassword ? (
                      <EyeOff className="h-4 w-4" />
                    ) : (
                      <Eye className="h-4 w-4" />
                    )}
                  </button>
                </div>
                {errors.password && (
                  <p className="mt-1 text-xs text-red-400 pl-1">{errors.password.message}</p>
                )}
              </div>

              {/* Checkbox Recordarme (Sin Olvidaste tu contraseña) */}
              <div className="flex items-center justify-between pt-0.5">
                <label className="flex items-center gap-2 cursor-pointer select-none text-xs sm:text-sm text-slate-300 hover:text-white transition-colors">
                  <input
                    type="checkbox"
                    checked={recordarme}
                    onChange={(e) => setRecordarme(e.target.checked)}
                    className="w-4 h-4 rounded text-amber-500 border-slate-600 focus:ring-amber-500 focus:ring-offset-0 bg-slate-900/80 cursor-pointer accent-amber-500"
                  />
                  <span>Recordarme</span>
                </label>
              </div>

              {/* Botón Iniciar Sesión Dorado / Ámbar */}
              <div className="pt-2">
                <button
                  type="submit"
                  disabled={isLoading}
                  className="w-full bg-gradient-to-r from-amber-400 via-amber-500 to-amber-600 hover:from-amber-500 hover:to-amber-700 text-slate-950 font-extrabold text-xs sm:text-sm uppercase tracking-wider py-3.5 px-6 rounded-xl shadow-lg shadow-amber-500/25 flex items-center justify-center gap-2 transition-all duration-200 transform hover:-translate-y-0.5 active:translate-y-0 disabled:opacity-60 disabled:cursor-not-allowed disabled:transform-none"
                >
                  {isLoading ? (
                    <>
                      <Loader2 className="w-4 h-4 animate-spin text-slate-950" />
                      <span>Iniciando sesión...</span>
                    </>
                  ) : (
                    <>
                      <span>INICIAR SESIÓN</span>
                      <ArrowRight className="w-4 h-4 stroke-[2.5]" />
                    </>
                  )}
                </button>
              </div>
            </form>
          </div>
        </div>
      </main>

      {/* Pie de Página (Footer con Derechos Reservados al Medio y HUANA DEV en Dorado) */}
      <footer className="w-full py-3.5 px-6 sm:px-12 text-[11px] sm:text-xs z-10 flex flex-col sm:flex-row items-center justify-between gap-2 border-t border-white/5 bg-slate-950/40 backdrop-blur-md">
        {/* Espacio invisible izquierdo para centrado equilibrado en desktop */}
        <div className="hidden sm:block flex-1" />

        {/* Derechos Reservados al Centro Exacto */}
        <p className="text-center text-slate-400 font-normal tracking-wide sm:flex-1">
          © {new Date().getFullYear()} A Y M &nbsp;·&nbsp; Todos los derechos reservados
        </p>

        {/* Crédito a la derecha con línea dorada y HUANA DEV en color dorado */}
        <div className="sm:flex-1 flex justify-center sm:justify-end items-center gap-2">
          <span className="text-amber-400 font-bold text-sm leading-none">|</span>
          <span className="text-slate-400">
            Desarrollado por{' '}
            <span className="font-bold text-amber-400 tracking-wider">HUANA DEV</span>
          </span>
        </div>
      </footer>
    </div>
  );
};

export default Login;