/**
 * Convierte un número en su representación literal en Bolivianos
 * Ejemplo: 15420 -> "QUINCE MIL CUATROCIENTOS VEINTE 00/100 BOLIVIANOS"
 */
function unidades(num) {
  switch (num) {
    case 1: return 'UN';
    case 2: return 'DOS';
    case 3: return 'TRES';
    case 4: return 'CUATRO';
    case 5: return 'CINCO';
    case 6: return 'SEIS';
    case 7: return 'SIETE';
    case 8: return 'OCHO';
    case 9: return 'NUEVE';
    default: return '';
  }
}

function decenasY(strSin, numUnidades) {
  if (numUnidades > 0) return `${strSin} Y ${unidades(numUnidades)}`;
  return strSin;
}

function decenas(num) {
  const dec = Math.floor(num / 10);
  const uni = num - (dec * 10);

  switch (dec) {
    case 1:
      switch (uni) {
        case 0: return 'DIEZ';
        case 1: return 'ONCE';
        case 2: return 'DOCE';
        case 3: return 'TRECE';
        case 4: return 'CATORCE';
        case 5: return 'QUINCE';
        default: return `DIECI${unidades(uni)}`;
      }
    case 2:
      if (uni === 0) return 'VEINTE';
      return `VEINTI${unidades(uni)}`;
    case 3: return decenasY('TREINTA', uni);
    case 4: return decenasY('CUARENTA', uni);
    case 5: return decenasY('CINCUENTA', uni);
    case 6: return decenasY('SESENTA', uni);
    case 7: return decenasY('SETENTA', uni);
    case 8: return decenasY('OCHENTA', uni);
    case 9: return decenasY('NOVENTA', uni);
    case 0: return unidades(uni);
    default: return '';
  }
}

function centenas(num) {
  const cen = Math.floor(num / 100);
  const dec = num - (cen * 100);

  switch (cen) {
    case 1:
      if (dec > 0) return `CIENTO ${decenas(dec)}`;
      return 'CIEN';
    case 2: return `DOSCIENTOS ${decenas(dec)}`;
    case 3: return `TRESCIENTOS ${decenas(dec)}`;
    case 4: return `CUATROCIENTOS ${decenas(dec)}`;
    case 5: return `QUINIENTOS ${decenas(dec)}`;
    case 6: return `SEISCIENTOS ${decenas(dec)}`;
    case 7: return `SETECIENTOS ${decenas(dec)}`;
    case 8: return `OCHOCIENTOS ${decenas(dec)}`;
    case 9: return `NOVECIENTOS ${decenas(dec)}`;
    default: return decenas(dec);
  }
}

function seccion(num, divisor, strSingular, strPlural) {
  const cientos = Math.floor(num / divisor);
  const resto = num - (cientos * divisor);
  let letras = '';

  if (cientos > 0) {
    if (cientos > 1) {
      letras = `${centenas(cientos)} ${strPlural}`;
    } else {
      letras = strSingular;
    }
  }

  if (resto > 0) {
    letras += '';
  }

  return { letras, resto };
}

function miles(num) {
  const divisor = 1000;
  const cientos = Math.floor(num / divisor);
  const resto = num - (cientos * divisor);

  const strMiles = seccion(num, divisor, 'UN MIL', 'MIL');
  const strCentenas = centenas(resto);

  if (strMiles.letras === '') return strCentenas;
  return `${strMiles.letras} ${strCentenas}`.trim();
}

function millones(num) {
  const divisor = 1000000;
  const strMillones = seccion(num, divisor, 'UN MILLON', 'MILLONES');
  const strMiles = miles(num % divisor);

  if (strMillones.letras === '') return strMiles;
  return `${strMillones.letras} ${strMiles}`.trim();
}

export function numeroALetras(monto) {
  const valor = Math.abs(Number(monto) || 0);
  const entero = Math.floor(valor);
  const centavos = Math.round((valor - entero) * 100);
  const strCentavos = `${centavos.toString().padStart(2, '0')}/100`;

  if (entero === 0) {
    return `CERO ${strCentavos} BOLIVIANOS`;
  }

  const strLetras = millones(entero).replace(/\s+/g, ' ').trim();
  return `${strLetras} ${strCentavos} BOLIVIANOS`;
}
