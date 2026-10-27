// Error de aplicación con código HTTP y mensaje para el usuario.
class AppError extends Error {
  constructor(status, codigo, mensaje, campos) {
    super(mensaje);
    this.status = status;
    this.codigo = codigo;
    this.campos = campos;   // { campo: mensaje }
  }
}
const validacion = campos => new AppError(400, 'VALIDACION', 'Revise los datos ingresados', campos);
const noEncontrado = msg => new AppError(404, 'NO_ENCONTRADO', msg);
const conflicto = (msg, campos) => new AppError(409, 'CONFLICTO', msg, campos);
const prohibido = (msg = 'No tiene permiso para realizar esta operación') => new AppError(403, 'SIN_PERMISO', msg);
const noAutenticado = (msg = 'Su sesión expiró. Inicie sesión de nuevo') => new AppError(401, 'NO_AUTENTICADO', msg);

// Middleware final: respuesta uniforme {codigo, mensaje, campos}
function manejadorErrores(err, req, res, _next) {
  if (err instanceof AppError) {
    return res.status(err.status).json({ codigo: err.codigo, mensaje: err.message, campos: err.campos || {} });
  }
  // Restricciones de PostgreSQL que llegan como respaldo de las validaciones de la aplicación
  if (err && err.code === '23505') return res.status(409).json({ codigo: 'CONFLICTO', mensaje: 'El registro ya existe', campos: {} });
  if (err && (err.code === '23514' || err.code === '23502')) return res.status(400).json({ codigo: 'VALIDACION', mensaje: 'Los datos no cumplen las reglas de integridad', campos: {} });
  console.error(err);
  return res.status(500).json({ codigo: 'ERROR_INTERNO', mensaje: 'Ocurrió un error inesperado. Intente de nuevo', campos: {} });
}

module.exports = { AppError, validacion, noEncontrado, conflicto, prohibido, noAutenticado, manejadorErrores };
