import { Loader2 } from 'lucide-react';
import logoEmblem from '../../assets/Emblema del minero con pico.png';

const LoadingSpinner = ({ size = 'default', message = 'Cargando...' }) => {
  const sizeClasses = {
    small: 'h-4 w-4',
    default: 'h-8 w-8',
    large: 'h-12 w-12'
  };

  return (
    <div className="min-h-screen flex items-center justify-center bg-gray-50">
      <div className="text-center">
        <div className="flex items-center justify-center mb-4">
          <img src={logoEmblem} alt="Minera A y M" className="h-10 w-10 object-contain mr-2 drop-shadow-sm" />
          <h1 className="text-xl font-bold tracking-tight">
            <span className="text-emerald-700">Minera </span>
            <span className="text-amber-500 font-black">A y M</span>
          </h1>
        </div>
        <div className="flex items-center justify-center space-x-2">
          <Loader2 className={`${sizeClasses[size]} animate-spin text-primary-600`} />
          <span className="text-gray-600">{message}</span>
        </div>
      </div>
    </div>
  );
};

export default LoadingSpinner;