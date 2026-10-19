import { useState, useEffect } from 'react';
import { Link } from 'react-router-dom';
import { useAuth } from '../hooks/useAuthStore';
import { internacionService, handleApiError } from '../services/api';
import { 
  PackageCheck, 
  Clock, 
  Calculator, 
  CheckCircle, 
  TrendingUp,
  Weight,
  DollarSign,
  Users,
  Truck,
  AlertCircle
} from 'lucide-react';

const Dashboard = () => {
  const { user, canInternMineral } = useAuth();
  const [stats, setStats] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);

  useEffect(() => {
    loadStats();
  }, []);

  const loadStats = async () => {
    try {
      setLoading(true);
      setError(null);
      
      if (canInternMineral()) {
        const data = await internacionService.getDashboardStats();
        setStats(data);
      }
    } catch (err) {
      console.error('Error al cargar estadísticas:', err);
      setError(handleApiError(err));
    } finally {
      setLoading(false);
    }
  };

  if (loading) {
    return (
      <div className="animate-pulse space-y-6">
        <div className="h-8 bg-gray-200 rounded w-1/3"></div>
        <div className="grid grid-cols-1 gap-6 sm:grid-cols-2 lg:grid-cols-4">
          {[1, 2, 3, 4].map((i) => (
            <div key={i} className="bg-white p-6 rounded-lg shadow">
              <div className="h-4 bg-gray-200 rounded w-1/2 mb-2"></div>
              <div className="h-8 bg-gray-200 rounded w-3/4"></div>
            </div>
          ))}
        </div>
      </div>
    );
  }

  return (
    <div className="space-y-8">
      {/* Encabezado */}
      <div>
        <h1 className="text-3xl font-bold text-gray-900">Dashboard</h1>
        <p className="mt-2 text-gray-600">
          Bienvenido, {user?.nombre}. Aquí tienes un resumen del sistema.
        </p>
      </div>

      {/* Tarjetas de estadísticas */}
      {canInternMineral() && stats && !error && (
        <div className="grid grid-cols-1 gap-6 sm:grid-cols-2 lg:grid-cols-4">
          <StatCard
            title="Total Internaciones"
            value={stats.totalInternaciones}
            icon={PackageCheck}
            color="blue"
          />
          <StatCard
            title="En Espera de Ley"
            value={stats.estados.enEsperaLey}
            icon={Clock}
            color="yellow"
            link="/calcular"
          />
          <StatCard
            title="Calculadas"
            value={stats.estados.calculadas}
            icon={Calculator}
            color="indigo"
          />
          <StatCard
            title="Pagadas"
            value={stats.estados.pagadas}
            icon={CheckCircle}
            color="green"
          />
        </div>
      )}

      {/* Métricas adicionales */}
      {canInternMineral() && stats && !error && (
        <div className="grid grid-cols-1 gap-6 lg:grid-cols-2">
          <MetricCard
            title="Total Kilos Procesados"
            value={`${Math.trunc(Number(stats.totalKilosBruto) || 0).toLocaleString('es-BO', { minimumFractionDigits: 0, maximumFractionDigits: 0 })} kg`}
            icon={Weight}
            subtitle="Peso bruto total de todas las internaciones"
          />
          <MetricCard
            title="Total Pagado"
            value={`${Math.trunc(Number(stats.totalPagado) || 0).toLocaleString('es-BO', { style: 'currency', currency: 'BOB', minimumFractionDigits: 0, maximumFractionDigits: 0 })}`}
            icon={DollarSign}
            subtitle="Monto total pagado a proveedores"
          />
        </div>
      )}

      {/* Error state */}
      {error && (
        <div className="rounded-md bg-red-50 p-4">
          <div className="flex">
            <AlertCircle className="h-5 w-5 text-red-400" />
            <div className="ml-3">
              <h3 className="text-sm font-medium text-red-800">Error al cargar estadísticas</h3>
              <p className="mt-2 text-sm text-red-700">{error}</p>
              <button
                onClick={loadStats}
                className="mt-2 btn btn-sm btn-secondary"
              >
                Reintentar
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Acciones rápidas */}
      <div className="grid grid-cols-1 gap-6 lg:grid-cols-2">
        <QuickActions />
        <RecentActivity />
      </div>
    </div>
  );
};

const StatCard = ({ title, value, icon: Icon, color, link }) => {
  const colorClasses = {
    blue: 'text-blue-600 bg-blue-100',
    yellow: 'text-yellow-600 bg-yellow-100',
    indigo: 'text-indigo-600 bg-indigo-100',
    green: 'text-green-600 bg-green-100'
  };

  const Card = ({ children }) => {
    if (link) {
      return (
        <Link to={link} className="card hover:shadow-md transition-shadow cursor-pointer">
          {children}
        </Link>
      );
    }
    return <div className="card">{children}</div>;
  };

  return (
    <Card>
      <div className="card-content">
        <div className="flex items-center">
          <div className={`p-2 rounded-md ${colorClasses[color]}`}>
            <Icon className="h-6 w-6" />
          </div>
          <div className="ml-4">
            <p className="text-sm font-medium text-gray-500">{title}</p>
            <p className="text-2xl font-semibold text-gray-900">{value}</p>
          </div>
        </div>
      </div>
    </Card>
  );
};

const MetricCard = ({ title, value, icon: Icon, subtitle }) => {
  return (
    <div className="card">
      <div className="card-header">
        <div className="flex items-center">
          <Icon className="h-5 w-5 text-gray-400" />
          <h3 className="ml-2 card-title text-lg">{title}</h3>
        </div>
      </div>
      <div className="card-content">
        <p className="text-3xl font-bold text-gray-900">{value}</p>
        {subtitle && <p className="text-sm text-gray-500 mt-1">{subtitle}</p>}
      </div>
    </div>
  );
};

const QuickActions = () => {
  const { canManageUsers, canManageProviders, canInternMineral } = useAuth();

  const actions = [
    {
      name: 'Gestionar Usuarios',
      href: '/usuarios',
      icon: Users,
      description: 'Crear y administrar usuarios del sistema',
      show: canManageUsers(),
      color: 'bg-blue-500'
    },
    {
      name: 'Gestionar Proveedores',
      href: '/proveedores',
      icon: Truck,
      description: 'Administrar información de proveedores',
      show: canManageProviders(),
      color: 'bg-green-500'
    },
    {
      name: 'Internar Mineral',
      href: '/internar',
      icon: PackageCheck,
      description: 'Registrar nueva entrada de mineral',
      show: canInternMineral(),
      color: 'bg-yellow-500'
    },
    {
      name: 'Calcular Pago',
      href: '/calcular',
      icon: Calculator,
      description: 'Procesar cálculos de pago pendientes',
      show: canInternMineral(),
      color: 'bg-indigo-500'
    }
  ].filter(action => action.show);

  if (actions.length === 0) {
    return null;
  }

  return (
    <div className="card">
      <div className="card-header">
        <h3 className="card-title">Acciones Rápidas</h3>
        <p className="card-description">
          Accesos directos a las funciones principales
        </p>
      </div>
      <div className="card-content">
        <div className="space-y-3">
          {actions.map((action) => {
            const Icon = action.icon;
            return (
              <Link
                key={action.name}
                to={action.href}
                className="flex items-center p-3 rounded-lg hover:bg-gray-50 transition-colors group"
              >
                <div className={`p-2 rounded-md ${action.color} text-white group-hover:scale-110 transition-transform`}>
                  <Icon className="h-5 w-5" />
                </div>
                <div className="ml-4">
                  <h4 className="text-sm font-medium text-gray-900">{action.name}</h4>
                  <p className="text-sm text-gray-500">{action.description}</p>
                </div>
              </Link>
            );
          })}
        </div>
      </div>
    </div>
  );
};

const RecentActivity = () => {
  return (
    <div className="card">
      <div className="card-header">
        <h3 className="card-title">Actividad Reciente</h3>
        <p className="card-description">
          Últimas acciones en el sistema
        </p>
      </div>
      <div className="card-content">
        <div className="text-center py-6 text-gray-500">
          <Clock className="h-8 w-8 mx-auto mb-2 text-gray-300" />
          <p className="text-sm">Actividad reciente próximamente</p>
          <p className="text-xs mt-1">Esta funcionalidad estará disponible en futuras versiones</p>
        </div>
      </div>
    </div>
  );
};

export default Dashboard;