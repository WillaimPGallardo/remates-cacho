// Validación de códigos de barras (PG-07, RF-04)
function digitoControlGS1(cuerpo) {
  // Pesos 3 y 1 alternados desde la derecha del cuerpo
  let suma = 0;
  for (let i = cuerpo.length - 1, peso = 3; i >= 0; i--, peso = peso === 3 ? 1 : 3) suma += Number(cuerpo[i]) * peso;
  return (10 - (suma % 10)) % 10;
}

function validarCodigo(tipo, valor) {
  const v = String(valor || '').trim();
  switch (tipo) {
    case 'EAN_13':
      if (!/^\d{13}$/.test(v)) return 'El código no cumple el formato EAN-13 (13 dígitos)';
      return digitoControlGS1(v.slice(0, 12)) === Number(v[12]) ? null : 'El dígito de control no es válido';
    case 'UPC_A':
      if (!/^\d{12}$/.test(v)) return 'El código no cumple el formato UPC-A (12 dígitos)';
      return digitoControlGS1(v.slice(0, 11)) === Number(v[11]) ? null : 'El dígito de control no es válido';
    case 'CODE_128':
      return /^[\x20-\x7E]{1,48}$/.test(v) ? null : 'El código no cumple el formato Code 128 (1 a 48 caracteres imprimibles)';
    default:
      return 'Tipo de código no válido';
  }
}

const formatoInterno = n => 'RC' + String(n).padStart(8, '0');

module.exports = { validarCodigo, digitoControlGS1, formatoInterno };
