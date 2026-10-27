const buscarPorUsuarioOCorreo = (db, valor) => db.query(
  `SELECT u.*, r.nombre AS rol FROM usuario u JOIN rol r USING (id_rol)
   WHERE lower(u.nombre_usuario) = lower($1) OR lower(u.correo) = lower($1) FOR UPDATE OF u`, [valor]).then(r => r.rows[0]);

const actualizarIntentos = (db, id, intentos, bloqueadoHasta) => db.query(
  'UPDATE usuario SET intentos_fallidos = $2, bloqueado_hasta = $3 WHERE id_usuario = $1', [id, intentos, bloqueadoHasta]);

const crearSesion = (db, id, tokenHash, ip, dispositivo) => db.query(
  'INSERT INTO sesion (id_usuario, token_hash, direccion_ip, dispositivo) VALUES ($1,$2,$3,$4)',
  [id, tokenHash, ip, dispositivo ? String(dispositivo).slice(0, 150) : null]);

const cerrarSesion = (db, tokenHash) => db.query('UPDATE sesion SET activa = FALSE WHERE token_hash = $1', [tokenHash]);
const cerrarSesionesUsuario = (db, id) => db.query('UPDATE sesion SET activa = FALSE WHERE id_usuario = $1 AND activa', [id]);

const obtenerHash = (db, id) => db.query('SELECT nombre_usuario, contrasena_hash FROM usuario WHERE id_usuario = $1', [id]).then(r => r.rows[0]);
const guardarContrasena = (db, id, hash) => db.query(
  `UPDATE usuario SET contrasena_hash = $2, requiere_cambio_contrasena = FALSE, contrasena_temporal_expira = NULL,
   fecha_actualizacion = now() WHERE id_usuario = $1`, [id, hash]);

module.exports = { buscarPorUsuarioOCorreo, actualizarIntentos, crearSesion, cerrarSesion, cerrarSesionesUsuario, obtenerHash, guardarContrasena };
