// Middleware de seguridad: valida la sesión (PG-02) y el permiso del rol en el servidor (RF-01, RNF-02).
const crypto = require('crypto');
const { pool } = require('../config/db');
const P = require('../config/parametros');
const { noAutenticado, prohibido } = require('./errores');
const { registrarAparte } = require('./auditoria');

const COOKIE = 'rc_sesion';
const hashToken = t => crypto.createHash('sha256').update(t).digest('hex');

async function autenticar(req, _res, next) {
  try {
    const token = req.cookies?.[COOKIE];
    if (!token) throw noAutenticado('Debe iniciar sesión');
    const { rows } = await pool.query(
      `SELECT s.id_sesion, s.fecha_inicio, s.ultima_actividad, u.id_usuario, u.nombre_completo, u.nombre_usuario,
              u.estado, u.requiere_cambio_contrasena, r.nombre AS rol,
              ARRAY(SELECT p.codigo FROM rol_permiso rp JOIN permiso p USING (id_permiso) WHERE rp.id_rol = u.id_rol) AS permisos
       FROM sesion s JOIN usuario u USING (id_usuario) JOIN rol r USING (id_rol)
       WHERE s.token_hash = $1 AND s.activa`, [hashToken(token)]);
    const s = rows[0];
    const ahora = Date.now();
    if (!s || s.estado !== 'ACTIVO'
      || ahora - new Date(s.ultima_actividad).getTime() > P.MINUTOS_INACTIVIDAD * 60000
      || ahora - new Date(s.fecha_inicio).getTime() > P.HORAS_SESION_MAXIMA * 3600000) {
      if (s) await pool.query('UPDATE sesion SET activa = FALSE WHERE id_sesion = $1', [s.id_sesion]);
      throw noAutenticado();
    }
    await pool.query('UPDATE sesion SET ultima_actividad = now() WHERE id_sesion = $1', [s.id_sesion]);
    req.usuario = s;
    // Con contraseña temporal solo se permite cambiarla o cerrar sesión
    if (s.requiere_cambio_contrasena && !['/api/v1/auth/cambiar-contrasena', '/api/v1/auth/logout', '/api/v1/auth/yo'].includes(req.originalUrl.split('?')[0])) {
      throw prohibido('Debe cambiar su contraseña antes de continuar');
    }
    next();
  } catch (e) { next(e); }
}

// Exige al menos uno de los permisos indicados
const permitir = (...permisos) => async (req, _res, next) => {
  if (permisos.some(p => req.usuario.permisos.includes(p))) return next();
  await registrarAparte({ idUsuario: req.usuario.id_usuario, modulo: 'Seguridad', tipo: 'ACCESO_DENEGADO',
    entidad: 'ruta', idEntidad: `${req.method} ${req.originalUrl}`.slice(0, 50), ip: req.ip, dispositivo: req.get('user-agent'), resultado: 'DENEGADO' });
  next(prohibido());
};

module.exports = { autenticar, permitir, hashToken, COOKIE };
