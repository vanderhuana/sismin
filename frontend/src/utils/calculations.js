/**
 * Réplica de la lógica de cálculo del backend para vista previa en frontend
 * Todo con números enteros, sin decimales ni redondeo (truncado directo a entero)
 */
export function calcularPagoPreview({
  kilosBruto,
  humedadPorcentaje,
  tipoMineral,
  ley,
  valorEscala,
  leyPlata,
  valorEscalaPlata,
  leyPlomo,
  valorEscalaPlomo,
  regaliasPorcentaje = 10,
  anticipos = 0,
  transporte = 0
}) {
  const bruto = Math.trunc(Number(kilosBruto) || 0);
  const humedad = Number(humedadPorcentaje) || 0;
  const regalias = Number(regaliasPorcentaje) || 0;
  const anticipo = Math.trunc(Number(anticipos) || 0);
  const transp = Math.trunc(Number(transporte) || 0);

  // Kilos neto = Kilos Bruto - (Kilos Bruto × Humedad / 100), truncado a entero sin redondeo
  // Ejemplo: 150 kg con 3% de humedad = 150 - 4.5 = 145.5 -> 145 kg
  const netoExacto = bruto - (bruto * humedad) / 100;
  const kilosNeto = Math.trunc(netoExacto);

  // Valor escala según mineral (entero)
  let valorEscalaTotal = 0;
  if (tipoMineral === 'COMPLEJO') {
    valorEscalaTotal = Math.trunc(
      (Number(valorEscalaPlata) || 0) + (Number(valorEscalaPlomo) || 0)
    );
  } else {
    valorEscalaTotal = Math.trunc(Number(valorEscala) || 0);
  }

  // Valor bruto (entero)
  const valorBruto = Math.trunc(kilosNeto * valorEscalaTotal);

  // Regalías (truncado a entero sin redondeo)
  const regaliasMonto = Math.trunc((valorBruto * regalias) / 100);

  // Saldo final (entero)
  const saldoFinal = Math.trunc(valorBruto - regaliasMonto - anticipo + transp);

  return {
    kilosNeto,
    valorEscalaTotal,
    valorBruto,
    regaliasMonto,
    saldoFinal
  };
}

export const formatBs = (n) =>
  Number(Math.trunc(n) || 0).toLocaleString('es-BO', {
    style: 'currency',
    currency: 'BOB',
    minimumFractionDigits: 0,
    maximumFractionDigits: 0
  });

export const formatKg = (n) =>
  `${Number(Math.trunc(n) || 0).toLocaleString('es-BO', {
    minimumFractionDigits: 0,
    maximumFractionDigits: 0
  })} kg`;
