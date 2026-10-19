import axios from 'axios';

// Configuración base de Axios
const API_BASE_URL = import.meta.env.VITE_API_URL || 'http://localhost:3000/api';

const api = axios.create({
  baseURL: API_BASE_URL,
  timeout: 10000,
  headers: {
    'Content-Type': 'application/json',
  },
});

// Interceptor para agregar token automáticamente
api.interceptors.request.use(
  (config) => {
    const token = localStorage.getItem('token');
    if (token) {
      config.headers.Authorization = `Bearer ${token}`;
    }
    return config;
  },
  (error) => {
    return Promise.reject(error);
  }
);

// Interceptor para manejar respuestas y errores
api.interceptors.response.use(
  (response) => {
    return response;
  },
  (error) => {
    // Si el token es inválido, limpiar localStorage y redirigir al login
    if (error.response?.status === 401) {
      localStorage.removeItem('token');
      localStorage.removeItem('user');
      window.location.href = '/login';
    }
    
    return Promise.reject(error);
  }
);

// Servicios de autenticación
export const authService = {
  login: async (credentials) => {
    const response = await api.post('/auth/login', credentials);
    return response.data;
  },
  
  logout: async () => {
    const response = await api.post('/auth/logout');
    localStorage.removeItem('token');
    localStorage.removeItem('user');
    return response.data;
  },
  
  verifyToken: async () => {
    const response = await api.get('/auth/verify');
    return response.data;
  },
  
  getProfile: async () => {
    const response = await api.get('/auth/me');
    return response.data;
  }
};

// Servicios de usuarios
export const userService = {
  getUsers: async (params = {}) => {
    const response = await api.get('/users', { params });
    return response.data;
  },
  
  getUser: async (id) => {
    const response = await api.get(`/users/${id}`);
    return response.data;
  },
  
  createUser: async (userData) => {
    const response = await api.post('/users', userData);
    return response.data;
  },
  
  updateUser: async (id, userData) => {
    const response = await api.put(`/users/${id}`, userData);
    return response.data;
  },
  
  deleteUser: async (id) => {
    const response = await api.delete(`/users/${id}`);
    return response.data;
  },
  
  toggleUserStatus: async (id) => {
    const response = await api.put(`/users/${id}/toggle-status`);
    return response.data;
  }
};

// Servicios de proveedores
export const providerService = {
  getProviders: async (params = {}) => {
    const response = await api.get('/providers', { params });
    return response.data;
  },
  
  getActiveProviders: async () => {
    const response = await api.get('/providers/active');
    return response.data;
  },
  
  getProvider: async (id) => {
    const response = await api.get(`/providers/${id}`);
    return response.data;
  },
  
  createProvider: async (providerData) => {
    const response = await api.post('/providers', providerData);
    return response.data;
  },
  
  updateProvider: async (id, providerData) => {
    const response = await api.put(`/providers/${id}`, providerData);
    return response.data;
  },
  
  deleteProvider: async (id) => {
    const response = await api.delete(`/providers/${id}`);
    return response.data;
  },
  
  toggleProviderStatus: async (id) => {
    const response = await api.put(`/providers/${id}/toggle-status`);
    return response.data;
  },
  
  getProviderStats: async (id) => {
    const response = await api.get(`/providers/${id}/stats`);
    return response.data;
  }
};

// Servicios de internaciones
export const internacionService = {
  getInternaciones: async (params = {}) => {
    const response = await api.get('/internaciones', { params });
    return response.data;
  },
  
  getPendingInternaciones: async () => {
    const response = await api.get('/internaciones/pendientes');
    return response.data;
  },
  
  getInternacion: async (id) => {
    const response = await api.get(`/internaciones/${id}`);
    return response.data;
  },
  
  createInternacion: async (internacionData) => {
    const response = await api.post('/internaciones', internacionData);
    return response.data;
  },
  
  updateInternacion: async (id, internacionData) => {
    const response = await api.put(`/internaciones/${id}`, internacionData);
    return response.data;
  },
  
  deleteInternacion: async (id) => {
    const response = await api.delete(`/internaciones/${id}`);
    return response.data;
  },
  
  getDashboardStats: async () => {
    const response = await api.get('/internaciones/stats/dashboard');
    return response.data;
  },
  
  downloadBoletaPdf: async (id) => {
    const response = await api.get(`/internaciones/${id}/boleta`, {
      responseType: 'blob'
    });
    return response;
  },
  
  getNextLote: async () => {
    const response = await api.get('/internaciones/next-lote');
    return response.data;
  },
  
  checkLoteAvailability: async (lote, excludeId = null) => {
    const response = await api.get('/internaciones/check-lote', {
      params: { lote, excludeId }
    });
    return response.data;
  }
};

// Servicios de cálculos
export const calculoService = {
  getCalculos: async (params = {}) => {
    const response = await api.get('/calculos', { params });
    return response.data;
  },
  
  getCalculo: async (id) => {
    const response = await api.get(`/calculos/${id}`);
    return response.data;
  },
  
  createCalculo: async (calculoData) => {
    const response = await api.post('/calculos', calculoData);
    return response.data;
  },
  
  markAsPaid: async (id) => {
    const response = await api.put(`/calculos/${id}/pagar`);
    return response.data;
  },
  
  generateReceipt: async (id) => {
    const response = await api.get(`/calculos/${id}/comprobante`, {
      responseType: 'blob'
    });
    return response;
  }
};

// Servicios de anticipos
export const anticipoService = {
  getAnticipos: async (params = {}) => {
    const response = await api.get('/anticipos', { params });
    return response.data;
  },

  getResumenProveedores: async () => {
    const response = await api.get('/anticipos/resumen-proveedores');
    return response.data;
  },

  getPendientesByProveedor: async (proveedorId) => {
    const response = await api.get(`/anticipos/proveedor/${proveedorId}/pendientes`);
    return response.data;
  },

  getAnticiposByInternacion: async (internacionId) => {
    const response = await api.get(`/anticipos/internacion/${internacionId}`);
    return response.data;
  },

  createAnticipo: async (data) => {
    const response = await api.post('/anticipos', data);
    return response.data;
  },

  downloadValePdf: async (id) => {
    const response = await api.get(`/anticipos/${id}/vale-pdf`, {
      responseType: 'blob'
    });
    return response;
  },

  deleteAnticipo: async (id) => {
    const response = await api.delete(`/anticipos/${id}`);
    return response.data;
  }
};

// Servicios de ventas de mineral (Lotes Generales)
export const ventaService = {
  getLotesDisponibles: async (params = {}) => {
    const response = await api.get('/ventas/disponibles', { params });
    return response.data;
  },

  createVentaLoteGeneral: async (data) => {
    const response = await api.post('/ventas', data);
    return response.data;
  },

  getVentas: async (params = {}) => {
    const response = await api.get('/ventas', { params });
    return response.data;
  },

  getVenta: async (id) => {
    const response = await api.get(`/ventas/${id}`);
    return response.data;
  },

  downloadExcel: async (id, fileName) => {
    const response = await api.get(`/ventas/${id}/excel`, { responseType: 'blob' });
    const url = window.URL.createObjectURL(new Blob([response.data]));
    const link = document.createElement('a');
    link.href = url;
    link.download = fileName || `venta-${id}.xlsx`;
    link.click();
    window.URL.revokeObjectURL(url);
  },

  downloadPdf: async (id, fileName) => {
    const response = await api.get(`/ventas/${id}/pdf`, { responseType: 'blob' });
    const url = window.URL.createObjectURL(new Blob([response.data], { type: 'application/pdf' }));
    const link = document.createElement('a');
    link.href = url;
    link.download = fileName || `venta-${id}.pdf`;
    link.click();
    window.URL.revokeObjectURL(url);
  }
};

// Función helper para manejar errores de API
export const handleApiError = (error) => {
  if (error.response?.data?.details && Array.isArray(error.response.data.details) && error.response.data.details.length > 0) {
    return error.response.data.details.map(d => d.message).join('. ');
  }

  if (error.response?.data?.error) {
    return error.response.data.error;
  }
  
  if (error.response?.data?.message) {
    return error.response.data.message;
  }
  
  if (error.code === 'NETWORK_ERROR') {
    return 'Error de conexión. Verifica tu conexión a internet.';
  }
  
  if (error.code === 'ECONNABORTED') {
    return 'Tiempo de espera agotado. Intenta nuevamente.';
  }
  
  return error.message || 'Ha ocurrido un error inesperado';
};

// Obtener detalles estructurados del error de API para mapear a campos
export const getApiErrorDetails = (error) => {
  const message = handleApiError(error);
  const details = error.response?.data?.details || [];
  const field = error.response?.data?.field || null;
  return { message, details, field };
};

export default api;