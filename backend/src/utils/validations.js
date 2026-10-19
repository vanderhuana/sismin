import Joi from 'joi';

// Validaciones para Usuario
export const userSchemas = {
  create: Joi.object({
    nombre: Joi.string().min(2).max(100).required()
      .messages({
        'string.empty': 'El nombre es requerido',
        'string.min': 'El nombre debe tener al menos 2 caracteres',
        'string.max': 'El nombre no puede exceder 100 caracteres'
      }),
    password: Joi.string().min(6).max(50).required()
      .messages({
        'string.empty': 'La contraseña es requerida',
        'string.min': 'La contraseña debe tener al menos 6 caracteres',
        'string.max': 'La contraseña no puede exceder 50 caracteres'
      }),
    rol: Joi.string().valid('ADMIN', 'MODERADO').default('MODERADO')
  }),
  
  update: Joi.object({
    nombre: Joi.string().min(2).max(100).optional(),
    password: Joi.string().min(6).max(50).optional(),
    rol: Joi.string().valid('ADMIN', 'MODERADO').optional(),
    activo: Joi.boolean().optional()
  }),
  
  login: Joi.object({
    nombre: Joi.string().required()
      .messages({
        'string.empty': 'El nombre de usuario es requerido'
      }),
    password: Joi.string().required()
      .messages({
        'string.empty': 'La contraseña es requerida'
      })
  })
};

// Validaciones para Proveedor
export const providerSchemas = {
  create: Joi.object({
    nombreCompleto: Joi.string().trim().min(3).max(100)
      .pattern(/^[a-zA-ZÀ-ÿ\u00f1\u00d1\s'.]+$/)
      .required()
      .messages({
        'string.empty': 'El nombre completo es requerido',
        'string.min': 'El nombre debe tener al menos 3 caracteres',
        'string.max': 'El nombre no puede exceder 100 caracteres',
        'string.pattern.base': 'El nombre solo debe contener letras y espacios (sin números ni símbolos)'
      }),
    ci: Joi.string().trim().min(5).max(20)
      .pattern(/^[0-9a-zA-Z\-]+$/)
      .required()
      .messages({
        'string.empty': 'La cédula de identidad (CI / NIT) es requerida',
        'string.min': 'La CI debe tener al menos 5 caracteres',
        'string.max': 'La CI no puede exceder 20 caracteres',
        'string.pattern.base': 'La CI solo debe contener números, letras y guión (ej: 1234567 o 1234567-1A)'
      }),
    telefono: Joi.string().trim().min(7).max(15)
      .pattern(/^[0-9+\s\-]+$/)
      .optional().allow('', null)
      .messages({
        'string.min': 'El teléfono debe tener al menos 7 dígitos',
        'string.max': 'El teléfono no puede exceder 15 dígitos',
        'string.pattern.base': 'El teléfono solo debe contener números y signos válidos (+, -)'
      }),
    direccion: Joi.string().trim().max(300).optional().allow('', null)
      .messages({
        'string.max': 'La dirección no puede exceder 300 caracteres'
      }),
    tipo: Joi.string().valid('EMPRESA', 'PERSONA_NATURAL').default('PERSONA_NATURAL')
      .messages({
        'any.only': 'El tipo de proveedor debe ser PERSONA_NATURAL o EMPRESA'
      })
  }),
  
  update: Joi.object({
    nombreCompleto: Joi.string().trim().min(3).max(100)
      .pattern(/^[a-zA-ZÀ-ÿ\u00f1\u00d1\s'.]+$/)
      .optional()
      .messages({
        'string.empty': 'El nombre completo no puede estar vacío',
        'string.min': 'El nombre debe tener al menos 3 caracteres',
        'string.max': 'El nombre no puede exceder 100 caracteres',
        'string.pattern.base': 'El nombre solo debe contener letras y espacios (sin números ni símbolos)'
      }),
    ci: Joi.string().trim().min(5).max(20)
      .pattern(/^[0-9a-zA-Z\-]+$/)
      .optional()
      .messages({
        'string.empty': 'La CI no puede estar vacía',
        'string.min': 'La CI debe tener al menos 5 caracteres',
        'string.max': 'La CI no puede exceder 20 caracteres',
        'string.pattern.base': 'La CI solo debe contener números, letras y guión (ej: 1234567 o 1234567-1A)'
      }),
    telefono: Joi.string().trim().min(7).max(15)
      .pattern(/^[0-9+\s\-]+$/)
      .optional().allow('', null)
      .messages({
        'string.min': 'El teléfono debe tener al menos 7 dígitos',
        'string.max': 'El teléfono no puede exceder 15 dígitos',
        'string.pattern.base': 'El teléfono solo debe contener números y signos válidos (+, -)'
      }),
    direccion: Joi.string().trim().max(300).optional().allow('', null)
      .messages({
        'string.max': 'La dirección no puede exceder 300 caracteres'
      }),
    tipo: Joi.string().valid('EMPRESA', 'PERSONA_NATURAL').optional()
      .messages({
        'any.only': 'El tipo de proveedor debe ser PERSONA_NATURAL o EMPRESA'
      }),
    activo: Joi.boolean().optional()
  })
};

// Validaciones para Internación
export const internacionSchemas = {
  create: Joi.object({
    lote: Joi.string().trim().min(1).max(50).required()
      .messages({
        'string.empty': 'El número de lote es obligatorio',
        'string.min': 'El número de lote debe tener al menos 1 caracter',
        'string.max': 'El número de lote no puede exceder 50 caracteres',
        'any.required': 'El número de lote es obligatorio'
      }),
    proveedorId: Joi.number().integer().positive().required()
      .messages({
        'number.base': 'Debes seleccionar un proveedor válido',
        'number.positive': 'El ID del proveedor debe ser positivo',
        'any.required': 'El proveedor es obligatorio'
      }),
    tipoMineral: Joi.string().valid('PLATA', 'PLOMO', 'COMPLEJO').required()
      .messages({
        'any.only': 'El tipo de mineral debe ser PLATA, PLOMO o COMPLEJO',
        'any.required': 'El tipo de mineral es obligatorio'
      }),
    kilosBruto: Joi.number().positive().precision(3).required()
      .messages({
        'number.base': 'Los kilos bruto deben ser un número válido',
        'number.positive': 'Los kilos bruto deben ser mayores a cero (0)',
        'number.precision': 'Los kilos bruto permiten hasta 3 decimales',
        'any.required': 'Los kilos bruto son obligatorios'
      }),
    anticipo: Joi.number().min(0).precision(2).default(0)
      .messages({
        'number.base': 'El anticipo debe ser un número válido',
        'number.min': 'El anticipo no puede ser negativo',
        'number.precision': 'El anticipo permite hasta 2 decimales'
      })
  }),
  
  update: Joi.object({
    lote: Joi.string().trim().min(1).max(50).optional()
      .messages({
        'string.empty': 'El número de lote no puede estar vacío',
        'string.min': 'El número de lote debe tener al menos 1 caracter',
        'string.max': 'El número de lote no puede exceder 50 caracteres'
      }),
    proveedorId: Joi.number().integer().positive().optional()
      .messages({
        'number.base': 'Debes seleccionar un proveedor válido',
        'number.positive': 'El ID del proveedor debe ser positivo'
      }),
    tipoMineral: Joi.string().valid('PLATA', 'PLOMO', 'COMPLEJO').optional()
      .messages({
        'any.only': 'El tipo de mineral debe ser PLATA, PLOMO o COMPLEJO'
      }),
    kilosBruto: Joi.number().positive().precision(3).optional()
      .messages({
        'number.base': 'Los kilos bruto deben ser un número válido',
        'number.positive': 'Los kilos bruto deben ser mayores a cero (0)',
        'number.precision': 'Los kilos bruto permiten hasta 3 decimales'
      }),
    anticipo: Joi.number().min(0).precision(2).optional()
      .messages({
        'number.base': 'El anticipo debe ser un número válido',
        'number.min': 'El anticipo no puede ser negativo',
        'number.precision': 'El anticipo permite hasta 2 decimales'
      }),
    estado: Joi.string().valid('EN_ESPERA_LEY', 'CALCULADO', 'PAGADO').optional()
      .messages({
        'any.only': 'El estado debe ser EN_ESPERA_LEY, CALCULADO o PAGADO'
      })
  }).unknown(true)
};

// Validaciones para Cálculo
export const calculoSchemas = {
  create: Joi.object({
    internacionId: Joi.number().integer().positive().required(),
    tipoMineral: Joi.string().valid('PLATA', 'PLOMO', 'COMPLEJO').required(),
    
    // Para mineral simple (PLATA o PLOMO)
    ley: Joi.number().positive().precision(3).when('tipoMineral', {
      is: Joi.string().valid('PLATA', 'PLOMO'),
      then: Joi.required(),
      otherwise: Joi.forbidden()
    }),
    valorEscala: Joi.number().positive().precision(2).when('tipoMineral', {
      is: Joi.string().valid('PLATA', 'PLOMO'),
      then: Joi.required(),
      otherwise: Joi.forbidden()
    }),
    
    // Para mineral complejo
    leyPlata: Joi.number().positive().precision(3).when('tipoMineral', {
      is: 'COMPLEJO',
      then: Joi.required(),
      otherwise: Joi.forbidden()
    }),
    valorEscalaPlata: Joi.number().positive().precision(2).when('tipoMineral', {
      is: 'COMPLEJO',
      then: Joi.required(),
      otherwise: Joi.forbidden()
    }),
    leyPlomo: Joi.number().positive().precision(3).when('tipoMineral', {
      is: 'COMPLEJO',
      then: Joi.required(),
      otherwise: Joi.forbidden()
    }),
    valorEscalaPlomo: Joi.number().positive().precision(2).when('tipoMineral', {
      is: 'COMPLEJO',
      then: Joi.required(),
      otherwise: Joi.forbidden()
    }),
    
    // Campos comunes
    humedadPorcentaje: Joi.number().min(0).max(100).precision(2).required()
      .messages({
        'number.min': 'La humedad no puede ser negativa',
        'number.max': 'La humedad no puede exceder 100%'
      }),
    regaliasPorcentaje: Joi.number().min(0).max(100).precision(2).default(10),
    transporte: Joi.number().min(0).precision(2).default(0),
    anticipos: Joi.number().min(0).precision(2).optional(),
    anticipoBascula: Joi.number().min(0).precision(2).optional(),
    anticipoProveedor: Joi.number().min(0).precision(2).optional(),
    anticiposDescontar: Joi.array().items(
      Joi.object({
        anticipoId: Joi.number().integer().positive().required(),
        montoADescontar: Joi.number().positive().precision(2).required()
      })
    ).optional()
  })
};

// Validaciones para Anticipos
export const anticipoSchemas = {
  create: Joi.object({
    proveedorId: Joi.number().integer().positive().required()
      .messages({
        'any.required': 'El proveedor es obligatorio',
        'number.base': 'El ID de proveedor debe ser un número entero'
      }),
    internacionId: Joi.number().integer().positive().optional().allow(null),
    monto: Joi.number().positive().precision(2).required()
      .messages({
        'any.required': 'El monto del anticipo es obligatorio',
        'number.base': 'El monto debe ser un número válido',
        'number.positive': 'El monto debe ser mayor a 0'
      }),
    fecha: Joi.string().isoDate().optional().allow('', null),
    glosa: Joi.string().max(255).allow('', null).optional(),
    observacion: Joi.string().allow('', null).optional()
  })
};

// Función helper para validar datos
export const validateData = (schema, data) => {
  const { error, value } = schema.validate(data, { abortEarly: false });
  
  if (error) {
    const validationError = new Error('Validation failed');
    validationError.isJoi = true;
    validationError.details = error.details;
    throw validationError;
  }
  
  return value;
};