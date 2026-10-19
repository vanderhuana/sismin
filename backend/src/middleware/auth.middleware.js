import jwt from 'jsonwebtoken';

// Middleware para verificar JWT
export const authenticateToken = (req, res, next) => {
  const authHeader = req.headers['authorization'];
  const token = authHeader && authHeader.split(' ')[1];

  if (!token) {
    return res.status(401).json({
      error: 'Token de acceso requerido'
    });
  }

  jwt.verify(token, process.env.JWT_SECRET, (err, user) => {
    if (err) {
      return res.status(403).json({
        error: 'Token inválido o expirado'
      });
    }

    req.user = user;
    next();
  });
};

// Middleware para verificar roles
export const requireRole = (...roles) => {
  return (req, res, next) => {
    if (!req.user) {
      return res.status(401).json({
        error: 'Usuario no autenticado'
      });
    }

    if (!roles.includes(req.user.rol)) {
      return res.status(403).json({
        error: 'No tienes permisos para realizar esta acción',
        requiredRoles: roles,
        userRole: req.user.rol
      });
    }

    next();
  };
};

// Middleware para verificar que sea admin
export const requireAdmin = requireRole('ADMIN');

// Middleware opcional de autenticación (no falla si no hay token)
export const optionalAuth = (req, res, next) => {
  const authHeader = req.headers['authorization'];
  const token = authHeader && authHeader.split(' ')[1];

  if (!token) {
    req.user = null;
    return next();
  }

  jwt.verify(token, process.env.JWT_SECRET, (err, user) => {
    if (err) {
      req.user = null;
    } else {
      req.user = user;
    }
    next();
  });
};