import { create } from 'zustand';
import { persist } from 'zustand/middleware';
import { authService } from '../services/api';

export const useAuthStore = create(
  persist(
    (set, get) => ({
      // Estado
      user: null,
      token: null,
      isAuthenticated: false,
      isLoading: false,
      error: null,

      // Acciones
      login: async (credentials) => {
        set({ isLoading: true, error: null });
        
        try {
          const response = await authService.login(credentials);
          const { token, usuario } = response;
          
          // Guardar en localStorage
          localStorage.setItem('token', token);
          localStorage.setItem('user', JSON.stringify(usuario));
          
          set({
            user: usuario,
            token,
            isAuthenticated: true,
            isLoading: false,
            error: null
          });
          
          return { success: true, user: usuario };
        } catch (error) {
          const errorMessage = error.response?.data?.error || 'Error al iniciar sesión';
          
          set({
            user: null,
            token: null,
            isAuthenticated: false,
            isLoading: false,
            error: errorMessage
          });
          
          return { success: false, error: errorMessage };
        }
      },

      logout: async () => {
        set({ isLoading: true });
        
        try {
          await authService.logout();
        } catch (error) {
          console.error('Error al cerrar sesión:', error);
        } finally {
          // Limpiar estado y localStorage
          localStorage.removeItem('token');
          localStorage.removeItem('user');
          
          set({
            user: null,
            token: null,
            isAuthenticated: false,
            isLoading: false,
            error: null
          });
        }
      },

      verifyToken: async () => {
        const token = localStorage.getItem('token');
        
        if (!token) {
          set({ isAuthenticated: false, isLoading: false, user: null, token: null });
          return false;
        }

        set({ isLoading: true });
        
        try {
          const response = await authService.verifyToken();
          const usuario = response.usuario;
          
          set({
            user: usuario,
            token,
            isAuthenticated: true,
            isLoading: false,
            error: null
          });
          
          localStorage.setItem('user', JSON.stringify(usuario));
          
          return true;
        } catch (error) {
          localStorage.removeItem('token');
          localStorage.removeItem('user');
          
          set({
            user: null,
            token: null,
            isAuthenticated: false,
            isLoading: false,
            error: null
          });
          
          return false;
        }
      },

      clearError: () => {
        set({ error: null });
      },

      // Helpers
      hasRole: (role) => {
        const { user } = get();
        return user?.rol === role;
      },

      isAdmin: () => {
        const { user } = get();
        return user?.rol === 'ADMIN';
      },

      isModerado: () => {
        const { user } = get();
        return user?.rol === 'MODERADO';
      },

      canManageUsers: () => {
        return get().isAdmin();
      },

      canManageProviders: () => {
        const { user } = get();
        return user && (user.rol === 'ADMIN' || user.rol === 'MODERADO');
      },

      canInternMineral: () => {
        const { user } = get();
        return user && (user.rol === 'ADMIN' || user.rol === 'MODERADO');
      }
    }),
    {
      name: 'auth-storage',
      // Solo persistir datos básicos, no funciones
      partialize: (state) => ({
        user: state.user,
        token: state.token,
        isAuthenticated: state.isAuthenticated
      }),
      // Hidratar desde localStorage al inicializar
      onRehydrateStorage: () => (state, error) => {
        if (error) {
          console.error('Error al hidratar auth store:', error);
        }
        // verifyToken se llama desde App.jsx al montar
      }
    }
  )
);

// Hook personalizado para usar solo las acciones de auth
export const useAuth = () => {
  const store = useAuthStore();
  return {
    user: store.user,
    isAuthenticated: store.isAuthenticated,
    isLoading: store.isLoading,
    error: store.error,
    login: store.login,
    logout: store.logout,
    verifyToken: store.verifyToken,
    clearError: store.clearError,
    hasRole: store.hasRole,
    isAdmin: store.isAdmin,
    isModerado: store.isModerado,
    canManageUsers: store.canManageUsers,
    canManageProviders: store.canManageProviders,
    canInternMineral: store.canInternMineral
  };
};