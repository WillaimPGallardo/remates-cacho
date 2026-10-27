// RF-02 · Gestión de usuarios (CU-002, subflujos A a D)
const crypto = require('crypto');
const bcrypt = require('bcryptjs');
const P = require('../../config/parametros');
const repo = require('./usuarios.repositorio');
const authRepo = require('../auth/auth.repositorio');
const { pool } = require('../../config/db');
const { enTransaccion } = require('../../comun/transaccion');
const { registrar } = require('../../comun/auditoria');
const { validar, reglas, requisitosContrasena, texto } = require('../../comun/validaciones');
const { validacion, noEncontrado, conflicto } = require('../../comun/errores');

const ROLES = ['GERENCIA', 'CAJERO', 'BODEGUERO'];
const reglaRol = v => (ROLES.includes(v) ? null : 'Seleccione un rol válido');
const publico = u => u && ({ ...u, id_rol: undefined });

const listar = filtros => repo.listar(pool, filtros);
async function obtener(id) { const u = await repo.obtener(pool, id); if (!u) throw noEncontrado('El usuario no existe'); return publico(u); }

// Subflujo A. Crear
async function crear(datos, ctx) {
  const d = { nombre_completo: texto(datos.nombre_completo), nombre_usuario: texto(datos.nombre_usuario), correo: texto(datos.correo), rol: datos.rol };
  const errores = validar({ ...d, contrasena: datos.contrasena }, {
    nombre_completo: [true, reglas.nombreCompleto], nombre_usuario: [true, reglas.nombreUsuario], correo: [true, reglas.correo], rol: [true, reglaRol], contrasena: [true, null] });
  if (datos.contrasena) {
    const f = requisitosContrasena(datos.contrasena, d.nombre_usuario);
    if (f.length) errores.contrasena = 'La contraseña no cumple los requisitos: ' + f.join(', ');
  }
  if (datos.contrasena !== datos.confirmacion) errores.confirmacion = 'Las contraseñas no coinciden';
  if (Object.keys(errores).length) throw validacion(errores);
  const hash = await bcrypt.hash(datos.contrasena, P.BCRYPT_COSTO);
  return enTransaccion(async db => {
    const dup = {};
    if (await repo.existeUsuario(db, d.nombre_usuario)) dup.nombre_usuario = 'El nombre de usuario ya se encuentra registrado';
    if (await repo.existeCorreo(db, d.correo)) dup.correo = 'El correo ya se encuentra registrado';
    if (Object.keys(dup).length) throw conflicto('Datos duplicados', dup);
    const id = await repo.crear(db, { ...d, id_rol: await repo.idRol(db, d.rol), hash });
    await registrar(db, { ...ctx, modulo: 'Usuarios', tipo: 'GESTION_USUARIO', entidad: 'usuario', idEntidad: id, nuevo: { accion: 'CREAR', ...d } });
    return publico(await repo.obtener(db, id));
  });
}

// Subflujo B. Modificar (el nombre de usuario no se modifica)
async function modificar(id, datos, ctx) {
  const d = { nombre_completo: texto(datos.nombre_completo), correo: texto(datos.correo), rol: datos.rol };
  const errores = validar(d, { nombre_completo: [true, reglas.nombreCompleto], correo: [true, reglas.correo], rol: [true, reglaRol] });
  if (Object.keys(errores).length) throw validacion(errores);
  return enTransaccion(async db => {
    const antes = await repo.obtener(db, id, true);
    if (!antes) throw noEncontrado('El usuario no existe');
    if (await repo.existeCorreo(db, d.correo, id)) throw conflicto('Datos duplicados', { correo: 'El correo ya se encuentra registrado' });
    if (antes.rol === 'GERENCIA' && d.rol !== 'GERENCIA' && antes.estado === 'ACTIVO' && await repo.gerentesActivos(db) <= 1) {
      throw conflicto('Debe existir al menos un usuario de Gerencia activo');
    }
    await repo.actualizar(db, id, { ...d, id_rol: await repo.idRol(db, d.rol) });
    if (antes.rol !== d.rol) await authRepo.cerrarSesionesUsuario(db, id);
    await registrar(db, { ...ctx, modulo: 'Usuarios', tipo: 'GESTION_USUARIO', entidad: 'usuario', idEntidad: id,
      anterior: { nombre_completo: antes.nombre_completo, correo: antes.correo, rol: antes.rol }, nuevo: { accion: 'MODIFICAR', ...d } });
    return publico(await repo.obtener(db, id));
  });
}

// Subflujo C. Desactivar o reactivar
async function cambiarEstado(id, estado, ctx) {
  if (!['ACTIVO', 'INACTIVO'].includes(estado)) throw validacion({ estado: 'Estado no válido' });
  return enTransaccion(async db => {
    const u = await repo.obtener(db, id, true);
    if (!u) throw noEncontrado('El usuario no existe');
    if (estado === 'INACTIVO') {
      if (Number(id) === ctx.idUsuario) throw conflicto('No puede desactivar su propia cuenta');
      if (u.rol === 'GERENCIA' && u.estado === 'ACTIVO' && await repo.gerentesActivos(db) <= 1) throw conflicto('Debe existir al menos un usuario de Gerencia activo');
    }
    await repo.cambiarEstado(db, id, estado);
    if (estado === 'INACTIVO') await authRepo.cerrarSesionesUsuario(db, id);
    await registrar(db, { ...ctx, modulo: 'Usuarios', tipo: 'GESTION_USUARIO', entidad: 'usuario', idEntidad: id,
      anterior: { estado: u.estado }, nuevo: { accion: estado === 'ACTIVO' ? 'REACTIVAR' : 'DESACTIVAR', estado } });
    return publico(await repo.obtener(db, id));
  });
}

// Contraseña temporal de 10 caracteres que cumple PG-03
function generarTemporal() {
  const may = 'ABCDEFGHJKLMNPQRSTUVWXYZ', min = 'abcdefghijkmnpqrstuvwxyz', num = '23456789', todos = may + min + num;
  const pick = s => s[crypto.randomInt(s.length)];
  const c = [pick(may), pick(min), pick(num), ...Array.from({ length: 7 }, () => pick(todos))];
  for (let i = c.length - 1; i > 0; i--) { const j = crypto.randomInt(i + 1); [c[i], c[j]] = [c[j], c[i]]; }
  return c.join('');
}

// Subflujo D. Restablecer contraseña
async function restablecer(id, ctx) {
  const temporal = generarTemporal();
  const hash = await bcrypt.hash(temporal, P.BCRYPT_COSTO);
  const expira = new Date(Date.now() + P.HORAS_CONTRASENA_TEMPORAL * 3600000);
  await enTransaccion(async db => {
    const u = await repo.obtener(db, id, true);
    if (!u) throw noEncontrado('El usuario no existe');
    if (u.estado !== 'ACTIVO') throw conflicto('Reactive la cuenta antes de restablecer la contraseña');
    await repo.fijarTemporal(db, id, hash, expira);
    await authRepo.cerrarSesionesUsuario(db, id);
    await registrar(db, { ...ctx, modulo: 'Usuarios', tipo: 'GESTION_USUARIO', entidad: 'usuario', idEntidad: id, nuevo: { accion: 'RESTABLECER_CONTRASENA', expira } });
  });
  return { contrasenaTemporal: temporal, expira };   // se muestra una sola vez; nunca se guarda en texto plano
}

module.exports = { listar, obtener, crear, modificar, cambiarEstado, restablecer, generarTemporal };
