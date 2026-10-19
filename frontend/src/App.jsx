import { useEffect, Suspense } from 'react';
import { BrowserRouter as Router, Routes, Route, Navigate } from 'react-router-dom';
import { useAuth } from './hooks/useAuthStore';

// Componentes
import Layout from './components/layout/Layout';
import Login from './pages/Login';
import Dashboard from './pages/Dashboard';
import Users from './pages/Users';
import Providers from './pages/Providers';
import InternMineral from './pages/InternMineral';
import CalculatePay from './pages/CalculatePay';
import MineralSales from './pages/MineralSales';
import Anticipos from './pages/Anticipos';
import LoadingSpinner from './components/ui/LoadingSpinner';

// Lazy loading para optimizar el bundle
// import { lazy } from 'react';
// const Users = lazy(() => import('./pages/Users'));
// const Providers = lazy(() => import('./pages/Providers'));

function App() {
  const { isAuthenticated, isLoading, verifyToken } = useAuth();

  // Verificar token al montar la app
  useEffect(() => {
    verifyToken();
  }, [verifyToken]);

  // Mostrar loading mientras verifica el token
  if (isLoading) {
    return <LoadingSpinner />;
  }

  return (
    <Router>
      <div className="App">
        <Routes>
          {/* Ruta de login */}
          <Route 
            path="/login" 
            element={
              isAuthenticated ? 
                <Navigate to="/" replace /> : 
                <Login />
            } 
          />
          
          {/* Rutas protegidas */}
          <Route 
            path="/*" 
            element={
              <ProtectedRoute>
                <Layout>
                  <Routes>
                    <Route path="/" element={<Dashboard />} />
                    <Route path="/usuarios" element={<Users />} />
                    <Route path="/proveedores" element={<Providers />} />
                    <Route path="/internar" element={<InternMineral />} />
                    <Route path="/anticipos" element={<Anticipos />} />
                    <Route path="/calcular" element={<CalculatePay />} />
                    <Route path="/ventas" element={<MineralSales />} />
                    <Route path="/comprobantes" element={<div className="p-8 text-center text-gray-500">Módulo de Comprobantes - Próximamente</div>} />
                    
                    {/* Ruta 404 */}
                    <Route path="*" element={<NotFound />} />
                  </Routes>
                </Layout>
              </ProtectedRoute>
            } 
          />
        </Routes>
      </div>
    </Router>
  );
}

// Componente para rutas protegidas
const ProtectedRoute = ({ children }) => {
  const { isAuthenticated } = useAuth();
  
  if (!isAuthenticated) {
    return <Navigate to="/login" replace />;
  }
  
  return (
    <Suspense fallback={<LoadingSpinner />}>
      {children}
    </Suspense>
  );
};

// Componente 404
const NotFound = () => {
  return (
    <div className="min-h-[400px] flex items-center justify-center">
      <div className="text-center">
        <h1 className="text-4xl font-bold text-gray-900 mb-4">404</h1>
        <p className="text-gray-600 mb-4">Página no encontrada</p>
        <Navigate to="/" replace />
      </div>
    </div>
  );
};

export default App;