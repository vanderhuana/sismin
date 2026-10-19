/**
 * Calcula el pago para un mineral basado en los datos de entrada
 * Todo con números enteros, sin decimales ni redondeo (truncado directo a entero)
 * @param {Object} params - Parámetros de cálculo
 * @returns {Object} - Resultado del cálculo con números enteros
 */
export function calcularPago(params) {
  const {
    kilosBruto,
    humedadPorcentaje,
    tipoMineral,
    // Para mineral simple
    ley,
    valorEscala,
    // Para complejo
    leyPlata,
    valorEscalaPlata,
    leyPlomo,
    valorEscalaPlomo,
    // Descuentos y ajustes
    regaliasPorcentaje = 10,
    anticipos = 0,
    transporte = 0
  } = params;

  // 1. Kilos bruto y parámetros truncados a enteros
  const bruto = Math.trunc(Number(kilosBruto) || 0);
  const humedad = Number(humedadPorcentaje) || 0;
  const regalias = Number(regaliasPorcentaje) || 0;
  const anticipo = Math.trunc(Number(anticipos) || 0);
  const transp = Math.trunc(Number(transporte) || 0);

  // Kilos neto = Kilos Bruto - (Kilos Bruto × Humedad / 100), truncado a entero sin redondeo
  // Ejemplo: 150 kg con 3% de humedad = 150 - 4.5 = 145.5 -> 145 kg
  const kilosNeto = calcularKilosNeto(kilosBruto, humedadPorcentaje);
  
  // 2. Determinar valor de escala según tipo de mineral (entero sin decimales)
  let valorEscalaTotal = 0;
  if (tipoMineral === 'COMPLEJO') {
    valorEscalaTotal = Math.trunc(
      (Number(params.valorEscalaPlata) || 0) + (Number(params.valorEscalaPlomo) || 0)
    );
  } else {
    valorEscalaTotal = Math.trunc(Number(params.valorEscala) || 0);
  }
  
  // 3. Calcular valor bruto (entero)
  const valorBruto = Math.trunc(kilosNeto * valorEscalaTotal);
  
  // 4. Calcular regalías (sin redondeo, truncado directo a entero)
  const regaliasMonto = Math.trunc((valorBruto * regalias) / 100);
  
  // 5. Calcular saldo final (entero, sin decimales ni redondeo)
  const saldoFinal = Math.trunc(valorBruto - regaliasMonto - anticipo + transp);
  
  return {
    kilosNeto,
    valorEscalaTotal,
    valorBruto,
    regaliasMonto,
    saldoFinal
  };
}

/**
 * Calcula kilos neto descontando humedad (sin decimales ni redondeo)
 * Kilos Neto = trunc(Kilos Bruto - (Kilos Bruto * Humedad / 100))
 * @param {number} kilosBruto 
 * @param {number} humedadPorcentaje 
 * @returns {number}
 */
export function calcularKilosNeto(kilosBruto, humedadPorcentaje) {
  const bruto = Math.trunc(Number(kilosBruto) || 0);
  const humedad = Number(humedadPorcentaje) || 0;
  const netoExacto = bruto - (bruto * humedad) / 100;
  return Math.trunc(netoExacto);
}

/**
 * Genera el número de lote automático
 * @param {number} ultimoId - Último ID de internación
 * @returns {string} - Número de lote formato LOTE-001
 */
export function generarLote(ultimoId = 0) {
  const numero = (ultimoId + 1).toString().padStart(3, '0');
  return `LOTE-${numero}`;
}

/**
 * Valida que los datos de cálculo sean consistentes con el tipo de mineral
 * @param {string} tipoMineral 
 * @param {Object} datos 
 * @returns {boolean}
 */
export function validarDatosCalculo(tipoMineral, datos) {
  if (tipoMineral === 'COMPLEJO') {
    return !!(datos.leyPlata && datos.valorEscalaPlata && 
             datos.leyPlomo && datos.valorEscalaPlomo);
  } else {
    return !!(datos.ley && datos.valorEscala);
  }
}

/**
 * Formatea un número como moneda boliviana entera (sin decimales)
 * @param {number} valor 
 * @returns {string}
 */
export function formatearMoneda(valor) {
  return new Intl.NumberFormat('es-BO', {
    style: 'currency',
    currency: 'BOB',
    minimumFractionDigits: 0,
    maximumFractionDigits: 0
  }).format(Math.trunc(valor || 0));
}

/**
 * Formatea peso en kilogramos enteros (sin decimales)
 * @param {number} kilos 
 * @returns {string}
 */
export function formatearPeso(kilos) {
  return `${new Intl.NumberFormat('es-BO', {
    minimumFractionDigits: 0,
    maximumFractionDigits: 0
  }).format(Math.trunc(kilos || 0))} kg`;
}

/**
 * Formatea porcentaje entero
 * @param {number} porcentaje 
 * @returns {string}
 */
export function formatearPorcentaje(porcentaje) {
  return `${Math.trunc(porcentaje || 0)}%`;
}