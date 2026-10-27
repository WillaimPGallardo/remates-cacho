// Validaciones compartidas según los parámetros PG del documento.
const P = require('../config/parametros');

const texto = v => (typeof v === 'string' ? v.trim() : '');
const vacio = v => v === undefined || v === null || texto(String(v)) === '';

const reglas = {
  nombreCompleto: v => (/^[A-Za-zÁÉÍÓÚÜÑáéíóúüñ' ]{2,100}$/.test(texto(v)) ? null : 'Use de 2 a 100 letras y espacios'),
  nombreUsuario: v => (/^[a-z0-9._]{4,30}$/.test(texto(v)) ? null : 'De 4 a 30 caracteres: minúsculas, números, punto o guion bajo'),
  correo: v => (/^[^@\s]+@[^@\s]+\.[^@\s]+$/.test(texto(v)) && texto(v).length <= 100 ? null : 'Correo no válido (ejemplo: nombre@dominio.com)'),
  sku: v => (/^[A-Z0-9-]{3,20}$/.test(texto(v)) ? null : 'De 3 a 20 caracteres: mayúsculas, números o guion'),
  precio: v => {
    const s = String(v ?? '').trim();
    if (!/^\d{1,10}(\.\d{1,2})?$/.test(s)) return 'Ingrese un número con hasta 2 decimales';
    return Number(s) > 0 ? null : 'Debe ser mayor que cero';
  },
  entero: (min, max) => v => {
    const s = String(v ?? '').trim();
    if (!/^-?\d+$/.test(s)) return 'Ingrese un número entero';
    const n = Number(s);
    return n >= min && n <= max ? null : `Debe estar entre ${min} y ${max.toLocaleString('es')}`;
  },
  motivo: v => (texto(v).length >= 10 && texto(v).length <= 255 ? null : 'Escriba entre 10 y 255 caracteres'),
};

// Política de contraseña PG-03: devuelve la lista de requisitos incumplidos
function requisitosContrasena(clave, nombreUsuario) {
  const c = String(clave || '');
  const fallas = [];
  if (c.length < 8) fallas.push('Mínimo 8 caracteres');
  if (!/[A-Z]/.test(c) || !/[a-z]/.test(c)) fallas.push('Al menos una mayúscula y una minúscula');
  if (!/[0-9]/.test(c)) fallas.push('Al menos un número');
  if (nombreUsuario && c.toLowerCase() === String(nombreUsuario).toLowerCase()) fallas.push('Distinta del nombre de usuario');
  return fallas;
}

// Aplica un esquema {campo: [obligatorio, regla]} y devuelve {campo: mensaje}
function validar(datos, esquema) {
  const errores = {};
  for (const [campo, [obligatorio, regla]] of Object.entries(esquema)) {
    const v = datos[campo];
    if (vacio(v)) { if (obligatorio) errores[campo] = 'Campo obligatorio'; continue; }
    const m = regla ? regla(v) : null;
    if (m) errores[campo] = m;
  }
  return errores;
}

// Rango de fechas PG-14: desde ≤ hasta, sin fechas futuras, máximo 12 meses
function rangoFechas(desde, hasta) {
  const hoy = new Date(); hoy.setHours(23, 59, 59, 999);
  const h = hasta ? new Date(hasta + 'T23:59:59') : hoy;
  const d = desde ? new Date(desde + 'T00:00:00') : new Date(h.getTime() - P.DIAS_RANGO_DEFECTO * 86400000);
  if (isNaN(d) || isNaN(h)) return { error: 'Fecha no válida' };
  if (d > h) return { error: 'La fecha inicial no puede ser mayor que la final' };
  if (h > hoy) return { error: 'No se permiten fechas futuras' };
  const limite = new Date(h); limite.setMonth(limite.getMonth() - P.MESES_RANGO_MAXIMO);
  if (d < limite) return { error: 'El rango máximo es de 12 meses' };
  return { desde: d, hasta: h };
}

module.exports = { reglas, validar, requisitosContrasena, rangoFechas, texto, vacio };
