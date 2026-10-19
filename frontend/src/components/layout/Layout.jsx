import { useState } from 'react';
import { Link, useLocation, useNavigate } from 'react-router-dom';
import { useAuth } from '../../hooks/useAuthStore';
import { 
  Menu, 
  X, 
  Home, 
  Users, 
  Truck, 
  PackageCheck, 
  Calculator, 
  FileText,
  TrendingUp,
  Coins,
  LogOut,
  ChevronDown,
  User
} from 'lucide-react';
import logoEmblem from '../../assets/Emblema del minero con pico.png';

const Layout = ({ children }) => {
  const [sidebarOpen, setSidebarOpen] = useState(false);
  const [userMenuOpen, setUserMenuOpen] = useState(false);
  const location = useLocation();
  const navigate = useNavigate();
  const { user, logout, isAdmin, canManageUsers, canManageProviders, canInternMineral } = useAuth();

  const handleLogout = async () => {
    await logout();
    navigate('/login');
  };

  const menuItems = [
    {
      name: 'Dashboard',
      href: '/',
      icon: Home,
      show: true
    },
    {
      name: 'Usuarios',
      href: '/usuarios',
      icon: Users,
      show: canManageUsers()
    },
    {
      name: 'Proveedores',
      href: '/proveedores',
      icon: Truck,
      show: canManageProviders()
    },
    {
      name: 'Internar Mineral',
      href: '/internar',
      icon: PackageCheck,
      show: canInternMineral()
    },
    {
      name: 'Anticipos',
      href: '/anticipos',
      icon: Coins,
      show: canInternMineral()
    },
    {
      name: 'Calcular Pago',
      href: '/calcular',
      icon: Calculator,
      show: canInternMineral()
    },
    {
      name: 'Venta de Mineral',
      href: '/ventas',
      icon: TrendingUp,
      show: canInternMineral()
    },
    {
      name: 'Comprobantes',
      href: '/comprobantes',
      icon: FileText,
      show: canInternMineral()
    }
  ].filter(item => item.show);

  const isCurrentPage = (href) => {
    if (href === '/') {
      return location.pathname === '/';
    }
    return location.pathname.startsWith(href);
  };

  return (
    <div className="min-h-screen bg-gray-50">
      {/* Sidebar para móvil */}
      {sidebarOpen && (
        <div className="fixed inset-0 z-40 lg:hidden">
          <div className="fixed inset-0 bg-gray-600 bg-opacity-75" onClick={() => setSidebarOpen(false)} />
          <div className="relative flex w-full max-w-xs flex-1 flex-col bg-white">
            <div className="absolute top-0 right-0 -mr-12 pt-2">
              <button
                type="button"
                className="ml-1 flex h-10 w-10 items-center justify-center rounded-full focus:outline-none focus:ring-2 focus:ring-inset focus:ring-white"
                onClick={() => setSidebarOpen(false)}
              >
                <X className="h-6 w-6 text-white" />
              </button>
            </div>
            <SidebarContent menuItems={menuItems} isCurrentPage={isCurrentPage} />
          </div>
        </div>
      )}

      {/* Sidebar para desktop */}
      <div className="hidden lg:fixed lg:inset-y-0 lg:flex lg:w-64 lg:flex-col">
        <SidebarContent menuItems={menuItems} isCurrentPage={isCurrentPage} />
      </div>

      {/* Contenido principal */}
      <div className="lg:pl-64 flex flex-col flex-1">
        {/* Header */}
        <div className="sticky top-0 z-10 bg-white shadow-sm border-b border-gray-200">
          <div className="flex h-16 items-center justify-between px-4 sm:px-6 lg:px-8">
            <button
              type="button"
              className="border-r border-gray-200 px-4 text-gray-500 focus:outline-none focus:ring-2 focus:ring-inset focus:ring-primary-500 lg:hidden"
              onClick={() => setSidebarOpen(true)}
            >
              <Menu className="h-6 w-6" />
            </button>

            {/* Usuario dropdown */}
            <div className="relative ml-auto">
              <button
                type="button"
                className="flex max-w-xs items-center rounded-full bg-white text-sm focus:outline-none focus:ring-2 focus:ring-primary-500 focus:ring-offset-2"
                onClick={() => setUserMenuOpen(!userMenuOpen)}
              >
                <div className="flex items-center space-x-3 px-3 py-2 rounded-lg hover:bg-gray-50">
                  <div className="flex-shrink-0">
                    <div className="h-8 w-8 rounded-full bg-primary-600 flex items-center justify-center">
                      <User className="h-5 w-5 text-white" />
                    </div>
                  </div>
                  <div className="hidden md:block text-left">
                    <div className="text-sm font-medium text-gray-900">{user?.nombre}</div>
                    <div className="text-xs text-gray-500">{user?.rol}</div>
                  </div>
                  <ChevronDown className="h-4 w-4 text-gray-400" />
                </div>
              </button>

              {userMenuOpen && (
                <div className="absolute right-0 z-10 mt-2 w-48 origin-top-right rounded-md bg-white py-1 shadow-lg ring-1 ring-black ring-opacity-5 focus:outline-none">
                  <button
                    onClick={handleLogout}
                    className="flex w-full items-center px-4 py-2 text-sm text-gray-700 hover:bg-gray-100"
                  >
                    <LogOut className="mr-3 h-4 w-4" />
                    Cerrar Sesión
                  </button>
                </div>
              )}
            </div>
          </div>
        </div>

        {/* Contenido de la página */}
        <main className="flex-1 pb-8">
          <div className="mx-auto max-w-7xl px-4 sm:px-6 lg:px-8 py-8">
            {children}
          </div>
        </main>
      </div>
    </div>
  );
};

const SidebarContent = ({ menuItems, isCurrentPage }) => {
  return (
    <div className="flex flex-1 flex-col overflow-y-auto bg-white">
      {/* Logo */}
      <div className="flex flex-shrink-0 items-center px-5 py-4 border-b border-gray-100 bg-gradient-to-r from-emerald-50/50 via-white to-amber-50/30">
        <div className="flex items-center">
          <div className="flex-shrink-0 p-1 bg-white rounded-xl shadow-xs border border-emerald-100">
            <img 
              src={logoEmblem} 
              alt="Logo Minera A y M" 
              className="h-10 w-10 object-contain drop-shadow-sm" 
            />
          </div>
          <div className="ml-3">
            <h1 className="text-lg font-extrabold tracking-tight leading-tight">
              <span className="text-emerald-700">Minera </span>
              <span className="text-amber-500 font-black">A y M</span>
            </h1>
            <p className="text-[11px] font-medium text-gray-500">Gestión de Minerales</p>
          </div>
        </div>
      </div>

      {/* Navegación */}
      <nav className="mt-6 flex-1 space-y-1 px-3">
        {menuItems.map((item) => {
          const Icon = item.icon;
          const current = isCurrentPage(item.href);
          
          return (
            <Link
              key={item.name}
              to={item.href}
              className={`
                group flex items-center px-3 py-2 text-sm font-medium rounded-lg transition-colors
                ${current
                  ? 'bg-primary-50 text-primary-700 border-r-2 border-primary-600'
                  : 'text-gray-600 hover:bg-gray-50 hover:text-gray-900'
                }
              `}
            >
              <Icon
                className={`
                  mr-3 h-5 w-5 flex-shrink-0
                  ${current ? 'text-primary-600' : 'text-gray-400 group-hover:text-gray-500'}
                `}
              />
              {item.name}
            </Link>
          );
        })}
      </nav>

      {/* Footer del sidebar */}
      <div className="flex-shrink-0 border-t border-gray-100 p-4">
        <div className="text-xs text-gray-500 text-center font-medium">
          <span className="text-emerald-700 font-bold">Minera</span> <span className="text-amber-500 font-black">A y M</span> <span className="text-gray-400">v1.0</span>
        </div>
      </div>
    </div>
  );
};

export default Layout;