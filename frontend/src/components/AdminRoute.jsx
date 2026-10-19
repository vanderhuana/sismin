import { Navigate } from 'react-router-dom';
import { useAuth } from '../hooks/useAuthStore';

const AdminRoute = ({ children }) => {
  const { isAdmin } = useAuth();

  if (!isAdmin()) {
    return (
      <div className="rounded-lg border border-amber-200 bg-amber-50 p-6 text-center">
        <h2 className="text-lg font-semibold text-amber-900">Acceso restringido</h2>
        <p className="mt-2 text-sm text-amber-800">
          Solo los administradores pueden acceder a esta sección.
        </p>
      </div>
    );
  }

  return children;
};

export default AdminRoute;
