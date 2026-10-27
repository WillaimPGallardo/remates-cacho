// RF-01 · Autenticación (CU-001). Sigue el diagrama de actividades de RF-01.
const crypto = require('crypto');
const bcrypt = require('bcryptjs');
const P = require('../../config/parametros');
const repo = require('./auth.repositorio');
const { enTransaccion } = require('../../comun/transaccion');
const { registrar } = require('../../comun/auditoria');
const { hashToken } = require('../../comun/seguridad');
const { AppError, validacion } = require('../../comun/errores');
const { requisitosContrasena, vacio } = require('../../comun/validaciones');

const MSG_INVALIDAS = 'Usuario o contraseña incorrectos';
const horaCorta = d => new Date(d).toLocaleTimeString('es-VE', { hour: '2-digit', minute: '2-digit' });

async function iniciarSesion({ usuario, contrasena }, ctx) {
  // Paso 4: campos obligatorios, sin consultar la base de datos
  if (vacio(usuario) || vacio(contrasena)) {
    throw validacion({ ...(vacio(usuario) && { usuario: 'Campo obligatorio' }), ...(vacio(contrasena) && { contrasena: 'Campo obligatorio' }) });
  }
  // Cada intento queda registrado aunque falle: por eso se confirma la transacción y el error se lanza después
  const res = await enTransaccion(async db => {
    const aud = { modulo: 'Seguridad', ip: ctx.ip, dispositivo: ctx.dispositivo };
    const u = await repo.buscarPorUsuarioOCorreo(db, usuario.trim());
    if (!u) {
      await registrar(db, { ...aud, tipo: 'INICIO_SESION_FALLIDO', entidad: 'usuario', idEntidad: usuario.slice(0, 50), resultado: 'FALLIDO', codigoError: 'NO_EXISTE' });
      return { error: new AppError(401, 'CREDENCIALES', MSG_INVALIDAS) };
    }
    aud.idUsuario = u.id_usuario;
    if (u.estado !== 'ACTIVO') {
      await registrar(db, { ...aud, tipo: 'ACCESO_DENEGADO', entidad: 'usuario', idEntidad: u.id_usuario, resultado: 'DENEGADO', codigoError: 'INACTIVO' });
      return { error: new AppError(403, 'CUENTA_INACTIVA', 'Cuenta inactiva. Comuníquese con la Gerencia') };
    }
    let intentos = u.intentos_fallidos;
    if (u.bloqueado_hasta && new Date(u.bloqueado_hasta) > new Date()) {
      return { error: new AppError(423, 'CUENTA_BLOQUEADA', `Cuenta bloqueada temporalmente. Intente de nuevo a las ${horaCorta(u.bloqueado_hasta)}`) };
    }
    if (u.bloqueado_hasta) intentos = 0;   // el bloqueo venció: se levanta y se reinicia el contador
    const ok = await bcrypt.compare(contrasena, u.contrasena_hash);
    if (!ok) {
      intentos += 1;
      if (intentos >= P.INTENTOS_MAXIMOS) {
        const hasta = new Date(Date.now() + P.MINUTOS_BLOQUEO * 60000);
        await repo.actualizarIntentos(db, u.id_usuario, intentos, hasta);
        await registrar(db, { ...aud, tipo: 'BLOQUEO_CUENTA', entidad: 'usuario', idEntidad: u.id_usuario, anterior: { intentos: intentos - 1 }, nuevo: { bloqueado_hasta: hasta }, resultado: 'EXITOSO' });
        return { error: new AppError(423, 'CUENTA_BLOQUEADA', `Cuenta bloqueada temporalmente por ${P.INTENTOS_MAXIMOS} intentos fallidos. Intente de nuevo a las ${horaCorta(hasta)}`) };
      }
      await repo.actualizarIntentos(db, u.id_usuario, intentos, null);
      await registrar(db, { ...aud, tipo: 'INICIO_SESION_FALLIDO', entidad: 'usuario', idEntidad: u.id_usuario, nuevo: { intentos }, resultado: 'FALLIDO', codigoError: 'CONTRASENA' });
      const quedan = P.INTENTOS_MAXIMOS - intentos;
      return { error: new AppError(401, 'CREDENCIALES', `${MSG_INVALIDAS}. Le ${quedan === 1 ? 'queda 1 intento' : `quedan ${quedan} intentos`}`) };
    }
    if (u.requiere_cambio_contrasena && u.contrasena_temporal_expira && new Date(u.contrasena_temporal_expira) < new Date()) {
      await registrar(db, { ...aud, tipo: 'ACCESO_DENEGADO', entidad: 'usuario', idEntidad: u.id_usuario, resultado: 'DENEGADO', codigoError: 'TEMPORAL_VENCIDA' });
      return { error: new AppError(403, 'TEMPORAL_VENCIDA', 'La contraseña temporal venció. Solicite un nuevo restablecimiento a la Gerencia') };
    }
    await repo.actualizarIntentos(db, u.id_usuario, 0, null);
    const token = crypto.randomBytes(32).toString('hex');
    await repo.crearSesion(db, u.id_usuario, hashToken(token), ctx.ip, ctx.dispositivo);
    await registrar(db, { ...aud, tipo: 'INICIO_SESION', entidad: 'usuario', idEntidad: u.id_usuario, resultado: 'EXITOSO' });
    return { token, usuario: { id: u.id_usuario, nombre: u.nombre_completo, usuario: u.nombre_usuario, rol: u.rol, requiereCambio: u.requiere_cambio_contrasena } };
  });
  if (res.error) throw res.error;
  return res;
}

async function cambiarContrasena(idUsuario, { actual, nueva, confirmacion }, ctx) {
  const errores = {};
  if (vacio(actual)) errores.actual = 'Campo obligatorio';
  const u = await repo.obtenerHash(require('../../config/db').pool, idUsuario);
  const fallas = requisitosContrasena(nueva, u.nombre_usuario);
  if (vacio(nueva)) errores.nueva = 'Campo obligatorio';
  else if (fallas.length) errores.nueva = 'La contraseña no cumple los requisitos: ' + fallas.join(', ');
  else if (nueva === actual) errores.nueva = 'Debe ser diferente de la contraseña actual';
  if (nueva !== confirmacion) errores.confirmacion = 'Las contraseñas no coinciden';
  if (Object.keys(errores).length) throw validacion(errores);
  if (!(await bcrypt.compare(actual, u.contrasena_hash))) throw validacion({ actual: 'La contraseña actual no es correcta' });
  const hash = await bcrypt.hash(nueva, P.BCRYPT_COSTO);
  await enTransaccion(async db => {
    await repo.guardarContrasena(db, idUsuario, hash);
    await registrar(db, { idUsuario, modulo: 'Seguridad', tipo: 'CAMBIO_CONTRASENA', entidad: 'usuario', idEntidad: idUsuario, ip: ctx.ip, dispositivo: ctx.dispositivo });
  });
}

async function cerrarSesion(token, ctx) {
  await enTransaccion(async db => {
    await repo.cerrarSesion(db, hashToken(token));
    await registrar(db, { idUsuario: ctx.idUsuario, modulo: 'Seguridad', tipo: 'CIERRE_SESION', ip: ctx.ip, dispositivo: ctx.dispositivo });
  });
}

module.exports = { iniciarSesion, cambiarContrasena, cerrarSesion };
